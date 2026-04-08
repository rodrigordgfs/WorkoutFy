import { z } from 'zod'

import { AppError } from '../../common/errors/app-error.js'
import type { UpdateWeeklyPlanningInput } from './types.js'

const dayOfWeekValues = [
  'monday',
  'tuesday',
  'wednesday',
  'thursday',
  'friday',
  'saturday',
  'sunday',
] as const

const dayOfWeekSchema = z.enum(dayOfWeekValues)

const updateWeeklyPlanningInputSchema = z
  .object({
    days: z
      .array(
        z
          .object({
            dayOfWeek: dayOfWeekSchema,
            workoutId: z.string().trim().min(1).nullable(),
          })
          .strict(),
      )
      .length(7),
  })
  .strict()
  .superRefine((value, context) => {
    const seenDays = new Set<string>()

    for (const [index, day] of value.days.entries()) {
      if (seenDays.has(day.dayOfWeek)) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['days', index, 'dayOfWeek'],
          message: 'Duplicate dayOfWeek values are not allowed.',
        })
      }

      seenDays.add(day.dayOfWeek)
    }

    for (const expectedDay of dayOfWeekValues) {
      if (!seenDays.has(expectedDay)) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['days'],
          message: 'All 7 days of the week must be provided exactly once.',
        })
        break
      }
    }
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

export function parseUpdateWeeklyPlanningInput(input: unknown): UpdateWeeklyPlanningInput {
  return parseWithSchema(updateWeeklyPlanningInputSchema, input)
}

const planningWorkoutSummarySchema = {
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

const weeklyPlanningDayResponseSchema = {
  type: 'object',
  additionalProperties: false,
  required: ['dayOfWeek', 'workout'],
  properties: {
    dayOfWeek: {
      type: 'string',
      enum: [...dayOfWeekValues],
    },
    workout: {
      anyOf: [planningWorkoutSummarySchema, { type: 'null' }],
    },
  },
} as const

export const weeklyPlanningWeekResponseSchema = {
  type: 'object',
  additionalProperties: false,
  required: ['days'],
  properties: {
    days: {
      type: 'array',
      items: weeklyPlanningDayResponseSchema,
    },
  },
} as const

export const todayPlanningResponseSchema = {
  type: 'object',
  additionalProperties: false,
  required: ['date', 'dayOfWeek', 'plannedWorkout', 'manualWorkoutOptions'],
  properties: {
    date: { type: 'string', format: 'date' },
    dayOfWeek: {
      type: 'string',
      enum: [...dayOfWeekValues],
    },
    plannedWorkout: {
      anyOf: [planningWorkoutSummarySchema, { type: 'null' }],
    },
    manualWorkoutOptions: {
      type: 'array',
      items: planningWorkoutSummarySchema,
    },
  },
} as const

export const updateWeeklyPlanningBodySchema = {
  type: 'object',
  additionalProperties: false,
  required: ['days'],
  properties: {
    days: {
      type: 'array',
      minItems: 7,
      maxItems: 7,
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['dayOfWeek', 'workoutId'],
        properties: {
          dayOfWeek: {
            type: 'string',
            enum: [...dayOfWeekValues],
          },
          workoutId: {
            anyOf: [{ type: 'string', minLength: 1 }, { type: 'null' }],
          },
        },
      },
    },
  },
} as const
