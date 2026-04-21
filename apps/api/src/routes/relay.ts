import type { FastifyPluginAsync } from 'fastify'
import type { WebSocket } from 'ws'
import { mailboxMessages } from '../db/schema.js'

/**
 * Map in-memory pour le routing WS multi-device d'un même foyer.
 * Sprint 0 : mono-node. Sprint 1 : Redis pub/sub pour multi-node.
 */
const householdSockets = new Map<string, Set<WebSocket>>()

const relayRoute: FastifyPluginAsync = async (app) => {
  app.get(
    '/',
    { websocket: true },
    (socket: WebSocket, request) => {
      const { householdId, deviceId } = request.query as {
        householdId?: string
        deviceId?: string
      }

      if (!householdId || !deviceId) {
        socket.close(1008, 'householdId et deviceId requis')
        return
      }

      if (!householdSockets.has(householdId)) {
        householdSockets.set(householdId, new Set())
      }
      householdSockets.get(householdId)!.add(socket)

      socket.on('message', async (raw) => {
        let msg: unknown
        try {
          msg = JSON.parse(raw.toString())
        } catch {
          socket.send(JSON.stringify({ error: 'JSON invalide' }))
          return
        }

        if (
          typeof msg !== 'object' ||
          msg === null ||
          typeof (msg as Record<string, unknown>)['blobJson'] !== 'string'
        ) {
          socket.send(JSON.stringify({ error: 'SyncMessage invalide' }))
          return
        }

        const message = msg as {
          blobJson: string
          seq: number
          sentAtMs: number
        }

        const expiresAt = new Date(Date.now() + 90 * 24 * 60 * 60 * 1000)
        await app.db.insert(mailboxMessages).values({
          householdId,
          senderDeviceId: deviceId,
          blobJson: message.blobJson,
          seq: message.seq ?? 0,
          sentAtMs: message.sentAtMs ?? Date.now(),
          expiresAt,
        })

        const peers = householdSockets.get(householdId)
        if (peers) {
          for (const peer of peers) {
            if (peer !== socket && peer.readyState === peer.OPEN) {
              peer.send(raw.toString())
            }
          }
        }
      })

      socket.on('close', () => {
        householdSockets.get(householdId)?.delete(socket)
        if (householdSockets.get(householdId)?.size === 0) {
          householdSockets.delete(householdId)
        }
      })

      socket.on('error', (err) => {
        app.log.error({ err }, 'WebSocket error')
      })
    },
  )
}

export default relayRoute
