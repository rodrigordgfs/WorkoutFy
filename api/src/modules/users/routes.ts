import fp from 'fastify-plugin'

import { errorResponseSchema } from '../../common/http/schemas.js'
import { currentUserResponseSchema, parseUpdateCurrentUserProfileInput, updateCurrentUserProfileBodySchema } from './schemas.js'

export default fp(async function usersRoutes(app) {
  app.get(
    '/users/me',
    {
      schema: {
        tags: ['Users'],
        summary: 'Resolve current authenticated user',
        description:
          'Creates or reuses the internal user linked to the current Clerk identity and returns the persisted profile baseline.',
        response: {
          200: currentUserResponseSchema,
          401: errorResponseSchema,
          500: errorResponseSchema,
        },
      },
    },
    async function getCurrentUser(request) {
      return app.requireCurrentUser(request)
    },
  )

  app.patch(
    '/users/me',
    {
      schema: {
        tags: ['Users'],
        summary: 'Update current authenticated user profile',
        description:
          'Updates only the editable application profile fields for the current authenticated user without changing Clerk-synced identity fields.',
        body: updateCurrentUserProfileBodySchema,
        response: {
          200: currentUserResponseSchema,
          400: errorResponseSchema,
          401: errorResponseSchema,
          500: errorResponseSchema,
        },
      },
    },
    async function patchCurrentUser(request) {
      const currentUser = await app.requireCurrentUser(request)
      const input = parseUpdateCurrentUserProfileInput(request.body)

      const updatedUser = await app.updateCurrentUserProfile(currentUser, input)
      request.currentUser = updatedUser

      return updatedUser
    },
  )
})
