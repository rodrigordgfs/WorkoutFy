import { z } from 'zod'

import { AppError } from '../../common/errors/app-error.js'

const muscleGroupNameSchema = z.string().trim().min(1).max(80)
const muscleGroupSlugSchema = z.string().trim().min(1).max(80)

const createAdminMuscleGroupInputSchema = z
  .object({
    name: muscleGroupNameSchema,
    slug: muscleGroupSlugSchema.optional(),
  })
  .strict()

const updateAdminMuscleGroupInputSchema = z
  .object({
    name: muscleGroupNameSchema.optional(),
    slug: muscleGroupSlugSchema.optional(),
  })
  .strict()
  .refine((value) => Object.keys(value).length > 0, {
    message: 'At least one editable muscle group field must be provided.',
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

export function parseCreateAdminMuscleGroupInput(input: unknown) {
  const result = parseWithSchema(createAdminMuscleGroupInputSchema, input)

  return {
    name: result.name,
    slug: result.slug ?? null,
  }
}

export function parseUpdateAdminMuscleGroupInput(input: unknown) {
  const result = parseWithSchema(updateAdminMuscleGroupInputSchema, input)

  return {
    ...(result.name === undefined ? {} : { name: result.name }),
    ...(result.slug === undefined ? {} : { slug: result.slug }),
  }
}

export const createAdminMuscleGroupBodySchema = {
  type: 'object',
  additionalProperties: false,
  required: ['name'],
  properties: {
    name: { type: 'string', minLength: 1, maxLength: 80 },
    slug: { type: 'string', minLength: 1, maxLength: 80 },
  },
} as const

export const updateAdminMuscleGroupBodySchema = {
  type: 'object',
  additionalProperties: false,
  properties: {
    name: { type: 'string', minLength: 1, maxLength: 80 },
    slug: { type: 'string', minLength: 1, maxLength: 80 },
  },
  minProperties: 1,
} as const

export const muscleGroupResponseSchema = {
  type: 'object',
  additionalProperties: false,
  required: ['id', 'name', 'slug'],
  properties: {
    id: { type: 'string' },
    name: { type: 'string' },
    slug: { type: 'string' },
  },
} as const

export const muscleGroupsListResponseSchema = {
  type: 'array',
  items: muscleGroupResponseSchema,
} as const

export const adminMuscleGroupResponseSchema = {
  type: 'object',
  additionalProperties: false,
  required: ['id', 'name', 'slug', 'createdAt', 'updatedAt'],
  properties: {
    id: { type: 'string' },
    name: { type: 'string' },
    slug: { type: 'string' },
    createdAt: { type: 'string', format: 'date-time' },
    updatedAt: { type: 'string', format: 'date-time' },
  },
} as const

export const adminMuscleGroupsListResponseSchema = {
  type: 'array',
  items: adminMuscleGroupResponseSchema,
} as const
