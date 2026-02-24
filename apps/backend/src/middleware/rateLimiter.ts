import rateLimit from 'express-rate-limit';
import { Request } from 'express';

/**
 * Enhanced Rate Limiting Middleware
 * Provides different rate limits for different types of requests
 * 
 * Requirements: 8.5
 * - Rate limiting for security and performance
 * - Different limits for different endpoint types
 * - IP and user-based rate limiting
 */

// General API rate limiter
export const generalRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 1000, // Limit each IP to 1000 requests per windowMs
  message: {
    error: {
      code: 'RATE_LIMIT_EXCEEDED',
      message: 'Too many requests from this IP, please try again later',
      timestamp: new Date().toISOString()
    }
  },
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req: Request) => {
    // Use user ID if authenticated, otherwise IP
    return req.userId || req.ip || 'unknown';
  }
});

// Strict rate limiter for sensitive operations
export const strictRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10, // Very limited for sensitive operations
  message: {
    error: {
      code: 'RATE_LIMIT_EXCEEDED',
      message: 'Too many sensitive operation attempts, please try again later',
      timestamp: new Date().toISOString()
    }
  },
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req: Request) => {
    // Combine IP and user ID for extra security
    const userId = req.userId || 'anonymous';
    return `${req.ip || 'unknown'}:${userId}`;
  }
});

// Trading-specific rate limiter
export const tradingRateLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute
  max: 60, // 60 trading operations per minute
  message: {
    error: {
      code: 'TRADING_RATE_LIMIT_EXCEEDED',
      message: 'Too many trading operations, please slow down',
      timestamp: new Date().toISOString()
    }
  },
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req: Request) => {
    return req.userId || req.ip || 'unknown';
  }
});

// Market creation rate limiter
export const marketCreationRateLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 5, // 5 markets per hour per user
  message: {
    error: {
      code: 'MARKET_CREATION_RATE_LIMIT_EXCEEDED',
      message: 'Too many market creation attempts, please try again later',
      timestamp: new Date().toISOString()
    }
  },
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req: Request) => {
    return req.userId || req.ip || 'unknown';
  }
});

// Admin operations rate limiter
export const adminRateLimiter = rateLimit({
  windowMs: 5 * 60 * 1000, // 5 minutes
  max: 100, // 100 admin operations per 5 minutes
  message: {
    error: {
      code: 'ADMIN_RATE_LIMIT_EXCEEDED',
      message: 'Too many admin operations, please slow down',
      timestamp: new Date().toISOString()
    }
  },
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req: Request) => {
    return req.userId || req.ip || 'unknown';
  }
});

// Legacy rate limiter for backward compatibility
export const rateLimiter = generalRateLimiter;