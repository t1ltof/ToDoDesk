import Fastify from 'fastify'
import { config } from './config.js'
import { closeDb, migrate } from './db.js'
import { registerAttachmentRoutes } from './attachments.js'
import { registerBoardLive } from './boardLive.js'
import { registerProjectRoutes } from './projects.js'
import { registerRoutes } from './routes.js'

const app = Fastify({ logger: true })

await migrate()
await registerRoutes(app)
await registerProjectRoutes(app)
await registerBoardLive(app)
await registerAttachmentRoutes(app)

await app.listen({ host: config.host, port: config.port })
app.log.info(`tododesk-api ${config.host}:${config.port}`)

const shutdown = async (): Promise<void> => {
  await app.close()
  await closeDb()
  process.exit(0)
}

process.on('SIGINT', () => void shutdown())
process.on('SIGTERM', () => void shutdown())
