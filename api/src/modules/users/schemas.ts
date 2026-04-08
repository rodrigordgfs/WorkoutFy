import { z } from 'zod'

import { AppError } from '../../common/errors/app-error.js'
import type { UpdateCurrentUserProfileInput } from './types.js'

export const authenticatedClerkContextSchema = z.object({
  clerkUserId: z.string().min(1),
  email: z.email().nullable(),
  firstName: z.string().trim().min(1).nullable(),
  lastName: z.string().trim().min(1).nullable(),
  imageUrl: z.url().nullable(),
})

function isValidDateOnly(value: string): boolean {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value)

  if (!match) {
    return false
  }

  const [, yearRaw, monthRaw, dayRaw] = match
  const year = Number(yearRaw)
  const month = Number(monthRaw)
  const day = Number(dayRaw)

  const date = new Date(Date.UTC(year, month - 1, day))

  return (
    Number.isInteger(year) &&
    Number.isInteger(month) &&
    Number.isInteger(day) &&
    date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day
  )
}

const updateCurrentUserProfileInputSchema = z
  .object({
    displayName: z.string().trim().min(1).max(80).nullable().optional(),
    dateOfBirth: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/, 'Invalid date format. Expected YYYY-MM-DD.')
      .refine(isValidDateOnly, 'Invalid calendar date. Expected a real YYYY-MM-DD date.')
      .nullable()
      .optional(),
    heightCm: z.int().min(1).max(300).nullable().optional(),
    weightKg: z.int().min(1).max(500).nullable().optional(),
  })
  .strict()
  .refine((value) => Object.keys(value).length > 0, {
    message: 'At least one editable profile field must be provided.',
  })

function toValidationIssues(error: z.ZodError): Array<{ path: string; message: string }> {
  return error.issues.map((issue) => ({
    path: issue.path.join('.'),
    message: issue.message,
  }))
}

export function parseUpdateCurrentUserProfileInput(input: unknown): UpdateCurrentUserProfileInput {
  const result = updateCurrentUserProfileInputSchema.safeParse(input)

  if (!result.success) {
    throw new AppError('Request validation failed.', 'VALIDATION_ERROR', 400, {
      issues: toValidationIssues(result.error),
    })
  }

  return result.data
}

export const updateCurrentUserProfileBodySchema = {
  type: 'object',
  additionalProperties: false,
  properties: {
    displayName: { type: ['string', 'null'], minLength: 1, maxLength: 80 },
    dateOfBirth: { type: ['string', 'null'], pattern: '^\\d{4}-\\d{2}-\\d{2}$' },
    heightCm: { type: ['integer', 'null'], minimum: 1, maximum: 300 },
    weightKg: { type: ['integer', 'null'], minimum: 1, maximum: 500 },
  },
} as const

export const currentUserResponseSchema = {
  type: 'object',
  additionalProperties: false,
  required: ['id', 'clerkUserId', 'email', 'firstName', 'lastName', 'imageUrl', 'profile'],
  properties: {
    id: { type: 'string' },
    clerkUserId: { type: 'string' },
    email: { type: ['string', 'null'] },
    firstName: { type: ['string', 'null'] },
    lastName: { type: ['string', 'null'] },
    imageUrl: { type: ['string', 'null'] },
    profile: {
      type: 'object',
      additionalProperties: false,
      required: ['displayName', 'dateOfBirth', 'heightCm', 'weightKg'],
      properties: {
        displayName: { type: ['string', 'null'] },
        dateOfBirth: { type: ['string', 'null'], format: 'date' },
        heightCm: { type: ['integer', 'null'] },
        weightKg: { type: ['integer', 'null'] },
      },
    },
  },
} as const
