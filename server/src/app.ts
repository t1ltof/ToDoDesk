import Fastify, { type FastifyInstance } from 'fastify'
import { config } from './config.js'

export function createApp(options?: { logger?: boolean }): FastifyInstance {
  return Fastify({
    logger: options?.logger ?? true,
    trustProxy: config.trustProxy
  })
}
