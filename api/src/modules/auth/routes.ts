import fp from 'fastify-plugin'
import type { FastifyReply } from 'fastify'

import { resolveAdminAccess } from '../../common/auth/clerk-auth.js'
import { errorResponseSchema } from '../../common/http/schemas.js'
import { createAuthProvider } from './provider.js'
import {
  authCredentialsBodySchema,
  authSessionResponseSchema,
  parseSignInInput,
  parseSignUpInput,
} from './schemas.js'
import { createAuthService } from './service.js'

const authContextResponseSchema = {
  type: 'object',
  additionalProperties: false,
  required: ['clerkUserId'],
  properties: {
    clerkUserId: { type: 'string' },
    email: { type: ['string', 'null'] },
    firstName: { type: ['string', 'null'] },
    lastName: { type: ['string', 'null'] },
    imageUrl: { type: ['string', 'null'] },
  },
} as const

const adminStatusResponseSchema = {
  type: 'object',
  additionalProperties: false,
  required: ['isAdmin', 'authorizationSource'],
  properties: {
    isAdmin: { type: 'boolean' },
    authorizationSource: { type: 'string' },
  },
} as const

const adminAccessResponseSchema = {
  type: 'object',
  additionalProperties: false,
  required: ['authorized', 'authorizationSource'],
  properties: {
    authorized: { type: 'boolean' },
    authorizationSource: { type: 'string' },
  },
} as const

function createSessionCookieHeader(token: string): string {
  const attributes = [
    `__session=${encodeURIComponent(token)}`,
    'Path=/',
    'HttpOnly',
    'SameSite=Lax',
  ]

  if (process.env.NODE_ENV === 'production') {
    attributes.push('Secure')
  }

  return attributes.join('; ')
}

function createClearSessionCookieHeader(): string {
  const attributes = [
    '__session=',
    'Path=/',
    'HttpOnly',
    'SameSite=Lax',
    'Max-Age=0',
    'Expires=Thu, 01 Jan 1970 00:00:00 GMT',
  ]

  if (process.env.NODE_ENV === 'production') {
    attributes.push('Secure')
  }

  return attributes.join('; ')
}

function setSessionCookie(reply: FastifyReply, token: string) {
  reply.header('Set-Cookie', createSessionCookieHeader(token))
}

function clearSessionCookie(reply: FastifyReply) {
  reply.header('Set-Cookie', createClearSessionCookieHeader())
}

export default fp(async function authRoutes(app) {
  const authService = createAuthService(createAuthProvider())

  app.post(
    '/auth/sign-up',
    {
      config: {
        allowUnauthenticated: true,
      },
      schema: {
        tags: ['Auth'],
        summary: 'Sign up with API-mediated Clerk auth',
        description:
          'Creates a user through the backend and establishes an HTTP-only authenticated session cookie for the frontend.',
        body: authCredentialsBodySchema,
        response: {
          201: authSessionResponseSchema,
          400: errorResponseSchema,
          409: errorResponseSchema,
          503: errorResponseSchema,
        },
      },
    },
    async function signUp(request, reply) {
      const input = parseSignUpInput(request.body)
      const result = await authService.signUp(input)

      setSessionCookie(reply, result.sessionToken)
      request.authContext = result.authContext

      const session = await authService.getSession(request, {
        requireCurrentUser: app.requireCurrentUser,
      })

      return reply.code(201).send(session)
    },
  )

  app.post(
    '/auth/sign-in',
    {
      config: {
        allowUnauthenticated: true,
      },
      schema: {
        tags: ['Auth'],
        summary: 'Sign in with API-mediated Clerk auth',
        description:
          'Authenticates a user through the backend and establishes an HTTP-only authenticated session cookie for the frontend.',
        body: authCredentialsBodySchema,
        response: {
          200: authSessionResponseSchema,
          400: errorResponseSchema,
          401: errorResponseSchema,
          503: errorResponseSchema,
        },
      },
    },
    async function signIn(request, reply) {
      const input = parseSignInInput(request.body)
      const result = await authService.signIn(input)

      setSessionCookie(reply, result.sessionToken)
      request.authContext = result.authContext

      const session = await authService.getSession(request, {
        requireCurrentUser: app.requireCurrentUser,
      })

      return reply.send(session)
    },
  )

  app.post(
    '/auth/sign-out',
    {
      config: {
        allowUnauthenticated: true,
      },
      schema: {
        tags: ['Auth'],
        summary: 'Sign out current session',
        description:
          'Revokes the current session when present and clears the HTTP-only authentication cookie.',
        response: {
          204: {
            type: 'null',
          },
          503: errorResponseSchema,
        },
      },
    },
    async function signOut(request, reply) {
      await authService.signOut(request)
      clearSessionCookie(reply)
      return reply.code(204).send()
    },
  )

  app.get(
    '/auth/session',
    {
      config: {
        allowUnauthenticated: true,
      },
      schema: {
        tags: ['Auth'],
        summary: 'Resolve current authenticated session',
        description:
          'Returns the current authenticated session state for frontend bootstrap. When no valid session exists, returns authenticated false.',
        response: {
          200: authSessionResponseSchema,
          500: errorResponseSchema,
          503: errorResponseSchema,
        },
      },
    },
    async function getSession(request) {
      return authService.getSession(request, {
        requireCurrentUser: app.requireCurrentUser,
      })
    },
  )

  app.get(
    '/auth/context',
    {
      schema: {
        tags: ['Auth'],
        summary: 'Resolve authenticated Clerk context',
        description:
          'Protected route that proves the /api boundary enforces authentication and exposes the normalized authenticated context.',
        response: {
          200: authContextResponseSchema,
          401: errorResponseSchema,
          500: errorResponseSchema,
        },
      },
    },
    async function getAuthContext(request) {
      const authContext = await app.requireAuth(request)
      return authContext
    },
  )

  app.get(
    '/auth/admin/status',
    {
      schema: {
        tags: ['Auth'],
        summary: 'Resolve administrative access status',
        description:
          'Returns whether the current authenticated user resolves as admin from Clerk private metadata without requiring the user to already be admin.',
        response: {
          200: adminStatusResponseSchema,
          401: errorResponseSchema,
          503: errorResponseSchema,
        },
      },
    },
    async function getAdminStatus(request) {
      const authContext = await app.requireAuth(request)
      const isAdmin =
        request.adminAccess ?? (await resolveAdminAccess(authContext.clerkUserId, request))

      request.adminAccess = isAdmin

      return {
        isAdmin,
        authorizationSource: 'privateMetadata',
      }
    },
  )

  app.get(
    '/auth/admin/access',
    {
      schema: {
        tags: ['Auth'],
        summary: 'Prove administrative access',
        description:
          'Protected administrative proof route that requires the current Clerk user to resolve `role = admin` from private metadata on the backend.',
        response: {
          200: adminAccessResponseSchema,
          401: errorResponseSchema,
          403: errorResponseSchema,
          503: errorResponseSchema,
        },
      },
    },
    async function getAdminAccess(request) {
      await app.requireAdmin(request)

      return {
        authorized: true,
        authorizationSource: 'privateMetadata',
      }
    },
  )
})
