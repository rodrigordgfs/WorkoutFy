import { Prisma, PrismaClient } from '@prisma/client'

import type {
  UpdateWorkoutSetLogInput,
  WorkoutExecutionSourceWorkout,
  WorkoutSessionCreateInput,
  WorkoutSessionItemSnapshotCreateInput,
} from './types.js'

type WorkoutSessionSetLogRecord = {
  id: string
  setNumber: number
  status: 'pending' | 'completed'
  plannedReps: number
  plannedLoadKg: number
  actualReps: number | null
  actualLoadKg: number | null
  completedAt: Date | null
}

type WorkoutSessionItemRecord = {
  id: string
  workoutItemId: string
  exerciseId: string
  exerciseName: string
  exerciseSlug: string
  plannedSets: number
  plannedReps: number
  plannedLoadKg: number
  plannedRestSeconds: number
  position: number
  setLogs: WorkoutSessionSetLogRecord[]
}

type WorkoutSessionRecord = {
  id: string
  workoutId: string
  workoutNameSnapshot: string | null
  status: 'in_progress' | 'completed'
  startedAt: Date
  completedAt: Date | null
  items: WorkoutSessionItemRecord[]
}

type WorkoutSessionHistoryRecord = {
  id: string
  workoutId: string
  workoutNameSnapshot: string | null
  startedAt: Date
  completedAt: Date | null
  items: Array<{
    exerciseId: string
    setLogs: Array<{
      status: 'pending' | 'completed'
    }>
  }>
}

type WorkoutSummaryRecord = {
  id: string
  name: string
}

const workoutExecutionSourceSelect = {
  id: true,
  name: true,
  items: {
    orderBy: [{ position: 'asc' as const }],
    select: {
      id: true,
      position: true,
      sets: true,
      reps: true,
      loadKg: true,
      restSeconds: true,
      exercise: {
        select: {
          id: true,
          name: true,
          slug: true,
        },
      },
    },
  },
}

const workoutSessionSetLogSelect = {
  id: true,
  setNumber: true,
  status: true,
  plannedReps: true,
  plannedLoadKg: true,
  actualReps: true,
  actualLoadKg: true,
  completedAt: true,
}

const workoutSessionItemSelect = {
  id: true,
  workoutItemId: true,
  exerciseId: true,
  exerciseName: true,
  exerciseSlug: true,
  plannedSets: true,
  plannedReps: true,
  plannedLoadKg: true,
  plannedRestSeconds: true,
  position: true,
  setLogs: {
    orderBy: [{ setNumber: 'asc' as const }],
    select: workoutSessionSetLogSelect,
  },
}

const workoutSessionSelect = {
  id: true,
  workoutId: true,
  workoutNameSnapshot: true,
  status: true,
  startedAt: true,
  completedAt: true,
  items: {
    orderBy: [{ position: 'asc' as const }],
    select: workoutSessionItemSelect,
  },
}

type WorkoutLogsPrismaClient = Pick<PrismaClient, '$transaction' | 'workout' | 'workoutSession' | 'workoutSetLog'>

const workoutSessionHistorySelect = {
  id: true,
  workoutId: true,
  workoutNameSnapshot: true,
  startedAt: true,
  completedAt: true,
  items: {
    select: {
      exerciseId: true,
      setLogs: {
        select: {
          status: true,
        },
      },
    },
  },
} as const

type WorkoutLogsPrismaTransactionClient = Prisma.TransactionClient

function sortWorkoutItemsByPosition(workout: WorkoutExecutionSourceWorkout) {
  return [...workout.items].sort((left, right) => left.position - right.position)
}

function buildWorkoutSessionItemSnapshot(item: WorkoutExecutionSourceWorkout['items'][number]): WorkoutSessionItemSnapshotCreateInput {
  return {
    workoutItemId: item.id,
    exerciseId: item.exercise.id,
    exerciseName: item.exercise.name,
    exerciseSlug: item.exercise.slug,
    plannedSets: item.sets,
    plannedReps: item.reps,
    plannedLoadKg: item.loadKg,
    plannedRestSeconds: item.restSeconds,
    position: item.position,
    setLogs: {
      create: Array.from({ length: item.sets }, (_, index) => ({
        setNumber: index + 1,
        status: 'pending',
        plannedReps: item.reps,
        plannedLoadKg: item.loadKg,
      })),
    },
  }
}

export function buildWorkoutSessionCreateInput(
  userId: string,
  workout: WorkoutExecutionSourceWorkout,
  startedAt?: Date,
): WorkoutSessionCreateInput {
  return {
    userId,
    workoutId: workout.id,
    workoutNameSnapshot: workout.name,
    activeSessionUserId: userId,
    status: 'in_progress',
    ...(startedAt === undefined ? {} : { startedAt }),
    items: {
      create: sortWorkoutItemsByPosition(workout).map(buildWorkoutSessionItemSnapshot),
    },
  }
}

function isActiveSessionConflictError(error: unknown): boolean {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === 'P2002' &&
    Array.isArray(error.meta?.target) &&
    error.meta.target.includes('active_session_user_id')
  )
}

export function createWorkoutLogsRepository(getPrisma: () => WorkoutLogsPrismaClient) {
  return {
    buildWorkoutSessionCreateInput,
    async findWorkoutSourceById(userId: string, workoutId: string) {
      return getPrisma().workout.findFirst({
        where: {
          id: workoutId,
          userId,
        },
        select: workoutExecutionSourceSelect,
      }) as Promise<WorkoutExecutionSourceWorkout | null>
    },
    async createSession(userId: string, workout: WorkoutExecutionSourceWorkout, startedAt?: Date) {
      const record = await getPrisma().workoutSession.create({
        data: buildWorkoutSessionCreateInput(userId, workout, startedAt),
        select: workoutSessionSelect,
      })

      return {
        record,
        workout: {
          id: workout.id,
          name: workout.name,
        },
      }
    },
    async findActiveSessionByUserId(userId: string) {
      const session = await getPrisma().workoutSession.findFirst({
        where: {
          userId,
          status: 'in_progress',
        },
        select: workoutSessionSelect,
      })

      if (!session) {
        return null
      }

      const workout = (await getPrisma().workout.findFirst({
        where: {
          id: session.workoutId,
          userId,
        },
        select: {
          id: true,
          name: true,
        },
      })) as WorkoutSummaryRecord | null

      return {
        record: session,
        workout: {
          id: session.workoutId,
          name: session.workoutNameSnapshot ?? workout?.name ?? null,
        },
      }
    },
    async findCompletedSessionById(userId: string, workoutSessionId: string) {
      const sessions = await getPrisma().workoutSession.findMany({
        where: {
          id: workoutSessionId,
          userId,
          status: 'completed',
        },
        select: workoutSessionSelect,
      })

      const session = sessions[0] ?? null

      if (!session) {
        return null
      }

      const workout = (await getPrisma().workout.findFirst({
        where: {
          id: session.workoutId,
          userId,
        },
        select: {
          id: true,
          name: true,
        },
      })) as WorkoutSummaryRecord | null

      return {
        record: session,
        workout: {
          id: session.workoutId,
          name: session.workoutNameSnapshot ?? workout?.name ?? null,
        },
      }
    },
    async findCompletedSessionHistoryByUserId(userId: string) {
      const sessions = await getPrisma().workoutSession.findMany({
        where: {
          userId,
          status: 'completed',
        },
        orderBy: [{ completedAt: 'desc' }],
        select: workoutSessionHistorySelect,
      })

      const workoutIds = Array.from(new Set(sessions.map((session) => session.workoutId)))
      const workouts =
        workoutIds.length > 0
          ? await getPrisma().workout.findMany({
              where: {
                userId,
                id: {
                  in: workoutIds,
                },
              },
              select: {
                id: true,
                name: true,
              },
            })
          : []

      const workoutNamesById = new Map(workouts.map((workout) => [workout.id, workout.name]))

      return sessions.map((session) => ({
        record: session,
        workout: {
          id: session.workoutId,
          name: session.workoutNameSnapshot ?? workoutNamesById.get(session.workoutId) ?? null,
        },
      }))
    },
    async updateSetLogById(workoutSetLogId: string, input: UpdateWorkoutSetLogInput, completedAt = new Date()) {
      return getPrisma().workoutSetLog.update({
        where: {
          id: workoutSetLogId,
        },
        data: {
          status: 'completed',
          actualReps: input.actualReps,
          actualLoadKg: input.actualLoadKg,
          completedAt,
        },
        select: workoutSessionSetLogSelect,
      })
    },
    async completeSessionById(userId: string, workoutSessionId: string, completedAt = new Date()) {
      return getPrisma().$transaction(async (tx) => {
        const updated = await tx.workoutSession.updateMany({
          where: {
            id: workoutSessionId,
            userId,
            status: 'in_progress',
            activeSessionUserId: userId,
          },
          data: {
            status: 'completed',
            completedAt,
            activeSessionUserId: null,
          },
        })

        if (updated.count === 0) {
          return null
        }

        const session = await tx.workoutSession.findFirst({
          where: {
            id: workoutSessionId,
            userId,
            status: 'completed',
          },
          select: workoutSessionSelect,
        })

        if (!session) {
          return null
        }

        const workout = await tx.workout.findFirst({
          where: {
            id: session.workoutId,
            userId,
          },
          select: {
            id: true,
            name: true,
          },
        })

        return {
          record: session,
          workout: {
            id: session.workoutId,
            name: session.workoutNameSnapshot ?? workout?.name ?? null,
          },
        }
      })
    },
    isActiveSessionConflictError,
  }
}

export type { WorkoutSessionRecord, WorkoutSessionItemRecord, WorkoutSessionSetLogRecord, WorkoutSessionHistoryRecord }
