import fp from 'fastify-plugin'

import { errorResponseSchema } from '../../common/http/schemas.js'
import { createPlanningRepository } from './repository.js'
import {
  todayPlanningResponseSchema,
  parseUpdateWeeklyPlanningInput,
  updateWeeklyPlanningBodySchema,
  weeklyPlanningWeekResponseSchema,
} from './schemas.js'
import { createPlanningService } from './service.js'

export default fp(async function planningRoutes(app) {
  function getRepositoryPrisma() {
    const prisma = app.prisma

    return {
      $transaction: prisma.$transaction
        ? <T>(fn: (tx: { weeklyPlanningDay: typeof prisma.weeklyPlanningDay }) => Promise<T>) =>
            prisma.$transaction((transactionClient) =>
              fn({
                weeklyPlanningDay: transactionClient.weeklyPlanningDay,
              }),
            )
        : <T>(fn: (tx: { weeklyPlanningDay: typeof prisma.weeklyPlanningDay }) => Promise<T>) =>
            fn({
              weeklyPlanningDay: prisma.weeklyPlanningDay,
            }),
      workout: {
        findMany(args: {
          where:
            | {
                userId: string
              }
            | {
                userId: string
                id: {
                  in: string[]
                }
          }
          orderBy?: Array<{ updatedAt: 'asc' | 'desc' }>
          select: Record<string, unknown>
        }) {
          if ('id' in args.where) {
            return prisma.workout.findMany({
              where: {
                userId: args.where.userId,
                id: {
                  in: args.where.id.in,
                },
              },
              select: {
                id: true,
              },
            })
          }

          return prisma.workout.findMany({
            where: {
              userId: args.where.userId,
            },
            orderBy: args.orderBy,
            select: {
              id: true,
              name: true,
              createdAt: true,
              updatedAt: true,
            },
          })
        },
      },
      weeklyPlanningDay: prisma.weeklyPlanningDay,
    }
  }

  const planningService = createPlanningService(createPlanningRepository(getRepositoryPrisma))

  app.get(
    '/planning/today',
    {
      schema: {
        tags: ['Planning'],
        summary: 'Get today planning',
        description:
          'Returns the authenticated user planning snapshot for the current server day together with manual workout options.',
        response: {
          200: todayPlanningResponseSchema,
          401: errorResponseSchema,
          500: errorResponseSchema,
        },
      },
    },
    async function getTodayPlanning(request) {
      const currentUser = await app.requireCurrentUser(request)
      return planningService.getTodayPlanning(currentUser)
    },
  )

  app.get(
    '/planning/week',
    {
      schema: {
        tags: ['Planning'],
        summary: 'Get weekly planning',
        description: 'Returns the authenticated user weekly planning normalized to the 7 days of the week.',
        response: {
          200: weeklyPlanningWeekResponseSchema,
          401: errorResponseSchema,
          500: errorResponseSchema,
        },
      },
    },
    async function getWeeklyPlanning(request) {
      const currentUser = await app.requireCurrentUser(request)
      return planningService.getWeeklyPlanning(currentUser)
    },
  )

  app.put(
    '/planning/week',
    {
      schema: {
        tags: ['Planning'],
        summary: 'Replace weekly planning',
        description: 'Replaces the authenticated user weekly planning with a complete 7-day payload.',
        body: updateWeeklyPlanningBodySchema,
        response: {
          200: weeklyPlanningWeekResponseSchema,
          400: errorResponseSchema,
          401: errorResponseSchema,
          404: errorResponseSchema,
          500: errorResponseSchema,
        },
      },
    },
    async function putWeeklyPlanning(request) {
      const currentUser = await app.requireCurrentUser(request)
      const input = parseUpdateWeeklyPlanningInput(request.body)

      return planningService.updateWeeklyPlanning(currentUser, input)
    },
  )
})
