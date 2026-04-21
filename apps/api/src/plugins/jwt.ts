import fp from 'fastify-plugin'
import fastifyJwt from '@fastify/jwt'

export interface JwtPayload {
  sub: string // accountId
  deviceId: string
  householdId: string
  type: 'access' | 'refresh'
}

declare module '@fastify/jwt' {
  interface FastifyJWT {
    payload: JwtPayload
    user: JwtPayload
  }
}

export default fp(async function jwtPlugin(app) {
  await app.register(fastifyJwt, {
    secret: app.env.JWT_SECRET,
  })
})
