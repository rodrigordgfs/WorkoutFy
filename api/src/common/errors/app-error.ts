export type AppErrorDetails = Record<string, unknown> | unknown[] | string | number | boolean | null

export class AppError extends Error {
  readonly code: string
  readonly statusCode: number
  readonly details?: AppErrorDetails

  constructor(message: string, code: string, statusCode: number, details?: AppErrorDetails) {
    super(message)
    this.name = 'AppError'
    this.code = code
    this.statusCode = statusCode
    this.details = details
  }
}
