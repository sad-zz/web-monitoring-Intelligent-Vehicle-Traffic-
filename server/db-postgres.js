/**
 * PostgreSQL Database module for cloud deployment
 * Compatible interface with db.js (SQLite)
 */
const { Pool } = require('pg');

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
    throw new Error('DATABASE_URL environment variable is required for PostgreSQL mode');
}

const pool = new Pool({
    connectionString: DATABASE_URL,
    ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

// Test connection
pool.query('SELECT NOW()', (err) => {
    if (err) {
        console.error('[PostgreSQL] Connection error:', err.message);
    } else {
        console.log('[PostgreSQL] Connected successfully');
    }
});

/**
 * Execute SQL statements (for schema creation)
 */
function exec(sql) {
    return pool.query(sql);
}

/**
 * Prepared statement wrapper compatible with better-sqlite3 API
 */
function prepare(sql) {
    return {
        run: async function(...params) {
            const result = await pool.query(sql, params);
            return {
                changes: result.rowCount,
                lastInsertRowid: result.rows[0]?.id || null
            };
        },
        get: async function(...params) {
            const result = await pool.query(sql, params);
            return result.rows[0] || null;
        },
        all: async function(...params) {
            const result = await pool.query(sql, params);
            return result.rows;
        }
    };
}

/**
 * Transaction wrapper (simple version)
 */
function transaction(fn) {
    return async function(data) {
        const client = await pool.acquire();
        try {
            await client.query('BEGIN');
            await fn(data);
            await client.query('COMMIT');
        } catch (err) {
            await client.query('ROLLBACK');
            throw err;
        } finally {
            client.release();
        }
    };
}

/**
 * Pragma wrapper (no-op for PostgreSQL, but kept for compatibility)
 */
function pragma(statement) {
    console.log('[PostgreSQL] pragma() is a no-op:', statement);
    return { changes: 0 };
}

/**
 * Close connection (for graceful shutdown)
 */
async function close() {
    await pool.end();
}

// Initialize PostgreSQL schema
async function initSchema() {
    const schema = `
        -- Users table
        CREATE TABLE IF NOT EXISTS users (
            id SERIAL PRIMARY KEY,
            username TEXT NOT NULL UNIQUE,
            password_hash TEXT NOT NULL,
            role TEXT DEFAULT 'admin',
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );

        -- Devices table
        CREATE TABLE IF NOT EXISTS devices (
            id SERIAL PRIMARY KEY,
            device_code TEXT NOT NULL UNIQUE,
            name TEXT NOT NULL,
            type TEXT NOT NULL DEFAULT 'sensor',
            route TEXT,
            ip TEXT,
            status TEXT NOT NULL DEFAULT 'offline',
            last_seen TIMESTAMP,
            firmware TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );

        -- Traffic data table
        CREATE TABLE IF NOT EXISTS traffic_data (
            id SERIAL PRIMARY KEY,
            device_code TEXT NOT NULL,
            timestamp TIMESTAMP NOT NULL,
            vehicle_class INTEGER DEFAULT 0,
            speed REAL DEFAULT 0,
            direction INTEGER DEFAULT 1,
            lane INTEGER DEFAULT 1,
            raw_payload TEXT,
            received_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );

        -- RMTO queue (simple)
        CREATE TABLE IF NOT EXISTS rmto_queue (
            id SERIAL PRIMARY KEY,
            device_code TEXT NOT NULL,
            period_start TIMESTAMP NOT NULL,
            period_end TIMESTAMP NOT NULL,
            total_vehicles INTEGER DEFAULT 0,
            avg_speed REAL DEFAULT 0,
            sent INTEGER DEFAULT 0,
            sent_at TIMESTAMP,
            rmto_response TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );

        -- RMTO queue (5-class)
        CREATE TABLE IF NOT EXISTS rmto_queue_5class (
            id SERIAL PRIMARY KEY,
            device_code TEXT NOT NULL,
            period_start TIMESTAMP NOT NULL,
            period_end TIMESTAMP NOT NULL,
            class1_count INTEGER DEFAULT 0,
            class2_count INTEGER DEFAULT 0,
            class3_count INTEGER DEFAULT 0,
            class4_count INTEGER DEFAULT 0,
            class5_count INTEGER DEFAULT 0,
            speed1_count INTEGER DEFAULT 0,
            speed2_count INTEGER DEFAULT 0,
            speed3_count INTEGER DEFAULT 0,
            speed4_count INTEGER DEFAULT 0,
            speed5_count INTEGER DEFAULT 0,
            violations INTEGER DEFAULT 0,
            avg_speed REAL DEFAULT 0,
            sent INTEGER DEFAULT 0,
            sent_at TIMESTAMP,
            rmto_response TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );

        -- RMTO queue (8-class)
        CREATE TABLE IF NOT EXISTS rmto_queue_8class (
            id SERIAL PRIMARY KEY,
            device_code TEXT NOT NULL,
            period_start TIMESTAMP NOT NULL,
            period_end TIMESTAMP NOT NULL,
            class1_count INTEGER DEFAULT 0,
            class2_count INTEGER DEFAULT 0,
            class3_count INTEGER DEFAULT 0,
            class4_count INTEGER DEFAULT 0,
            class5_count INTEGER DEFAULT 0,
            class6_count INTEGER DEFAULT 0,
            class7_count INTEGER DEFAULT 0,
            class8_count INTEGER DEFAULT 0,
            speed1_count INTEGER DEFAULT 0,
            speed2_count INTEGER DEFAULT 0,
            speed3_count INTEGER DEFAULT 0,
            speed4_count INTEGER DEFAULT 0,
            speed5_count INTEGER DEFAULT 0,
            speed6_count INTEGER DEFAULT 0,
            speed7_count INTEGER DEFAULT 0,
            speed8_count INTEGER DEFAULT 0,
            violations INTEGER DEFAULT 0,
            avg_speed REAL DEFAULT 0,
            sent INTEGER DEFAULT 0,
            sent_at TIMESTAMP,
            rmto_response TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );

        -- Send log
        CREATE TABLE IF NOT EXISTS send_log (
            id SERIAL PRIMARY KEY,
            method TEXT NOT NULL,
            device_code TEXT NOT NULL,
            request_data TEXT,
            response_data TEXT,
            success INTEGER DEFAULT 0,
            error_message TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );

        -- irawdata table
        CREATE TABLE IF NOT EXISTS irawdata (
            id SERIAL PRIMARY KEY,
            device_code TEXT NOT NULL,
            create_at TIMESTAMP NOT NULL,
            stop TIMESTAMP NOT NULL,
            lane INTEGER DEFAULT 1,
            is_read INTEGER DEFAULT 0,
            a INTEGER DEFAULT 0,
            b INTEGER DEFAULT 0,
            c INTEGER DEFAULT 0,
            d INTEGER DEFAULT 0,
            e INTEGER DEFAULT 0,
            x INTEGER DEFAULT 0,
            sa INTEGER DEFAULT 0,
            sb INTEGER DEFAULT 0,
            sc INTEGER DEFAULT 0,
            sd INTEGER DEFAULT 0,
            se INTEGER DEFAULT 0,
            sx INTEGER DEFAULT 0,
            sao INTEGER DEFAULT 0,
            sbo INTEGER DEFAULT 0,
            sco INTEGER DEFAULT 0,
            sdo INTEGER DEFAULT 0,
            seo INTEGER DEFAULT 0,
            sxo INTEGER DEFAULT 0,
            overtaking INTEGER DEFAULT 0,
            tooclose INTEGER DEFAULT 0,
            received_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );

        -- Mehvar (routes) table
        CREATE TABLE IF NOT EXISTS mehvar (
            code INTEGER PRIMARY KEY,
            name TEXT NOT NULL,
            send_enable INTEGER DEFAULT 1,
            repair INTEGER DEFAULT 0,
            ostan TEXT
        );

        -- Indexes
        CREATE INDEX IF NOT EXISTS idx_traffic_device ON traffic_data(device_code);
        CREATE INDEX IF NOT EXISTS idx_traffic_time ON traffic_data(timestamp);
        CREATE INDEX IF NOT EXISTS idx_rmto_unsent ON rmto_queue(sent, device_code);
        CREATE INDEX IF NOT EXISTS idx_rmto5_unsent ON rmto_queue_5class(sent, device_code);
        CREATE INDEX IF NOT EXISTS idx_rmto8_unsent ON rmto_queue_8class(sent, device_code);
        CREATE INDEX IF NOT EXISTS idx_irawdata_device ON irawdata(device_code);
        CREATE INDEX IF NOT EXISTS idx_irawdata_time ON irawdata(create_at);
        CREATE INDEX IF NOT EXISTS idx_irawdata_read ON irawdata(is_read);
    `;

    try {
        await pool.query(schema);
        console.log('[PostgreSQL] Schema initialized');
    } catch (err) {
        console.error('[PostgreSQL] Schema initialization error:', err.message);
        throw err;
    }
}

// Initialize schema on startup
initSchema().catch(console.error);

module.exports = {
    exec,
    prepare,
    transaction,
    pragma,
    close,
    pool,
    // Synchronous wrapper for compatibility (CAUTION: Blocks event loop!)
    prepareSync: prepare
};
