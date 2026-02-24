"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.hasPermission = hasPermission;
exports.hasAnyPermission = hasAnyPermission;
exports.hasAllPermissions = hasAllPermissions;
exports.hasRole = hasRole;
exports.hasAnyRole = hasAnyRole;
exports.getUserPermissions = getUserPermissions;
exports.isValidRole = isValidRole;
exports.isValidPermission = isValidPermission;
exports.getRoleLevel = getRoleLevel;
exports.isHigherRole = isHigherRole;
exports.getHighestRole = getHighestRole;
exports.filterPermissionsByRoles = filterPermissionsByRoles;
exports.getMissingPermissions = getMissingPermissions;
exports.canAccessResource = canAccessResource;
exports.canAssignRole = canAssignRole;
exports.getRoleDisplayName = getRoleDisplayName;
exports.getPermissionDisplayName = getPermissionDisplayName;
exports.createPermissionSummary = createPermissionSummary;
const auth_middleware_1 = require("../middleware/auth.middleware");
function hasPermission(userRoles, requiredPermission) {
    return userRoles.some(role => auth_middleware_1.ROLE_PERMISSIONS[role]?.includes(requiredPermission));
}
function hasAnyPermission(userRoles, permissions) {
    return permissions.some(permission => hasPermission(userRoles, permission));
}
function hasAllPermissions(userRoles, permissions) {
    return permissions.every(permission => hasPermission(userRoles, permission));
}
function hasRole(userRoles, requiredRole) {
    return userRoles.includes(requiredRole);
}
function hasAnyRole(userRoles, roles) {
    return roles.some(role => userRoles.includes(role));
}
function getUserPermissions(userRoles) {
    const permissions = new Set();
    userRoles.forEach(role => {
        const rolePermissions = auth_middleware_1.ROLE_PERMISSIONS[role] || [];
        rolePermissions.forEach((permission) => permissions.add(permission));
    });
    return Array.from(permissions);
}
function isValidRole(role) {
    return Object.values(auth_middleware_1.UserRole).includes(role);
}
function isValidPermission(permission) {
    return Object.values(auth_middleware_1.Permission).includes(permission);
}
function getRoleLevel(role) {
    const roleLevels = {
        [auth_middleware_1.UserRole.USER]: 1,
        [auth_middleware_1.UserRole.MARKET_CREATOR]: 2,
        [auth_middleware_1.UserRole.LIQUIDITY_PROVIDER]: 2,
        [auth_middleware_1.UserRole.MODERATOR]: 3,
        [auth_middleware_1.UserRole.ADMIN]: 4
    };
    return roleLevels[role] || 0;
}
function isHigherRole(role1, role2) {
    return getRoleLevel(role1) > getRoleLevel(role2);
}
function getHighestRole(roles) {
    if (roles.length === 0)
        return null;
    return roles.reduce((highest, current) => isHigherRole(current, highest) ? current : highest);
}
function filterPermissionsByRoles(permissions, userRoles) {
    return permissions.filter(permission => hasPermission(userRoles, permission));
}
function getMissingPermissions(userRoles, requiredPermissions) {
    return requiredPermissions.filter(permission => !hasPermission(userRoles, permission));
}
function canAccessResource(userRoles, resourceOwnerId, currentUserId, requiredPermission) {
    if (hasRole(userRoles, auth_middleware_1.UserRole.ADMIN)) {
        return true;
    }
    if (resourceOwnerId === currentUserId) {
        return hasPermission(userRoles, requiredPermission);
    }
    const adminPermissions = [
        auth_middleware_1.Permission.MANAGE_USERS,
        auth_middleware_1.Permission.MODERATE_CONTENT,
        auth_middleware_1.Permission.MANAGE_PLATFORM
    ];
    return hasAnyPermission(userRoles, adminPermissions) &&
        hasPermission(userRoles, requiredPermission);
}
function canAssignRole(assignerRoles, targetRole) {
    if (!hasRole(assignerRoles, auth_middleware_1.UserRole.ADMIN)) {
        return false;
    }
    if (targetRole === auth_middleware_1.UserRole.ADMIN) {
        return false;
    }
    return true;
}
function getRoleDisplayName(role) {
    const displayNames = {
        [auth_middleware_1.UserRole.USER]: 'User',
        [auth_middleware_1.UserRole.MARKET_CREATOR]: 'Market Creator',
        [auth_middleware_1.UserRole.LIQUIDITY_PROVIDER]: 'Liquidity Provider',
        [auth_middleware_1.UserRole.MODERATOR]: 'Moderator',
        [auth_middleware_1.UserRole.ADMIN]: 'Administrator'
    };
    return displayNames[role] || role;
}
function getPermissionDisplayName(permission) {
    const displayNames = {
        [auth_middleware_1.Permission.CREATE_MARKET]: 'Create Market',
        [auth_middleware_1.Permission.EDIT_MARKET]: 'Edit Market',
        [auth_middleware_1.Permission.DELETE_MARKET]: 'Delete Market',
        [auth_middleware_1.Permission.RESOLVE_MARKET]: 'Resolve Market',
        [auth_middleware_1.Permission.PLACE_ORDER]: 'Place Order',
        [auth_middleware_1.Permission.CANCEL_ORDER]: 'Cancel Order',
        [auth_middleware_1.Permission.PROVIDE_LIQUIDITY]: 'Provide Liquidity',
        [auth_middleware_1.Permission.MANAGE_USERS]: 'Manage Users',
        [auth_middleware_1.Permission.VIEW_ADMIN_DASHBOARD]: 'View Admin Dashboard',
        [auth_middleware_1.Permission.MODERATE_CONTENT]: 'Moderate Content',
        [auth_middleware_1.Permission.MANAGE_PLATFORM]: 'Manage Platform',
        [auth_middleware_1.Permission.VIEW_PROFILE]: 'View Profile',
        [auth_middleware_1.Permission.EDIT_PROFILE]: 'Edit Profile'
    };
    return displayNames[permission] || permission;
}
function createPermissionSummary(userRoles) {
    const permissions = getUserPermissions(userRoles);
    return {
        roles: userRoles,
        permissions,
        canCreateMarkets: hasPermission(userRoles, auth_middleware_1.Permission.CREATE_MARKET),
        canTrade: hasPermission(userRoles, auth_middleware_1.Permission.PLACE_ORDER),
        canProvideLiquidity: hasPermission(userRoles, auth_middleware_1.Permission.PROVIDE_LIQUIDITY),
        canModerate: hasPermission(userRoles, auth_middleware_1.Permission.MODERATE_CONTENT),
        isAdmin: hasRole(userRoles, auth_middleware_1.UserRole.ADMIN)
    };
}
//# sourceMappingURL=rbac.utils.js.map