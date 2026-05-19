import type { AppModule } from '../types/architecture';

// Hoshang CRM - Green NRG Admin Dashboard Modules
export const moduleMap: AppModule[] = [
  {
    id: 'dashboard',
    label: 'Leads',
    description: 'CRM lead list, filtering, and status updates.',
    category: 'operational',
    priority: 'foundation',
    priorityOrder: 1,
    allowedRoles: ['developer', 'admin', 'operator'],
    accessStrategy: 'permission-based',
    pages: [
      {
        id: 'dashboard-home',
        label: 'Leads',
        kind: 'overview',
        path: '/dashboard',
        notes: 'Main CRM leads workspace.',
      },
    ],
    notes: 'Main CRM page for all roles.',
  },
  {
    id: 'logs',
    label: 'Logs',
    description: 'System and API audit logs.',
    category: 'system',
    priority: 'low',
    priorityOrder: 2,
    allowedRoles: ['developer', 'admin'],
    accessStrategy: 'static-role-based',
    pages: [
      {
        id: 'logs-list',
        label: 'Logs',
        kind: 'log',
        path: '/logs',
      },
    ],
    notes: 'Developer-only audit and system logs.',
  },
  {
    id: 'users',
    label: 'Users',
    description: 'User account and access management.',
    category: 'system',
    priority: 'low',
    priorityOrder: 3,
    allowedRoles: ['developer', 'admin'],
    accessStrategy: 'permission-based',
    pages: [
      {
        id: 'users-list',
        label: 'Users',
        kind: 'list',
        path: '/users',
      },
      {
        id: 'users-detail',
        label: 'User Detail',
        kind: 'detail',
        path: '/users/:id',
      },
      {
        id: 'users-create',
        label: 'Create User',
        kind: 'create',
        path: '/users/new',
      },
    ],
    notes: 'Admin and developer only - user management.',
  },
  {
    id: 'ai-settings',
    label: 'AI Settings',
    description: 'Active AI model and prompt configuration.',
    category: 'system',
    priority: 'low',
    priorityOrder: 4,
    allowedRoles: ['developer'],
    accessStrategy: 'permission-based',
    pages: [
      {
        id: 'ai-settings-overview',
        label: 'AI Settings',
        kind: 'configuration',
        path: '/ai-settings',
      },
    ],
    notes: 'Developer-only AI control panel.',
  },
];

export const crossSystemCapabilities = [
  'Authentication & Authorization',
  'Global Notifications',
  'Responsive Admin Shell',
  'Role-Based Navigation',
  'Permission-Based Route Guards',
] as const;

export const implementationOrder = [...moduleMap].sort(
  (left, right) => left.priorityOrder - right.priorityOrder,
);
