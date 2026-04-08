import type { DayOfWeek, UpdateWeeklyPlanningInput } from './types.js'

type PlanningWorkoutSummaryRecord = {
  id: string
  name: string
  createdAt: Date
  updatedAt: Date
}

type WeeklyPlanningAssignmentRecord = {
  dayOfWeek: DayOfWeek
  workout: PlanningWorkoutSummaryRecord
}

const workoutSummarySelect = {
  id: true,
  name: true,
  createdAt: true,
  updatedAt: true,
}

const weeklyPlanningAssignmentSelect = {
  dayOfWeek: true,
  workout: {
    select: workoutSummarySelect,
  },
}

type PlanningTransactionClient = {
  weeklyPlanningDay: {
    deleteMany(args: {
      where: {
        userId: string
      }
    }): Promise<{ count: number }>
    create(args: {
      data: {
        userId: string
        workoutId: string
        dayOfWeek: DayOfWeek
      }
    }): Promise<{ id: string }>
  }
}

type PlanningPrismaClient = {
  $transaction<T>(fn: (tx: PlanningTransactionClient) => Promise<T>): Promise<T>
  workout: {
    findMany(args: {
      where: {
        userId: string
        id?: {
          in: string[]
        }
      }
      orderBy?: Array<{ updatedAt: 'asc' | 'desc' }>
      select:
        | typeof workoutSummarySelect
        | {
            id: true
          }
    }): Promise<PlanningWorkoutSummaryRecord[] | Array<{ id: string }>>
  }
  weeklyPlanningDay: {
    findMany(args: {
      where: {
        userId: string
      }
      select: typeof weeklyPlanningAssignmentSelect
    }): Promise<WeeklyPlanningAssignmentRecord[]>
  }
}

export function createPlanningRepository(getPrisma: () => PlanningPrismaClient) {
  return {
    async listByUserId(userId: string) {
      return getPrisma().weeklyPlanningDay.findMany({
        where: {
          userId,
        },
        select: weeklyPlanningAssignmentSelect,
      })
    },
    async listWorkoutOptionsByUserId(userId: string) {
      return getPrisma().workout.findMany({
        where: {
          userId,
        },
        orderBy: [{ updatedAt: 'desc' }],
        select: workoutSummarySelect,
      }) as Promise<PlanningWorkoutSummaryRecord[]>
    },
    async replaceByUserId(userId: string, input: UpdateWeeklyPlanningInput) {
      const workoutIds = Array.from(
        new Set(
          input.days
            .map(({ workoutId }) => workoutId)
            .filter((workoutId): workoutId is string => workoutId !== null),
        ),
      )

      if (workoutIds.length > 0) {
        const workouts = await getPrisma().workout.findMany({
          where: {
            userId,
            id: {
              in: workoutIds,
            },
          },
          select: {
            id: true,
          },
        }) as Array<{ id: string }>

        if (workouts.length !== workoutIds.length) {
          return 'invalid_workout' as const
        }
      }

      await getPrisma().$transaction(async (transactionClient) => {
        await transactionClient.weeklyPlanningDay.deleteMany({
          where: {
            userId,
          },
        })

        for (const day of input.days) {
          if (!day.workoutId) {
            continue
          }

          await transactionClient.weeklyPlanningDay.create({
            data: {
              userId,
              workoutId: day.workoutId,
              dayOfWeek: day.dayOfWeek,
            },
          })
        }
      })

      return this.listByUserId(userId)
    },
  }
}

export type { PlanningWorkoutSummaryRecord, WeeklyPlanningAssignmentRecord }
