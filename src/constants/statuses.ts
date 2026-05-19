import type { SelectOption } from '../types/common'
import type { UserStatus } from '../types/user'

export const USER_STATUSES = [
	'active',
	'inactive',
	'invited',
] as const satisfies readonly UserStatus[]

export const USER_STATUS_LABELS: Record<UserStatus, string> = {
	active: 'Active',
	inactive: 'Inactive',
	invited: 'Invited',
}

export const USER_STATUS_OPTIONS: SelectOption[] = [
	{ value: 'active', label: USER_STATUS_LABELS.active },
	{ value: 'inactive', label: USER_STATUS_LABELS.inactive },
	{ value: 'invited', label: USER_STATUS_LABELS.invited },
]

