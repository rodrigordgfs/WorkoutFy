import { z } from 'zod'

import { AppError } from '../../common/errors/app-error.js'
import type { StartWorkoutSessionInput, UpdateWorkoutSetLogInput } from './types.js'

const startWorkoutSessionInputSchema = z
  .object({
    workoutId: z.string().trim().min(1),
  })
  .strict()

const updateWorkoutSetLogParamsZodSchema = z
  .object({
    workoutSetLogId: z.string().trim().min(1),
  })
  .strict()

const updateWorkoutSetLogInputZodSchema = z
  .object({
    actualReps: z.int().positive(),
    actualLoadKg: z.number().min(0),
  })
  .strict()

function toValidationIssues(error: z.ZodError): Array<{ path: string; message: string }> {
  return error.issues.map((issue) => ({
    path: issue.path.join('.'),
    message: issue.message,
  }))
}

function parseWithSchema<T>(schema: z.ZodType<T>, input: unknown): T {
  const result = schema.safeParse(input)

  if (!result.success) {
    throw new AppError('Request validation failed.', 'VALIDATION_ERROR', 400, {
      issues: toValidationIssues(result.error),
    })
  }

  return result.data
}

export function parseStartWorkoutSessionInput(input: unknown): StartWorkoutSessionInput {
  return parseWithSchema(startWorkoutSessionInputSchema, input)
}

export function parseUpdateWorkoutSetLogParams(input: unknown): { workoutSetLogId: string } {
  return parseWithSchema(updateWorkoutSetLogParamsZodSchema, input)
}

export function parseWorkoutSessionHistoryParams(input: unknown): { workoutSessionId: string } {
  return parseWithSchema(
    z
      .object({
        workoutSessionId: z.string().trim().min(1),
      })
      .strict(),
    input,
  )
}

export function parseUpdateWorkoutSetLogInput(input: unknown): UpdateWorkoutSetLogInput {
  return parseWithSchema(updateWorkoutSetLogInputZodSchema, input)
}

const workoutSessionWorkoutResponseSchema = {
  type: 'object',
  additionalProperties: false,
  required: ['id', 'name'],
  properties: {
    id: { type: 'string' },
    name: {
      anyOf: [{ type: 'string' }, { type: 'null' }],
    },
  },
} as const

export const workoutSessionSetLogResponseSchema = {
  type: 'object',
  additionalProperties: false,
  required: [
    'id',
    'setNumber',
    'status',
    'plannedReps',
    'plannedLoadKg',
    'actualReps',
    'actualLoadKg',
    'completedAt',
  ],
  properties: {
    id: { type: 'string' },
    setNumber: { type: 'integer' },
    status: {
      type: 'string',
      enum: ['pending', 'completed'],
    },
    plannedReps: { type: 'integer' },
    plannedLoadKg: { type: 'number' },
    actualReps: {
      anyOf: [{ type: 'integer' }, { type: 'null' }],
    },
    actualLoadKg: {
      anyOf: [{ type: 'number' }, { type: 'null' }],
    },
    completedAt: {
      anyOf: [{ type: 'string', format: 'date-time' }, { type: 'null' }],
    },
  },
} as const

const workoutSessionItemResponseSchema = {
  type: 'object',
  additionalProperties: false,
  required: [
    'id',
    'workoutItemId',
    'exerciseId',
    'exerciseName',
    'exerciseSlug',
    'plannedSets',
    'plannedReps',
    'plannedLoadKg',
    'plannedRestSeconds',
    'position',
    'setLogs',
  ],
  properties: {
    id: { type: 'string' },
    workoutItemId: { type: 'string' },
    exerciseId: { type: 'string' },
    exerciseName: { type: 'string' },
    exerciseSlug: { type: 'string' },
    plannedSets: { type: 'integer' },
    plannedReps: { type: 'integer' },
    plannedLoadKg: { type: 'number' },
    plannedRestSeconds: { type: 'integer' },
    position: { type: 'integer' },
    setLogs: {
      type: 'array',
      items: workoutSessionSetLogResponseSchema,
    },
  },
} as const

export const workoutSessionDetailResponseSchema = {
  type: 'object',
  additionalProperties: false,
  required: ['id', 'workoutId', 'status', 'startedAt', 'completedAt', 'workout', 'items'],
  properties: {
    id: { type: 'string' },
    workoutId: { type: 'string' },
    status: {
      type: 'string',
      enum: ['in_progress', 'completed'],
    },
    startedAt: { type: 'string', format: 'date-time' },
    completedAt: {
      anyOf: [{ type: 'string', format: 'date-time' }, { type: 'null' }],
    },
    workout: workoutSessionWorkoutResponseSchema,
    items: {
      type: 'array',
      items: workoutSessionItemResponseSchema,
    },
  },
} as const

export const workoutSessionHistoryEntryResponseSchema = {
  type: 'object',
  additionalProperties: false,
  required: ['id', 'workoutId', 'workoutName', 'startedAt', 'completedAt', 'completedSetCount', 'exerciseCount'],
  properties: {
    id: { type: 'string' },
    workoutId: { type: 'string' },
    workoutName: {
      anyOf: [{ type: 'string' }, { type: 'null' }],
    },
    startedAt: { type: 'string', format: 'date-time' },
    completedAt: { type: 'string', format: 'date-time' },
    completedSetCount: { type: 'integer' },
    exerciseCount: { type: 'integer' },
  },
} as const

export const workoutSessionHistoryListResponseSchema = {
  type: 'array',
  items: workoutSessionHistoryEntryResponseSchema,
} as const

export const workoutSessionHistoryDetailResponseSchema = {
  type: 'object',
  additionalProperties: false,
  required: ['id', 'workoutId', 'workoutName', 'startedAt', 'completedAt', 'items'],
  properties: {
    id: { type: 'string' },
    workoutId: { type: 'string' },
    workoutName: {
      anyOf: [{ type: 'string' }, { type: 'null' }],
    },
    startedAt: { type: 'string', format: 'date-time' },
    completedAt: { type: 'string', format: 'date-time' },
    items: {
      type: 'array',
      items: workoutSessionItemResponseSchema,
    },
  },
} as const

export const startWorkoutSessionBodySchema = {
  type: 'object',
  additionalProperties: false,
  required: ['workoutId'],
  properties: {
    workoutId: { type: 'string', minLength: 1 },
  },
} as const

export const updateWorkoutSetLogParamsSchema = {
  type: 'object',
  additionalProperties: false,
  required: ['workoutSetLogId'],
  properties: {
    workoutSetLogId: { type: 'string', minLength: 1 },
  },
} as const

export const workoutSessionHistoryParamsSchema = {
  type: 'object',
  additionalProperties: false,
  required: ['workoutSessionId'],
  properties: {
    workoutSessionId: { type: 'string', minLength: 1 },
  },
} as const

export const updateWorkoutSetLogBodySchema = {
  type: 'object',
  additionalProperties: false,
  required: ['actualReps', 'actualLoadKg'],
  properties: {
    actualReps: { type: 'integer', minimum: 1 },
    actualLoadKg: { type: 'number', minimum: 0 },
  },
} as const
