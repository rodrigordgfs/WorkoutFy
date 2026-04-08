export const errorResponseSchema = {
  type: 'object',
  additionalProperties: false,
  required: ['message', 'code', 'statusCode'],
  properties: {
    message: { type: 'string' },
    code: { type: 'string' },
    statusCode: { type: 'integer' },
    details: {},
  },
} as const

export const healthcheckResponseSchema = {
  type: 'object',
  additionalProperties: false,
  required: ['status'],
  properties: {
    status: { type: 'string' },
  },
} as const
