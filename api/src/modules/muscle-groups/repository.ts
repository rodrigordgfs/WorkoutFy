import { Prisma, type PrismaClient } from '@prisma/client'

export type MuscleGroupRecord = {
  id: string
  name: string
  slug: string
}

export type AdminMuscleGroupRecord = MuscleGroupRecord & {
  createdAt: Date
  updatedAt: Date
}

type MuscleGroupsPrismaClient = Pick<PrismaClient, 'muscleGroup' | 'exerciseMuscleGroup'>

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

export function createMuscleGroupsRepository(getPrisma: () => MuscleGroupsPrismaClient) {
  return {
    async list() {
      return getPrisma().muscleGroup.findMany({
        orderBy: [{ name: 'asc' }],
        select: {
          id: true,
          name: true,
          slug: true,
        },
      })
    },
    async listAdmin() {
      return getPrisma().muscleGroup.findMany({
        orderBy: [{ name: 'asc' }],
        select: {
          id: true,
          name: true,
          slug: true,
          createdAt: true,
          updatedAt: true,
        },
      })
    },
    async findAdminById(id: string) {
      return getPrisma().muscleGroup.findUnique({
        where: { id },
        select: {
          id: true,
          name: true,
          slug: true,
          createdAt: true,
          updatedAt: true,
        },
      })
    },
    async createAdmin(input: { name: string; slug: string }) {
      try {
        return await getPrisma().muscleGroup.create({
          data: input,
          select: {
            id: true,
            name: true,
            slug: true,
            createdAt: true,
            updatedAt: true,
          },
        })
      } catch (error) {
        if (isUniqueSlugError(error)) {
          return null
        }

        throw error
      }
    },
    async updateAdmin(id: string, input: { name?: string; slug?: string }) {
      try {
        return await getPrisma().muscleGroup.update({
          where: { id },
          data: input,
          select: {
            id: true,
            name: true,
            slug: true,
            createdAt: true,
            updatedAt: true,
          },
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
    async countExerciseAssociations(muscleGroupId: string) {
      return getPrisma().exerciseMuscleGroup.count({
        where: { muscleGroupId },
      })
    },
    async deleteAdmin(id: string) {
      try {
        await getPrisma().muscleGroup.delete({
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
