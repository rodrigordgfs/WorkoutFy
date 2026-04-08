import type { FastifyRequest } from 'fastify'
import type { AuthenticatedClerkContext } from '../../common/auth/clerk-auth.js'

export type CurrentUserProfile = {
  displayName: string | null
  dateOfBirth: string | null
  heightCm: number | null
  weightKg: number | null
}

export type UpdateCurrentUserProfileInput = {
  displayName?: string | null
  dateOfBirth?: string | null
  heightCm?: number | null
  weightKg?: number | null
}

export type CurrentUser = {
  id: string
  clerkUserId: string
  email: string | null
  firstName: string | null
  lastName: string | null
  imageUrl: string | null
  profile: CurrentUserProfile
}

export type PersistedUserRecord = {
  id: string
  clerkUserId: string
  email: string | null
  firstName: string | null
  lastName: string | null
  imageUrl: string | null
  profile: {
    displayName: string | null
    dateOfBirth: Date | null
    heightCm: number | null
    weightKg: number | null
  }
}

export interface UsersRepository {
  upsertByClerkUserId(input: AuthenticatedClerkContext): Promise<PersistedUserRecord>
  updateProfileByUserId(userId: string, input: UpdateCurrentUserProfileInput): Promise<PersistedUserRecord['profile']>
}

declare module 'fastify' {
  interface FastifyInstance {
    syncCurrentUser(request: FastifyRequest): Promise<CurrentUser>
    requireCurrentUser(request: FastifyRequest): Promise<CurrentUser>
    updateCurrentUserProfile(currentUser: CurrentUser, input: UpdateCurrentUserProfileInput): Promise<CurrentUser>
  }

  interface FastifyRequest {
    currentUser: CurrentUser | null
  }
}
