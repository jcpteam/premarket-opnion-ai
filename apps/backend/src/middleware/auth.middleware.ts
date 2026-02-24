import { Request, Response, NextFunction } from 'express';
import rateLimit from 'express-rate-limit';
import { AuthService } from '../services/auth.service';
import { logger } from '../config/logger';
import { authConfig } from '../config/auth.config';

// Extend Express Request interface to include user
declare global {
  namespace Express {
    interface Request {
      user?: any;
      userId?: string;
      walletAddress?: string;
      isAdmin?: boolean;
      isVerified?: boolean;
      userRoles?: UserRole[];
    }
  }
}

// Define user roles for RBAC
export enum UserRole {
  USER = 'user',
  ADMIN = 'admin',
  MODERATOR = 'moderator',
  MARKET_CREATOR = 'market_creator',
  LIQUIDITY_PROVIDER = 'liquidity_provider'
}

// Define permissions for different actions
export enum Permission {
  // Market permissions
  CREATE_MARKET = 'create_market',
  EDIT_MARKET = 'edit_market',
  DELETE_MARKET = 'delete_market',
  RESOLVE_MARKET = 'resolve_market',
  
  // Trading permissions
  PLACE_ORDER = 'place_order',
  CANCEL_ORDER = 'cancel_order',
  PROVIDE_LIQUIDITY = 'provide_liquidity',
  
  // Admin permissions
  MANAGE_USERS = 'manage_users',
  VIEW_ADMIN_DASHBOARD = 'view_admin_dashboard',
  MODERATE_CONTENT = 'moderate_content',
  MANAGE_PLATFORM = 'manage_platform',
  
  // User permissions
  VIEW_PROFILE = 'view_profile',
  EDIT_PROFILE = 'edit_profile'
}

// Role-Permission mapping
export const ROLE_PERMISSIONS: Record<UserRole, Permission[]> = {
  [UserRole.USER]: [
    Permission.PLACE_ORDER,
    Permission.CANCEL_ORDER,
    Permission.VIEW_PROFILE,
    Permission.EDIT_PROFILE
  ],
  [UserRole.MARKET_CREATOR]: [
    Permission.PLACE_ORDER,
    Permission.CANCEL_ORDER,
    Permission.VIEW_PROFILE,
    Permission.EDIT_PROFILE,
    Permission.CREATE_MARKET,
    Permission.EDIT_MARKET
  ],
  [UserRole.LIQUIDITY_PROVIDER]: [
    Permission.PLACE_ORDER,
    Permission.CANCEL_ORDER,
    Permission.VIEW_PROFILE,
    Permission.EDIT_PROFILE,
    Permission.PROVIDE_LIQUIDITY
  ],
  [UserRole.MODERATOR]: [
    Permission.PLACE_ORDER,
    Permission.CANCEL_ORDER,
    Permission.VIEW_PROFILE,
    Permission.EDIT_PROFILE,
    Permission.MODERATE_CONTENT,
    Permission.RESOLVE_MARKET
  ],
  [UserRole.ADMIN]: [
    ...Object.values(Permission) // Admins have all permissions
  ]
};

export interface AuthMiddlewareDependencies {
  authService: AuthService;
}

/**
 * Authentication Middleware
 * Validates JWT tokens and sets user context with RBAC support
 * 
 * Requirements: 3.1, 3.5, 8.5
 * - JWT validation middleware
 * - Role-based access control (RBAC) system
 * - Session management validation
 * - Rate limiting and security headers
 */
export function createAuthMiddleware(dependencies: AuthMiddlewareDependencies) {
  const { authService } = dependencies;

  /**
   * Rate limiters for different authentication endpoints
   */
  const authRateLimiter = rateLimit({
    windowMs: authConfig.rateLimiting.auth.windowMs,
    max: authConfig.rateLimiting.auth.max,
    message: {
      error: {
        code: 'RATE_LIMIT_EXCEEDED',
        message: 'Too many authentication attempts, please try again later',
        timestamp: new Date().toISOString()
      }
    },
    standardHeaders: true,
    legacyHeaders: false,
    keyGenerator: (req) => {
      const walletAddress = req.body?.walletAddress || req.headers['x-wallet-address'];
      return walletAddress ? `${req.ip}:${walletAddress}` : req.ip || 'unknown';
    }
  });

  const nonceRateLimiter = rateLimit({
    windowMs: authConfig.rateLimiting.nonce.windowMs,
    max: authConfig.rateLimiting.nonce.max,
    message: {
      error: {
        code: 'RATE_LIMIT_EXCEEDED',
        message: 'Too many nonce requests, please try again later',
        timestamp: new Date().toISOString()
      }
    },
    standardHeaders: true,
    legacyHeaders: false
  });

  const refreshRateLimiter = rateLimit({
    windowMs: authConfig.rateLimiting.refresh.windowMs,
    max: authConfig.rateLimiting.refresh.max,
    message: {
      error: {
        code: 'RATE_LIMIT_EXCEEDED',
        message: 'Too many token refresh attempts, please try again later',
        timestamp: new Date().toISOString()
      }
    },
    standardHeaders: true,
    legacyHeaders: false
  });

  /**
   * Security headers middleware
   */
  const securityHeaders = (req: Request, res: Response, next: NextFunction) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('X-XSS-Protection', '1; mode=block');
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    res.setHeader('Permissions-Policy', 'geolocation=(), microphone=(), camera=()');
    
    if (!req.headers['x-request-id']) {
      req.headers['x-request-id'] = Math.random().toString(36).substring(2, 15);
    }
    
    next();
  };

  /**
   * Get user roles based on user data
   */
  const getUserRoles = (user: any): UserRole[] => {
    const roles: UserRole[] = [UserRole.USER];
    
    if (user.isAdmin) {
      roles.push(UserRole.ADMIN);
    }
    
    if (user.canCreateMarkets) {
      roles.push(UserRole.MARKET_CREATOR);
    }
    
    if (user.isLiquidityProvider) {
      roles.push(UserRole.LIQUIDITY_PROVIDER);
    }
    
    if (user.isModerator) {
      roles.push(UserRole.MODERATOR);
    }
    
    return roles;
  };

  /**
   * Check if user has required permission
   */
  const hasPermission = (userRoles: UserRole[], requiredPermission: Permission): boolean => {
    return userRoles.some(role => 
      ROLE_PERMISSIONS[role]?.includes(requiredPermission)
    );
  };

  /**
   * Enhanced middleware to authenticate requests using JWT tokens
   */
  const authenticate = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const authHeader = req.headers.authorization;
      
      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        res.status(401).json({
          error: {
            code: 'MISSING_TOKEN',
            message: 'Authorization token is required',
            timestamp: new Date().toISOString(),
            requestId: req.headers['x-request-id'] || 'unknown'
          }
        });
        return;
      }

      const token = authHeader.substring(7);

      if (await authService.isTokenBlacklisted(token)) {
        res.status(401).json({
          error: {
            code: 'TOKEN_REVOKED',
            message: 'Token has been revoked',
            timestamp: new Date().toISOString(),
            requestId: req.headers['x-request-id'] || 'unknown'
          }
        });
        return;
      }

      const user = await authService.validateToken(token);
      const userRoles = getUserRoles(user);

      req.user = user;
      req.userId = user.id;
      req.walletAddress = user.walletAddress;
      req.isAdmin = user.isAdmin;
      req.isVerified = user.isVerified;
      req.userRoles = userRoles;

      next();

    } catch (error) {
      logger.warn('Authentication failed', {
        error: error instanceof Error ? error.message : 'Unknown error',
        ip: req.ip,
        userAgent: req.get('User-Agent'),
        requestId: req.headers['x-request-id']
      });

      res.status(401).json({
        error: {
          code: 'AUTHENTICATION_FAILED',
          message: 'Invalid or expired token',
          timestamp: new Date().toISOString(),
          requestId: req.headers['x-request-id'] || 'unknown'
        }
      });
    }
  };

  /**
   * Enhanced middleware to require admin privileges
   */
  const requireAdmin = (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) {
      res.status(401).json({
        error: {
          code: 'AUTHENTICATION_REQUIRED',
          message: 'Authentication is required',
          timestamp: new Date().toISOString(),
          requestId: req.headers['x-request-id'] || 'unknown'
        }
      });
      return;
    }

    if (!req.isAdmin && !req.userRoles?.includes(UserRole.ADMIN)) {
      logger.warn('Admin access denied', {
        userId: req.userId,
        walletAddress: req.walletAddress,
        roles: req.userRoles,
        ip: req.ip,
        path: req.path,
        method: req.method,
        requestId: req.headers['x-request-id']
      });

      res.status(403).json({
        error: {
          code: 'INSUFFICIENT_PRIVILEGES',
          message: 'Admin privileges required',
          timestamp: new Date().toISOString(),
          requestId: req.headers['x-request-id'] || 'unknown'
        }
      });
      return;
    }

    next();
  };

  /**
   * RBAC middleware to check specific permissions
   */
  const requirePermission = (permission: Permission) => {
    return (req: Request, res: Response, next: NextFunction) => {
      if (!req.user || !req.userRoles) {
        res.status(401).json({
          error: {
            code: 'AUTHENTICATION_REQUIRED',
            message: 'Authentication is required',
            timestamp: new Date().toISOString(),
            requestId: req.headers['x-request-id'] || 'unknown'
          }
        });
        return;
      }

      if (!hasPermission(req.userRoles, permission)) {
        logger.warn('Permission denied', {
          userId: req.userId,
          walletAddress: req.walletAddress,
          roles: req.userRoles,
          requiredPermission: permission,
          ip: req.ip,
          path: req.path,
          method: req.method,
          requestId: req.headers['x-request-id']
        });

        res.status(403).json({
          error: {
            code: 'INSUFFICIENT_PERMISSIONS',
            message: `Permission '${permission}' is required`,
            timestamp: new Date().toISOString(),
            requestId: req.headers['x-request-id'] || 'unknown'
          }
        });
        return;
      }

      next();
    };
  };

  /**
   * Middleware to require any of the specified roles
   */
  const requireRole = (...roles: UserRole[]) => {
    return (req: Request, res: Response, next: NextFunction) => {
      if (!req.user || !req.userRoles) {
        res.status(401).json({
          error: {
            code: 'AUTHENTICATION_REQUIRED',
            message: 'Authentication is required',
            timestamp: new Date().toISOString(),
            requestId: req.headers['x-request-id'] || 'unknown'
          }
        });
        return;
      }

      const hasRequiredRole = roles.some(role => req.userRoles?.includes(role));

      if (!hasRequiredRole) {
        logger.warn('Role access denied', {
          userId: req.userId,
          walletAddress: req.walletAddress,
          userRoles: req.userRoles,
          requiredRoles: roles,
          ip: req.ip,
          path: req.path,
          method: req.method,
          requestId: req.headers['x-request-id']
        });

        res.status(403).json({
          error: {
            code: 'INSUFFICIENT_ROLE',
            message: `One of the following roles is required: ${roles.join(', ')}`,
            timestamp: new Date().toISOString(),
            requestId: req.headers['x-request-id'] || 'unknown'
          }
        });
        return;
      }

      next();
    };
  };

  /**
   * Enhanced middleware to require verified user
   */
  const requireVerified = (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) {
      res.status(401).json({
        error: {
          code: 'AUTHENTICATION_REQUIRED',
          message: 'Authentication is required',
          timestamp: new Date().toISOString(),
          requestId: req.headers['x-request-id'] || 'unknown'
        }
      });
      return;
    }

    if (!req.isVerified) {
      logger.warn('Verification required', {
        userId: req.userId,
        walletAddress: req.walletAddress,
        ip: req.ip,
        path: req.path,
        method: req.method,
        requestId: req.headers['x-request-id']
      });

      res.status(403).json({
        error: {
          code: 'VERIFICATION_REQUIRED',
          message: 'Account verification is required',
          timestamp: new Date().toISOString(),
          requestId: req.headers['x-request-id'] || 'unknown'
        }
      });
      return;
    }

    next();
  };

  /**
   * Enhanced optional authentication middleware with RBAC support
   */
  const optionalAuth = async (req: Request, _res: Response, next: NextFunction) => {
    try {
      const authHeader = req.headers.authorization;
      
      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        next();
        return;
      }

      const token = authHeader.substring(7);

      if (await authService.isTokenBlacklisted(token)) {
        next();
        return;
      }

      const user = await authService.validateToken(token);
      const userRoles = getUserRoles(user);

      req.user = user;
      req.userId = user.id;
      req.walletAddress = user.walletAddress;
      req.isAdmin = user.isAdmin;
      req.isVerified = user.isVerified;
      req.userRoles = userRoles;

    } catch (error) {
      logger.debug('Optional authentication failed', {
        error: error instanceof Error ? error.message : 'Unknown error',
        requestId: req.headers['x-request-id']
      });
    }

    next();
  };

  /**
   * Enhanced middleware to check if user owns a resource
   */
  const requireOwnership = (field: string = 'userId') => {
    return (req: Request, res: Response, next: NextFunction) => {
      if (!req.user) {
        res.status(401).json({
          error: {
            code: 'AUTHENTICATION_REQUIRED',
            message: 'Authentication is required',
            timestamp: new Date().toISOString(),
            requestId: req.headers['x-request-id'] || 'unknown'
          }
        });
        return;
      }

      const resourceUserId = req.params[field] || req.body[field];
      
      if (!resourceUserId) {
        res.status(400).json({
          error: {
            code: 'MISSING_RESOURCE_ID',
            message: `${field} is required`,
            timestamp: new Date().toISOString(),
            requestId: req.headers['x-request-id'] || 'unknown'
          }
        });
        return;
      }

      if (req.isAdmin || req.userRoles?.includes(UserRole.ADMIN)) {
        next();
        return;
      }

      if (req.userId !== resourceUserId) {
        logger.warn('Ownership access denied', {
          userId: req.userId,
          resourceUserId,
          field,
          ip: req.ip,
          path: req.path,
          method: req.method,
          requestId: req.headers['x-request-id']
        });

        res.status(403).json({
          error: {
            code: 'ACCESS_DENIED',
            message: 'You can only access your own resources',
            timestamp: new Date().toISOString(),
            requestId: req.headers['x-request-id'] || 'unknown'
          }
        });
        return;
      }

      next();
    };
  };

  /**
   * Middleware to add request ID for tracking
   */
  const addRequestId = (req: Request, _res: Response, next: NextFunction) => {
    if (!req.headers['x-request-id']) {
      req.headers['x-request-id'] = Math.random().toString(36).substring(2, 15);
    }
    next();
  };

  /**
   * Middleware to validate request origin and prevent CSRF
   */
  const validateOrigin = (req: Request, res: Response, next: NextFunction) => {
    const origin = req.get('Origin') || req.get('Referer');
    const allowedOrigins = [
      process.env.FRONTEND_URL || 'http://localhost:3000',
      process.env.ADMIN_URL || 'http://localhost:3001'
    ];

    if (req.method === 'GET' || req.path === '/health') {
      next();
      return;
    }

    if (!origin || !allowedOrigins.some(allowed => origin.startsWith(allowed))) {
      logger.warn('Invalid origin detected', {
        origin,
        ip: req.ip,
        path: req.path,
        method: req.method,
        userAgent: req.get('User-Agent'),
        requestId: req.headers['x-request-id']
      });

      res.status(403).json({
        error: {
          code: 'INVALID_ORIGIN',
          message: 'Request origin not allowed',
          timestamp: new Date().toISOString(),
          requestId: req.headers['x-request-id'] || 'unknown'
        }
      });
      return;
    }

    next();
  };

  return {
    // Core authentication
    authenticate,
    optionalAuth,
    
    // Authorization and RBAC
    requireAdmin,
    requireVerified,
    requirePermission,
    requireRole,
    requireOwnership,
    
    // Rate limiting
    authRateLimiter,
    nonceRateLimiter,
    refreshRateLimiter,
    
    // Security
    securityHeaders,
    validateOrigin,
    addRequestId,
    
    // Utility functions
    getUserRoles,
    hasPermission,
    
    // Constants for external use
    UserRole,
    Permission,
    ROLE_PERMISSIONS
  };
}