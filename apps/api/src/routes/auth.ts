import type { FastifyPluginAsync } from 'fastify'
import { z } from 'zod'
import { sha256HexFromString, randomBytes } from '@kinhale/crypto'
import { magicLinks, accounts } from '../db/schema.js'
import { eq, and, gt } from 'drizzle-orm'

const MagicLinkBodySchema = z.object({
  email: z.string().email(),
})

const VerifyQuerySchema = z.object({
  token: z.string().min(64),
})

const authRoute: FastifyPluginAsync = async (app) => {
  app.post<{ Body: z.infer<typeof MagicLinkBodySchema> }>(
    '/magic-link',
    async (request, reply) => {
      const result = MagicLinkBodySchema.safeParse(request.body)
      if (!result.success) {
        return reply.status(400).send({ error: 'Email invalide' })
      }

      const { email } = result.data
      const emailHash = await sha256HexFromString(email.toLowerCase().trim())

      const tokenBytes = await randomBytes(32)
      const token = Buffer.from(tokenBytes).toString('hex')
      const tokenHash = await sha256HexFromString(token)

      const expiresAt = new Date(Date.now() + 10 * 60 * 1000)

      await app.db.insert(magicLinks).values({
        emailHash,
        tokenHash,
        expiresAt,
      })

      if (app.env.NODE_ENV === 'development') {
        const magicUrl = `http://localhost:${app.env.PORT}/auth/verify?token=${token}`
        app.log.info({ magicUrl }, 'Magic link généré (dev only)')
      }

      return reply.status(200).send({ message: 'Magic link envoyé' })
    },
  )

  app.get<{ Querystring: z.infer<typeof VerifyQuerySchema> }>(
    '/verify',
    async (request, reply) => {
      const result = VerifyQuerySchema.safeParse(request.query)
      if (!result.success) {
        return reply.status(400).send({ error: 'Token manquant ou invalide' })
      }

      const { token } = result.data
      const tokenHash = await sha256HexFromString(token)

      const rows = await app.db
        .select()
        .from(magicLinks)
        .where(
          and(
            eq(magicLinks.tokenHash, tokenHash),
            gt(magicLinks.expiresAt, new Date()),
          ),
        )

      if (rows.length === 0) {
        return reply.status(401).send({ error: 'Token invalide ou expiré' })
      }

      const link = rows[0]
      if (link === undefined) {
        return reply.status(401).send({ error: 'Token invalide ou expiré' })
      }
      if (link.usedAt !== null) {
        return reply.status(401).send({ error: 'Token déjà utilisé' })
      }

      await app.db
        .update(magicLinks)
        .set({ usedAt: new Date() })
        .where(eq(magicLinks.id, link.id))

      const accountRows = await app.db
        .select()
        .from(accounts)
        .where(eq(accounts.emailHash, link.emailHash))

      let accountId: string
      const existingAccount = accountRows[0]
      if (existingAccount !== undefined) {
        accountId = existingAccount.id
      } else {
        const newAccount = await app.db
          .insert(accounts)
          .values({ emailHash: link.emailHash })
          .returning()
        const created = newAccount[0]
        if (created === undefined) {
          return reply.status(500).send({ error: 'Erreur création compte' })
        }
        accountId = created.id
      }

      const householdId = accountId
      const deviceId = accountId

      const accessToken = app.jwt.sign(
        { sub: accountId, deviceId, householdId, type: 'access' },
        { expiresIn: app.env.JWT_ACCESS_TTL },
      )

      return reply.status(200).send({ accessToken })
    },
  )
}

export default authRoute
