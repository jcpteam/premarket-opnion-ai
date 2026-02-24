"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.validateUserAgent = exports.requestTimeout = exports.ipFilter = exports.suspiciousActivityDetector = exports.requestSizeLimiter = exports.securityHeaders = void 0;
exports.parseSize = parseSize;
const logger_1 = require("../config/logger");
const securityHeaders = (_req, res, next) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('X-XSS-Protection', '1; mode=block');
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    res.setHeader('Permissions-Policy', 'geolocation=(), microphone=(), camera=(), payment=()');
    res.setHeader('X-DNS-Prefetch-Control', 'off');
    res.removeHeader('X-Powered-By');
    res.setHeader('Content-Security-Policy', "default-src 'none'; frame-ancestors 'none';");
    next();
};
exports.securityHeaders = securityHeaders;
const requestSizeLimiter = (maxSize = '10mb') => {
    return (req, res, next) => {
        const contentLength = req.get('Content-Length');
        if (contentLength) {
            const sizeInBytes = parseInt(contentLength);
            const maxSizeInBytes = parseSize(maxSize);
            if (sizeInBytes > maxSizeInBytes) {
                logger_1.logger.warn('Request size limit exceeded', {
                    contentLength: sizeInBytes,
                    maxSize: maxSizeInBytes,
                    ip: req.ip,
                    path: req.path,
                    method: req.method,
                    requestId: req.headers['x-request-id']
                });
                return res.status(413).json({
                    error: {
                        code: 'REQUEST_TOO_LARGE',
                        message: `Request size exceeds limit of ${maxSize}`,
                        timestamp: new Date().toISOString(),
                        requestId: req.headers['x-request-id'] || 'unknown'
                    }
                });
            }
        }
        next();
    };
};
exports.requestSizeLimiter = requestSizeLimiter;
const suspiciousActivityDetector = (req, res, next) => {
    const suspiciousPatterns = [
        /(\b(union|select|insert|update|delete|drop|create|alter|exec|execute)\b)/i,
        /(<script|javascript:|vbscript:|onload=|onerror=)/i,
        /(\.\.\/|\.\.\\|%2e%2e%2f|%2e%2e%5c)/i,
        /(\b(cat|ls|pwd|whoami|id|uname|wget|curl|nc|netcat)\b)/i
    ];
    const checkString = (str) => {
        return suspiciousPatterns.some(pattern => pattern.test(str));
    };
    const checkObject = (obj) => {
        if (typeof obj === 'string') {
            return checkString(obj);
        }
        if (typeof obj === 'object' && obj !== null) {
            return Object.values(obj).some(value => checkObject(value));
        }
        return false;
    };
    const suspicious = checkString(req.url) ||
        checkObject(req.query) ||
        checkObject(req.body);
    if (suspicious) {
        logger_1.logger.warn('Suspicious activity detected', {
            ip: req.ip,
            path: req.path,
            method: req.method,
            userAgent: req.get('User-Agent'),
            query: req.query,
            body: req.body,
            userId: req.userId,
            requestId: req.headers['x-request-id']
        });
        return res.status(400).json({
            error: {
                code: 'SUSPICIOUS_REQUEST',
                message: 'Request contains potentially malicious content',
                timestamp: new Date().toISOString(),
                requestId: req.headers['x-request-id'] || 'unknown'
            }
        });
    }
    next();
};
exports.suspiciousActivityDetector = suspiciousActivityDetector;
const ipFilter = (options) => {
    return (req, res, next) => {
        const clientIP = req.ip || 'unknown';
        if (options.blacklist && options.blacklist.includes(clientIP)) {
            logger_1.logger.warn('Blocked IP attempted access', {
                ip: clientIP,
                path: req.path,
                method: req.method,
                userAgent: req.get('User-Agent'),
                requestId: req.headers['x-request-id']
            });
            return res.status(403).json({
                error: {
                    code: 'IP_BLOCKED',
                    message: 'Access denied from this IP address',
                    timestamp: new Date().toISOString(),
                    requestId: req.headers['x-request-id'] || 'unknown'
                }
            });
        }
        if (options.whitelist && !options.whitelist.includes(clientIP)) {
            logger_1.logger.warn('Non-whitelisted IP attempted access', {
                ip: clientIP,
                path: req.path,
                method: req.method,
                userAgent: req.get('User-Agent'),
                requestId: req.headers['x-request-id']
            });
            return res.status(403).json({
                error: {
                    code: 'IP_NOT_WHITELISTED',
                    message: 'Access denied: IP not in whitelist',
                    timestamp: new Date().toISOString(),
                    requestId: req.headers['x-request-id'] || 'unknown'
                }
            });
        }
        next();
    };
};
exports.ipFilter = ipFilter;
const requestTimeout = (timeoutMs = 30000) => {
    return (req, res, next) => {
        const timeout = setTimeout(() => {
            if (!res.headersSent) {
                logger_1.logger.warn('Request timeout', {
                    ip: req.ip,
                    path: req.path,
                    method: req.method,
                    timeout: timeoutMs,
                    userId: req.userId,
                    requestId: req.headers['x-request-id']
                });
                res.status(408).json({
                    error: {
                        code: 'REQUEST_TIMEOUT',
                        message: 'Request timeout',
                        timestamp: new Date().toISOString(),
                        requestId: req.headers['x-request-id'] || 'unknown'
                    }
                });
            }
        }, timeoutMs);
        res.on('finish', () => {
            clearTimeout(timeout);
        });
        next();
    };
};
exports.requestTimeout = requestTimeout;
const validateUserAgent = (req, res, next) => {
    const userAgent = req.get('User-Agent');
    if (!userAgent) {
        logger_1.logger.warn('Request without User-Agent header', {
            ip: req.ip,
            path: req.path,
            method: req.method,
            requestId: req.headers['x-request-id']
        });
        return res.status(400).json({
            error: {
                code: 'MISSING_USER_AGENT',
                message: 'User-Agent header is required',
                timestamp: new Date().toISOString(),
                requestId: req.headers['x-request-id'] || 'unknown'
            }
        });
    }
    const suspiciousPatterns = [
        /bot/i,
        /crawler/i,
        /spider/i,
        /scraper/i,
        /curl/i,
        /wget/i,
        /python/i,
        /java/i
    ];
    const isSuspicious = suspiciousPatterns.some(pattern => pattern.test(userAgent));
    if (isSuspicious) {
        logger_1.logger.warn('Suspicious User-Agent detected', {
            ip: req.ip,
            path: req.path,
            method: req.method,
            userAgent,
            requestId: req.headers['x-request-id']
        });
    }
    next();
};
exports.validateUserAgent = validateUserAgent;
function parseSize(size) {
    const units = {
        b: 1,
        kb: 1024,
        mb: 1024 * 1024,
        gb: 1024 * 1024 * 1024
    };
    const match = size.toLowerCase().match(/^(\d+(?:\.\d+)?)\s*([a-z]+)$/);
    if (!match) {
        return parseInt(size) || 0;
    }
    const [, value, unit] = match;
    const multiplier = units[unit] || 1;
    return Math.floor(parseFloat(value) * multiplier);
}
//# sourceMappingURL=security.middleware.js.map