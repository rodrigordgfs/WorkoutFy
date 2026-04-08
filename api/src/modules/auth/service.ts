import { getAuth } from '@clerk/fastify'

import { AppError } from '../../common/errors/app-error.js'
import { getAuthenticatedClerkContext, resolveAdminAccess } from '../../common/auth/clerk-auth.js'
import type { CurrentUser } from '../users/types.js'
import type { AuthProvider, AuthSessionResponse, AuthSessionUser, SignInInput, SignUpInput } from './types.js'

function toAuthSessionUser(currentUser: CurrentUser, isAdmin: boolean): AuthSessionUser {
  return {
    id: currentUser.id,
    clerkUserId: currentUser.clerkUserId,
    email: currentUser.email,
    firstName: currentUser.firstName,
    lastName: currentUser.lastName,
    imageUrl: currentUser.imageUrl,
    profile: currentUser.profile,
    isAdmin,
  }
}

function isUnauthorizedError(error: unknown): boolean {
  return error instanceof AppError && error.code === 'UNAUTHORIZED'
}

export function createAuthService(provider: AuthProvider) {
  return {
    async signUp(input: SignUpInput) {
      return provider.signUp(input)
    },
    async signIn(input: SignInInput) {
      return provider.signIn(input)
    },
    async signOut(request: Parameters<typeof getAuth>[0]) {
      const auth = getAuth(request)

      if (auth.sessionId) {
        await provider.signOut(auth.sessionId)
      }
    },
    async getSession(
      request: Parameters<typeof getAuthenticatedClerkContext>[0] & {
        currentUser: CurrentUser | null
      },
      dependencies: {
        requireCurrentUser: (request: Parameters<typeof getAuthenticatedClerkContext>[0]) => Promise<CurrentUser>
      },
    ): Promise<AuthSessionResponse> {
      try {
        const authContext = await getAuthenticatedClerkContext(request)
        const currentUser =
          request.currentUser ?? (await dependencies.requireCurrentUser(request))
        const isAdmin =
          request.adminAccess ?? (await resolveAdminAccess(authContext.clerkUserId, request))

        request.adminAccess = isAdmin

        return {
          authenticated: true,
          user: toAuthSessionUser(currentUser, isAdmin),
        }
      } catch (error) {
        if (isUnauthorizedError(error)) {
          return {
            authenticated: false,
            user: null,
          }
        }

        throw error
      }
    },
  }
}

