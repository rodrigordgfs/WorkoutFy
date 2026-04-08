import { z } from 'zod'

import { AppError } from '../../common/errors/app-error.js'
import type {
  CreateAdminExerciseInput,
  ListExercisesFilters,
  UpdateAdminExerciseInput,
} from './types.js'

const exerciseNameSchema = z.string().trim().min(1).max(120)
const exerciseSlugSchema = z.string().trim().min(1).max(120)
const muscleGroupIdsSchema = z.array(z.string().trim().min(1)).min(1)

const listExercisesFiltersSchema = z
  .object({
    search: z.string().trim().min(1).max(120).nullable().optional(),
    muscleGroupId: z.string().trim().min(1).nullable().optional(),
  })
  .strict()

const createAdminExerciseInputSchema = z
  .object({
    name: exerciseNameSchema,
    slug: exerciseSlugSchema.optional(),
    muscleGroupIds: muscleGroupIdsSchema,
  })
  .strict()

const updateAdminExerciseInputSchema = z
  .object({
    name: exerciseNameSchema.optional(),
    slug: exerciseSlugSchema.optional(),
    muscleGroupIds: muscleGroupIdsSchema.optional(),
  })
  .strict()
  .refine((value) => Object.keys(value).length > 0, {
    message: 'At least one editable exercise field must be provided.',
  })

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

function assertUniqueMuscleGroupIds(ids: string[]) {
  if (new Set(ids).size !== ids.length) {
    throw new AppError('Request validation failed.', 'VALIDATION_ERROR', 400, {
      issues: [
        {
          path: 'muscleGroupIds',
          message: 'Duplicate muscle groups are not allowed for the same exercise.',
        },
      ],
    })
  }
}

export function parseListExercisesFilters(input: unknown): ListExercisesFilters {
  const result = parseWithSchema(listExercisesFiltersSchema, input)

  return {
    search: result.search ?? null,
    muscleGroupId: result.muscleGroupId ?? null,
  }
}

export function parseCreateAdminExerciseInput(input: unknown): CreateAdminExerciseInput {
  const result = parseWithSchema(createAdminExerciseInputSchema, input)

  assertUniqueMuscleGroupIds(result.muscleGroupIds)

  return {
    name: result.name,
    slug: result.slug ?? null,
    muscleGroupIds: result.muscleGroupIds,
  }
}

export function parseUpdateAdminExerciseInput(input: unknown): UpdateAdminExerciseInput {
  const result = parseWithSchema(updateAdminExerciseInputSchema, input)

  if (result.muscleGroupIds !== undefined) {
    assertUniqueMuscleGroupIds(result.muscleGroupIds)
  }

  return {
    ...(result.name === undefined ? {} : { name: result.name }),
    ...(result.slug === undefined ? {} : { slug: result.slug }),
    ...(result.muscleGroupIds === undefined ? {} : { muscleGroupIds: result.muscleGroupIds }),
  }
}

export const listExercisesQuerystringSchema = {
  type: 'object',
  additionalProperties: false,
  properties: {
    search: { type: 'string', minLength: 1, maxLength: 120 },
    muscleGroupId: { type: 'string', minLength: 1 },
  },
} as const

export const createAdminExerciseBodySchema = {
  type: 'object',
  additionalProperties: false,
  required: ['name', 'muscleGroupIds'],
  properties: {
    name: { type: 'string', minLength: 1, maxLength: 120 },
    slug: { type: 'string', minLength: 1, maxLength: 120 },
    muscleGroupIds: {
      type: 'array',
      minItems: 1,
      items: { type: 'string', minLength: 1 },
    },
  },
} as const

export const updateAdminExerciseBodySchema = {
  type: 'object',
  additionalProperties: false,
  properties: {
    name: { type: 'string', minLength: 1, maxLength: 120 },
    slug: { type: 'string', minLength: 1, maxLength: 120 },
    muscleGroupIds: {
      type: 'array',
      minItems: 1,
      items: { type: 'string', minLength: 1 },
    },
  },
  minProperties: 1,
} as const

export const exerciseMuscleGroupResponseSchema = {
  type: 'object',
  additionalProperties: false,
  required: ['id', 'name', 'slug'],
  properties: {
    id: { type: 'string' },
    name: { type: 'string' },
    slug: { type: 'string' },
  },
} as const

export const exerciseResponseSchema = {
  type: 'object',
  additionalProperties: false,
  required: ['id', 'name', 'slug', 'muscleGroups'],
  properties: {
    id: { type: 'string' },
    name: { type: 'string' },
    slug: { type: 'string' },
    muscleGroups: {
      type: 'array',
      items: exerciseMuscleGroupResponseSchema,
    },
  },
} as const

export const exercisesListResponseSchema = {
  type: 'array',
  items: exerciseResponseSchema,
} as const

export const adminExerciseResponseSchema = {
  type: 'object',
  additionalProperties: false,
  required: ['id', 'name', 'slug', 'muscleGroups', 'createdAt', 'updatedAt'],
  properties: {
    id: { type: 'string' },
    name: { type: 'string' },
    slug: { type: 'string' },
    muscleGroups: {
      type: 'array',
      items: exerciseMuscleGroupResponseSchema,
    },
    createdAt: { type: 'string', format: 'date-time' },
    updatedAt: { type: 'string', format: 'date-time' },
  },
} as const

export const adminExercisesListResponseSchema = {
  type: 'array',
  items: adminExerciseResponseSchema,
} as const
