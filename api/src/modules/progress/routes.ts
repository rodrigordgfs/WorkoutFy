import fp from 'fastify-plugin'

import { errorResponseSchema } from '../../common/http/schemas.js'
import { createProgressRepository } from './repository.js'
import { progressOverviewResponseSchema } from './schemas.js'
import { createProgressService } from './service.js'

export default fp(async function progressRoutes(app) {
  const progressService = createProgressService(createProgressRepository(() => app.prisma))

  app.get(
    '/progress/overview',
    {
      schema: {
        tags: ['Progress'],
        summary: 'Get progress overview',
        description:
          'Returns a small authenticated overview of user progress, consistency, profile snapshot and exercise load evolution.',
        response: {
          200: progressOverviewResponseSchema,
          401: errorResponseSchema,
          500: errorResponseSchema,
        },
      },
    },
    async function getProgressOverview(request) {
      const currentUser = await app.requireCurrentUser(request)
      return progressService.getProgressOverview(currentUser)
    },
  )
})
