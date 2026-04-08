import fastifySwagger from '@fastify/swagger'
import fastifySwaggerUi from '@fastify/swagger-ui'
import fp from 'fastify-plugin'

export default fp(async function swaggerPlugin(app) {
  await app.register(fastifySwagger, {
    openapi: {
      openapi: '3.0.3',
      info: {
        title: 'WorkoutFy API',
        description: 'Backend foundation for WorkoutFy.',
        version: '0.1.0',
      },
      tags: [
        {
          name: 'System',
          description: 'Infrastructure and health endpoints.',
        },
        {
          name: 'Exercises',
          description: 'Authenticated catalog endpoints for exercises and muscle groups.',
        },
        {
          name: 'Users',
          description: 'Authenticated user identity and profile bootstrap endpoints.',
        },
        {
          name: 'Workouts',
          description: 'Authenticated CRUD endpoints for user workouts.',
        },
        {
          name: 'Planning',
          description: 'Authenticated weekly planning endpoints for user workouts.',
        },
        {
          name: 'Auth',
          description: 'Authentication and protected boundary verification endpoints.',
        },
      ],
    },
  })

  await app.register(fastifySwaggerUi, {
    routePrefix: '/docs',
  })
})
