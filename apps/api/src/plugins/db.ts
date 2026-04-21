import fp from 'fastify-plugin'
import { drizzle, type NodePgDatabase } from 'drizzle-orm/node-postgres'
import { Pool } from 'pg'
import * as schema from '../db/schema.js'

export type DrizzleDb = NodePgDatabase<typeof schema>

export default fp(async function dbPlugin(app) {
  const pool = new Pool({ connectionString: app.env.DATABASE_URL })

  const client = await pool.connect()
  client.release()

  const db = drizzle(pool, { schema })
  app.decorate('db', db)

  app.addHook('onClose', async () => {
    await pool.end()
  })
})
