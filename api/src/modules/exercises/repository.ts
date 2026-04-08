import { Prisma, type PrismaClient } from '@prisma/client'

import type {
  CreateAdminExerciseInput,
  ListExercisesFilters,
  UpdateAdminExerciseInput,
} from './types.js'

type ExercisesPrismaClient = Pick<
  PrismaClient,
  '$transaction' | 'exercise' | 'muscleGroup' | 'exerciseMuscleGroup' | 'workoutItem' | 'workoutSessionItem'
>

type ExercisesTransactionClient = Omit<ExercisesPrismaClient, '$transaction'>

const exerciseMuscleGroupsArgs = {
  orderBy: [{ muscleGroup: { name: 'asc' } }],
  select: {
    muscleGroup: {
      select: {
        id: true,
        name: true,
        slug: true,
      },
    },
  },
} satisfies Prisma.Exercise$muscleGroupsArgs

const exerciseBaseSelect = {
  id: true,
  name: true,
  slug: true,
  muscleGroups: exerciseMuscleGroupsArgs,
} satisfies Prisma.ExerciseSelect

const adminExerciseSelect = {
  ...exerciseBaseSelect,
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.ExerciseSelect

export type ExerciseRow = Prisma.ExerciseGetPayload<{ select: typeof exerciseBaseSelect }>
export type AdminExerciseRecord = Prisma.ExerciseGetPayload<{ select: typeof adminExerciseSelect }>

function buildWhere(filters: ListExercisesFilters) {
  return {
    ...(filters.search
      ? {
          name: {
            contains: filters.search,
            mode: 'insensitive' as const,
          },
        }
      : {}),
    ...(filters.muscleGroupId
      ? {
          muscleGroups: {
            some: {
              muscleGroupId: filters.muscleGroupId,
            },
          },
        }
      : {}),
  }
}

function isUniqueSlugError(error: unknown): boolean {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === 'P2002' &&
    Array.isArray(error.meta?.target) &&
    error.meta.target.includes('slug')
  )
}

function isMissingRecordError(error: unknown): boolean {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === 'P2025'
  )
}

async function syncExerciseMuscleGroups(
  transactionClient: ExercisesTransactionClient,
  exerciseId: string,
  muscleGroupIds: string[],
) {
  await transactionClient.exerciseMuscleGroup.deleteMany({
    where: { exerciseId },
  })

  await transactionClient.exerciseMuscleGroup.createMany({
    data: muscleGroupIds.map((muscleGroupId) => ({
      exerciseId,
      muscleGroupId,
    })),
  })
}

export function createExercisesRepository(getPrisma: () => ExercisesPrismaClient) {
  return {
    async list(filters: ListExercisesFilters) {
      return getPrisma().exercise.findMany({
        where: buildWhere(filters),
        orderBy: [{ name: 'asc' }],
        select: exerciseBaseSelect,
      })
    },
    async listAdmin() {
      return getPrisma().exercise.findMany({
        orderBy: [{ name: 'asc' }],
        select: adminExerciseSelect,
      })
    },
    async findAdminById(id: string) {
      return getPrisma().exercise.findUnique({
        where: { id },
        select: adminExerciseSelect,
      })
    },
    async countExistingMuscleGroups(ids: string[]) {
      return getPrisma().muscleGroup.count({
        where: {
          id: {
            in: ids,
          },
        },
      })
    },
    async createAdmin(input: CreateAdminExerciseInput & { slug: string }) {
      try {
        return await getPrisma().$transaction(async (transactionClient) => {
          const created = await transactionClient.exercise.create({
            data: {
              name: input.name,
              slug: input.slug,
            },
            select: {
              id: true,
            },
          })

          await syncExerciseMuscleGroups(
            transactionClient,
            created.id,
            input.muscleGroupIds,
          )

          return transactionClient.exercise.findUniqueOrThrow({
            where: { id: created.id },
            select: adminExerciseSelect,
          })
        })
      } catch (error) {
        if (isUniqueSlugError(error)) {
          return null
        }

        throw error
      }
    },
    async updateAdmin(id: string, input: UpdateAdminExerciseInput & { slug?: string }) {
      try {
        return await getPrisma().$transaction(async (transactionClient) => {
          await transactionClient.exercise.update({
            where: { id },
            data: {
              ...(input.name === undefined ? {} : { name: input.name }),
              ...(input.slug === undefined ? {} : { slug: input.slug }),
            },
            select: {
              id: true,
            },
          })

          if (input.muscleGroupIds !== undefined) {
            await syncExerciseMuscleGroups(
              transactionClient,
              id,
              input.muscleGroupIds,
            )
          }

          return transactionClient.exercise.findUniqueOrThrow({
            where: { id },
            select: adminExerciseSelect,
          })
        })
      } catch (error) {
        if (isUniqueSlugError(error)) {
          return 'duplicate-slug' as const
        }

        if (isMissingRecordError(error)) {
          return null
        }

        throw error
      }
    },
    async countWorkoutItemReferences(exerciseId: string) {
      return getPrisma().workoutItem.count({
        where: { exerciseId },
      })
    },
    async countWorkoutSessionItemReferences(exerciseId: string) {
      return getPrisma().workoutSessionItem.count({
        where: { exerciseId },
      })
    },
    async deleteAdmin(id: string) {
      try {
        await getPrisma().exercise.delete({
          where: { id },
        })

        return true
      } catch (error) {
        if (isMissingRecordError(error)) {
          return false
        }

        throw error
      }
    },
  }
}
