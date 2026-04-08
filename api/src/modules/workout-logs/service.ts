import { AppError } from '../../common/errors/app-error.js'
import type { CurrentUser } from '../users/types.js'
import type {
  StartWorkoutSessionInput,
  UpdateWorkoutSetLogInput,
  WorkoutSessionDetail,
  WorkoutSessionHistoryDetail,
  WorkoutSessionHistoryEntry,
  WorkoutSessionItem,
  WorkoutSessionSetLog,
} from './types.js'
import type {
  WorkoutSessionHistoryRecord,
  WorkoutSessionItemRecord,
  WorkoutSessionRecord,
  WorkoutSessionSetLogRecord,
} from './repository.js'

type WorkoutLogsRepository = {
  findWorkoutSourceById(userId: string, workoutId: string): Promise<{
    id: string
    name: string
    items: Array<{
      id: string
      position: number
      sets: number
      reps: number
      loadKg: number
      restSeconds: number
      exercise: {
        id: string
        name: string
        slug: string
      }
    }>
  } | null>
  createSession(
    userId: string,
    workout: {
      id: string
      name: string
      items: Array<{
        id: string
        position: number
        sets: number
        reps: number
        loadKg: number
        restSeconds: number
        exercise: {
          id: string
          name: string
          slug: string
        }
      }>
    },
    startedAt?: Date,
  ): Promise<{
    record: WorkoutSessionRecord
    workout: {
      id: string
      name: string | null
    }
  }>
  findActiveSessionByUserId(userId: string): Promise<{
    record: WorkoutSessionRecord
    workout: {
      id: string
      name: string | null
    }
  } | null>
  findCompletedSessionById(userId: string, workoutSessionId: string): Promise<{
    record: WorkoutSessionRecord
    workout: {
      id: string
      name: string | null
    }
  } | null>
  findCompletedSessionHistoryByUserId(userId: string): Promise<
    Array<{
      record: WorkoutSessionHistoryRecord
      workout: {
        id: string
        name: string | null
      }
    }>
  >
  updateSetLogById(
    workoutSetLogId: string,
    input: UpdateWorkoutSetLogInput,
    completedAt?: Date,
  ): Promise<WorkoutSessionSetLogRecord>
  completeSessionById(
    userId: string,
    workoutSessionId: string,
    completedAt?: Date,
  ): Promise<{
    record: WorkoutSessionRecord
    workout: {
      id: string
      name: string | null
    }
  } | null>
  isActiveSessionConflictError(error: unknown): boolean
}

function workoutNotFoundError(): AppError {
  return new AppError('Workout not found.', 'WORKOUT_NOT_FOUND', 404)
}

function emptyWorkoutError(): AppError {
  return new AppError('Workout must have at least one item before starting a session.', 'EMPTY_WORKOUT', 400)
}

function activeWorkoutSessionConflictError(): AppError {
  return new AppError(
    'An active workout session already exists for the current user.',
    'ACTIVE_WORKOUT_SESSION_EXISTS',
    409,
  )
}

function activeWorkoutSessionNotFoundError(): AppError {
  return new AppError('No active workout session was found.', 'ACTIVE_WORKOUT_SESSION_NOT_FOUND', 404)
}

function workoutSetLogNotFoundError(): AppError {
  return new AppError('Workout set log not found in the active session.', 'WORKOUT_SET_LOG_NOT_FOUND', 404)
}

function workoutSessionHasNoCompletedSetLogsError(): AppError {
  return new AppError(
    'Workout session must contain at least one completed set log before completion.',
    'WORKOUT_SESSION_HAS_NO_COMPLETED_SET_LOGS',
    400,
  )
}

function toWorkoutSessionSetLog(record: WorkoutSessionSetLogRecord): WorkoutSessionSetLog {
  return {
    id: record.id,
    setNumber: record.setNumber,
    status: record.status,
    plannedReps: record.plannedReps,
    plannedLoadKg: record.plannedLoadKg,
    actualReps: record.actualReps,
    actualLoadKg: record.actualLoadKg,
    completedAt: record.completedAt?.toISOString() ?? null,
  }
}

function toWorkoutSessionItem(record: WorkoutSessionItemRecord): WorkoutSessionItem {
  return {
    id: record.id,
    workoutItemId: record.workoutItemId,
    exerciseId: record.exerciseId,
    exerciseName: record.exerciseName,
    exerciseSlug: record.exerciseSlug,
    plannedSets: record.plannedSets,
    plannedReps: record.plannedReps,
    plannedLoadKg: record.plannedLoadKg,
    plannedRestSeconds: record.plannedRestSeconds,
    position: record.position,
    setLogs: record.setLogs.map(toWorkoutSessionSetLog),
  }
}

function toWorkoutSessionDetail(
  record: WorkoutSessionRecord,
  workout: {
    id: string
    name: string | null
  },
): WorkoutSessionDetail {
  return {
    id: record.id,
    workoutId: record.workoutId,
    status: record.status,
    startedAt: record.startedAt.toISOString(),
    completedAt: record.completedAt?.toISOString() ?? null,
    workout,
    items: record.items.map(toWorkoutSessionItem),
  }
}

function toWorkoutSessionHistoryEntry(
  record: WorkoutSessionHistoryRecord,
  workout: {
    id: string
    name: string | null
  },
): WorkoutSessionHistoryEntry {
  const completedSetCount = record.items.reduce(
    (sum, item) => sum + item.setLogs.filter((setLog) => setLog.status === 'completed').length,
    0,
  )

  const exerciseCount = new Set(
    record.items
      .filter((item) => item.setLogs.some((setLog) => setLog.status === 'completed'))
      .map((item) => item.exerciseId),
  ).size

  return {
    id: record.id,
    workoutId: record.workoutId,
    workoutName: workout.name,
    startedAt: record.startedAt.toISOString(),
    completedAt: record.completedAt?.toISOString() ?? record.startedAt.toISOString(),
    completedSetCount,
    exerciseCount,
  }
}

function toWorkoutSessionHistoryDetail(
  record: WorkoutSessionRecord,
  workout: {
    id: string
    name: string | null
  },
): WorkoutSessionHistoryDetail {
  return {
    id: record.id,
    workoutId: record.workoutId,
    workoutName: workout.name,
    startedAt: record.startedAt.toISOString(),
    completedAt: record.completedAt?.toISOString() ?? record.startedAt.toISOString(),
    items: record.items.map(toWorkoutSessionItem),
  }
}

function workoutSessionHistoryDetailNotFoundError(): AppError {
  return new AppError('Completed workout session not found.', 'WORKOUT_SESSION_HISTORY_NOT_FOUND', 404)
}

export function createWorkoutLogsService(repository: WorkoutLogsRepository) {
  return {
    async getWorkoutSessionHistoryDetail(
      currentUser: CurrentUser,
      workoutSessionId: string,
    ): Promise<WorkoutSessionHistoryDetail> {
      const session = await repository.findCompletedSessionById(currentUser.id, workoutSessionId)

      if (!session) {
        throw workoutSessionHistoryDetailNotFoundError()
      }

      return toWorkoutSessionHistoryDetail(session.record, session.workout)
    },
    async listWorkoutSessionHistory(currentUser: CurrentUser): Promise<WorkoutSessionHistoryEntry[]> {
      const sessions = await repository.findCompletedSessionHistoryByUserId(currentUser.id)
      return sessions.map((session) => toWorkoutSessionHistoryEntry(session.record, session.workout))
    },
    async startWorkoutSession(currentUser: CurrentUser, input: StartWorkoutSessionInput): Promise<WorkoutSessionDetail> {
      const workout = await repository.findWorkoutSourceById(currentUser.id, input.workoutId)

      if (!workout) {
        throw workoutNotFoundError()
      }

      if (workout.items.length === 0) {
        throw emptyWorkoutError()
      }

      try {
        const createdSession = await repository.createSession(currentUser.id, workout)
        return toWorkoutSessionDetail(createdSession.record, createdSession.workout)
      } catch (error) {
        if (repository.isActiveSessionConflictError(error)) {
          throw activeWorkoutSessionConflictError()
        }

        throw error
      }
    },
    async getActiveWorkoutSession(currentUser: CurrentUser): Promise<WorkoutSessionDetail> {
      const activeSession = await repository.findActiveSessionByUserId(currentUser.id)

      if (!activeSession) {
        throw activeWorkoutSessionNotFoundError()
      }

      return toWorkoutSessionDetail(activeSession.record, activeSession.workout)
    },
    async updateActiveWorkoutSetLog(
      currentUser: CurrentUser,
      workoutSetLogId: string,
      input: UpdateWorkoutSetLogInput,
    ): Promise<WorkoutSessionSetLog> {
      const activeSession = await repository.findActiveSessionByUserId(currentUser.id)

      if (!activeSession) {
        throw activeWorkoutSessionNotFoundError()
      }

      const targetSetLog = activeSession.record.items
        .flatMap((item) => item.setLogs)
        .find((setLog) => setLog.id === workoutSetLogId)

      if (!targetSetLog) {
        throw workoutSetLogNotFoundError()
      }

      const updatedSetLog = await repository.updateSetLogById(workoutSetLogId, input)
      return toWorkoutSessionSetLog(updatedSetLog)
    },
    async completeActiveWorkoutSession(currentUser: CurrentUser): Promise<WorkoutSessionDetail> {
      const activeSession = await repository.findActiveSessionByUserId(currentUser.id)

      if (!activeSession) {
        throw activeWorkoutSessionNotFoundError()
      }

      const hasCompletedSetLog = activeSession.record.items.some((item) =>
        item.setLogs.some((setLog) => setLog.status === 'completed'),
      )

      if (!hasCompletedSetLog) {
        throw workoutSessionHasNoCompletedSetLogsError()
      }

      const completedSession = await repository.completeSessionById(currentUser.id, activeSession.record.id)

      if (!completedSession) {
        throw activeWorkoutSessionNotFoundError()
      }

      return toWorkoutSessionDetail(completedSession.record, completedSession.workout)
    },
  }
}
