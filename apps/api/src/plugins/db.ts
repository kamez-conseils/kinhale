import fp from 'fastify-plugin'
import { type NodePgDatabase } from 'drizzle-orm/node-postgres'
import type * as schema from '../db/schema.js'

export type DrizzleDb = NodePgDatabase<typeof schema>

export default fp(async function dbPlugin(_app) {
  // Implémenté en Task 4
})
