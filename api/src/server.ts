import 'dotenv/config'

import { buildApp } from './app.js'

const host = process.env.HOST ?? '0.0.0.0'

const parsedPort = Number(process.env.PORT ?? 3001)

if (!Number.isInteger(parsedPort) || parsedPort <= 0) {
  throw new Error('PORT must be a positive integer.')
}

const port = parsedPort

const app = buildApp()

try {
  await app.listen({ host, port })
} catch (error) {
  app.log.error(error)
  process.exit(1)
}
