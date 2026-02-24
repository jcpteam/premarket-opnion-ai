import { Request, Response, NextFunction } from 'express';
import { AuthService } from '../services/auth.service';
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
export declare enum UserRole {
    USER = "user",
    ADMIN = "admin",
    MODERATOR = "moderator",
    MARKET_CREATOR = "market_creator",
    LIQUIDITY_PROVIDER = "liquidity_provider"
}
export declare enum Permission {
    CREATE_MARKET = "create_market",
    EDIT_MARKET = "edit_market",
    DELETE_MARKET = "delete_market",
    RESOLVE_MARKET = "resolve_market",
    PLACE_ORDER = "place_order",
    CANCEL_ORDER = "cancel_order",
    PROVIDE_LIQUIDITY = "provide_liquidity",
    MANAGE_USERS = "manage_users",
    VIEW_ADMIN_DASHBOARD = "view_admin_dashboard",
    MODERATE_CONTENT = "moderate_content",
    MANAGE_PLATFORM = "manage_platform",
    VIEW_PROFILE = "view_profile",
    EDIT_PROFILE = "edit_profile"
}
export declare const ROLE_PERMISSIONS: Record<UserRole, Permission[]>;
export interface AuthMiddlewareDependencies {
    authService: AuthService;
}
export declare function createAuthMiddleware(dependencies: AuthMiddlewareDependencies): {
    authenticate: (req: Request, res: Response, next: NextFunction) => Promise<void>;
    optionalAuth: (req: Request, _res: Response, next: NextFunction) => Promise<void>;
    requireAdmin: (req: Request, res: Response, next: NextFunction) => void;
    requireVerified: (req: Request, res: Response, next: NextFunction) => void;
    requirePermission: (permission: Permission) => (req: Request, res: Response, next: NextFunction) => void;
    requireRole: (...roles: UserRole[]) => (req: Request, res: Response, next: NextFunction) => void;
    requireOwnership: (field?: string) => (req: Request, res: Response, next: NextFunction) => void;
    authRateLimiter: import("express-rate-limit").RateLimitRequestHandler;
    nonceRateLimiter: import("express-rate-limit").RateLimitRequestHandler;
    refreshRateLimiter: import("express-rate-limit").RateLimitRequestHandler;
    securityHeaders: (req: Request, res: Response, next: NextFunction) => void;
    validateOrigin: (req: Request, res: Response, next: NextFunction) => void;
    addRequestId: (req: Request, _res: Response, next: NextFunction) => void;
    getUserRoles: (user: any) => UserRole[];
    hasPermission: (userRoles: UserRole[], requiredPermission: Permission) => boolean;
    UserRole: typeof UserRole;
    Permission: typeof Permission;
    ROLE_PERMISSIONS: Record<UserRole, Permission[]>;
};
//# sourceMappingURL=auth.middleware.d.ts.map