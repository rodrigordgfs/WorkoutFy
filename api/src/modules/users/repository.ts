import type { AuthenticatedClerkContext } from '../../common/auth/clerk-auth.js'
import type { PersistedUserRecord, UpdateCurrentUserProfileInput, UsersRepository } from './types.js'

type UsersPrismaClient = {
  user: {
    upsert(args: {
      where: { clerkUserId: string }
      update: {
        email: string | null
        firstName: string | null
        lastName: string | null
        imageUrl: string | null
      }
      create: {
        clerkUserId: string
        email: string | null
        firstName: string | null
        lastName: string | null
        imageUrl: string | null
        profile: { create: Record<string, never> }
      }
      include: { profile: true }
    }): Promise<{
      id: string
      clerkUserId: string
      email: string | null
      firstName: string | null
      lastName: string | null
      imageUrl: string | null
      profile: {
        displayName: string | null
        dateOfBirth: Date | null
        heightCm: number | null
        weightKg: number | null
      } | null
    }>
  }
  userProfile: {
    upsert(args: {
      where: { userId: string }
      update: {
        displayName?: string | null
        dateOfBirth?: Date | null
        heightCm?: number | null
        weightKg?: number | null
      }
      create: {
        userId: string
        displayName?: string | null
        dateOfBirth?: Date | null
        heightCm?: number | null
        weightKg?: number | null
      }
    }): Promise<{
      displayName: string | null
      dateOfBirth: Date | null
      heightCm: number | null
      weightKg: number | null
    }>
  }
}

function toProfileDate(dateOfBirth: string | null | undefined): Date | null | undefined {
  if (dateOfBirth === undefined) {
    return undefined
  }

  if (dateOfBirth === null) {
    return null
  }

  return new Date(`${dateOfBirth}T00:00:00.000Z`)
}

function toUserProfileUpdateData(input: UpdateCurrentUserProfileInput) {
  return {
    ...(input.displayName === undefined ? {} : { displayName: input.displayName }),
    ...(input.dateOfBirth === undefined ? {} : { dateOfBirth: toProfileDate(input.dateOfBirth) }),
    ...(input.heightCm === undefined ? {} : { heightCm: input.heightCm }),
    ...(input.weightKg === undefined ? {} : { weightKg: input.weightKg }),
  }
}

function toPersistedUserRecord(record: {
  id: string
  clerkUserId: string
  email: string | null
  firstName: string | null
  lastName: string | null
  imageUrl: string | null
  profile: {
    displayName: string | null
    dateOfBirth: Date | null
    heightCm: number | null
    weightKg: number | null
  } | null
}): PersistedUserRecord {
  return {
    id: record.id,
    clerkUserId: record.clerkUserId,
    email: record.email,
    firstName: record.firstName,
    lastName: record.lastName,
    imageUrl: record.imageUrl,
    profile: {
      displayName: record.profile?.displayName ?? null,
      dateOfBirth: record.profile?.dateOfBirth ?? null,
      heightCm: record.profile?.heightCm ?? null,
      weightKg: record.profile?.weightKg ?? null,
    },
  }
}

export function createUsersRepository(getPrisma: () => UsersPrismaClient): UsersRepository {
  return {
    async upsertByClerkUserId(input) {
      const prisma = getPrisma()
      const record = await prisma.user.upsert({
        where: { clerkUserId: input.clerkUserId },
        update: {
          email: input.email,
          firstName: input.firstName,
          lastName: input.lastName,
          imageUrl: input.imageUrl,
        },
        create: {
          clerkUserId: input.clerkUserId,
          email: input.email,
          firstName: input.firstName,
          lastName: input.lastName,
          imageUrl: input.imageUrl,
          profile: {
            create: {},
          },
        },
        include: { profile: true },
      })

      return toPersistedUserRecord(record)
    },
    async updateProfileByUserId(userId, input) {
      const prisma = getPrisma()
      const profile = await prisma.userProfile.upsert({
        where: { userId },
        update: toUserProfileUpdateData(input),
        create: {
          userId,
          ...toUserProfileUpdateData(input),
        },
      })

      return {
        displayName: profile.displayName,
        dateOfBirth: profile.dateOfBirth,
        heightCm: profile.heightCm,
        weightKg: profile.weightKg,
      }
    },
  }
}
