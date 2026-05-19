import { mockServices } from './mock-services'

// APIs are intentionally disabled for now. Keep imports below commented
// so switching back to live services is explicit and controlled.
// import { getServices } from './registry'
// import { apiDashboardService } from './api/dashboard-service'
// import { apiLogsService } from './api/common.service'
// import { apiAISettingsService } from './api/ai-settings.service'

export const services = {
  ...mockServices,
}
