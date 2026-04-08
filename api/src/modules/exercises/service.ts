import { AppError } from '../../common/errors/app-error.js'
import type { AdminExerciseRecord, ExerciseRow } from './repository.js'
import type {
  CreateAdminExerciseInput,
  ListExercisesFilters,
  UpdateAdminExerciseInput,
} from './types.js'

type ExercisesRepository = {
  list(filters: ListExercisesFilters): Promise<ExerciseRow[]>
  listAdmin(): Promise<AdminExerciseRecord[]>
  findAdminById(id: string): Promise<AdminExerciseRecord | null>
  countExistingMuscleGroups(ids: string[]): Promise<number>
  createAdmin(input: CreateAdminExerciseInput & { slug: string }): Promise<AdminExerciseRecord | null>
  updateAdmin(
    id: string,
    input: UpdateAdminExerciseInput & { slug?: string },
  ): Promise<AdminExerciseRecord | 'duplicate-slug' | null>
  countWorkoutItemReferences(exerciseId: string): Promise<number>
  countWorkoutSessionItemReferences(exerciseId: string): Promise<number>
  deleteAdmin(id: string): Promise<boolean>
}

function slugify(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

function resolveSlug(name: string, explicitSlug: string | null | undefined): string {
  const derived = slugify(explicitSlug ?? name)

  if (derived.length === 0) {
    throw new AppError('Request validation failed.', 'VALIDATION_ERROR', 400, {
      issues: [
        {
          path: explicitSlug === undefined ? 'name' : 'slug',
          message: 'Slug must contain at least one alphanumeric character.',
        },
      ],
    })
  }

  return derived
}

function mapExercise(record: ExerciseRow | AdminExerciseRecord) {
  return {
    id: record.id,
    name: record.name,
    slug: record.slug,
    muscleGroups: record.muscleGroups.map(({ muscleGroup }) => ({
      id: muscleGroup.id,
      name: muscleGroup.name,
      slug: muscleGroup.slug,
    })),
    ...('createdAt' in record
      ? {
          createdAt: record.createdAt,
          updatedAt: record.updatedAt,
        }
      : {}),
  }
}

async function assertExistingMuscleGroups(
  repository: ExercisesRepository,
  muscleGroupIds: string[],
) {
  const count = await repository.countExistingMuscleGroups(muscleGroupIds)

  if (count !== muscleGroupIds.length) {
    throw new AppError(
      'One or more informed muscle groups do not exist.',
      'MUSCLE_GROUP_NOT_FOUND',
      400,
    )
  }
}

export function createExercisesService(repository: ExercisesRepository) {
  return {
    async listExercises(filters: ListExercisesFilters) {
      const records = await repository.list(filters)

      return records.map(mapExercise)
    },
    async listAdminExercises() {
      const records = await repository.listAdmin()

      return records.map(mapExercise)
    },
    async createAdminExercise(input: CreateAdminExerciseInput) {
      await assertExistingMuscleGroups(repository, input.muscleGroupIds)

      const record = await repository.createAdmin({
        ...input,
        slug: resolveSlug(input.name, input.slug),
      })

      if (!record) {
        throw new AppError(
          'An exercise with this slug already exists.',
          'EXERCISE_SLUG_CONFLICT',
          409,
        )
      }

      return mapExercise(record)
    },
    async updateAdminExercise(id: string, input: UpdateAdminExerciseInput) {
      const existing = await repository.findAdminById(id)

      if (!existing) {
        throw new AppError('Exercise not found.', 'EXERCISE_NOT_FOUND', 404)
      }

      if (input.muscleGroupIds !== undefined) {
        await assertExistingMuscleGroups(repository, input.muscleGroupIds)
      }

      const record = await repository.updateAdmin(id, {
        ...input,
        ...(input.slug === undefined && input.name === undefined
          ? {}
          : {
              slug: resolveSlug(input.name ?? existing.name, input.slug ?? undefined),
            }),
      })

      if (record === 'duplicate-slug') {
        throw new AppError(
          'An exercise with this slug already exists.',
          'EXERCISE_SLUG_CONFLICT',
          409,
        )
      }

      if (!record) {
        throw new AppError('Exercise not found.', 'EXERCISE_NOT_FOUND', 404)
      }

      return mapExercise(record)
    },
    async deleteAdminExercise(id: string) {
      const existing = await repository.findAdminById(id)

      if (!existing) {
        throw new AppError('Exercise not found.', 'EXERCISE_NOT_FOUND', 404)
      }

      const [workoutItemReferences, workoutSessionItemReferences] = await Promise.all([
        repository.countWorkoutItemReferences(id),
        repository.countWorkoutSessionItemReferences(id),
      ])

      if (workoutItemReferences > 0 || workoutSessionItemReferences > 0) {
        throw new AppError(
          'Exercise cannot be removed while it is referenced by workouts or workout history.',
          'EXERCISE_IN_USE',
          409,
        )
      }

      const deleted = await repository.deleteAdmin(id)

      if (!deleted) {
        throw new AppError('Exercise not found.', 'EXERCISE_NOT_FOUND', 404)
      }
    },
  }
}
