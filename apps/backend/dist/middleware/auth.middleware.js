"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ROLE_PERMISSIONS = exports.Permission = exports.UserRole = void 0;
exports.createAuthMiddleware = createAuthMiddleware;
const express_rate_limit_1 = __importDefault(require("express-rate-limit"));
const logger_1 = require("../config/logger");
const auth_config_1 = require("../config/auth.config");
var UserRole;
(function (UserRole) {
    UserRole["USER"] = "user";
    UserRole["ADMIN"] = "admin";
    UserRole["MODERATOR"] = "moderator";
    UserRole["MARKET_CREATOR"] = "market_creator";
    UserRole["LIQUIDITY_PROVIDER"] = "liquidity_provider";
})(UserRole || (exports.UserRole = UserRole = {}));
var Permission;
(function (Permission) {
    Permission["CREATE_MARKET"] = "create_market";
    Permission["EDIT_MARKET"] = "edit_market";
    Permission["DELETE_MARKET"] = "delete_market";
    Permission["RESOLVE_MARKET"] = "resolve_market";
    Permission["PLACE_ORDER"] = "place_order";
    Permission["CANCEL_ORDER"] = "cancel_order";
    Permission["PROVIDE_LIQUIDITY"] = "provide_liquidity";
    Permission["MANAGE_USERS"] = "manage_users";
    Permission["VIEW_ADMIN_DASHBOARD"] = "view_admin_dashboard";
    Permission["MODERATE_CONTENT"] = "moderate_content";
    Permission["MANAGE_PLATFORM"] = "manage_platform";
    Permission["VIEW_PROFILE"] = "view_profile";
    Permission["EDIT_PROFILE"] = "edit_profile";
})(Permission || (exports.Permission = Permission = {}));
exports.ROLE_PERMISSIONS = {
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
        ...Object.values(Permission)
    ]
};
function createAuthMiddleware(dependencies) {
    const { authService } = dependencies;
    const authRateLimiter = (0, express_rate_limit_1.default)({
        windowMs: auth_config_1.authConfig.rateLimiting.auth.windowMs,
        max: auth_config_1.authConfig.rateLimiting.auth.max,
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
    const nonceRateLimiter = (0, express_rate_limit_1.default)({
        windowMs: auth_config_1.authConfig.rateLimiting.nonce.windowMs,
        max: auth_config_1.authConfig.rateLimiting.nonce.max,
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
    const refreshRateLimiter = (0, express_rate_limit_1.default)({
        windowMs: auth_config_1.authConfig.rateLimiting.refresh.windowMs,
        max: auth_config_1.authConfig.rateLimiting.refresh.max,
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
    const securityHeaders = (req, res, next) => {
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
    const getUserRoles = (user) => {
        const roles = [UserRole.USER];
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
    const hasPermission = (userRoles, requiredPermission) => {
        return userRoles.some(role => exports.ROLE_PERMISSIONS[role]?.includes(requiredPermission));
    };
    const authenticate = async (req, res, next) => {
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
        }
        catch (error) {
            logger_1.logger.warn('Authentication failed', {
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
    const requireAdmin = (req, res, next) => {
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
            logger_1.logger.warn('Admin access denied', {
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
    const requirePermission = (permission) => {
        return (req, res, next) => {
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
                logger_1.logger.warn('Permission denied', {
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
    const requireRole = (...roles) => {
        return (req, res, next) => {
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
                logger_1.logger.warn('Role access denied', {
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
    const requireVerified = (req, res, next) => {
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
            logger_1.logger.warn('Verification required', {
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
    const optionalAuth = async (req, _res, next) => {
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
        }
        catch (error) {
            logger_1.logger.debug('Optional authentication failed', {
                error: error instanceof Error ? error.message : 'Unknown error',
                requestId: req.headers['x-request-id']
            });
        }
        next();
    };
    const requireOwnership = (field = 'userId') => {
        return (req, res, next) => {
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
                logger_1.logger.warn('Ownership access denied', {
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
    const addRequestId = (req, _res, next) => {
        if (!req.headers['x-request-id']) {
            req.headers['x-request-id'] = Math.random().toString(36).substring(2, 15);
        }
        next();
    };
    const validateOrigin = (req, res, next) => {
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
            logger_1.logger.warn('Invalid origin detected', {
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
        authenticate,
        optionalAuth,
        requireAdmin,
        requireVerified,
        requirePermission,
        requireRole,
        requireOwnership,
        authRateLimiter,
        nonceRateLimiter,
        refreshRateLimiter,
        securityHeaders,
        validateOrigin,
        addRequestId,
        getUserRoles,
        hasPermission,
        UserRole,
        Permission,
        ROLE_PERMISSIONS: exports.ROLE_PERMISSIONS
    };
}
//# sourceMappingURL=auth.middleware.js.map