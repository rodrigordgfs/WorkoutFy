type ProgressSessionSetLogRecord = {
  status: 'pending' | 'completed'
  actualReps: number | null
  actualLoadKg: number | null
  completedAt: Date | null
}

type ProgressSessionItemRecord = {
  exerciseId: string
  exerciseName: string
  exerciseSlug: string
  setLogs: ProgressSessionSetLogRecord[]
}

type ProgressSessionRecord = {
  id: string
  completedAt: Date | null
  items: ProgressSessionItemRecord[]
}

type ProgressProfileRecord = {
  displayName: string | null
  heightCm: number | null
  weightKg: number | null
}

const progressSessionSelect = {
  id: true,
  completedAt: true,
  items: {
    select: {
      exerciseId: true,
      exerciseName: true,
      exerciseSlug: true,
      setLogs: {
        select: {
          status: true,
          actualReps: true,
          actualLoadKg: true,
          completedAt: true,
        },
      },
    },
  },
} as const

type ProgressPrismaClient = {
  workoutSession: {
    findMany(args: {
      where: {
        userId: string
        status: 'completed'
      }
      orderBy: Array<{ completedAt: 'asc' | 'desc' }>
      select: typeof progressSessionSelect
    }): Promise<ProgressSessionRecord[]>
  }
  userProfile: {
    findUnique(args: {
      where: { userId: string }
      select: {
        displayName: true
        heightCm: true
        weightKg: true
      }
    }): Promise<ProgressProfileRecord | null>
  }
}

export function createProgressRepository(getPrisma: () => ProgressPrismaClient) {
  return {
    findCompletedSessionsByUserId(userId: string) {
      return getPrisma().workoutSession.findMany({
        where: {
          userId,
          status: 'completed',
        },
        orderBy: [{ completedAt: 'desc' }],
        select: progressSessionSelect,
      })
    },
    async findProfileSnapshotByUserId(userId: string) {
      return (
        (await getPrisma().userProfile.findUnique({
          where: { userId },
          select: {
            displayName: true,
            heightCm: true,
            weightKg: true,
          },
        })) ?? {
          displayName: null,
          heightCm: null,
          weightKg: null,
        }
      )
    },
  }
}

export type { ProgressProfileRecord, ProgressSessionItemRecord, ProgressSessionRecord, ProgressSessionSetLogRecord }
