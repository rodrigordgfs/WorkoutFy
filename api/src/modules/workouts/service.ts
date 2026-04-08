import { AppError } from '../../common/errors/app-error.js'
import type { CurrentUser } from '../users/types.js'
import type {
  CreateWorkoutInput,
  CreateWorkoutItemInput,
  ReorderWorkoutItemsInput,
  UpdateWorkoutInput,
  UpdateWorkoutItemInput,
  WorkoutDetail,
  WorkoutExercise,
  WorkoutItem,
  WorkoutSummary,
} from './types.js'
import type { WorkoutDetailRecord, WorkoutItemRecord, WorkoutSummaryRecord } from './repository.js'

type WorkoutsRepository = {
  create(userId: string, input: CreateWorkoutInput): Promise<WorkoutSummaryRecord>
  listByUserId(userId: string): Promise<WorkoutSummaryRecord[]>
  findById(userId: string, workoutId: string): Promise<WorkoutDetailRecord | null>
  updateById(userId: string, workoutId: string, input: UpdateWorkoutInput): Promise<WorkoutDetailRecord | null>
  deleteById(userId: string, workoutId: string): Promise<boolean>
  existsById(userId: string, workoutId: string): Promise<boolean>
  exerciseExists(exerciseId: string): Promise<boolean>
  createItem(workoutId: string, input: CreateWorkoutItemInput): Promise<WorkoutItemRecord>
  reorderItems(
    userId: string,
    workoutId: string,
    input: ReorderWorkoutItemsInput,
  ): Promise<WorkoutDetailRecord | 'invalid_order' | null>
  updateItemById(
    userId: string,
    workoutId: string,
    workoutItemId: string,
    input: UpdateWorkoutItemInput,
  ): Promise<WorkoutItemRecord | null>
  deleteItemById(userId: string, workoutId: string, workoutItemId: string): Promise<boolean>
}

function toWorkoutSummary(record: WorkoutSummaryRecord): WorkoutSummary {
  return {
    id: record.id,
    name: record.name,
    createdAt: record.createdAt.toISOString(),
    updatedAt: record.updatedAt.toISOString(),
  }
}

function toExercise(record: WorkoutItemRecord['exercise']): WorkoutExercise {
  return {
    id: record.id,
    name: record.name,
    slug: record.slug,
    muscleGroups: record.muscleGroups.map(({ muscleGroup }) => ({
      id: muscleGroup.id,
      name: muscleGroup.name,
      slug: muscleGroup.slug,
    })),
  }
}

function toWorkoutItem(record: WorkoutItemRecord): WorkoutItem {
  return {
    id: record.id,
    exerciseId: record.exerciseId,
    sets: record.sets,
    reps: record.reps,
    loadKg: record.loadKg,
    restSeconds: record.restSeconds,
    position: record.position,
    createdAt: record.createdAt.toISOString(),
    updatedAt: record.updatedAt.toISOString(),
    exercise: toExercise(record.exercise),
  }
}

function toWorkoutDetail(record: WorkoutDetailRecord): WorkoutDetail {
  return {
    ...toWorkoutSummary(record),
    items: record.items.map(toWorkoutItem),
  }
}

function notFoundError(): AppError {
  return new AppError('Workout not found.', 'WORKOUT_NOT_FOUND', 404)
}

function workoutItemNotFoundError(): AppError {
  return new AppError('Workout item not found.', 'WORKOUT_ITEM_NOT_FOUND', 404)
}

function invalidExerciseError(): AppError {
  return new AppError('Exercise not found.', 'EXERCISE_NOT_FOUND', 400)
}

function invalidWorkoutItemOrderError(): AppError {
  return new AppError('Workout item order is invalid.', 'INVALID_WORKOUT_ITEM_ORDER', 400)
}

export function createWorkoutsService(repository: WorkoutsRepository) {
  return {
    async createWorkout(currentUser: CurrentUser, input: CreateWorkoutInput) {
      return toWorkoutSummary(await repository.create(currentUser.id, input))
    },
    async listWorkouts(currentUser: CurrentUser) {
      return (await repository.listByUserId(currentUser.id)).map(toWorkoutSummary)
    },
    async getWorkout(currentUser: CurrentUser, workoutId: string) {
      const record = await repository.findById(currentUser.id, workoutId)

      if (!record) {
        throw notFoundError()
      }

      return toWorkoutDetail(record)
    },
    async updateWorkout(currentUser: CurrentUser, workoutId: string, input: UpdateWorkoutInput) {
      const record = await repository.updateById(currentUser.id, workoutId, input)

      if (!record) {
        throw notFoundError()
      }

      return toWorkoutSummary(record)
    },
    async deleteWorkout(currentUser: CurrentUser, workoutId: string) {
      const deleted = await repository.deleteById(currentUser.id, workoutId)

      if (!deleted) {
        throw notFoundError()
      }
    },
    async createWorkoutItem(currentUser: CurrentUser, workoutId: string, input: CreateWorkoutItemInput) {
      const workoutExists = await repository.existsById(currentUser.id, workoutId)

      if (!workoutExists) {
        throw notFoundError()
      }

      const exerciseExists = await repository.exerciseExists(input.exerciseId)

      if (!exerciseExists) {
        throw invalidExerciseError()
      }

      return toWorkoutItem(await repository.createItem(workoutId, input))
    },
    async reorderWorkoutItems(currentUser: CurrentUser, workoutId: string, input: ReorderWorkoutItemsInput) {
      const result = await repository.reorderItems(currentUser.id, workoutId, input)

      if (result === 'invalid_order') {
        throw invalidWorkoutItemOrderError()
      }

      if (!result) {
        throw notFoundError()
      }

      return toWorkoutDetail(result)
    },
    async updateWorkoutItem(
      currentUser: CurrentUser,
      workoutId: string,
      workoutItemId: string,
      input: UpdateWorkoutItemInput,
    ) {
      const item = await repository.updateItemById(currentUser.id, workoutId, workoutItemId, input)

      if (!item) {
        throw workoutItemNotFoundError()
      }

      return toWorkoutItem(item)
    },
    async deleteWorkoutItem(currentUser: CurrentUser, workoutId: string, workoutItemId: string) {
      const deleted = await repository.deleteItemById(currentUser.id, workoutId, workoutItemId)

      if (!deleted) {
        throw workoutItemNotFoundError()
      }
    },
  }
}
