// ===== Common =====
export interface CommonEntity {
	id: string
	createdAt: Date
	updatedAt?: Date
}

// Export individual domain modules
export type * from './common'
export type * from './user'
export type * from './log'
