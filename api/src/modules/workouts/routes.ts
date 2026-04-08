import fp from 'fastify-plugin'

import { errorResponseSchema } from '../../common/http/schemas.js'
import { createWorkoutsRepository } from './repository.js'
import {
  createWorkoutBodySchema,
  createWorkoutItemBodySchema,
  parseCreateWorkoutInput,
  parseCreateWorkoutItemInput,
  parseReorderWorkoutItemsInput,
  parseUpdateWorkoutInput,
  parseUpdateWorkoutItemInput,
  reorderWorkoutItemsBodySchema,
  updateWorkoutBodySchema,
  updateWorkoutItemBodySchema,
  workoutDetailResponseSchema,
  workoutItemParamsSchema,
  workoutItemResponseSchema,
  workoutParamsSchema,
  workoutResponseSchema,
  workoutsListResponseSchema,
} from './schemas.js'
import { createWorkoutsService } from './service.js'

export default fp(async function workoutsRoutes(app) {
  function getRepositoryPrisma() {
    const prisma = app.prisma

    return {
      $transaction: prisma.$transaction
        ? <T>(fn: (tx: { workoutItem: typeof prisma.workoutItem }) => Promise<T>) =>
            prisma.$transaction((transactionClient) => fn({ workoutItem: transactionClient.workoutItem }))
        : <T>(fn: (tx: { workoutItem: typeof prisma.workoutItem }) => Promise<T>) =>
            fn({ workoutItem: prisma.workoutItem }),
      workout: prisma.workout,
      exercise: prisma.exercise,
      workoutItem: prisma.workoutItem,
    }
  }

  const workoutsService = createWorkoutsService(
    createWorkoutsRepository(getRepositoryPrisma),
  )

  app.post(
    '/workouts',
    {
      schema: {
        tags: ['Workouts'],
        summary: 'Create workout',
        description: 'Creates a workout owned by the current authenticated user.',
        body: createWorkoutBodySchema,
        response: {
          201: workoutResponseSchema,
          400: errorResponseSchema,
          401: errorResponseSchema,
          500: errorResponseSchema,
        },
      },
    },
    async function postWorkout(request, reply) {
      const currentUser = await app.requireCurrentUser(request)
      const input = parseCreateWorkoutInput(request.body)
      const workout = await workoutsService.createWorkout(currentUser, input)

      return reply.code(201).send(workout)
    },
  )

  app.get(
    '/workouts',
    {
      schema: {
        tags: ['Workouts'],
        summary: 'List workouts',
        description: 'Lists workouts owned by the current authenticated user ordered by most recently updated first.',
        response: {
          200: workoutsListResponseSchema,
          401: errorResponseSchema,
          500: errorResponseSchema,
        },
      },
    },
    async function getWorkouts(request) {
      const currentUser = await app.requireCurrentUser(request)
      return workoutsService.listWorkouts(currentUser)
    },
  )

  app.get(
    '/workouts/:workoutId',
    {
      schema: {
        tags: ['Workouts'],
        summary: 'Get workout',
        description:
          'Returns a single workout owned by the current authenticated user together with its ordered workout items.',
        params: workoutParamsSchema,
        response: {
          200: workoutDetailResponseSchema,
          401: errorResponseSchema,
          404: errorResponseSchema,
          500: errorResponseSchema,
        },
      },
    },
    async function getWorkout(request) {
      const currentUser = await app.requireCurrentUser(request)
      const { workoutId } = request.params as { workoutId: string }

      return workoutsService.getWorkout(currentUser, workoutId)
    },
  )

  app.patch(
    '/workouts/:workoutId',
    {
      schema: {
        tags: ['Workouts'],
        summary: 'Update workout',
        description: 'Updates editable fields of a workout owned by the current authenticated user.',
        params: workoutParamsSchema,
        body: updateWorkoutBodySchema,
        response: {
          200: workoutResponseSchema,
          400: errorResponseSchema,
          401: errorResponseSchema,
          404: errorResponseSchema,
          500: errorResponseSchema,
        },
      },
    },
    async function patchWorkout(request) {
      const currentUser = await app.requireCurrentUser(request)
      const { workoutId } = request.params as { workoutId: string }
      const input = parseUpdateWorkoutInput(request.body)

      return workoutsService.updateWorkout(currentUser, workoutId, input)
    },
  )

  app.delete(
    '/workouts/:workoutId',
    {
      schema: {
        tags: ['Workouts'],
        summary: 'Delete workout',
        description: 'Deletes a workout owned by the current authenticated user.',
        params: workoutParamsSchema,
        response: {
          204: { type: 'null' },
          401: errorResponseSchema,
          404: errorResponseSchema,
          500: errorResponseSchema,
        },
      },
    },
    async function deleteWorkout(request, reply) {
      const currentUser = await app.requireCurrentUser(request)
      const { workoutId } = request.params as { workoutId: string }

      await workoutsService.deleteWorkout(currentUser, workoutId)

      return reply.code(204).send()
    },
  )

  app.post(
    '/workouts/:workoutId/items',
    {
      schema: {
        tags: ['Workouts'],
        summary: 'Create workout item',
        description: 'Adds a new workout item to an owned workout, assigning the next available position.',
        params: workoutParamsSchema,
        body: createWorkoutItemBodySchema,
        response: {
          201: workoutItemResponseSchema,
          400: errorResponseSchema,
          401: errorResponseSchema,
          404: errorResponseSchema,
          500: errorResponseSchema,
        },
      },
    },
    async function postWorkoutItem(request, reply) {
      const currentUser = await app.requireCurrentUser(request)
      const { workoutId } = request.params as { workoutId: string }
      const input = parseCreateWorkoutItemInput(request.body)
      const workoutItem = await workoutsService.createWorkoutItem(currentUser, workoutId, input)

      return reply.code(201).send(workoutItem)
    },
  )

  app.patch(
    '/workouts/:workoutId/items/reorder',
    {
      schema: {
        tags: ['Workouts'],
        summary: 'Reorder workout items',
        description: 'Reorders all items of an owned workout atomically and returns the updated workout detail.',
        params: workoutParamsSchema,
        body: reorderWorkoutItemsBodySchema,
        response: {
          200: workoutDetailResponseSchema,
          400: errorResponseSchema,
          401: errorResponseSchema,
          404: errorResponseSchema,
          500: errorResponseSchema,
        },
      },
    },
    async function patchWorkoutItemsOrder(request) {
      const currentUser = await app.requireCurrentUser(request)
      const { workoutId } = request.params as { workoutId: string }
      const input = parseReorderWorkoutItemsInput(request.body)

      return workoutsService.reorderWorkoutItems(currentUser, workoutId, input)
    },
  )

  app.patch(
    '/workouts/:workoutId/items/:workoutItemId',
    {
      schema: {
        tags: ['Workouts'],
        summary: 'Update workout item',
        description: 'Updates execution parameters of an item that belongs to the authenticated user workout.',
        params: workoutItemParamsSchema,
        body: updateWorkoutItemBodySchema,
        response: {
          200: workoutItemResponseSchema,
          400: errorResponseSchema,
          401: errorResponseSchema,
          404: errorResponseSchema,
          500: errorResponseSchema,
        },
      },
    },
    async function patchWorkoutItem(request) {
      const currentUser = await app.requireCurrentUser(request)
      const { workoutId, workoutItemId } = request.params as { workoutId: string; workoutItemId: string }
      const input = parseUpdateWorkoutItemInput(request.body)

      return workoutsService.updateWorkoutItem(currentUser, workoutId, workoutItemId, input)
    },
  )

  app.delete(
    '/workouts/:workoutId/items/:workoutItemId',
    {
      schema: {
        tags: ['Workouts'],
        summary: 'Delete workout item',
        description: 'Removes an item from an owned workout without exposing resources from another user.',
        params: workoutItemParamsSchema,
        response: {
          204: { type: 'null' },
          401: errorResponseSchema,
          404: errorResponseSchema,
          500: errorResponseSchema,
        },
      },
    },
    async function deleteWorkoutItem(request, reply) {
      const currentUser = await app.requireCurrentUser(request)
      const { workoutId, workoutItemId } = request.params as { workoutId: string; workoutItemId: string }

      await workoutsService.deleteWorkoutItem(currentUser, workoutId, workoutItemId)

      return reply.code(204).send()
    },
  )
})
