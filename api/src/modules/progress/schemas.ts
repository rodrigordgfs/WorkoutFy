export const progressProfileSnapshotResponseSchema = {
  type: 'object',
  additionalProperties: false,
  required: ['displayName', 'heightCm', 'weightKg'],
  properties: {
    displayName: { anyOf: [{ type: 'string' }, { type: 'null' }] },
    heightCm: { anyOf: [{ type: 'integer' }, { type: 'null' }] },
    weightKg: { anyOf: [{ type: 'integer' }, { type: 'null' }] },
  },
} as const

export const exerciseProgressSummaryResponseSchema = {
  type: 'object',
  additionalProperties: false,
  required: [
    'exerciseId',
    'exerciseName',
    'exerciseSlug',
    'completedSetCount',
    'completedSessionCount',
    'bestActualLoadKg',
    'latestActualLoadKg',
    'latestCompletedAt',
  ],
  properties: {
    exerciseId: { type: 'string' },
    exerciseName: { type: 'string' },
    exerciseSlug: { type: 'string' },
    completedSetCount: { type: 'integer' },
    completedSessionCount: { type: 'integer' },
    bestActualLoadKg: { anyOf: [{ type: 'number' }, { type: 'null' }] },
    latestActualLoadKg: { anyOf: [{ type: 'number' }, { type: 'null' }] },
    latestCompletedAt: { anyOf: [{ type: 'string', format: 'date-time' }, { type: 'null' }] },
  },
} as const

export const progressOverviewResponseSchema = {
  type: 'object',
  additionalProperties: false,
  required: ['summary', 'profileSnapshot', 'exerciseProgressSummaries'],
  properties: {
    summary: {
      type: 'object',
      additionalProperties: false,
      required: ['totalCompletedSessions', 'completedSessionsThisWeek', 'totalCompletedSets', 'latestCompletedAt'],
      properties: {
        totalCompletedSessions: { type: 'integer' },
        completedSessionsThisWeek: { type: 'integer' },
        totalCompletedSets: { type: 'integer' },
        latestCompletedAt: { anyOf: [{ type: 'string', format: 'date-time' }, { type: 'null' }] },
      },
    },
    profileSnapshot: progressProfileSnapshotResponseSchema,
    exerciseProgressSummaries: {
      type: 'array',
      items: exerciseProgressSummaryResponseSchema,
    },
  },
} as const
