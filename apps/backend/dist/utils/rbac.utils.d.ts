import { UserRole, Permission } from '../middleware/auth.middleware';
export declare function hasPermission(userRoles: UserRole[], requiredPermission: Permission): boolean;
export declare function hasAnyPermission(userRoles: UserRole[], permissions: Permission[]): boolean;
export declare function hasAllPermissions(userRoles: UserRole[], permissions: Permission[]): boolean;
export declare function hasRole(userRoles: UserRole[], requiredRole: UserRole): boolean;
export declare function hasAnyRole(userRoles: UserRole[], roles: UserRole[]): boolean;
export declare function getUserPermissions(userRoles: UserRole[]): Permission[];
export declare function isValidRole(role: string): role is UserRole;
export declare function isValidPermission(permission: string): permission is Permission;
export declare function getRoleLevel(role: UserRole): number;
export declare function isHigherRole(role1: UserRole, role2: UserRole): boolean;
export declare function getHighestRole(roles: UserRole[]): UserRole | null;
export declare function filterPermissionsByRoles(permissions: Permission[], userRoles: UserRole[]): Permission[];
export declare function getMissingPermissions(userRoles: UserRole[], requiredPermissions: Permission[]): Permission[];
export declare function canAccessResource(userRoles: UserRole[], resourceOwnerId: string, currentUserId: string, requiredPermission: Permission): boolean;
export declare function canAssignRole(assignerRoles: UserRole[], targetRole: UserRole): boolean;
export declare function getRoleDisplayName(role: UserRole): string;
export declare function getPermissionDisplayName(permission: Permission): string;
export interface PermissionSummary {
    roles: UserRole[];
    permissions: Permission[];
    canCreateMarkets: boolean;
    canTrade: boolean;
    canProvideLiquidity: boolean;
    canModerate: boolean;
    isAdmin: boolean;
}
export declare function createPermissionSummary(userRoles: UserRole[]): PermissionSummary;
//# sourceMappingURL=rbac.utils.d.ts.map