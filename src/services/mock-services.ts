import type {
	AILog,
	AIActiveSetting,
	AIActiveSettingUpdateInput,
	ApiLog,
	CreateUserInput,
	IAISettingsService,
	ILogsService,
	IUsersService,
	LogsListParams,
	ManagedUser,
	PaginatedResponse,
	UpdateUserInput,
	UserPermission,
	UserRole,
	UserRoleCatalogItem,
	UsersListParams,
} from './contracts'
import type { DashboardOverview, DashboardOverviewParams } from './core/contracts'
import type { SystemHealth } from '../types/domain'

const now = new Date()

const ALL_PERMISSIONS: UserPermission[] = [
	{
		id: 'perm-dashboard-view',
		code: 'can_view_dashboard',
		name: 'Dashboard view',
		description: 'View dashboard metrics and charts.',
	},
	{
		id: 'perm-users-manage',
		code: 'can_manage_users',
		name: 'Users manage',
		description: 'Manage user accounts and permissions.',
	},
	{
		id: 'perm-logs-view',
		code: 'can_view_logs',
		name: 'Logs view',
		description: 'View API and AI audit logs.',
	},
]

const ROLE_CATALOG: UserRoleCatalogItem[] = [
	{
		key: 'developer',
		label: 'Developer',
		default_permissions: ALL_PERMISSIONS.map(permission => permission.code),
	},
	{
		key: 'admin',
		label: 'Admin',
		default_permissions: ['can_view_dashboard', 'can_manage_users'],
	},
	{
		key: 'operator',
		label: 'Operator',
		default_permissions: ['can_view_dashboard'],
	},
]

const MOCK_USERS: ManagedUser[] = [
	{
		id: 'user-1',
		email: 'dev@planner.local',
		full_name: 'Lead Developer',
		phone: '+998901112233',
		role: 'developer',
		is_active: true,
		custom_permissions: [],
		created_by: 'system',
		created_by_name: 'System',
		created_at: toIso(now, -28),
		updated_at: toIso(now, -1),
	},
	{
		id: 'user-2',
		email: 'admin@planner.local',
		full_name: 'Main Admin',
		phone: '+998901112244',
		role: 'admin',
		is_active: true,
		custom_permissions: ['perm-dashboard-view', 'perm-users-manage'],
		created_by: 'user-1',
		created_by_name: 'Lead Developer',
		created_at: toIso(now, -23),
		updated_at: toIso(now, -3),
	},
	{
		id: 'user-3',
		email: 'ops@planner.local',
		full_name: 'Sales Operator',
		phone: '+998901112255',
		role: 'operator',
		is_active: true,
		custom_permissions: ['perm-dashboard-view'],
		created_by: 'user-2',
		created_by_name: 'Main Admin',
		created_at: toIso(now, -17),
		updated_at: toIso(now, -2),
	},
	{
		id: 'user-4',
		email: 'intern@planner.local',
		full_name: 'Support Intern',
		phone: '+998901112266',
		role: 'operator',
		is_active: false,
		custom_permissions: ['perm-dashboard-view'],
		created_by: 'user-2',
		created_by_name: 'Main Admin',
		created_at: toIso(now, -11),
		updated_at: toIso(now, -6),
	},
]

const MOCK_API_LOGS: ApiLog[] = Array.from({ length: 28 }, (_, index) => {
	const logIndex = index + 1
	const isError = logIndex % 7 === 0
	const statusCode = isError ? 500 : logIndex % 3 === 0 ? 201 : 200
	return {
		id: `api-log-${logIndex}`,
		method: logIndex % 2 === 0 ? 'GET' : 'POST',
		endpoint:
			logIndex % 2 === 0
				? '/api/leads/dashboard/'
				: '/api/users/sync-permissions/',
		status_code: statusCode,
		level: isError ? 'error' : 'info',
		error: isError ? 'Upstream timeout' : undefined,
		duration_ms: 120 + logIndex * 6,
		created_at: toIso(now, -logIndex),
		updated_at: toIso(now, -logIndex),
	}
})

const MOCK_AI_LOGS: AILog[] = Array.from({ length: 18 }, (_, index) => {
	const logIndex = index + 1
	const isFailure = logIndex % 6 === 0
	return {
		id: `ai-log-${logIndex}`,
		action: 'plan_generation',
		model: 'gpt-4.1-mini',
		prompt: `Generate weekly plan #${logIndex}`,
		response: isFailure ? '' : `Plan generated for request #${logIndex}`,
		level: isFailure ? 'warning' : 'info',
		error: isFailure ? 'Token limit reached; retried with compression.' : undefined,
		tokens_used: 580 + logIndex * 23,
		cost: Number((0.006 + logIndex * 0.0004).toFixed(4)),
		duration_ms: 800 + logIndex * 32,
		created_at: toIso(now, -logIndex),
		updated_at: toIso(now, -logIndex),
	}
})

const DEFAULT_HEALTH: SystemHealth = {
	status: 'ok',
	database: 'ok',
	redis: 'ok',
}

function toIso(baseDate: Date, minusDays = 0): string {
	const date = new Date(baseDate)
	date.setDate(date.getDate() + minusDays)
	date.setHours(10, 0, 0, 0)
	return date.toISOString()
}

function paginate<T>(
	items: T[],
	page = 1,
	pageSize = 10,
): PaginatedResponse<T> {
	const safePage = Math.max(1, page)
	const safePageSize = Math.max(1, pageSize)
	const start = (safePage - 1) * safePageSize
	const end = start + safePageSize
	const sliced = items.slice(start, end)

	return {
		items: sliced,
		total: items.length,
		count: items.length,
		page: safePage,
		page_size: safePageSize,
		next: end < items.length ? `${safePage + 1}` : null,
		previous: safePage > 1 ? `${safePage - 1}` : null,
	}
}

function sortByDateField<T extends { created_at?: string; updated_at?: string }>(
	items: T[],
	ordering?: string,
): T[] {
	if (!ordering) {
		return items
	}

	const isDesc = ordering.startsWith('-')
	const field = ordering.replace(/^-/, '')
	if (field !== 'created_at' && field !== 'updated_at') {
		return items
	}

	return [...items].sort((left, right) => {
		const leftTime = Date.parse(left[field] ?? '')
		const rightTime = Date.parse(right[field] ?? '')
		if (leftTime === rightTime) {
			return 0
		}
		return isDesc ? rightTime - leftTime : leftTime - rightTime
	})
}

function resolveUserPermissions(user: ManagedUser): UserPermission[] {
	if (user.role === 'developer') {
		return ALL_PERMISSIONS
	}

	const permissionIdSet = new Set(user.custom_permissions ?? [])
	return ALL_PERMISSIONS.filter(permission => permissionIdSet.has(permission.id))
}

function createDashboardOverview(
	params?: DashboardOverviewParams,
): DashboardOverview {
	const dateTo = params?.date_to ?? toIso(new Date(), 0).slice(0, 10)
	const dateFrom =
		params?.date_from ?? toIso(new Date(), -29).slice(0, 10)

	const timeSeries = Array.from({ length: 10 }, (_, index) => {
		const pointDate = new Date()
		pointDate.setDate(pointDate.getDate() - (9 - index))
		const label = pointDate.toISOString().slice(0, 10)

		return {
			bucket_start: label,
			bucket_end: label,
			label,
			leads: 20 + index * 3,
			chats: 14 + index * 2,
			clients: 9 + index,
			contracts: 7 + index,
			revenue: String(8500000 + index * 670000),
			collected_amount: String(7200000 + index * 590000),
		}
	})

	return {
		leads: 248,
		clients: 144,
		instagram_leads: 104,
		telegram_leads: 96,
		manual_leads: 48,
		closed_sales: 38,
		lost_leads: 19,
		installations: 46,
		products: 92,
		chats: 316,
		notifications: 53,
		customers: 112,
		orders: 89,
		pending_payments: 14,
		contracts: 71,
		unread_messages: 11,
		revenue: '96500000',
		collected_amount: '81200000',
		pipeline_amount: '15300000',
		delivered_amount: '79800000',
		subsidy_amount: '8900000',
		date_range: {
			date_from: dateFrom,
			date_to: dateTo,
			interval: params?.interval ?? 'day',
			label_format: 'dd MMM',
			timezone: 'Asia/Tashkent',
		},
		filtered_summary: {
			leads: 248,
			new_leads: 82,
			converted_leads: 38,
			clients: 144,
			new_clients: 27,
			new_customers: 24,
			total_contracts: 71,
			active_contracts: 43,
			completed_orders: 76,
			total_chat_sessions: 316,
			active_chat_sessions: 48,
			pending_payment_amount: '15300000',
			revenue: '96500000',
			collected_amount: '81200000',
			average_order_value: '1084000',
			average_contract_value: '1359000',
			order_completion_rate: '85.39',
			lead_conversion_rate: '15.32',
			contract_renewal_rate: '62.50',
		},
		breakdowns: {
			leads_by_status: [
				{ key: 'new', label: 'New', count: 82 },
				{ key: 'contacted', label: 'Contacted', count: 54 },
				{ key: 'qualified', label: 'Qualified', count: 48 },
				{ key: 'converted', label: 'Converted', count: 38 },
				{ key: 'lost', label: 'Lost', count: 19 },
			],
			leads_by_source: [
				{ key: 'instagram', label: 'Instagram', count: 104 },
				{ key: 'telegram', label: 'Telegram', count: 96 },
				{ key: 'manual', label: 'Manual', count: 48 },
			],
			contracts_by_status: [
				{ key: 'draft', label: 'Draft', count: 10 },
				{ key: 'audit_pending', label: 'Audit Pending', count: 11 },
				{ key: 'paid', label: 'Paid', count: 28 },
				{ key: 'delivered', label: 'Delivered', count: 22 },
			],
			orders_by_status: [
				{ key: 'new', label: 'New', count: 16 },
				{ key: 'processing', label: 'Processing', count: 27 },
				{ key: 'done', label: 'Done', count: 46 },
			],
			payments_by_status: [
				{ key: 'pending', label: 'Pending', count: 14 },
				{ key: 'paid', label: 'Paid', count: 75 },
			],
			products_by_category: [
				{ key: 'HOSHANG-panels', label: 'HOSHANG Panels', count: 54 },
				{ key: 'inverters', label: 'Inverters', count: 24 },
				{ key: 'battery', label: 'Battery', count: 14 },
			],
			chats_by_channel: [
				{ key: 'telegram', label: 'Telegram', count: 172 },
				{ key: 'instagram', label: 'Instagram', count: 144 },
			],
			top_products: [
				{
					product_id: 'prd-1001',
					key: 'jinko-ja-585',
					label: 'Jinko JA 585W',
					count: 128,
					revenue: '24600000',
				},
				{
					product_id: 'prd-1002',
					key: 'longi-himo-x10',
					label: 'Longi Hi-MO X10',
					count: 107,
					revenue: '21800000',
				},
				{
					product_id: 'prd-1003',
					key: 'deye-12kw',
					label: 'Deye 12kW Inverter',
					count: 74,
					revenue: '17350000',
				},
			],
		},
		time_series: timeSeries,
		region_demand: [
			{ region: 'Tashkent', total: 91 },
			{ region: 'Samarkand', total: 46 },
			{ region: 'Namangan', total: 38 },
			{ region: 'Bukhara', total: 32 },
		],
		manager_performance: [
			{
				manager_id: 'user-3',
				manager_username: 'Sales Operator',
				total: 84,
				won: 31,
				lost: 9,
			},
		],
	}
}

class MockUsersService implements IUsersService {
	private users: ManagedUser[] = [...MOCK_USERS]

	async listUsers(params?: UsersListParams): Promise<PaginatedResponse<ManagedUser>> {
		const search = params?.search?.trim().toLowerCase() ?? ''
		const role = params?.role
		const isActive =
			typeof params?.is_active === 'boolean'
				? params?.is_active
				: params?.status === 'active'
					? true
					: params?.status === 'inactive'
						? false
						: undefined

		let filtered = this.users.filter(user => {
			if (role && user.role !== role) {
				return false
			}
			if (typeof isActive === 'boolean' && Boolean(user.is_active) !== isActive) {
				return false
			}
			if (!search) {
				return true
			}

			return [user.full_name, user.email, user.phone ?? '']
				.join(' ')
				.toLowerCase()
				.includes(search)
		})

		filtered = sortByDateField(filtered, params?.ordering)

		return paginate(filtered, params?.page, params?.page_size)
	}

	async getUserById(id: string): Promise<ManagedUser> {
		const user = this.users.find(item => item.id === id)
		if (!user) {
			throw new Error('User not found')
		}
		return { ...user }
	}

	async createUser(input: CreateUserInput): Promise<ManagedUser> {
		const timestamp = new Date().toISOString()
		const created: ManagedUser = {
			id: `user-${Date.now()}`,
			email: input.email.trim().toLowerCase(),
			full_name: input.full_name.trim(),
			phone: input.phone ?? null,
			role: input.role,
			is_active: input.is_active ?? true,
			custom_permissions: input.custom_permission_ids ?? [],
			created_by: 'system',
			created_by_name: 'System',
			created_at: timestamp,
			updated_at: timestamp,
		}
		this.users = [created, ...this.users]
		return { ...created }
	}

	async updateUser(id: string, input: UpdateUserInput): Promise<ManagedUser> {
		const targetIndex = this.users.findIndex(user => user.id === id)
		if (targetIndex < 0) {
			throw new Error('User not found')
		}

		const current = this.users[targetIndex]
		const updated: ManagedUser = {
			...current,
			email: input.email?.trim().toLowerCase() ?? current.email,
			full_name: input.full_name?.trim() ?? current.full_name,
			phone: input.phone !== undefined ? input.phone : current.phone,
			role: input.role ?? current.role,
			is_active: input.is_active ?? current.is_active,
			custom_permissions:
				input.custom_permission_ids ?? current.custom_permissions ?? [],
			updated_at: new Date().toISOString(),
		}

		this.users = [
			...this.users.slice(0, targetIndex),
			updated,
			...this.users.slice(targetIndex + 1),
		]

		return { ...updated }
	}

	async deleteUser(id: string): Promise<void> {
		this.users = this.users.filter(user => user.id !== id)
	}

	async toggleUserActive(id: string): Promise<ManagedUser> {
		const user = await this.getUserById(id)
		return this.updateUser(id, { is_active: !Boolean(user.is_active) })
	}

	async listPermissions(): Promise<UserPermission[]> {
		return [...ALL_PERMISSIONS]
	}

	async listRolesCatalog(): Promise<UserRoleCatalogItem[]> {
		return [...ROLE_CATALOG]
	}

	async listUserPermissions(userId: string): Promise<UserPermission[]> {
		const user = await this.getUserById(userId)
		return resolveUserPermissions(user)
	}

	async grantPermission(userId: string, permissionCode: string): Promise<void> {
		const permission = ALL_PERMISSIONS.find(item => item.code === permissionCode)
		if (!permission) {
			return
		}

		const targetUser = await this.getUserById(userId)
		const permissions = new Set(targetUser.custom_permissions ?? [])
		permissions.add(permission.id)
		await this.updateUser(userId, {
			custom_permission_ids: Array.from(permissions),
		})
	}

	async revokePermission(userId: string, permissionCode: string): Promise<void> {
		const permission = ALL_PERMISSIONS.find(item => item.code === permissionCode)
		if (!permission) {
			return
		}

		const targetUser = await this.getUserById(userId)
		const permissions = new Set(targetUser.custom_permissions ?? [])
		permissions.delete(permission.id)
		await this.updateUser(userId, {
			custom_permission_ids: Array.from(permissions),
		})
	}

	async bulkUpdateUsers(
		ids: string[],
		input: UpdateUserInput,
	): Promise<ManagedUser[]> {
		return Promise.all(ids.map(id => this.updateUser(id, input)))
	}

	async bulkDeleteUsers(ids: string[]): Promise<void> {
		const idSet = new Set(ids)
		this.users = this.users.filter(user => !idSet.has(user.id))
	}
}

class MockLogsService implements ILogsService {
	async listApiLogs(
		params?: LogsListParams,
	): Promise<PaginatedResponse<ApiLog>> {
		const filtered = filterLogs(MOCK_API_LOGS, params)
		const sorted = sortByDateField(filtered, params?.ordering ?? '-created_at')
		return paginate(sorted, params?.page, params?.page_size)
	}

	async getApiLog(id: string): Promise<ApiLog> {
		const log = MOCK_API_LOGS.find(item => item.id === id)
		if (!log) {
			throw new Error('API log not found')
		}
		return { ...log }
	}

	async listAILogs(params?: LogsListParams): Promise<PaginatedResponse<AILog>> {
		const filtered = filterLogs(MOCK_AI_LOGS, params)
		const sorted = sortByDateField(filtered, params?.ordering ?? '-created_at')
		return paginate(sorted, params?.page, params?.page_size)
	}

	async getAILog(id: string): Promise<AILog> {
		const log = MOCK_AI_LOGS.find(item => item.id === id)
		if (!log) {
			throw new Error('AI log not found')
		}
		return { ...log }
	}

	async getHealth(): Promise<SystemHealth> {
		return { ...DEFAULT_HEALTH }
	}
}

function filterLogs<T extends { level?: string; created_at?: string }>(
	logs: T[],
	params?: LogsListParams,
): T[] {
	const search = params?.search?.trim().toLowerCase() ?? ''
	const level = params?.level

	return logs.filter(log => {
		if (level && log.level !== level) {
			return false
		}
		if (!search) {
			return true
		}

		return JSON.stringify(log).toLowerCase().includes(search)
	})
}

class MockAISettingsService implements IAISettingsService {
	private activeSetting: AIActiveSetting = {
		id: '1',
		system_prompt:
			'You are Hoshang assistant. Capture lead details and escalate to operator when needed.',
		openai_api_key: 'sk-mock-key-1234567890',
		model_name: 'gpt-4.1',
		temperature: 0.7,
		max_tokens: 500,
		is_active: true,
		created_at: toIso(now, -14),
		updated_at: toIso(now, -1),
	}

	async getActiveSetting(): Promise<AIActiveSetting> {
		return { ...this.activeSetting }
	}

	async createOrUpdateActiveSetting(
		input: AIActiveSettingUpdateInput,
	): Promise<AIActiveSetting> {
		this.activeSetting = {
			...this.activeSetting,
			...input,
			temperature:
				typeof input.temperature === 'number'
					? input.temperature
					: this.activeSetting.temperature,
			max_tokens:
				typeof input.max_tokens === 'number'
					? Math.max(1, Math.round(input.max_tokens))
					: this.activeSetting.max_tokens,
			updated_at: new Date().toISOString(),
		}

		return { ...this.activeSetting }
	}

	async updateActiveSetting(
		input: AIActiveSettingUpdateInput,
	): Promise<AIActiveSetting> {
		return this.createOrUpdateActiveSetting(input)
	}
}

const usersService = new MockUsersService()
const logsService = new MockLogsService()
const aiSettingsService = new MockAISettingsService()

export const mockServices = {
	dashboard: {
		async getDashboardOverview(
			params?: DashboardOverviewParams,
		): Promise<DashboardOverview> {
			return createDashboardOverview(params)
		},
	},
	users: usersService,
	logs: logsService,
	aiSettings: aiSettingsService,
	common: {
		async getHealth(): Promise<SystemHealth> {
			return { ...DEFAULT_HEALTH }
		},
		async getPublicCompanyInfo(): Promise<{
			name: string
			phone: string
			email: string
		}> {
			return {
				name: 'AI Planner',
				phone: '+998 71 200 00 00',
				email: 'support@planner.local',
			}
		},
		async calculateSubsidy(payload: {
			requested_power_kw?: number
			audit_power_kw?: number
		}): Promise<{
			base_price: number
			subsidy_amount: number
			customer_amount: number
			subsidy_reference_power_kw: number
		}> {
			const requestedPower = Number(payload.requested_power_kw ?? 0)
			const auditPower = Number(payload.audit_power_kw ?? requestedPower)
			const referencePower = Math.max(1, Math.min(requestedPower, auditPower))
			const basePrice = referencePower * 8500000
			const subsidyAmount = basePrice * 0.18
			const customerAmount = basePrice - subsidyAmount

			return {
				base_price: Math.round(basePrice),
				subsidy_amount: Math.round(subsidyAmount),
				customer_amount: Math.round(customerAmount),
				subsidy_reference_power_kw: referencePower,
			}
		},
	},
}

export type MockServices = typeof mockServices
