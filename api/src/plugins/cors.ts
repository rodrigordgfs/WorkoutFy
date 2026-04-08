import fp from 'fastify-plugin'
import type { FastifyReply, FastifyRequest } from 'fastify'

const DEFAULT_ALLOWED_ORIGINS = [
  'http://localhost:3000',
  'http://127.0.0.1:3000',
  'http://localhost:5173',
  'http://127.0.0.1:5173',
]

function parseAllowedOrigins() {
  const configuredOrigins = process.env.CORS_ALLOWED_ORIGINS
    ?.split(',')
    .map((origin) => origin.trim())
    .filter(Boolean)

  return configuredOrigins?.length ? configuredOrigins : DEFAULT_ALLOWED_ORIGINS
}

function setCorsHeaders(request: FastifyRequest, reply: FastifyReply, allowedOrigins: Set<string>) {
  const origin = request.headers.origin

  if (!origin || !allowedOrigins.has(origin)) {
    return false
  }

  reply.header('Access-Control-Allow-Origin', origin)
  reply.header('Vary', 'Origin')
  reply.header('Access-Control-Allow-Credentials', 'true')
  reply.header('Access-Control-Allow-Methods', 'GET,POST,PATCH,PUT,DELETE,OPTIONS')
  reply.header(
    'Access-Control-Allow-Headers',
    'Origin, X-Requested-With, Content-Type, Accept, Authorization, Clerk-Request-Id',
  )

  return true
}

const corsPlugin = fp(async function corsPlugin(app) {
  const allowedOrigins = new Set(parseAllowedOrigins())

  app.addHook('onRequest', async (request, reply) => {
    const isPreflight = request.method === 'OPTIONS'
    const hasOrigin = typeof request.headers.origin === 'string'

    setCorsHeaders(request, reply, allowedOrigins)

    if (!isPreflight || !hasOrigin) {
      return
    }

    reply.code(204).send()
  })
})

export default corsPlugin
