import { mockServices } from './mock-services'

import type {
	IDashboardService,
	ILogsService,
	IUsersService,
} from './contracts'

// APIs are intentionally disabled for now.
// import { DashboardAdapter } from './adapters/implementations/dashboard.adapter'
// import { LogsAdapter } from './adapters/implementations/logs.adapter'
// import { UsersAdapter } from './adapters/implementations/users.adapter'

export interface ServiceRegistry {
	dashboard: IDashboardService
	logs: ILogsService
	users: IUsersService
}

export function createServiceRegistry(_baseUrl: string): ServiceRegistry {
	return {
		dashboard: {
			getDashboard: async params => {
				const overview = await mockServices.dashboard.getDashboardOverview(params)
				return {
					stats: [
						{
							id: 'metric-leads',
							metric_name: 'leads',
							metric_value: overview.leads,
							period: overview.date_range.interval,
						},
					],
					period: {
						from: overview.date_range.date_from,
						to: overview.date_range.date_to,
					},
				}
			},
			getStats: async params => {
				const overview = await mockServices.dashboard.getDashboardOverview(params)
				return [
					{
						id: 'metric-leads',
						metric_name: 'leads',
						metric_value: overview.leads,
						period: overview.date_range.interval,
					},
					{
						id: 'metric-clients',
						metric_name: 'clients',
						metric_value: overview.clients,
						period: overview.date_range.interval,
					},
				]
			},
		},
		logs: mockServices.logs,
		users: mockServices.users,
	}
}

let serviceRegistry: ServiceRegistry | null = null

export function initializeServices(baseUrl: string): ServiceRegistry {
	serviceRegistry = createServiceRegistry(baseUrl)
	return serviceRegistry
}

export function getServices(): ServiceRegistry {
	if (!serviceRegistry) {
		serviceRegistry = createServiceRegistry('')
	}
	return serviceRegistry
}
