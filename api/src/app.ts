import 'dotenv/config'

import Fastify, { type FastifyInstance } from 'fastify'

import { errorResponseSchema, healthcheckResponseSchema } from './common/http/schemas.js'
import authRoutes from './modules/auth/routes.js'
import exercisesRoutes from './modules/exercises/routes.js'
import muscleGroupsRoutes from './modules/muscle-groups/routes.js'
import planningRoutes from './modules/planning/routes.js'
import progressRoutes from './modules/progress/routes.js'
import workoutLogsRoutes from './modules/workout-logs/routes.js'
import workoutsRoutes from './modules/workouts/routes.js'
import usersRoutes from './modules/users/routes.js'
import authPlugin from './plugins/auth.js'
import corsPlugin from './plugins/cors.js'
import currentUserPlugin from './plugins/current-user.js'
import errorHandlerPlugin from './plugins/error-handler.js'
import prismaPlugin from './plugins/prisma.js'
import swaggerPlugin from './plugins/swagger.js'

export function buildApp(): FastifyInstance {
  const app = Fastify({
    logger: true,
  })

  app.register(errorHandlerPlugin)
  app.register(corsPlugin)
  app.register(swaggerPlugin)
  app.register(prismaPlugin)

  app.register(
    async function apiRoutes(api) {
      api.register(authPlugin)
      api.register(currentUserPlugin)
      api.register(authRoutes)
      api.register(muscleGroupsRoutes)
      api.register(exercisesRoutes)
      api.register(planningRoutes)
      api.register(progressRoutes)
      api.register(workoutLogsRoutes)
      api.register(workoutsRoutes)
      api.register(usersRoutes)
    },
    {
      prefix: '/api',
    },
  )

  app.register(async function systemRoutes(routes) {
    routes.get(
      '/health',
      {
        schema: {
          tags: ['System'],
          summary: 'Healthcheck',
          description: 'Public healthcheck endpoint for the backend foundation.',
          response: {
            200: healthcheckResponseSchema,
            500: errorResponseSchema,
          },
        },
      },
      async () => ({
        status: 'ok',
      }),
    )
  })

  return app
}
