import 'dotenv/config'

import type { FastifyRequest } from 'fastify'
import fp from 'fastify-plugin'

import { getAuthenticatedClerkContext, resolveAdminAccess, type AuthenticatedClerkContext } from '../common/auth/clerk-auth.js'
import { AppError } from '../common/errors/app-error.js'

declare module 'fastify' {
  interface FastifyContextConfig {
    allowUnauthenticated?: boolean
  }

  interface FastifyInstance {
    requireAuth(request: FastifyRequest): Promise<AuthenticatedClerkContext>
    requireAdmin(request: FastifyRequest): Promise<AuthenticatedClerkContext>
  }
}

export default fp(async function authPlugin(app) {
  const secretKey = process.env.CLERK_SECRET_KEY
  const publishableKey = process.env.CLERK_PUBLISHABLE_KEY

  const missingEnvVars = [
    !secretKey ? 'CLERK_SECRET_KEY' : null,
    !publishableKey ? 'CLERK_PUBLISHABLE_KEY' : null,
  ].filter((value): value is string => value !== null)

  if (missingEnvVars.length > 0) {
    throw new AppError(
      'Clerk configuration is incomplete.',
      'CONFIGURATION_ERROR',
      500,
      { missingEnvVars },
    )
  }

  const { clerkPlugin } = await import('@clerk/fastify')

  app.decorateRequest('authContext', null)
  app.decorateRequest('adminAccess', null)
  app.decorate('requireAuth', async function requireAuth(request) {
    const authContext = await getAuthenticatedClerkContext(request)
    request.authContext = authContext

    return authContext
  })

  await app.register(clerkPlugin, {
    secretKey,
    publishableKey,
    hookName: 'onRequest',
  })

  app.decorate('requireAdmin', async function requireAdmin(request) {
    const authContext = await app.requireAuth(request)

    const isAdmin =
      request.adminAccess ?? (await resolveAdminAccess(authContext.clerkUserId, request))

    request.adminAccess = isAdmin

    if (!isAdmin) {
      throw new AppError('Administrator access is required.', 'FORBIDDEN', 403)
    }

    return authContext
  })

  app.addHook('preHandler', async (request) => {
    if (request.routeOptions.config.allowUnauthenticated === true) {
      return
    }

    await app.requireAuth(request)
  })
})
