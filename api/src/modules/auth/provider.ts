import { createClerkClient, type ClerkClient } from '@clerk/backend'

import { AppError } from '../../common/errors/app-error.js'
import type { AuthenticatedClerkContext } from '../../common/auth/clerk-auth.js'
import type { AuthProvider, AuthProviderResult, SignInInput, SignUpInput } from './types.js'

type ClerkLikeError = {
  status?: number
  statusCode?: number
  errors?: Array<{
    code?: string
    message?: string
    longMessage?: string
    meta?: Record<string, unknown>
  }>
}

function getErrorStatus(error: unknown): number | null {
  if (typeof error !== 'object' || error === null) {
    return null
  }

  const candidate = error as ClerkLikeError
  return typeof candidate.status === 'number'
    ? candidate.status
    : typeof candidate.statusCode === 'number'
      ? candidate.statusCode
      : null
}

function getPrimaryEmail(user: {
  primaryEmailAddressId: string | null
  emailAddresses: Array<{ id: string; emailAddress: string }>
}): string | null {
  if (!user.primaryEmailAddressId) {
    return user.emailAddresses[0]?.emailAddress ?? null
  }

  return (
    user.emailAddresses.find((emailAddress) => emailAddress.id === user.primaryEmailAddressId)
      ?.emailAddress ?? null
  )
}

function toAuthenticatedClerkContext(user: {
  id: string
  emailAddresses: Array<{ id: string; emailAddress: string }>
  primaryEmailAddressId: string | null
  firstName: string | null
  lastName: string | null
  imageUrl: string
}): AuthenticatedClerkContext {
  return {
    clerkUserId: user.id,
    email: getPrimaryEmail(user),
    firstName: user.firstName,
    lastName: user.lastName,
    imageUrl: user.imageUrl || null,
  }
}

function toAuthProviderResult(input: {
  sessionId: string
  sessionToken: string
  authContext: AuthenticatedClerkContext
}): AuthProviderResult {
  return input
}

function toAuthProviderUnavailableError(error: unknown): AppError {
  return new AppError('Authentication provider is unavailable.', 'AUTH_PROVIDER_UNAVAILABLE', 503, {
    ...(error instanceof Error ? { cause: error.message } : {}),
  })
}

function toDuplicateAccountError(error: unknown): AppError {
  const candidate = error as ClerkLikeError
  const duplicateEmail = candidate?.errors?.some(
    (issue) =>
      issue.code === 'form_identifier_exists' ||
      issue.message?.toLowerCase().includes('already') === true ||
      issue.longMessage?.toLowerCase().includes('already') === true,
  )

  if (duplicateEmail) {
    return new AppError('An account with this email already exists.', 'AUTH_ACCOUNT_ALREADY_EXISTS', 409)
  }

  return new AppError('Unable to create account.', 'AUTH_SIGN_UP_FAILED', 400, {
    ...(error instanceof Error ? { cause: error.message } : {}),
  })
}

function toInvalidCredentialsError(): AppError {
  return new AppError('Invalid email or password.', 'AUTH_INVALID_CREDENTIALS', 401)
}

function createProductionAuthProvider(clerkClient: ClerkClient): AuthProvider {
  return {
    async signUp(input: SignUpInput) {
      try {
        const user = await clerkClient.users.createUser({
          emailAddress: [input.email],
          password: input.password,
        })

        const session = await clerkClient.sessions.createSession({
          userId: user.id,
        })

        const token = await clerkClient.sessions.getToken(session.id)

        return toAuthProviderResult({
          sessionId: session.id,
          sessionToken: token.jwt,
          authContext: toAuthenticatedClerkContext(user),
        })
      } catch (error) {
        const status = getErrorStatus(error)

        if (status && status >= 400 && status < 500) {
          throw toDuplicateAccountError(error)
        }

        throw toAuthProviderUnavailableError(error)
      }
    },
    async signIn(input: SignInInput) {
      try {
        const users = await clerkClient.users.getUserList({
          emailAddress: [input.email],
        })

        const user = users.data[0]

        if (!user) {
          throw toInvalidCredentialsError()
        }

        try {
          await clerkClient.users.verifyPassword({
            userId: user.id,
            password: input.password,
          })
        } catch {
          throw toInvalidCredentialsError()
        }

        const session = await clerkClient.sessions.createSession({
          userId: user.id,
        })

        const token = await clerkClient.sessions.getToken(session.id)

        return toAuthProviderResult({
          sessionId: session.id,
          sessionToken: token.jwt,
          authContext: toAuthenticatedClerkContext(user),
        })
      } catch (error) {
        if (error instanceof AppError) {
          throw error
        }

        throw toAuthProviderUnavailableError(error)
      }
    },
    async signOut(sessionId: string) {
      try {
        await clerkClient.sessions.revokeSession(sessionId)
      } catch (error) {
        const status = getErrorStatus(error)

        if (status === 404) {
          return
        }

        throw toAuthProviderUnavailableError(error)
      }
    },
  }
}

type TestStoredUser = {
  clerkUserId: string
  email: string
  password: string
  firstName: string | null
  lastName: string | null
  imageUrl: string | null
  role: string | null
}

function createTestSessionToken(user: TestStoredUser): string {
  const payload = Buffer.from(
    JSON.stringify({
      clerkUserId: user.clerkUserId,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      imageUrl: user.imageUrl,
      role: user.role,
    }),
  ).toString('base64url')

  return `test_session.${payload}`
}

function createTestAuthProvider(): AuthProvider {
  const usersByEmail = new Map<string, TestStoredUser>()
  let userCounter = 0
  let sessionCounter = 0

  return {
    async signUp(input: SignUpInput) {
      const normalizedEmail = input.email.trim().toLowerCase()

      if (usersByEmail.has(normalizedEmail)) {
        throw new AppError('An account with this email already exists.', 'AUTH_ACCOUNT_ALREADY_EXISTS', 409)
      }

      userCounter += 1

      const user: TestStoredUser = {
        clerkUserId: `clerk_user_test_${userCounter}`,
        email: normalizedEmail,
        password: input.password,
        firstName: null,
        lastName: null,
        imageUrl: null,
        role: null,
      }

      usersByEmail.set(normalizedEmail, user)
      sessionCounter += 1

      return {
        sessionId: `sess_test_${sessionCounter}`,
        sessionToken: createTestSessionToken(user),
        authContext: {
          clerkUserId: user.clerkUserId,
          email: user.email,
          firstName: user.firstName,
          lastName: user.lastName,
          imageUrl: user.imageUrl,
        },
      }
    },
    async signIn(input: SignInInput) {
      const normalizedEmail = input.email.trim().toLowerCase()
      const user = usersByEmail.get(normalizedEmail)

      if (!user || user.password !== input.password) {
        throw toInvalidCredentialsError()
      }

      sessionCounter += 1

      return {
        sessionId: `sess_test_${sessionCounter}`,
        sessionToken: createTestSessionToken(user),
        authContext: {
          clerkUserId: user.clerkUserId,
          email: user.email,
          firstName: user.firstName,
          lastName: user.lastName,
          imageUrl: user.imageUrl,
        },
      }
    },
    async signOut() {
      return
    },
  }
}

export function createAuthProvider(): AuthProvider {
  if (process.env.NODE_ENV === 'test') {
    return createTestAuthProvider()
  }

  const secretKey = process.env.CLERK_SECRET_KEY
  const publishableKey = process.env.CLERK_PUBLISHABLE_KEY

  if (!secretKey || !publishableKey) {
    throw new AppError('Clerk configuration is incomplete.', 'CONFIGURATION_ERROR', 500, {
      missingEnvVars: [
        !secretKey ? 'CLERK_SECRET_KEY' : null,
        !publishableKey ? 'CLERK_PUBLISHABLE_KEY' : null,
      ].filter(Boolean),
    })
  }

  return createProductionAuthProvider(
    createClerkClient({
      secretKey,
      publishableKey,
    }),
  )
}

