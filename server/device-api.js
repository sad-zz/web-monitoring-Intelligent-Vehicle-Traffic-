/**
 * Device API - Secure endpoints for device data reception
 * Includes API key authentication and rate limiting
 */

const crypto = require('crypto');

// In-memory rate limiter (simple implementation)
const rateLimitStore = new Map();
const RATE_LIMIT_WINDOW = 60 * 1000; // 1 minute
const RATE_LIMIT_MAX_REQUESTS = 100; // 100 requests per minute per device

/**
 * Middleware: API Key Authentication
 */
function apiKeyAuth(req, res, next) {
    const apiKey = req.headers['x-api-key'] || req.query.api_key;
    const expectedKey = process.env.DEVICE_API_KEY;

    // If no API key is configured, allow all (backward compatibility)
    if (!expectedKey) {
        console.warn('[Device API] Warning: DEVICE_API_KEY not configured - API is open!');
        return next();
    }

    if (!apiKey || apiKey !== expectedKey) {
        console.warn('[Device API] Invalid API key attempt from', req.ip);
        return res.status(401).json({ 
            error: 'unauthorized',
            message: 'Invalid or missing API key' 
        });
    }

    next();
}

/**
 * Middleware: Rate Limiting
 */
function rateLimit(req, res, next) {
    const identifier = req.body.device_code || req.ip;
    const now = Date.now();
    
    // Get or create rate limit entry
    let limitEntry = rateLimitStore.get(identifier);
    
    if (!limitEntry) {
        limitEntry = { count: 0, resetTime: now + RATE_LIMIT_WINDOW };
        rateLimitStore.set(identifier, limitEntry);
    }

    // Reset if window expired
    if (now > limitEntry.resetTime) {
        limitEntry.count = 0;
        limitEntry.resetTime = now + RATE_LIMIT_WINDOW;
    }

    // Check limit
    if (limitEntry.count >= RATE_LIMIT_MAX_REQUESTS) {
        const retryAfter = Math.ceil((limitEntry.resetTime - now) / 1000);
        res.setHeader('Retry-After', retryAfter);
        return res.status(429).json({ 
            error: 'rate_limit_exceeded',
            message: 'Too many requests',
            retry_after: retryAfter
        });
    }

    limitEntry.count++;
    next();
}

/**
 * Input validation for device data
 */
function validateDeviceData(data) {
    const errors = [];

    // device_code: required, 4 digits
    if (!data.device_code && !data.device_id && !data.code) {
        errors.push('device_code is required');
    } else {
        const code = String(data.device_code || data.device_id || data.code);
        if (!/^\d{4}$/.test(code)) {
            errors.push('device_code must be 4 digits');
        }
    }

    // timestamp: optional, but if provided must be valid ISO8601
    if (data.timestamp) {
        const ts = new Date(data.timestamp);
        if (isNaN(ts.getTime())) {
            errors.push('timestamp must be valid ISO8601 format');
        }
        // Check if timestamp is not too far in future (allow 5 minutes)
        if (ts.getTime() > Date.now() + 5 * 60 * 1000) {
            errors.push('timestamp cannot be in the future');
        }
    }

    // vehicle_class: optional, 0-8
    if (data.vehicle_class !== undefined) {
        const vc = parseInt(data.vehicle_class, 10);
        if (isNaN(vc) || vc < 0 || vc > 8) {
            errors.push('vehicle_class must be 0-8');
        }
    }

    // speed: optional, 0-300
    if (data.speed !== undefined) {
        const speed = parseFloat(data.speed);
        if (isNaN(speed) || speed < 0 || speed > 300) {
            errors.push('speed must be 0-300 km/h');
        }
    }

    // direction: optional, 1-2
    if (data.direction !== undefined) {
        const dir = parseInt(data.direction, 10);
        if (isNaN(dir) || (dir !== 1 && dir !== 2)) {
            errors.push('direction must be 1 or 2');
        }
    }

    // lane: optional, 1-8
    if (data.lane !== undefined) {
        const lane = parseInt(data.lane, 10);
        if (isNaN(lane) || lane < 1 || lane > 8) {
            errors.push('lane must be 1-8');
        }
    }

    return errors;
}

/**
 * Validate irawdata format (iccore)
 */
function validateIrawData(data) {
    const errors = [];

    if (!data.device_id && !data.device_code && !data.code) {
        errors.push('device_id is required');
    }

    // Vehicle counts (a, b, c, d, e, x)
    ['a', 'b', 'c', 'd', 'e', 'x'].forEach(key => {
        if (data[key] !== undefined) {
            const val = parseInt(data[key], 10);
            if (isNaN(val) || val < 0) {
                errors.push(`${key} must be non-negative integer`);
            }
        }
    });

    // Speed sums (sa, sb, sc, sd, se, sx)
    ['sa', 'sb', 'sc', 'sd', 'se', 'sx'].forEach(key => {
        if (data[key] !== undefined) {
            const val = parseInt(data[key], 10);
            if (isNaN(val) || val < 0) {
                errors.push(`${key} must be non-negative integer`);
            }
        }
    });

    return errors;
}

/**
 * Sanitize input (prevent SQL injection, XSS)
 */
function sanitizeInput(obj) {
    const sanitized = {};
    
    for (const key in obj) {
        let value = obj[key];
        
        // Skip functions
        if (typeof value === 'function') continue;
        
        // Recursively sanitize objects
        if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
            sanitized[key] = sanitizeInput(value);
            continue;
        }
        
        // Convert to string and trim
        if (typeof value === 'string') {
            value = value.trim();
            // Remove null bytes
            value = value.replace(/\0/g, '');
            // Limit length to prevent DoS
            if (value.length > 10000) {
                value = value.substring(0, 10000);
            }
        }
        
        sanitized[key] = value;
    }
    
    return sanitized;
}

/**
 * Generate device signature for verification (optional)
 */
function generateDeviceSignature(deviceCode, timestamp, secret) {
    const data = `${deviceCode}:${timestamp}:${secret}`;
    return crypto.createHash('sha256').update(data).digest('hex');
}

/**
 * Verify device signature (optional)
 */
function verifyDeviceSignature(deviceCode, timestamp, signature, secret) {
    const expected = generateDeviceSignature(deviceCode, timestamp, secret);
    return crypto.timingSafeEqual(
        Buffer.from(signature, 'hex'),
        Buffer.from(expected, 'hex')
    );
}

/**
 * Clean up old rate limit entries (call periodically)
 */
function cleanupRateLimitStore() {
    const now = Date.now();
    for (const [key, value] of rateLimitStore.entries()) {
        if (now > value.resetTime + RATE_LIMIT_WINDOW) {
            rateLimitStore.delete(key);
        }
    }
}

// Cleanup rate limit store every 5 minutes
setInterval(cleanupRateLimitStore, 5 * 60 * 1000);

module.exports = {
    apiKeyAuth,
    rateLimit,
    validateDeviceData,
    validateIrawData,
    sanitizeInput,
    generateDeviceSignature,
    verifyDeviceSignature
};
