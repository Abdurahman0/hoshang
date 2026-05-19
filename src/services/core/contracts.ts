import type {
  AppLog,
  EntityId,
  LogCleanupSettingsPatchInput,
  LogListParams,
  ManagedUser,
  PaginatedResult,
  SystemHealth,
  TableQueryParams,
  UserListParams,
  UserMutationInput,
  UserPatchInput,
  UserPermission,
} from '../../types/domain';

export type ServiceModuleKey =
  | 'dashboard'
  | 'logs'
  | 'users';

export interface DashboardDateRange {
  date_from: string;
  date_to: string;
  interval: string;
  label_format: string;
  timezone: string;
}

export interface DashboardBreakdownItem {
  key: string;
  label: string;
  count: number;
}

export interface DashboardTopProduct {
  product_id?: string;
  key: string;
  label: string;
  count: number;
  revenue?: string;
}

export interface DashboardRegionDemandItem {
  region: string;
  total: number;
}

export interface DashboardManagerPerformanceItem {
  manager_id: string | null;
  manager_username: string;
  total: number;
  won: number;
  lost: number;
}

export interface DashboardFilteredSummary {
  leads: number;
  new_leads: number;
  converted_leads: number;
  clients: number;
  new_customers?: number;
  new_clients: number;
  total_contracts: number;
  active_contracts: number;
  completed_orders?: number;
  total_chat_sessions?: number;
  active_chat_sessions?: number;
  pending_payment_amount?: string;
  revenue: string;
  collected_amount: string;
  average_order_value?: string;
  average_contract_value: string;
  order_completion_rate?: string;
  lead_conversion_rate: string;
  contract_renewal_rate: string;
}

export interface DashboardBreakdowns {
  leads_by_status: DashboardBreakdownItem[];
  leads_by_source: DashboardBreakdownItem[];
  contracts_by_status: DashboardBreakdownItem[];
  orders_by_status?: DashboardBreakdownItem[];
  payments_by_status?: DashboardBreakdownItem[];
  products_by_category: DashboardBreakdownItem[];
  chats_by_channel: DashboardBreakdownItem[];
  top_products: DashboardTopProduct[];
}

export interface DashboardTimeSeriesPoint {
  bucket_start: string;
  bucket_end: string;
  label: string;
  leads: number;
  chats: number;
  clients: number;
  contracts: number;
  revenue: string;
  collected_amount: string;
}

export interface DashboardOverview {
  leads: number;
  clients: number;
  instagram_leads?: number;
  telegram_leads?: number;
  manual_leads?: number;
  closed_sales?: number;
  lost_leads?: number;
  installations?: number;
  products?: number;
  chats?: number;
  notifications?: number;
  customers?: number;
  orders?: number;
  pending_payments?: number;
  contracts: number;
  unread_messages: number;
  revenue: string;
  collected_amount?: string;
  pipeline_amount?: string;
  delivered_amount?: string;
  subsidy_amount?: string;
  date_range: DashboardDateRange;
  filtered_summary: DashboardFilteredSummary;
  breakdowns: DashboardBreakdowns;
  time_series: DashboardTimeSeriesPoint[];
  region_demand?: DashboardRegionDemandItem[];
  manager_performance?: DashboardManagerPerformanceItem[];
}

export type DashboardInterval = 'day' | 'week' | 'month';

export interface DashboardOverviewParams {
  date_from?: string;
  date_to?: string;
  interval?: DashboardInterval;
}

export interface DashboardService {
  getOverview(params?: DashboardOverviewParams): Promise<DashboardOverview>;
}

export interface LogsService {
  listLogs(params?: LogListParams): Promise<PaginatedResult<AppLog>>;
  getLogById(id: EntityId): Promise<AppLog | null>;
  getSystemHealth(): Promise<SystemHealth>;
  updateLogCleanupSettings(input: LogCleanupSettingsPatchInput): Promise<AppLog | null>;
}

export interface UserService {
  list(params?: UserListParams): Promise<PaginatedResult<ManagedUser>>;
  getById(id: EntityId): Promise<ManagedUser | null>;
  listUsers(params?: UserListParams): Promise<PaginatedResult<ManagedUser>>;
  getUserById(id: EntityId): Promise<ManagedUser | null>;
  getManagedUser(id: EntityId): Promise<ManagedUser | null>;
  createUser(input: UserMutationInput): Promise<ManagedUser>;
  updateUser(id: EntityId, input: UserMutationInput): Promise<ManagedUser | null>;
  patchUser(id: EntityId, input: UserPatchInput): Promise<ManagedUser | null>;
  deleteUser(id: EntityId): Promise<boolean>;
  listUserPermissions(userId: EntityId): Promise<UserPermission[]>;
  getUserPermissions(userId: EntityId): Promise<UserPermission[]>;
}

export type AllServices = {
  dashboard: DashboardService;
  logs: LogsService;
  users: UserService;
};

