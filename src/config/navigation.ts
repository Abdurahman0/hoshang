import type { AppModule, AppRole, AccessStrategy } from '../types/architecture';
import type { AppRouteId } from './routes';

export type NavigationGroupId = 'main' | 'operations' | 'system';

export type NavigationIconKey =
  | 'dashboard'
  | 'users'
  | 'ai-settings'
  | 'logs';

type SidebarRouteId = Extract<AppRouteId, AppModule['id']>;

export interface NavigationItemConfig {
  id: SidebarRouteId;
  label: string;
  path: string;
  iconKey: NavigationIconKey;
  moduleId?: AppModule['id'];
  group: NavigationGroupId;
  sortOrder: number;
  allowedRoles?: AppRole[];
  accessStrategy?: AccessStrategy;
  permissionKey?: string;
  children?: NavigationItemConfig[];
}

export interface NavigationGroupConfig {
  id: NavigationGroupId;
  label: string;
  sortOrder: number;
  items: NavigationItemConfig[];
}

// Navigation structure for Hoshang CRM
export const navigationConfig: NavigationGroupConfig[] = [
  {
    id: 'main',
    label: 'Leads',
    sortOrder: 1,
    items: [
      {
        id: 'dashboard',
        label: 'Leads',
        path: '/dashboard',
        moduleId: 'dashboard',
        iconKey: 'dashboard',
        group: 'main',
        sortOrder: 1,
        allowedRoles: ['developer', 'admin', 'operator'],
      },
    ],
  },
  {
    id: 'system',
    label: 'System',
    sortOrder: 3,
    items: [
      {
        id: 'users',
        label: 'Users',
        path: '/users',
        moduleId: 'users',
        iconKey: 'users',
        group: 'system',
        sortOrder: 1,
        allowedRoles: ['developer', 'admin'],
      },
      {
        id: 'logs',
        label: 'Logs',
        path: '/logs',
        moduleId: 'logs',
        iconKey: 'logs',
        group: 'system',
        sortOrder: 2,
        allowedRoles: ['developer', 'admin'],
      },
      {
        id: 'ai-settings',
        label: 'AI Settings',
        path: '/ai-settings',
        moduleId: 'ai-settings',
        iconKey: 'ai-settings',
        group: 'system',
        sortOrder: 3,
        allowedRoles: ['developer'],
      },
    ],
  },
];

// Flatten all navigation items
export function getAllNavigationItems(): NavigationItemConfig[] {
  return navigationConfig.flatMap((group) => group.items);
}

// Get navigation items visible to a specific role
export function getNavigationItemsByRole(role: AppRole): NavigationItemConfig[] {
  return getAllNavigationItems().filter((item) => {
    if (!item.allowedRoles) return true;
    return item.allowedRoles.includes(role);
  });
}
