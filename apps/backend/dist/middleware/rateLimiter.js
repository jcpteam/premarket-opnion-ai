"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.rateLimiter = exports.adminRateLimiter = exports.marketCreationRateLimiter = exports.tradingRateLimiter = exports.strictRateLimiter = exports.generalRateLimiter = void 0;
const express_rate_limit_1 = __importDefault(require("express-rate-limit"));
exports.generalRateLimiter = (0, express_rate_limit_1.default)({
    windowMs: 15 * 60 * 1000,
    max: 1000,
    message: {
        error: {
            code: 'RATE_LIMIT_EXCEEDED',
            message: 'Too many requests from this IP, please try again later',
            timestamp: new Date().toISOString()
        }
    },
    standardHeaders: true,
    legacyHeaders: false,
    keyGenerator: (req) => {
        return req.userId || req.ip || 'unknown';
    }
});
exports.strictRateLimiter = (0, express_rate_limit_1.default)({
    windowMs: 15 * 60 * 1000,
    max: 10,
    message: {
        error: {
            code: 'RATE_LIMIT_EXCEEDED',
            message: 'Too many sensitive operation attempts, please try again later',
            timestamp: new Date().toISOString()
        }
    },
    standardHeaders: true,
    legacyHeaders: false,
    keyGenerator: (req) => {
        const userId = req.userId || 'anonymous';
        return `${req.ip || 'unknown'}:${userId}`;
    }
});
exports.tradingRateLimiter = (0, express_rate_limit_1.default)({
    windowMs: 1 * 60 * 1000,
    max: 60,
    message: {
        error: {
            code: 'TRADING_RATE_LIMIT_EXCEEDED',
            message: 'Too many trading operations, please slow down',
            timestamp: new Date().toISOString()
        }
    },
    standardHeaders: true,
    legacyHeaders: false,
    keyGenerator: (req) => {
        return req.userId || req.ip || 'unknown';
    }
});
exports.marketCreationRateLimiter = (0, express_rate_limit_1.default)({
    windowMs: 60 * 60 * 1000,
    max: 5,
    message: {
        error: {
            code: 'MARKET_CREATION_RATE_LIMIT_EXCEEDED',
            message: 'Too many market creation attempts, please try again later',
            timestamp: new Date().toISOString()
        }
    },
    standardHeaders: true,
    legacyHeaders: false,
    keyGenerator: (req) => {
        return req.userId || req.ip || 'unknown';
    }
});
exports.adminRateLimiter = (0, express_rate_limit_1.default)({
    windowMs: 5 * 60 * 1000,
    max: 100,
    message: {
        error: {
            code: 'ADMIN_RATE_LIMIT_EXCEEDED',
            message: 'Too many admin operations, please slow down',
            timestamp: new Date().toISOString()
        }
    },
    standardHeaders: true,
    legacyHeaders: false,
    keyGenerator: (req) => {
        return req.userId || req.ip || 'unknown';
    }
});
exports.rateLimiter = exports.generalRateLimiter;
//# sourceMappingURL=rateLimiter.js.map