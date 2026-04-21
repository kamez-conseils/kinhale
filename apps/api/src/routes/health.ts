import type { FastifyPluginAsync } from 'fastify'

interface HealthResponse {
  status: 'ok'
  version: string
  timestamp: string
}

const healthRoute: FastifyPluginAsync = async (app) => {
  app.get<{ Reply: HealthResponse }>('/health', async () => ({
    status: 'ok',
    version: '0.1.0',
    timestamp: new Date().toISOString(),
  }))
}
export default healthRoute
