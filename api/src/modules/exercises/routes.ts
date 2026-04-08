import fp from 'fastify-plugin'

import { errorResponseSchema } from '../../common/http/schemas.js'
import { createExercisesRepository } from './repository.js'
import {
  adminExerciseResponseSchema,
  adminExercisesListResponseSchema,
  createAdminExerciseBodySchema,
  exercisesListResponseSchema,
  listExercisesQuerystringSchema,
  parseCreateAdminExerciseInput,
  parseListExercisesFilters,
  parseUpdateAdminExerciseInput,
  updateAdminExerciseBodySchema,
} from './schemas.js'
import { createExercisesService } from './service.js'

export default fp(async function exercisesRoutes(app) {
  const exercisesService = createExercisesService(createExercisesRepository(() => app.prisma))

  app.get(
    '/exercises',
    {
      schema: {
        tags: ['Exercises'],
        summary: 'List exercises',
        description:
          'Returns the authenticated catalog of exercises available for workout composition, supporting name search and muscle group filtering.',
        querystring: listExercisesQuerystringSchema,
        response: {
          200: exercisesListResponseSchema,
          400: errorResponseSchema,
          401: errorResponseSchema,
          500: errorResponseSchema,
        },
      },
    },
    async function getExercises(request) {
      const filters = parseListExercisesFilters(request.query)
      return exercisesService.listExercises(filters)
    },
  )

  app.get(
    '/admin/exercises',
    {
      schema: {
        tags: ['Admin'],
        summary: 'List exercises for administration',
        description: 'Returns the administrative list of exercises with persisted metadata and associated muscle groups.',
        response: {
          200: adminExercisesListResponseSchema,
          401: errorResponseSchema,
          403: errorResponseSchema,
          500: errorResponseSchema,
        },
      },
    },
    async function getAdminExercises(request) {
      await app.requireAdmin(request)

      return exercisesService.listAdminExercises()
    },
  )

  app.post(
    '/admin/exercises',
    {
      schema: {
        tags: ['Admin'],
        summary: 'Create exercise',
        description: 'Creates an exercise for administrative catalog maintenance.',
        body: createAdminExerciseBodySchema,
        response: {
          201: adminExerciseResponseSchema,
          400: errorResponseSchema,
          401: errorResponseSchema,
          403: errorResponseSchema,
          409: errorResponseSchema,
          500: errorResponseSchema,
        },
      },
    },
    async function postAdminExercise(request, reply) {
      await app.requireAdmin(request)

      const input = parseCreateAdminExerciseInput(request.body)
      const exercise = await exercisesService.createAdminExercise(input)

      reply.code(201)
      return exercise
    },
  )

  app.patch(
    '/admin/exercises/:exerciseId',
    {
      schema: {
        tags: ['Admin'],
        summary: 'Update exercise',
        description: 'Updates an exercise for administrative catalog maintenance.',
        body: updateAdminExerciseBodySchema,
        response: {
          200: adminExerciseResponseSchema,
          400: errorResponseSchema,
          401: errorResponseSchema,
          403: errorResponseSchema,
          404: errorResponseSchema,
          409: errorResponseSchema,
          500: errorResponseSchema,
        },
      },
    },
    async function patchAdminExercise(request) {
      await app.requireAdmin(request)

      const input = parseUpdateAdminExerciseInput(request.body)
      return exercisesService.updateAdminExercise(
        (request.params as { exerciseId: string }).exerciseId,
        input,
      )
    },
  )

  app.delete(
    '/admin/exercises/:exerciseId',
    {
      schema: {
        tags: ['Admin'],
        summary: 'Delete exercise',
        description: 'Deletes an exercise when it is no longer referenced by workouts or workout history.',
        response: {
          204: { type: 'null' },
          401: errorResponseSchema,
          403: errorResponseSchema,
          404: errorResponseSchema,
          409: errorResponseSchema,
          500: errorResponseSchema,
        },
      },
    },
    async function deleteAdminExercise(request, reply) {
      await app.requireAdmin(request)

      await exercisesService.deleteAdminExercise(
        (request.params as { exerciseId: string }).exerciseId,
      )

      reply.code(204).send()
    },
  )
})
