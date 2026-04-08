import { Prisma } from '@prisma/client'

import type {
  CreateWorkoutInput,
  CreateWorkoutItemInput,
  ReorderWorkoutItemsInput,
  UpdateWorkoutInput,
  UpdateWorkoutItemInput,
} from './types.js'

type WorkoutSummaryRecord = {
  id: string
  name: string
  createdAt: Date
  updatedAt: Date
}

type WorkoutDetailRecord = WorkoutSummaryRecord & {
  items: WorkoutItemRecord[]
}

type WorkoutItemRecord = {
  id: string
  exerciseId: string
  sets: number
  reps: number
  loadKg: number
  restSeconds: number
  position: number
  createdAt: Date
  updatedAt: Date
  exercise: {
    id: string
    name: string
    slug: string
    muscleGroups: Array<{
      muscleGroup: {
        id: string
        name: string
        slug: string
      }
    }>
  }
}

const workoutSummarySelect = {
  id: true,
  name: true,
  createdAt: true,
  updatedAt: true,
}

const workoutItemSelect = {
  id: true,
  exerciseId: true,
  sets: true,
  reps: true,
  loadKg: true,
  restSeconds: true,
  position: true,
  createdAt: true,
  updatedAt: true,
  exercise: {
    select: {
      id: true,
      name: true,
      slug: true,
      muscleGroups: {
        orderBy: [{ muscleGroup: { name: 'asc' as const } }],
        select: {
          muscleGroup: {
            select: {
              id: true,
              name: true,
              slug: true,
            },
          },
        },
      },
    },
  },
}

const workoutDetailSelect = {
  ...workoutSummarySelect,
  items: {
    orderBy: [{ position: 'asc' as const }],
    select: workoutItemSelect,
  },
}

const workoutItemOrderSelect = {
  id: true,
  position: true,
}

type WorkoutsTransactionClient = {
  workoutItem: {
    findMany(args: {
      where: {
        workoutId: string
      }
      orderBy: Array<{ position: 'asc' | 'desc' }>
      take?: number
      select:
        | {
            position: true
          }
        | typeof workoutItemOrderSelect
    }): Promise<Array<{ position: number }> | Array<{ id: string; position: number }>>
    create(args: {
      data: {
        workoutId: string
        exerciseId: string
        sets: number
        reps: number
        loadKg: number
        restSeconds: number
        position: number
      }
      select: typeof workoutItemSelect
    }): Promise<WorkoutItemRecord>
    update(args: {
      where: {
        id: string
      }
      data: {
        position: number
      }
      select: {
        position: true
      }
    }): Promise<{ position: number }>
  }
}

type WorkoutsPrismaClient = {
  $transaction<T>(fn: (tx: WorkoutsTransactionClient) => Promise<T>): Promise<T>
  workout: {
    create(args: {
      data: {
        userId: string
        name: string
      }
      select: typeof workoutSummarySelect
    }): Promise<WorkoutSummaryRecord>
    findMany(args: {
      where: {
        userId: string
      }
      orderBy: Array<{ updatedAt: 'asc' | 'desc' }>
      select: typeof workoutSummarySelect
    }): Promise<WorkoutSummaryRecord[]>
    findFirst(args: {
      where: {
        id: string
        userId: string
      }
      select: typeof workoutDetailSelect
    }): Promise<WorkoutDetailRecord | null>
    count(args: {
      where: {
        id: string
        userId: string
      }
    }): Promise<number>
    updateMany(args: {
      where: {
        id: string
        userId: string
      }
      data: {
        name?: string
      }
    }): Promise<{ count: number }>
    deleteMany(args: {
      where: {
        id: string
        userId: string
      }
    }): Promise<{ count: number }>
  }
  exercise: {
    count(args: {
      where: {
        id: string
      }
    }): Promise<number>
  }
  workoutItem: {
    findFirst(args: {
      where: {
        id: string
        workoutId: string
        workout: {
          userId: string
        }
      }
      select: {
        id: true
      }
    }): Promise<{ id: string } | null>
    update(args: {
      where: {
        id: string
      }
      data: {
        sets?: number
        reps?: number
        loadKg?: number
        restSeconds?: number
      }
      select: typeof workoutItemSelect
    }): Promise<WorkoutItemRecord>
    deleteMany(args: {
      where: {
        id: string
        workoutId: string
        workout: {
          userId: string
        }
      }
    }): Promise<{ count: number }>
  }
}

function isWorkoutItemPositionConflict(error: unknown): boolean {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === 'P2002' &&
    Array.isArray(error.meta?.target) &&
    error.meta.target.includes('workout_id') &&
    error.meta.target.includes('position')
  )
}

async function createWorkoutItemWithNextPosition(
  transactionClient: WorkoutsTransactionClient,
  workoutId: string,
  input: CreateWorkoutItemInput,
): Promise<WorkoutItemRecord> {
  const items = await transactionClient.workoutItem.findMany({
    where: { workoutId },
    orderBy: [{ position: 'desc' }],
    take: 1,
    select: {
      position: true,
    },
  })

  const position = items.length === 0 ? 0 : items[0].position + 1

  return transactionClient.workoutItem.create({
    data: {
      workoutId,
      exerciseId: input.exerciseId,
      sets: input.sets,
      reps: input.reps,
      loadKg: input.loadKg,
      restSeconds: input.restSeconds,
      position,
    },
    select: workoutItemSelect,
  })
}

export function createWorkoutsRepository(getPrisma: () => WorkoutsPrismaClient) {
  return {
    async create(userId: string, input: CreateWorkoutInput) {
      return getPrisma().workout.create({
        data: {
          userId,
          name: input.name,
        },
        select: workoutSummarySelect,
      })
    },
    async listByUserId(userId: string) {
      return getPrisma().workout.findMany({
        where: { userId },
        orderBy: [{ updatedAt: 'desc' }],
        select: workoutSummarySelect,
      })
    },
    async findById(userId: string, workoutId: string) {
      return getPrisma().workout.findFirst({
        where: {
          id: workoutId,
          userId,
        },
        select: workoutDetailSelect,
      })
    },
    async updateById(userId: string, workoutId: string, input: UpdateWorkoutInput) {
      const result = await getPrisma().workout.updateMany({
        where: {
          id: workoutId,
          userId,
        },
        data: {
          ...(input.name === undefined ? {} : { name: input.name }),
        },
      })

      if (result.count === 0) {
        return null
      }

      return this.findById(userId, workoutId)
    },
    async deleteById(userId: string, workoutId: string) {
      const result = await getPrisma().workout.deleteMany({
        where: {
          id: workoutId,
          userId,
        },
      })

      return result.count > 0
    },
    async existsById(userId: string, workoutId: string) {
      const workoutCount = await getPrisma().workout.count({
        where: {
          id: workoutId,
          userId,
        },
      })

      return workoutCount > 0
    },
    async exerciseExists(exerciseId: string) {
      const exerciseCount = await getPrisma().exercise.count({
        where: {
          id: exerciseId,
        },
      })

      return exerciseCount > 0
    },
    async createItem(workoutId: string, input: CreateWorkoutItemInput) {
      const prisma = getPrisma()

      for (let attempt = 0; attempt < 3; attempt += 1) {
        try {
          return await prisma.$transaction((transactionClient) =>
            createWorkoutItemWithNextPosition(transactionClient, workoutId, input),
          )
        } catch (error) {
          if (isWorkoutItemPositionConflict(error) && attempt < 2) {
            continue
          }

          throw error
        }
      }

      throw new Error('Unexpected workout item position retry exhaustion.')
    },
    async reorderItems(userId: string, workoutId: string, input: ReorderWorkoutItemsInput) {
      const workout = await this.findById(userId, workoutId)

      if (!workout) {
        return null
      }

      const uniqueItemIds = new Set(input.itemIdsInOrder)

      if (
        workout.items.length === 0 ||
        uniqueItemIds.size !== input.itemIdsInOrder.length ||
        workout.items.length !== input.itemIdsInOrder.length
      ) {
        return 'invalid_order' as const
      }

      const expectedItemIds = new Set(workout.items.map((item) => item.id))

      for (const itemId of input.itemIdsInOrder) {
        if (!expectedItemIds.has(itemId)) {
          return 'invalid_order' as const
        }
      }

      await getPrisma().$transaction(async (transactionClient) => {
        const currentItems = (await transactionClient.workoutItem.findMany({
          where: { workoutId },
          orderBy: [{ position: 'asc' }],
          select: workoutItemOrderSelect,
        })) as Array<{ id: string; position: number }>

        if (currentItems.length !== input.itemIdsInOrder.length) {
          throw new Error('Unexpected workout item reorder drift.')
        }

        for (const [index, item] of currentItems.entries()) {
          await transactionClient.workoutItem.update({
            where: { id: item.id },
            data: {
              position: -(index + 1),
            },
            select: {
              position: true,
            },
          })
        }

        for (const [index, itemId] of input.itemIdsInOrder.entries()) {
          await transactionClient.workoutItem.update({
            where: { id: itemId },
            data: {
              position: index,
            },
            select: {
              position: true,
            },
          })
        }
      })

      return this.findById(userId, workoutId)
    },
    async updateItemById(userId: string, workoutId: string, workoutItemId: string, input: UpdateWorkoutItemInput) {
      const item = await getPrisma().workoutItem.findFirst({
        where: {
          id: workoutItemId,
          workoutId,
          workout: {
            userId,
          },
        },
        select: {
          id: true,
        },
      })

      if (!item) {
        return null
      }

      return getPrisma().workoutItem.update({
        where: {
          id: workoutItemId,
        },
        data: {
          ...(input.sets === undefined ? {} : { sets: input.sets }),
          ...(input.reps === undefined ? {} : { reps: input.reps }),
          ...(input.loadKg === undefined ? {} : { loadKg: input.loadKg }),
          ...(input.restSeconds === undefined ? {} : { restSeconds: input.restSeconds }),
        },
        select: workoutItemSelect,
      })
    },
    async deleteItemById(userId: string, workoutId: string, workoutItemId: string) {
      const result = await getPrisma().workoutItem.deleteMany({
        where: {
          id: workoutItemId,
          workoutId,
          workout: {
            userId,
          },
        },
      })

      return result.count > 0
    },
  }
}

export type { WorkoutDetailRecord, WorkoutItemRecord, WorkoutSummaryRecord }
