import { z } from 'zod'

import { AppError } from '../../common/errors/app-error.js'
import type { SignInInput, SignUpInput } from './types.js'

const authCredentialsSchema = z
  .object({
    email: z.email().max(320),
    password: z.string().min(8).max(128),
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

export function parseSignUpInput(input: unknown): SignUpInput {
  return parseWithSchema(authCredentialsSchema, input)
}

export function parseSignInInput(input: unknown): SignInInput {
  return parseWithSchema(authCredentialsSchema, input)
}

export const authCredentialsBodySchema = {
  type: 'object',
  additionalProperties: false,
  required: ['email', 'password'],
  properties: {
    email: { type: 'string', format: 'email', maxLength: 320 },
    password: { type: 'string', minLength: 8, maxLength: 128 },
  },
} as const

export const authSessionUserResponseSchema = {
  type: 'object',
  additionalProperties: false,
  required: ['id', 'clerkUserId', 'email', 'firstName', 'lastName', 'imageUrl', 'profile', 'isAdmin'],
  properties: {
    id: { type: 'string' },
    clerkUserId: { type: 'string' },
    email: { type: ['string', 'null'] },
    firstName: { type: ['string', 'null'] },
    lastName: { type: ['string', 'null'] },
    imageUrl: { type: ['string', 'null'] },
    isAdmin: { type: 'boolean' },
    profile: {
      type: 'object',
      additionalProperties: false,
      required: ['displayName', 'dateOfBirth', 'heightCm', 'weightKg'],
      properties: {
        displayName: { type: ['string', 'null'] },
        dateOfBirth: { type: ['string', 'null'] },
        heightCm: { type: ['number', 'null'] },
        weightKg: { type: ['number', 'null'] },
      },
    },
  },
} as const

export const authenticatedSessionResponseSchema = {
  type: 'object',
  additionalProperties: false,
  required: ['authenticated', 'user'],
  properties: {
    authenticated: { const: true },
    user: authSessionUserResponseSchema,
  },
} as const

export const unauthenticatedSessionResponseSchema = {
  type: 'object',
  additionalProperties: false,
  required: ['authenticated', 'user'],
  properties: {
    authenticated: { const: false },
    user: { type: 'null' },
  },
} as const

export const authSessionResponseSchema = {
  oneOf: [authenticatedSessionResponseSchema, unauthenticatedSessionResponseSchema],
} as const

