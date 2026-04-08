import type { PrismaClient as PrismaClientType } from '@prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'
import prismaClientPackage from '@prisma/client'
import fp from 'fastify-plugin'

const { PrismaClient } = prismaClientPackage

import { AppError } from '../common/errors/app-error.js'

declare module 'fastify' {
  interface FastifyInstance {
    prisma: PrismaClientType
  }
}

const globalForPrisma = globalThis as { prisma?: PrismaClientType }

function getPrismaClient(): PrismaClientType {
  if (!globalForPrisma.prisma) {
    if (!process.env.DATABASE_URL) {
      throw new AppError('DATABASE_URL is required for Prisma.', 'CONFIGURATION_ERROR', 500)
    }

    try {
      const adapter = new PrismaPg(process.env.DATABASE_URL)
      globalForPrisma.prisma = new PrismaClient({ adapter })
    } catch (error) {
      throw new AppError(
        'Prisma client could not be initialized.',
        'PRISMA_CONFIGURATION_ERROR',
        500,
        {
          hint: 'Prisma 7 requires a configured adapter or Accelerate before first database use.',
          cause: error instanceof Error ? error.message : String(error),
        },
      )
    }
  }

  return globalForPrisma.prisma
}

export default fp(async function prismaPlugin(app) {
  app.decorate('prisma', null as unknown as PrismaClientType)

  Object.defineProperty(app, 'prisma', {
    configurable: true,
    enumerable: true,
    get() {
      return getPrismaClient()
    },
  })

  app.addHook('onClose', async () => {
    if (globalForPrisma.prisma) {
      await globalForPrisma.prisma.$disconnect()
      globalForPrisma.prisma = undefined
    }
  })
})
