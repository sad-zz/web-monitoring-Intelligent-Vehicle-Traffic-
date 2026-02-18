/**
 * Backup Handler - Import/Export SQL backups (.sql, .sql.gz, .db)
 * Supports migration from MySQL/PostgreSQL dumps to SQLite/PostgreSQL
 */
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');
const { spawn } = require('child_process');
const db = require('./db');

/**
 * Import SQL file (.sql or .sql.gz) into database
 * @param {string} filePath - Path to SQL file
 * @param {function} progressCallback - Called with progress updates
 * @returns {Promise} - Resolves when import is complete
 */
async function importSqlFile(filePath, progressCallback) {
    return new Promise((resolve, reject) => {
        const isGzipped = filePath.endsWith('.gz');
        const dbType = process.env.DATABASE_TYPE || (process.env.DATABASE_URL ? 'postgresql' : 'sqlite');
        
        progressCallback({ status: 'starting', message: 'شروع import بکاپ...' });

        // Read file (decompress if needed)
        let sqlContent = '';
        const readStream = fs.createReadStream(filePath);
        
        const processStream = isGzipped 
            ? readStream.pipe(zlib.createGunzip())
            : readStream;

        processStream.on('data', (chunk) => {
            sqlContent += chunk.toString();
        });

        processStream.on('end', async () => {
            try {
                progressCallback({ status: 'processing', message: 'پردازش فایل SQL...' });
                
                // Parse and convert SQL statements
                const statements = parseSqlStatements(sqlContent);
                progressCallback({ 
                    status: 'importing', 
                    message: `در حال import ${statements.length} دستور SQL...`,
                    total: statements.length 
                });

                // Execute statements
                let imported = 0;
                let errors = 0;

                for (let i = 0; i < statements.length; i++) {
                    try {
                        const stmt = statements[i];
                        
                        // Convert MySQL/PostgreSQL syntax to target DB
                        const convertedStmt = convertSqlSyntax(stmt, dbType);
                        
                        if (convertedStmt && convertedStmt.trim()) {
                            if (dbType === 'postgresql') {
                                await db.pool.query(convertedStmt);
                            } else {
                                db.exec(convertedStmt);
                            }
                            imported++;
                        }
                        
                        // Report progress every 100 statements
                        if (i % 100 === 0) {
                            progressCallback({
                                status: 'importing',
                                message: `Import شده: ${imported} از ${statements.length}`,
                                imported,
                                total: statements.length,
                                progress: Math.round((i / statements.length) * 100)
                            });
                        }
                    } catch (err) {
                        errors++;
                        console.error('[Backup] Error executing statement:', err.message);
                        // Continue with next statement
                    }
                }

                progressCallback({
                    status: 'complete',
                    message: `Import کامل شد: ${imported} رکورد، ${errors} خطا`,
                    imported,
                    errors
                });

                resolve({ imported, errors });
            } catch (err) {
                progressCallback({ status: 'error', message: err.message });
                reject(err);
            }
        });

        processStream.on('error', (err) => {
            progressCallback({ status: 'error', message: err.message });
            reject(err);
        });
    });
}

/**
 * Parse SQL file into individual statements
 */
function parseSqlStatements(sqlContent) {
    // Remove comments
    sqlContent = sqlContent
        .replace(/--[^\n]*/g, '')  // Single-line comments
        .replace(/\/\*[\s\S]*?\*\//g, '');  // Multi-line comments

    // Split by semicolon (simple parser)
    const statements = sqlContent
        .split(';')
        .map(s => s.trim())
        .filter(s => s.length > 0 && !s.match(/^(USE|SET|LOCK|UNLOCK)/i));

    return statements;
}

/**
 * Convert SQL syntax from MySQL/PostgreSQL to target database
 */
function convertSqlSyntax(statement, targetDb) {
    if (!statement || !statement.trim()) return '';

    let converted = statement;

    // Skip certain statements
    if (converted.match(/^(SET|SHOW|LOCK|UNLOCK|BEGIN|COMMIT|ROLLBACK)/i)) {
        return '';
    }

    if (targetDb === 'sqlite') {
        // Convert PostgreSQL/MySQL to SQLite
        converted = converted
            // AUTO_INCREMENT -> AUTOINCREMENT
            .replace(/AUTO_INCREMENT/gi, 'AUTOINCREMENT')
            // SERIAL -> INTEGER PRIMARY KEY AUTOINCREMENT
            .replace(/\bSERIAL\b/gi, 'INTEGER PRIMARY KEY AUTOINCREMENT')
            // TIMESTAMP -> TEXT
            .replace(/\bTIMESTAMP\b/gi, 'TEXT')
            // DATETIME -> TEXT
            .replace(/\bDATETIME\b/gi, 'TEXT')
            // CURRENT_TIMESTAMP -> datetime('now')
            .replace(/CURRENT_TIMESTAMP/gi, "datetime('now')")
            // Remove IF EXISTS from DROP
            .replace(/DROP TABLE IF EXISTS/gi, 'DROP TABLE IF EXISTS')
            // INT(11) -> INTEGER
            .replace(/INT\(\d+\)/gi, 'INTEGER')
            // VARCHAR(n) -> TEXT
            .replace(/VARCHAR\(\d+\)/gi, 'TEXT')
            // TINYINT -> INTEGER
            .replace(/\bTINYINT\b/gi, 'INTEGER')
            // DOUBLE -> REAL
            .replace(/\bDOUBLE\b/gi, 'REAL')
            // Remove ENGINE, CHARSET, etc.
            .replace(/ENGINE\s*=\s*\w+/gi, '')
            .replace(/DEFAULT CHARSET\s*=\s*\w+/gi, '')
            .replace(/COLLATE\s*=\s*\w+/gi, '')
            .replace(/CHARACTER SET\s+\w+/gi, '');
    } else if (targetDb === 'postgresql') {
        // Convert MySQL to PostgreSQL
        converted = converted
            // AUTO_INCREMENT -> SERIAL
            .replace(/AUTO_INCREMENT/gi, 'SERIAL')
            // TINYINT -> INTEGER
            .replace(/\bTINYINT\b/gi, 'INTEGER')
            // DATETIME -> TIMESTAMP
            .replace(/\bDATETIME\b/gi, 'TIMESTAMP')
            // INT(11) -> INTEGER
            .replace(/INT\(\d+\)/gi, 'INTEGER')
            // VARCHAR(n) is ok in PostgreSQL
            // Remove backticks
            .replace(/`/g, '"')
            // Remove ENGINE, CHARSET
            .replace(/ENGINE\s*=\s*\w+/gi, '')
            .replace(/DEFAULT CHARSET\s*=\s*\w+/gi, '')
            .replace(/COLLATE\s*=\s*\w+/gi, '')
            .replace(/CHARACTER SET\s+\w+/gi, '');
    }

    return converted.trim();
}

/**
 * Export database to SQL file
 * @param {string} outputPath - Path to save SQL file
 * @returns {Promise}
 */
async function exportToSql(outputPath) {
    const dbType = process.env.DATABASE_TYPE || (process.env.DATABASE_URL ? 'postgresql' : 'sqlite');
    
    if (dbType === 'sqlite') {
        // Use sqlite3 command-line tool to dump
        const dbPath = path.join(__dirname, 'data.db');
        return new Promise((resolve, reject) => {
            const dumpProcess = spawn('sqlite3', [dbPath, '.dump']);
            const writeStream = fs.createWriteStream(outputPath);
            
            dumpProcess.stdout.pipe(writeStream);
            dumpProcess.on('error', reject);
            dumpProcess.on('close', (code) => {
                if (code === 0) resolve();
                else reject(new Error('sqlite3 dump failed'));
            });
        });
    } else {
        // PostgreSQL pg_dump
        const dbUrl = new URL(process.env.DATABASE_URL);
        return new Promise((resolve, reject) => {
            const env = {
                PGPASSWORD: dbUrl.password
            };
            const dumpProcess = spawn('pg_dump', [
                '-h', dbUrl.hostname,
                '-p', dbUrl.port || '5432',
                '-U', dbUrl.username,
                '-d', dbUrl.pathname.slice(1),
                '-f', outputPath
            ], { env });
            
            dumpProcess.on('error', reject);
            dumpProcess.on('close', (code) => {
                if (code === 0) resolve();
                else reject(new Error('pg_dump failed'));
            });
        });
    }
}

/**
 * List available backup files in uploads directory
 */
function listBackupFiles(uploadsDir) {
    if (!fs.existsSync(uploadsDir)) {
        fs.mkdirSync(uploadsDir, { recursive: true });
        return [];
    }

    return fs.readdirSync(uploadsDir)
        .filter(f => f.endsWith('.db') || f.endsWith('.sql') || f.endsWith('.gz'))
        .map(f => {
            const stat = fs.statSync(path.join(uploadsDir, f));
            return {
                name: f,
                size: stat.size,
                sizeFormatted: formatBytes(stat.size),
                date: stat.mtime.toISOString(),
                type: f.endsWith('.gz') ? 'sql.gz' : (f.endsWith('.sql') ? 'sql' : 'db')
            };
        })
        .sort((a, b) => new Date(b.date) - new Date(a.date));
}

function formatBytes(bytes) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
}

module.exports = {
    importSqlFile,
    exportToSql,
    listBackupFiles,
    parseSqlStatements,
    convertSqlSyntax
};
