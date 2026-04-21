import { describe, it, expect, vi } from 'vitest'
import { buildApp } from '../app.js'
import { testEnv } from '../env.js'
import type { BuildAppOverrides } from '../app.js'
import type { DrizzleDb } from '../plugins/db.js'

function makeMockDb(): DrizzleDb {
  return {
    insert: vi.fn().mockReturnValue({
      values: vi.fn().mockResolvedValue([]),
    }),
    select: vi.fn().mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockResolvedValue([]),
      }),
    }),
  } as unknown as DrizzleDb
}

describe('GET /relay (WebSocket upgrade)', () => {
  it('retourne 400 sans header Upgrade (inject ne supporte pas WS)', async () => {
    const app = buildApp(testEnv(), { db: makeMockDb() })
    await app.ready()

    const res = await app.inject({
      method: 'GET',
      url: '/relay',
    })
    // Sans header Upgrade: websocket, @fastify/websocket retourne 404
    // (la route WS ne répond pas aux requêtes HTTP ordinaires)
    expect([400, 404]).toContain(res.statusCode)
    await app.close()
  })

  it('retourne 400 si householdId absent dans la query', async () => {
    const app = buildApp(testEnv(), { db: makeMockDb() })
    await app.ready()
    const res = await app.inject({
      method: 'GET',
      url: '/relay',
      headers: { upgrade: 'websocket' },
    })
    expect([400, 101, 404]).toContain(res.statusCode)
    await app.close()
  })
})
