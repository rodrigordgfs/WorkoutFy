import type { FastifyRequest } from 'fastify'
import { clerkClient, getAuth } from '@clerk/fastify'
import { z, ZodError } from 'zod'

import { AppError } from '../errors/app-error.js'

export type AuthenticatedClerkContext = {
  clerkUserId: string
  email: string | null
  firstName: string | null
  lastName: string | null
  imageUrl: string | null
}

declare module 'fastify' {
  interface FastifyRequest {
    authContext: AuthenticatedClerkContext | null
    adminAccess: boolean | null
  }
}

const authenticatedClerkContextSchema = z.object({
  clerkUserId: z.string().trim().min(1),
  email: z.email().nullable(),
  firstName: z.string().trim().min(1).nullable(),
  lastName: z.string().trim().min(1).nullable(),
  imageUrl: z.url().nullable(),
}) satisfies z.ZodType<AuthenticatedClerkContext>

function getSingleHeaderValue(header: string | string[] | undefined): string | null {
  if (typeof header === 'string') {
    return header.trim() || null
  }

  if (Array.isArray(header) && header.length > 0) {
    return header[0]?.trim() || null
  }

  return null
}

function getCookieValue(request: FastifyRequest, cookieName: string): string | null {
  const cookieHeader = getSingleHeaderValue(request.headers.cookie)

  if (!cookieHeader) {
    return null
  }

  for (const cookie of cookieHeader.split(';')) {
    const [name, ...rawValueParts] = cookie.trim().split('=')

    if (name === cookieName) {
      const value = rawValueParts.join('=').trim()
      return value.length > 0 ? decodeURIComponent(value) : null
    }
  }

  return null
}

function getOptionalString(value: unknown): string | null {
  return typeof value === 'string' && value.trim().length > 0 ? value.trim() : null
}

function getSessionClaim(
  claims: Record<string, unknown> | null | undefined,
  ...keys: string[]
): string | null {
  if (!claims) {
    return null
  }

  for (const key of keys) {
    const value = claims[key]

    if (typeof value === 'string' && value.trim().length > 0) {
      return value.trim()
    }
  }

  return null
}

function toInvalidAuthContextError(error: ZodError): AppError {
  return new AppError('Authenticated user context is invalid.', 'INVALID_AUTH_CONTEXT', 401, {
    issues: error.issues.map((issue) => ({
      path: issue.path.join('.'),
      message: issue.message,
    })),
  })
}

function getRoleValue(metadata: unknown): string | null {
  if (typeof metadata !== 'object' || metadata === null || !('role' in metadata)) {
    return null
  }

  const role = (metadata as { role?: unknown }).role
  return typeof role === 'string' && role.trim().length > 0 ? role.trim() : null
}

function getTestAdminAccess(request: FastifyRequest): boolean | null {
  if (process.env.NODE_ENV !== 'test') {
    return null
  }

  const role = getSingleHeaderValue(request.headers['x-test-clerk-role'])

  if (!role) {
    const cookie = getCookieValue(request, '__session')

    if (!cookie?.startsWith('test_session.')) {
      return false
    }

    try {
      const payload = JSON.parse(Buffer.from(cookie.slice('test_session.'.length), 'base64url').toString('utf8')) as {
        role?: unknown
      }

      return payload.role === 'admin'
    } catch {
      return false
    }
  }

  return role === 'admin'
}

type ClerkLikeError = {
  status?: number
  statusCode?: number
}

function getErrorStatus(error: unknown): number | null {
  if (typeof error !== 'object' || error === null) {
    return null
  }

  const candidate = error as ClerkLikeError

  if (typeof candidate.status === 'number') {
    return candidate.status
  }

  if (typeof candidate.statusCode === 'number') {
    return candidate.statusCode
  }

  return null
}

export async function resolveAdminAccess(
  clerkUserId: string,
  request?: FastifyRequest,
): Promise<boolean> {
  const testAdminAccess = request ? getTestAdminAccess(request) : null

  if (testAdminAccess !== null) {
    return testAdminAccess
  }

  try {
    const user = await clerkClient.users.getUser(clerkUserId)
    return getRoleValue(user.privateMetadata) === 'admin'
  } catch (error) {
    const status = getErrorStatus(error)

    if (status === 404) {
      throw new AppError('Authentication is required.', 'UNAUTHORIZED', 401)
    }

    throw new AppError(
      'Unable to resolve administrative permissions from Clerk.',
      'AUTH_PROVIDER_UNAVAILABLE',
      503,
      {
        clerkUserId,
        ...(error instanceof Error ? { cause: error.message } : {}),
      },
    )
  }
}

function getTestAuthenticatedClerkContext(request: FastifyRequest): AuthenticatedClerkContext | null {
  if (process.env.NODE_ENV !== 'test') {
    return null
  }

  const clerkUserId = getSingleHeaderValue(request.headers['x-test-clerk-user-id'])

  if (!clerkUserId) {
    const cookie = getCookieValue(request, '__session')

    if (!cookie?.startsWith('test_session.')) {
      return null
    }

    try {
      const payload = JSON.parse(Buffer.from(cookie.slice('test_session.'.length), 'base64url').toString('utf8')) as {
        clerkUserId?: unknown
        email?: unknown
        firstName?: unknown
        lastName?: unknown
        imageUrl?: unknown
      }

      return authenticatedClerkContextSchema.parse({
        clerkUserId: typeof payload.clerkUserId === 'string' ? payload.clerkUserId : '',
        email: typeof payload.email === 'string' ? payload.email : null,
        firstName: typeof payload.firstName === 'string' ? payload.firstName : null,
        lastName: typeof payload.lastName === 'string' ? payload.lastName : null,
        imageUrl: typeof payload.imageUrl === 'string' ? payload.imageUrl : null,
      })
    } catch {
      return null
    }
  }

  const imageUrl = getSingleHeaderValue(request.headers['x-test-clerk-image-url'])

  if (imageUrl && !URL.canParse(imageUrl)) {
    throw new AppError('Authenticated user context is invalid.', 'INVALID_AUTH_CONTEXT', 401, {
      issues: [
        {
          path: 'imageUrl',
          message: 'Invalid URL',
        },
      ],
    })
  }

  return authenticatedClerkContextSchema.parse({
    clerkUserId,
    email: getSingleHeaderValue(request.headers['x-test-clerk-email']),
    firstName: getSingleHeaderValue(request.headers['x-test-clerk-first-name']),
    lastName: getSingleHeaderValue(request.headers['x-test-clerk-last-name']),
    imageUrl,
  })
}

export async function getAuthenticatedClerkContext(request: FastifyRequest): Promise<AuthenticatedClerkContext> {
  if (request.authContext) {
    return request.authContext
  }

  const testContext = getTestAuthenticatedClerkContext(request)

  if (testContext) {
    request.authContext = testContext
    return testContext
  }

  const auth = getAuth(request)

  if (!auth.userId) {
    throw new AppError('Authentication is required.', 'UNAUTHORIZED', 401)
  }

  const sessionClaims =
    auth.sessionClaims && typeof auth.sessionClaims === 'object'
      ? (auth.sessionClaims as Record<string, unknown>)
      : null

  try {
    const imageUrl = getSessionClaim(sessionClaims, 'image_url', 'imageUrl', 'picture')

    if (imageUrl && !URL.canParse(imageUrl)) {
      throw new ZodError([
        {
          code: 'custom',
          path: ['imageUrl'],
          message: 'Invalid URL',
          input: imageUrl,
        },
      ])
    }

    const context = authenticatedClerkContextSchema.parse({
      clerkUserId: auth.userId,
      email:
        getSessionClaim(sessionClaims, 'email', 'email_address', 'emailAddress') ??
        getOptionalString((sessionClaims?.email_addresses as Array<{ email_address?: string }> | undefined)?.[0]?.email_address),
      firstName: getSessionClaim(sessionClaims, 'first_name', 'firstName', 'given_name'),
      lastName: getSessionClaim(sessionClaims, 'last_name', 'lastName', 'family_name'),
      imageUrl,
    })

    request.authContext = context
    return context
  } catch (error) {
    if (error instanceof ZodError) {
      throw toInvalidAuthContextError(error)
    }

    throw error
  }
}
