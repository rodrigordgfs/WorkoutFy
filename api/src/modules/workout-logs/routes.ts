import fp from 'fastify-plugin'

import { errorResponseSchema } from '../../common/http/schemas.js'
import { createWorkoutLogsRepository } from './repository.js'
import {
  parseWorkoutSessionHistoryParams,
  parseUpdateWorkoutSetLogInput,
  parseUpdateWorkoutSetLogParams,
  parseStartWorkoutSessionInput,
  startWorkoutSessionBodySchema,
  updateWorkoutSetLogBodySchema,
  updateWorkoutSetLogParamsSchema,
  workoutSessionDetailResponseSchema,
  workoutSessionHistoryDetailResponseSchema,
  workoutSessionHistoryListResponseSchema,
  workoutSessionHistoryParamsSchema,
  workoutSessionSetLogResponseSchema,
} from './schemas.js'
import { createWorkoutLogsService } from './service.js'

export default fp(async function workoutLogsRoutes(app) {
  const workoutLogsService = createWorkoutLogsService(createWorkoutLogsRepository(() => app.prisma))

  app.post(
    '/workout-sessions',
    {
      schema: {
        tags: ['Workout Sessions'],
        summary: 'Start workout session',
        description:
          'Creates an in-progress workout session for the authenticated user using the current workout snapshot.',
        body: startWorkoutSessionBodySchema,
        response: {
          201: workoutSessionDetailResponseSchema,
          400: errorResponseSchema,
          401: errorResponseSchema,
          404: errorResponseSchema,
          409: errorResponseSchema,
          500: errorResponseSchema,
        },
      },
    },
    async function postWorkoutSession(request, reply) {
      const currentUser = await app.requireCurrentUser(request)
      const input = parseStartWorkoutSessionInput(request.body)
      const session = await workoutLogsService.startWorkoutSession(currentUser, input)

      return reply.code(201).send(session)
    },
  )

  app.get(
    '/workout-sessions/history',
    {
      schema: {
        tags: ['Workout Sessions'],
        summary: 'List completed workout sessions history',
        description:
          'Returns a compact authenticated history of completed workout sessions ordered by completedAt descending.',
        response: {
          200: workoutSessionHistoryListResponseSchema,
          401: errorResponseSchema,
          500: errorResponseSchema,
        },
      },
    },
    async function getWorkoutSessionHistory(request) {
      const currentUser = await app.requireCurrentUser(request)
      return workoutLogsService.listWorkoutSessionHistory(currentUser)
    },
  )

  app.get(
    '/workout-sessions/history/:workoutSessionId',
    {
      schema: {
        tags: ['Workout Sessions'],
        summary: 'Get completed workout session history detail',
        description:
          'Returns the authenticated user completed workout session snapshot with items and set logs from persisted history.',
        params: workoutSessionHistoryParamsSchema,
        response: {
          200: workoutSessionHistoryDetailResponseSchema,
          401: errorResponseSchema,
          404: errorResponseSchema,
          500: errorResponseSchema,
        },
      },
    },
    async function getWorkoutSessionHistoryDetail(request) {
      const currentUser = await app.requireCurrentUser(request)
      const params = parseWorkoutSessionHistoryParams(request.params)
      return workoutLogsService.getWorkoutSessionHistoryDetail(currentUser, params.workoutSessionId)
    },
  )

  app.get(
    '/workout-sessions/active',
    {
      schema: {
        tags: ['Workout Sessions'],
        summary: 'Get active workout session',
        description: 'Returns the current in-progress workout session for the authenticated user.',
        response: {
          200: workoutSessionDetailResponseSchema,
          401: errorResponseSchema,
          404: errorResponseSchema,
          500: errorResponseSchema,
        },
      },
    },
    async function getActiveWorkoutSession(request) {
      const currentUser = await app.requireCurrentUser(request)
      return workoutLogsService.getActiveWorkoutSession(currentUser)
    },
  )

  app.patch(
    '/workout-sessions/active/set-logs/:workoutSetLogId',
    {
      schema: {
        tags: ['Workout Sessions'],
        summary: 'Register or adjust a set log in the active workout session',
        description:
          'Updates an existing workout set log in the authenticated user active session and marks it as completed.',
        params: updateWorkoutSetLogParamsSchema,
        body: updateWorkoutSetLogBodySchema,
        response: {
          200: workoutSessionSetLogResponseSchema,
          400: errorResponseSchema,
          401: errorResponseSchema,
          404: errorResponseSchema,
          500: errorResponseSchema,
        },
      },
    },
    async function patchActiveWorkoutSetLog(request) {
      const currentUser = await app.requireCurrentUser(request)
      const params = parseUpdateWorkoutSetLogParams(request.params)
      const input = parseUpdateWorkoutSetLogInput(request.body)

      return workoutLogsService.updateActiveWorkoutSetLog(currentUser, params.workoutSetLogId, input)
    },
  )

  app.post(
    '/workout-sessions/active/complete',
    {
      schema: {
        tags: ['Workout Sessions'],
        summary: 'Complete the active workout session',
        description:
          'Marks the authenticated user active workout session as completed and persists the final session state.',
        response: {
          200: workoutSessionDetailResponseSchema,
          400: errorResponseSchema,
          401: errorResponseSchema,
          404: errorResponseSchema,
          500: errorResponseSchema,
        },
      },
    },
    async function postCompleteActiveWorkoutSession(request) {
      const currentUser = await app.requireCurrentUser(request)
      return workoutLogsService.completeActiveWorkoutSession(currentUser)
    },
  )
})
