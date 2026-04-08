import fp from 'fastify-plugin'

import { errorResponseSchema } from '../../common/http/schemas.js'
import { createMuscleGroupsRepository } from './repository.js'
import {
  adminMuscleGroupResponseSchema,
  adminMuscleGroupsListResponseSchema,
  createAdminMuscleGroupBodySchema,
  muscleGroupsListResponseSchema,
  parseCreateAdminMuscleGroupInput,
  parseUpdateAdminMuscleGroupInput,
  updateAdminMuscleGroupBodySchema,
} from './schemas.js'
import { createMuscleGroupsService } from './service.js'

export default fp(async function muscleGroupsRoutes(app) {
  const muscleGroupsService = createMuscleGroupsService(
    createMuscleGroupsRepository(() => app.prisma),
  )

  app.get(
    '/muscle-groups',
    {
      schema: {
        tags: ['Exercises'],
        summary: 'List muscle groups',
        description: 'Returns the authenticated catalog of muscle groups available for workout composition.',
        response: {
          200: muscleGroupsListResponseSchema,
          401: errorResponseSchema,
          500: errorResponseSchema,
        },
      },
    },
    async function getMuscleGroups() {
      return muscleGroupsService.listMuscleGroups()
    },
  )

  app.get(
    '/admin/muscle-groups',
    {
      schema: {
        tags: ['Admin'],
        summary: 'List muscle groups for administration',
        description: 'Returns the administrative list of muscle groups with persisted metadata.',
        response: {
          200: adminMuscleGroupsListResponseSchema,
          401: errorResponseSchema,
          403: errorResponseSchema,
          500: errorResponseSchema,
        },
      },
    },
    async function getAdminMuscleGroups(request) {
      await app.requireAdmin(request)

      return muscleGroupsService.listAdminMuscleGroups()
    },
  )

  app.post(
    '/admin/muscle-groups',
    {
      schema: {
        tags: ['Admin'],
        summary: 'Create muscle group',
        description: 'Creates a muscle group for administrative catalog maintenance.',
        body: createAdminMuscleGroupBodySchema,
        response: {
          201: adminMuscleGroupResponseSchema,
          400: errorResponseSchema,
          401: errorResponseSchema,
          403: errorResponseSchema,
          409: errorResponseSchema,
          500: errorResponseSchema,
        },
      },
    },
    async function postAdminMuscleGroup(request, reply) {
      await app.requireAdmin(request)

      const input = parseCreateAdminMuscleGroupInput(request.body)
      const muscleGroup = await muscleGroupsService.createAdminMuscleGroup(input)

      reply.code(201)
      return muscleGroup
    },
  )

  app.patch(
    '/admin/muscle-groups/:muscleGroupId',
    {
      schema: {
        tags: ['Admin'],
        summary: 'Update muscle group',
        description: 'Updates a muscle group for administrative catalog maintenance.',
        body: updateAdminMuscleGroupBodySchema,
        response: {
          200: adminMuscleGroupResponseSchema,
          400: errorResponseSchema,
          401: errorResponseSchema,
          403: errorResponseSchema,
          404: errorResponseSchema,
          409: errorResponseSchema,
          500: errorResponseSchema,
        },
      },
    },
    async function patchAdminMuscleGroup(request) {
      await app.requireAdmin(request)

      const input = parseUpdateAdminMuscleGroupInput(request.body)
      return muscleGroupsService.updateAdminMuscleGroup(
        (request.params as { muscleGroupId: string }).muscleGroupId,
        input,
      )
    },
  )

  app.delete(
    '/admin/muscle-groups/:muscleGroupId',
    {
      schema: {
        tags: ['Admin'],
        summary: 'Delete muscle group',
        description: 'Deletes a muscle group when it is no longer associated with any exercise.',
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
    async function deleteAdminMuscleGroup(request, reply) {
      await app.requireAdmin(request)

      await muscleGroupsService.deleteAdminMuscleGroup(
        (request.params as { muscleGroupId: string }).muscleGroupId,
      )

      reply.code(204).send()
    },
  )
})
