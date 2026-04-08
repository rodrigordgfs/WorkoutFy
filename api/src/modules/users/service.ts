import { getAuthenticatedClerkContext } from './auth-context.js'
import type { CurrentUser, PersistedUserRecord, UpdateCurrentUserProfileInput, UsersRepository } from './types.js'

function toCurrentUser(record: PersistedUserRecord): CurrentUser {
  return {
    id: record.id,
    clerkUserId: record.clerkUserId,
    email: record.email,
    firstName: record.firstName,
    lastName: record.lastName,
    imageUrl: record.imageUrl,
    profile: {
      displayName: record.profile.displayName,
      dateOfBirth: record.profile.dateOfBirth?.toISOString().slice(0, 10) ?? null,
      heightCm: record.profile.heightCm,
      weightKg: record.profile.weightKg,
    },
  }
}

export function createUsersService(repository: UsersRepository) {
  return {
    async syncCurrentUser(request: Parameters<typeof getAuthenticatedClerkContext>[0]): Promise<CurrentUser> {
      const clerkContext = await getAuthenticatedClerkContext(request)
      return toCurrentUser(await repository.upsertByClerkUserId(clerkContext))
    },
    async updateCurrentUserProfile(
      currentUser: CurrentUser,
      input: UpdateCurrentUserProfileInput,
    ): Promise<CurrentUser> {
      const profile = await repository.updateProfileByUserId(currentUser.id, input)

      return {
        ...currentUser,
        profile: {
          displayName: profile.displayName,
          dateOfBirth: profile.dateOfBirth?.toISOString().slice(0, 10) ?? null,
          heightCm: profile.heightCm,
          weightKg: profile.weightKg,
        },
      }
    },
  }
}
