import { describe, it, expect } from 'vitest';
import { buildPeerPingMessage, isPeerPingMessage, PEER_PING_TYPES } from './peer-ping.js';

const VALID_UUID = '0a7e1b74-8c7d-4b7e-9f8a-1234567890ab';

describe('isPeerPingMessage', () => {
  it('accepte un message bien formé avec type=peer_ping / pingType=dose_recorded', () => {
    const msg = {
      type: 'peer_ping',
      pingType: 'dose_recorded',
      doseId: VALID_UUID,
      sentAtMs: 1_717_000_000_000,
    };
    expect(isPeerPingMessage(msg)).toBe(true);
  });

  it('rejette un message null ou non-objet', () => {
    expect(isPeerPingMessage(null)).toBe(false);
    expect(isPeerPingMessage('peer_ping')).toBe(false);
    expect(isPeerPingMessage(42)).toBe(false);
    expect(isPeerPingMessage(undefined)).toBe(false);
  });

  it('rejette un message avec un type différent de peer_ping', () => {
    expect(
      isPeerPingMessage({
        type: 'sync_blob',
        pingType: 'dose_recorded',
        doseId: VALID_UUID,
        sentAtMs: 1,
      }),
    ).toBe(false);
  });

  it('rejette un pingType non reconnu (whitelist stricte)', () => {
    expect(
      isPeerPingMessage({
        type: 'peer_ping',
        pingType: 'secret_exfil',
        doseId: VALID_UUID,
        sentAtMs: 1,
      }),
    ).toBe(false);
  });

  it("rejette un doseId qui n'est pas un UUID v4", () => {
    for (const bad of ['', 'not-an-uuid', '12345', '00000000-0000-0000-0000-000000000000']) {
      expect(
        isPeerPingMessage({
          type: 'peer_ping',
          pingType: 'dose_recorded',
          doseId: bad,
          sentAtMs: 1,
        }),
      ).toBe(false);
    }
  });

  it('rejette un sentAtMs non numérique ou non fini', () => {
    for (const bad of [Number.NaN, Number.POSITIVE_INFINITY, -1, '1', null, undefined]) {
      expect(
        isPeerPingMessage({
          type: 'peer_ping',
          pingType: 'dose_recorded',
          doseId: VALID_UUID,
          sentAtMs: bad,
        }),
      ).toBe(false);
    }
  });

  it('tolère des champs supplémentaires (forward-compat), jamais consommés', () => {
    const msg = {
      type: 'peer_ping',
      pingType: 'dose_recorded',
      doseId: VALID_UUID,
      sentAtMs: 1_717_000_000_000,
      // Champ ajouté futur / tentative d'injection : toléré par le typeguard
      // mais le relais et le client ne le consommeront pas.
      extra: 'ignored',
    };
    expect(isPeerPingMessage(msg)).toBe(true);
  });

  it('PEER_PING_TYPES ne contient que les types documentés v1.0', () => {
    expect([...PEER_PING_TYPES]).toEqual(['dose_recorded']);
  });
});

describe('buildPeerPingMessage', () => {
  it('construit un message strictement conforme au schéma', () => {
    const msg = buildPeerPingMessage({
      pingType: 'dose_recorded',
      doseId: VALID_UUID,
      sentAtMs: 42,
    });
    expect(msg).toEqual({
      type: 'peer_ping',
      pingType: 'dose_recorded',
      doseId: VALID_UUID,
      sentAtMs: 42,
    });
    // Le résultat satisfait le typeguard (round-trip).
    expect(isPeerPingMessage(msg)).toBe(true);
  });

  it("n'ajoute AUCUN champ supplémentaire (ex: donnée santé)", () => {
    const msg = buildPeerPingMessage({
      pingType: 'dose_recorded',
      doseId: VALID_UUID,
      sentAtMs: 1,
    });
    expect(Object.keys(msg).sort()).toEqual(['doseId', 'pingType', 'sentAtMs', 'type']);
  });
});
