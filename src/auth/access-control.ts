import { routePaths } from '../config/routes'
import type { AppRouteId } from '../config/routes'
import type { AppRole } from '../types/architecture'
import type { AuthenticatedUser, PermissionCode } from './types'

const ROUTE_REQUIRED_PERMISSIONS: Partial<Record<AppRouteId, PermissionCode>> = {
	dashboard: 'can_view_dashboard',
	users: 'can_manage_users',
	'ai-settings': 'can_manage_ai_settings',
	logs: 'can_view_logs',
}

const PUBLIC_ROUTE_IDS = new Set<AppRouteId>([
	'home',
	'login',
	'access-denied',
	'not-found',
])

const MODULE_PATH_BY_ROUTE_ID: Record<string, string> = {
	dashboard: routePaths.dashboard,
	users: routePaths.users,
	'ai-settings': routePaths['ai-settings'],
	logs: routePaths.logs,
}

export function hasRole(
	user: AuthenticatedUser | null,
	role: AppRole | readonly AppRole[],
): boolean {
	if (!user) {
		return false
	}

	if (Array.isArray(role)) {
		return role.includes(user.role)
	}

	return user.role === role
}

export function hasPermission(
	user: AuthenticatedUser | null,
	permission: PermissionCode,
): boolean {
	if (!user) {
		return false
	}

	if (user.role === 'developer') {
		return true
	}

	return user.permissionKeys.includes(permission)
}

export function canAccessRouteForUser(
	user: AuthenticatedUser | null,
	routeId: AppRouteId,
): boolean {
	if (PUBLIC_ROUTE_IDS.has(routeId)) {
		return true
	}

	if (!user) {
		return false
	}

	if (user.role === 'developer') {
		return true
	}

	if (user.role === 'admin') {
		return ['dashboard', 'users', 'logs'].includes(routeId)
	}

	if (user.role === 'operator') {
		return routeId === 'dashboard'
	}

	if (routeId === 'ai-settings') {
		return false
	}

	const requiredPermission = ROUTE_REQUIRED_PERMISSIONS[routeId]
	if (!requiredPermission) {
		return false
	}

	return hasPermission(user, requiredPermission)
}

export function resolveDefaultLandingPathForUser(
	user: AuthenticatedUser | null,
): string {
	if (!user) {
		return routePaths.login
	}

	const fallbackRouteOrder: AppRouteId[] = [
		'dashboard',
		'users',
		'logs',
	]

	const firstAllowed = fallbackRouteOrder.find(routeId =>
		canAccessRouteForUser(user, routeId),
	)

	if (!firstAllowed) {
		return routePaths.accessDenied
	}

	return MODULE_PATH_BY_ROUTE_ID[firstAllowed] ?? routePaths.accessDenied
}
