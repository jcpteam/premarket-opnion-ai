import { Request, Response, NextFunction } from 'express';
import { logger } from '../config/logger';

/**
 * Security Middleware Collection
 * Provides various security-related middleware functions
 * 
 * Requirements: 8.5
 * - Security headers and protection measures
 * - Request validation and sanitization
 * - Attack prevention and monitoring
 */

/**
 * Comprehensive security headers middleware
 */
export const securityHeaders = (_req: Request, res: Response, next: NextFunction) => {
  // Prevent MIME type sniffing
  res.setHeader('X-Content-Type-Options', 'nosniff');
  
  // Prevent clickjacking
  res.setHeader('X-Frame-Options', 'DENY');
  
  // Enable XSS protection
  res.setHeader('X-XSS-Protection', '1; mode=block');
  
  // Control referrer information
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  
  // Restrict permissions
  res.setHeader('Permissions-Policy', 'geolocation=(), microphone=(), camera=(), payment=()');
  
  // Prevent DNS prefetching
  res.setHeader('X-DNS-Prefetch-Control', 'off');
  
  // Remove server information
  res.removeHeader('X-Powered-By');
  
  // Content Security Policy for API responses
  res.setHeader('Content-Security-Policy', "default-src 'none'; frame-ancestors 'none';");
  
  next();
};

/**
 * Request size limiter middleware
 */
export const requestSizeLimiter = (maxSize: string = '10mb') => {
  return (req: Request, res: Response, next: NextFunction) => {
    const contentLength = req.get('Content-Length');
    
    if (contentLength) {
      const sizeInBytes = parseInt(contentLength);
      const maxSizeInBytes = parseSize(maxSize);
      
      if (sizeInBytes > maxSizeInBytes) {
        logger.warn('Request size limit exceeded', {
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
    
    next();
  };
};

/**
 * Suspicious activity detector middleware
 */
export const suspiciousActivityDetector = (req: Request, res: Response, next: NextFunction) => {
  const suspiciousPatterns = [
    // SQL injection patterns
    /(\b(union|select|insert|update|delete|drop|create|alter|exec|execute)\b)/i,
    // XSS patterns
    /(<script|javascript:|vbscript:|onload=|onerror=)/i,
    // Path traversal patterns
    /(\.\.\/|\.\.\\|%2e%2e%2f|%2e%2e%5c)/i,
    // Command injection patterns
    /(\b(cat|ls|pwd|whoami|id|uname|wget|curl|nc|netcat)\b)/i
  ];
  
  const checkString = (str: string): boolean => {
    return suspiciousPatterns.some(pattern => pattern.test(str));
  };
  
  const checkObject = (obj: any): boolean => {
    if (typeof obj === 'string') {
      return checkString(obj);
    }
    
    if (typeof obj === 'object' && obj !== null) {
      return Object.values(obj).some(value => checkObject(value));
    }
    
    return false;
  };
  
  // Check URL, query parameters, and body
  const suspicious = 
    checkString(req.url) ||
    checkObject(req.query) ||
    checkObject(req.body);
  
  if (suspicious) {
    logger.warn('Suspicious activity detected', {
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

/**
 * IP whitelist/blacklist middleware
 */
export const ipFilter = (options: {
  whitelist?: string[];
  blacklist?: string[];
}) => {
  return (req: Request, res: Response, next: NextFunction) => {
    const clientIP = req.ip || 'unknown';
    
    // Check blacklist first
    if (options.blacklist && options.blacklist.includes(clientIP)) {
      logger.warn('Blocked IP attempted access', {
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
    
    // Check whitelist if provided
    if (options.whitelist && !options.whitelist.includes(clientIP)) {
      logger.warn('Non-whitelisted IP attempted access', {
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

/**
 * Request timeout middleware
 */
export const requestTimeout = (timeoutMs: number = 30000) => {
  return (req: Request, res: Response, next: NextFunction) => {
    const timeout = setTimeout(() => {
      if (!res.headersSent) {
        logger.warn('Request timeout', {
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
    
    // Clear timeout when response is finished
    res.on('finish', () => {
      clearTimeout(timeout);
    });
    
    next();
  };
};

/**
 * User agent validation middleware
 */
export const validateUserAgent = (req: Request, res: Response, next: NextFunction) => {
  const userAgent = req.get('User-Agent');
  
  if (!userAgent) {
    logger.warn('Request without User-Agent header', {
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
  
  // Check for suspicious user agents
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
    logger.warn('Suspicious User-Agent detected', {
      ip: req.ip,
      path: req.path,
      method: req.method,
      userAgent,
      requestId: req.headers['x-request-id']
    });
    
    // Don't block, just log for now
    // Could implement stricter blocking based on requirements
  }
  
  next();
};

/**
 * Utility function to parse size strings (e.g., "10mb", "1gb")
 */
function parseSize(size: string): number {
  const units: { [key: string]: number } = {
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

export {
  parseSize
};