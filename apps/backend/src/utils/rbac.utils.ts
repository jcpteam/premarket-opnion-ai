import { UserRole, Permission, ROLE_PERMISSIONS } from '../middleware/auth.middleware';

/**
 * Role-Based Access Control (RBAC) Utilities
 * Provides utility functions for managing roles and permissions
 * 
 * Requirements: 3.1, 8.5
 * - Role-based access control system
 * - Permission management utilities
 * - User role validation
 */

/**
 * Check if a user has a specific permission
 */
export function hasPermission(userRoles: UserRole[], requiredPermission: Permission): boolean {
  return userRoles.some(role => 
    ROLE_PERMISSIONS[role]?.includes(requiredPermission)
  );
}

/**
 * Check if a user has any of the specified permissions
 */
export function hasAnyPermission(userRoles: UserRole[], permissions: Permission[]): boolean {
  return permissions.some(permission => hasPermission(userRoles, permission));
}

/**
 * Check if a user has all of the specified permissions
 */
export function hasAllPermissions(userRoles: UserRole[], permissions: Permission[]): boolean {
  return permissions.every(permission => hasPermission(userRoles, permission));
}

/**
 * Check if a user has a specific role
 */
export function hasRole(userRoles: UserRole[], requiredRole: UserRole): boolean {
  return userRoles.includes(requiredRole);
}

/**
 * Check if a user has any of the specified roles
 */
export function hasAnyRole(userRoles: UserRole[], roles: UserRole[]): boolean {
  return roles.some(role => userRoles.includes(role));
}

/**
 * Get all permissions for a user based on their roles
 */
export function getUserPermissions(userRoles: UserRole[]): Permission[] {
  const permissions = new Set<Permission>();
  
  userRoles.forEach(role => {
    const rolePermissions = ROLE_PERMISSIONS[role] || [];
    rolePermissions.forEach((permission: Permission) => permissions.add(permission));
  });
  
  return Array.from(permissions);
}

/**
 * Check if a role is valid
 */
export function isValidRole(role: string): role is UserRole {
  return Object.values(UserRole).includes(role as UserRole);
}

/**
 * Check if a permission is valid
 */
export function isValidPermission(permission: string): permission is Permission {
  return Object.values(Permission).includes(permission as Permission);
}

/**
 * Get role hierarchy level (higher number = more privileges)
 */
export function getRoleLevel(role: UserRole): number {
  const roleLevels: Record<UserRole, number> = {
    [UserRole.USER]: 1,
    [UserRole.MARKET_CREATOR]: 2,
    [UserRole.LIQUIDITY_PROVIDER]: 2,
    [UserRole.MODERATOR]: 3,
    [UserRole.ADMIN]: 4
  };
  
  return roleLevels[role] || 0;
}

/**
 * Check if one role has higher privileges than another
 */
export function isHigherRole(role1: UserRole, role2: UserRole): boolean {
  return getRoleLevel(role1) > getRoleLevel(role2);
}

/**
 * Get the highest role from a list of roles
 */
export function getHighestRole(roles: UserRole[]): UserRole | null {
  if (roles.length === 0) return null;
  
  return roles.reduce((highest, current) => 
    isHigherRole(current, highest) ? current : highest
  );
}

/**
 * Filter permissions based on user roles
 */
export function filterPermissionsByRoles(
  permissions: Permission[], 
  userRoles: UserRole[]
): Permission[] {
  return permissions.filter(permission => hasPermission(userRoles, permission));
}

/**
 * Get missing permissions for a user
 */
export function getMissingPermissions(
  userRoles: UserRole[], 
  requiredPermissions: Permission[]
): Permission[] {
  return requiredPermissions.filter(permission => 
    !hasPermission(userRoles, permission)
  );
}

/**
 * Check if user can perform action on resource
 */
export function canAccessResource(
  userRoles: UserRole[],
  resourceOwnerId: string,
  currentUserId: string,
  requiredPermission: Permission
): boolean {
  // Admin can access everything
  if (hasRole(userRoles, UserRole.ADMIN)) {
    return true;
  }
  
  // User can access their own resources
  if (resourceOwnerId === currentUserId) {
    return hasPermission(userRoles, requiredPermission);
  }
  
  // Check if user has permission for other users' resources
  // This would typically require higher-level permissions
  const adminPermissions = [
    Permission.MANAGE_USERS,
    Permission.MODERATE_CONTENT,
    Permission.MANAGE_PLATFORM
  ];
  
  return hasAnyPermission(userRoles, adminPermissions) && 
         hasPermission(userRoles, requiredPermission);
}

/**
 * Validate role assignment (check if user can assign roles)
 */
export function canAssignRole(
  assignerRoles: UserRole[],
  targetRole: UserRole
): boolean {
  // Only admins can assign roles
  if (!hasRole(assignerRoles, UserRole.ADMIN)) {
    return false;
  }
  
  // Admins can assign any role except admin (prevent privilege escalation)
  if (targetRole === UserRole.ADMIN) {
    // Only super admin or system can assign admin role
    // This would require additional checks in a real system
    return false;
  }
  
  return true;
}

/**
 * Get role display name
 */
export function getRoleDisplayName(role: UserRole): string {
  const displayNames: Record<UserRole, string> = {
    [UserRole.USER]: 'User',
    [UserRole.MARKET_CREATOR]: 'Market Creator',
    [UserRole.LIQUIDITY_PROVIDER]: 'Liquidity Provider',
    [UserRole.MODERATOR]: 'Moderator',
    [UserRole.ADMIN]: 'Administrator'
  };
  
  return displayNames[role] || role;
}

/**
 * Get permission display name
 */
export function getPermissionDisplayName(permission: Permission): string {
  const displayNames: Record<Permission, string> = {
    [Permission.CREATE_MARKET]: 'Create Market',
    [Permission.EDIT_MARKET]: 'Edit Market',
    [Permission.DELETE_MARKET]: 'Delete Market',
    [Permission.RESOLVE_MARKET]: 'Resolve Market',
    [Permission.PLACE_ORDER]: 'Place Order',
    [Permission.CANCEL_ORDER]: 'Cancel Order',
    [Permission.PROVIDE_LIQUIDITY]: 'Provide Liquidity',
    [Permission.MANAGE_USERS]: 'Manage Users',
    [Permission.VIEW_ADMIN_DASHBOARD]: 'View Admin Dashboard',
    [Permission.MODERATE_CONTENT]: 'Moderate Content',
    [Permission.MANAGE_PLATFORM]: 'Manage Platform',
    [Permission.VIEW_PROFILE]: 'View Profile',
    [Permission.EDIT_PROFILE]: 'Edit Profile'
  };
  
  return displayNames[permission] || permission;
}

/**
 * Create a permission summary for a user
 */
export interface PermissionSummary {
  roles: UserRole[];
  permissions: Permission[];
  canCreateMarkets: boolean;
  canTrade: boolean;
  canProvideLiquidity: boolean;
  canModerate: boolean;
  isAdmin: boolean;
}

export function createPermissionSummary(userRoles: UserRole[]): PermissionSummary {
  const permissions = getUserPermissions(userRoles);
  
  return {
    roles: userRoles,
    permissions,
    canCreateMarkets: hasPermission(userRoles, Permission.CREATE_MARKET),
    canTrade: hasPermission(userRoles, Permission.PLACE_ORDER),
    canProvideLiquidity: hasPermission(userRoles, Permission.PROVIDE_LIQUIDITY),
    canModerate: hasPermission(userRoles, Permission.MODERATE_CONTENT),
    isAdmin: hasRole(userRoles, UserRole.ADMIN)
  };
}