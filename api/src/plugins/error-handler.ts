import { type FastifyError } from 'fastify'
import fp from 'fastify-plugin'

import { AppError } from '../common/errors/app-error.js'

type ErrorResponseBody = {
  message: string
  code: string
  statusCode: number
  details?: unknown
}

function isFastifyError(error: unknown): error is FastifyError {
  return (
    typeof error === 'object' &&
    error !== null &&
    'message' in error &&
    'statusCode' in error
  )
}

function hasValidationIssues(
  error: unknown,
): error is FastifyError & { validation: Array<{ instancePath: string; keyword: string; message?: string; params: unknown; schemaPath: string }> } {
  return (
    isFastifyError(error) &&
    'validation' in error &&
    Array.isArray(error.validation)
  )
}

function toErrorResponse(error: unknown): ErrorResponseBody {
  if (error instanceof AppError) {
    return {
      message: error.message,
      code: error.code,
      statusCode: error.statusCode,
      ...(error.details === undefined ? {} : { details: error.details }),
    }
  }

  if (hasValidationIssues(error)) {
    return {
      message: 'Request validation failed.',
      code: 'VALIDATION_ERROR',
      statusCode: 400,
      details: {
        issues: error.validation.map((issue) => ({
          path: issue.instancePath.replace(/^\//, '').replace(/\//g, '.'),
          message: issue.message ?? 'Invalid value.',
        })),
      },
    }
  }

  const statusCode =
    isFastifyError(error) && typeof error.statusCode === 'number' && error.statusCode >= 400
      ? error.statusCode
      : 500

  const isSerializationError = isFastifyError(error) && error.code === 'FST_ERR_FAILED_ERROR_SERIALIZATION'

  const message =
    error instanceof Error
      ? error.message
      : 'An unexpected error occurred.'

  return {
    message: statusCode >= 500 ? 'Internal server error.' : message,
    code: isSerializationError
      ? 'SERIALIZATION_ERROR'
      : isFastifyError(error) && typeof error.code === 'string'
        ? error.code
        : 'INTERNAL_SERVER_ERROR',
    statusCode,
  }
}

export default fp(async function errorHandlerPlugin(app) {
  app.setNotFoundHandler((request, reply) => {
    reply.code(404).send({
      message: `Route ${request.method}:${request.url} not found`,
      code: 'NOT_FOUND',
      statusCode: 404,
    })
  })

  app.setErrorHandler((error, request, reply) => {
    const response = toErrorResponse(error)
    const logMessage = error instanceof Error ? error.message : response.message

    request.log.error({ err: error, code: response.code }, logMessage)

    reply.code(response.statusCode).send(response)
  })
})
