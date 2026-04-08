import { z } from 'zod'

import { AppError } from '../../common/errors/app-error.js'
import type {
  CreateWorkoutInput,
  CreateWorkoutItemInput,
  ReorderWorkoutItemsInput,
  UpdateWorkoutInput,
  UpdateWorkoutItemInput,
} from './types.js'

const workoutNameSchema = z.string().trim().min(1).max(80)
const positiveIntegerSchema = z.number().int().positive()
const nonNegativeIntegerSchema = z.number().int().min(0)
const nonNegativeNumberSchema = z.number().min(0)

const createWorkoutInputSchema = z
  .object({
    name: workoutNameSchema,
  })
  .strict()

const updateWorkoutInputSchema = z
  .object({
    name: workoutNameSchema.optional(),
  })
  .strict()
  .refine((value) => Object.keys(value).length > 0, {
    message: 'At least one editable workout field must be provided.',
  })

const createWorkoutItemInputSchema = z
  .object({
    exerciseId: z.string().trim().min(1),
    sets: positiveIntegerSchema,
    reps: positiveIntegerSchema,
    loadKg: nonNegativeNumberSchema,
    restSeconds: nonNegativeIntegerSchema,
  })
  .strict()

const updateWorkoutItemInputSchema = z
  .object({
    sets: positiveIntegerSchema.optional(),
    reps: positiveIntegerSchema.optional(),
    loadKg: nonNegativeNumberSchema.optional(),
    restSeconds: nonNegativeIntegerSchema.optional(),
  })
  .strict()
  .refine((value) => Object.keys(value).length > 0, {
    message: 'At least one editable workout item field must be provided.',
  })

const reorderWorkoutItemsInputSchema = z
  .object({
    itemIdsInOrder: z.array(z.string().trim().min(1)).min(1),
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

export function parseCreateWorkoutInput(input: unknown): CreateWorkoutInput {
  return parseWithSchema(createWorkoutInputSchema, input)
}

export function parseUpdateWorkoutInput(input: unknown): UpdateWorkoutInput {
  return parseWithSchema(updateWorkoutInputSchema, input)
}

export function parseCreateWorkoutItemInput(input: unknown): CreateWorkoutItemInput {
  return parseWithSchema(createWorkoutItemInputSchema, input)
}

export function parseUpdateWorkoutItemInput(input: unknown): UpdateWorkoutItemInput {
  return parseWithSchema(updateWorkoutItemInputSchema, input)
}

export function parseReorderWorkoutItemsInput(input: unknown): ReorderWorkoutItemsInput {
  return parseWithSchema(reorderWorkoutItemsInputSchema, input)
}

const workoutExerciseMuscleGroupSchema = {
  type: 'object',
  additionalProperties: false,
  required: ['id', 'name', 'slug'],
  properties: {
    id: { type: 'string' },
    name: { type: 'string' },
    slug: { type: 'string' },
  },
} as const

const workoutExerciseSchema = {
  type: 'object',
  additionalProperties: false,
  required: ['id', 'name', 'slug', 'muscleGroups'],
  properties: {
    id: { type: 'string' },
    name: { type: 'string' },
    slug: { type: 'string' },
    muscleGroups: {
      type: 'array',
      items: workoutExerciseMuscleGroupSchema,
    },
  },
} as const

export const workoutItemResponseSchema = {
  type: 'object',
  additionalProperties: false,
  required: [
    'id',
    'exerciseId',
    'sets',
    'reps',
    'loadKg',
    'restSeconds',
    'position',
    'createdAt',
    'updatedAt',
    'exercise',
  ],
  properties: {
    id: { type: 'string' },
    exerciseId: { type: 'string' },
    sets: { type: 'integer', minimum: 1 },
    reps: { type: 'integer', minimum: 1 },
    loadKg: { type: 'number', minimum: 0 },
    restSeconds: { type: 'integer', minimum: 0 },
    position: { type: 'integer', minimum: 0 },
    createdAt: { type: 'string', format: 'date-time' },
    updatedAt: { type: 'string', format: 'date-time' },
    exercise: workoutExerciseSchema,
  },
} as const

export const workoutResponseSchema = {
  type: 'object',
  additionalProperties: false,
  required: ['id', 'name', 'createdAt', 'updatedAt'],
  properties: {
    id: { type: 'string' },
    name: { type: 'string' },
    createdAt: { type: 'string', format: 'date-time' },
    updatedAt: { type: 'string', format: 'date-time' },
  },
} as const

export const workoutDetailResponseSchema = {
  type: 'object',
  additionalProperties: false,
  required: ['id', 'name', 'createdAt', 'updatedAt', 'items'],
  properties: {
    id: { type: 'string' },
    name: { type: 'string' },
    createdAt: { type: 'string', format: 'date-time' },
    updatedAt: { type: 'string', format: 'date-time' },
    items: {
      type: 'array',
      items: workoutItemResponseSchema,
    },
  },
} as const

export const workoutsListResponseSchema = {
  type: 'array',
  items: workoutResponseSchema,
} as const

export const createWorkoutBodySchema = {
  type: 'object',
  additionalProperties: false,
  required: ['name'],
  properties: {
    name: { type: 'string', minLength: 1, maxLength: 80 },
  },
} as const

export const updateWorkoutBodySchema = {
  type: 'object',
  additionalProperties: false,
  properties: {
    name: { type: 'string', minLength: 1, maxLength: 80 },
  },
} as const

export const createWorkoutItemBodySchema = {
  type: 'object',
  additionalProperties: false,
  required: ['exerciseId', 'sets', 'reps', 'loadKg', 'restSeconds'],
  properties: {
    exerciseId: { type: 'string', minLength: 1 },
    sets: { type: 'integer', minimum: 1 },
    reps: { type: 'integer', minimum: 1 },
    loadKg: { type: 'number', minimum: 0 },
    restSeconds: { type: 'integer', minimum: 0 },
  },
} as const

export const updateWorkoutItemBodySchema = {
  type: 'object',
  additionalProperties: false,
  properties: {
    sets: { type: 'integer', minimum: 1 },
    reps: { type: 'integer', minimum: 1 },
    loadKg: { type: 'number', minimum: 0 },
    restSeconds: { type: 'integer', minimum: 0 },
  },
} as const

export const reorderWorkoutItemsBodySchema = {
  type: 'object',
  additionalProperties: false,
  required: ['itemIdsInOrder'],
  properties: {
    itemIdsInOrder: {
      type: 'array',
      minItems: 1,
      items: {
        type: 'string',
        minLength: 1,
      },
    },
  },
} as const

export const workoutParamsSchema = {
  type: 'object',
  additionalProperties: false,
  required: ['workoutId'],
  properties: {
    workoutId: { type: 'string', minLength: 1 },
  },
} as const

export const workoutItemParamsSchema = {
  type: 'object',
  additionalProperties: false,
  required: ['workoutId', 'workoutItemId'],
  properties: {
    workoutId: { type: 'string', minLength: 1 },
    workoutItemId: { type: 'string', minLength: 1 },
  },
} as const
