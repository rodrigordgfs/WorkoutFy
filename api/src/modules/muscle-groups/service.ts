import { AppError } from '../../common/errors/app-error.js'
import type { AdminMuscleGroupRecord, MuscleGroupRecord } from './repository.js'

type CreateAdminMuscleGroupInput = {
  name: string
  slug: string | null
}

type UpdateAdminMuscleGroupInput = {
  name?: string
  slug?: string | null
}

type MuscleGroupsRepository = {
  list(): Promise<MuscleGroupRecord[]>
  listAdmin(): Promise<AdminMuscleGroupRecord[]>
  findAdminById(id: string): Promise<AdminMuscleGroupRecord | null>
  createAdmin(input: { name: string; slug: string }): Promise<AdminMuscleGroupRecord | null>
  updateAdmin(
    id: string,
    input: { name?: string; slug?: string },
  ): Promise<AdminMuscleGroupRecord | 'duplicate-slug' | null>
  countExerciseAssociations(muscleGroupId: string): Promise<number>
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

export function createMuscleGroupsService(repository: MuscleGroupsRepository) {
  return {
    async listMuscleGroups() {
      return repository.list()
    },
    async listAdminMuscleGroups() {
      return repository.listAdmin()
    },
    async createAdminMuscleGroup(input: CreateAdminMuscleGroupInput) {
      const record = await repository.createAdmin({
        name: input.name,
        slug: resolveSlug(input.name, input.slug),
      })

      if (!record) {
        throw new AppError(
          'A muscle group with this slug already exists.',
          'MUSCLE_GROUP_SLUG_CONFLICT',
          409,
        )
      }

      return record
    },
    async updateAdminMuscleGroup(id: string, input: UpdateAdminMuscleGroupInput) {
      const existing = await repository.findAdminById(id)

      if (!existing) {
        throw new AppError('Muscle group not found.', 'MUSCLE_GROUP_NOT_FOUND', 404)
      }

      const nextName = input.name ?? existing.name
      const nextSlug =
        input.slug === undefined && input.name === undefined
          ? undefined
          : resolveSlug(nextName, input.slug ?? undefined)

      const record = await repository.updateAdmin(id, {
        ...(input.name === undefined ? {} : { name: nextName }),
        ...(nextSlug === undefined ? {} : { slug: nextSlug }),
      })

      if (record === 'duplicate-slug') {
        throw new AppError(
          'A muscle group with this slug already exists.',
          'MUSCLE_GROUP_SLUG_CONFLICT',
          409,
        )
      }

      if (!record) {
        throw new AppError('Muscle group not found.', 'MUSCLE_GROUP_NOT_FOUND', 404)
      }

      return record
    },
    async deleteAdminMuscleGroup(id: string) {
      const existing = await repository.findAdminById(id)

      if (!existing) {
        throw new AppError('Muscle group not found.', 'MUSCLE_GROUP_NOT_FOUND', 404)
      }

      const associationCount = await repository.countExerciseAssociations(id)

      if (associationCount > 0) {
        throw new AppError(
          'Muscle group cannot be removed while it is associated with exercises.',
          'MUSCLE_GROUP_IN_USE',
          409,
        )
      }

      const deleted = await repository.deleteAdmin(id)

      if (!deleted) {
        throw new AppError('Muscle group not found.', 'MUSCLE_GROUP_NOT_FOUND', 404)
      }
    },
  }
}
