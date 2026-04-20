import { describe, expect, it } from 'vitest';
import { assignAuthoritativeTimestamp, LATE_SYNC_THRESHOLD_MS } from './rm14-recorded-timestamp';

const SERVER = new Date('2026-04-19T12:00:00Z');

function offsetMs(base: Date, ms: number): Date {
  return new Date(base.getTime() + ms);
}

describe('RM14 — constant', () => {
  it('expose un seuil de sync tardive de 60 000 ms par défaut', () => {
    expect(LATE_SYNC_THRESHOLD_MS).toBe(60_000);
  });
});

describe('RM14 — assignAuthoritativeTimestamp (saisie en ligne)', () => {
  it('administeredAtUtc == serverReceivedAtUtc : latence nulle', () => {
    const result = assignAuthoritativeTimestamp({
      administeredAtUtc: SERVER,
      serverReceivedAtUtc: SERVER,
    });
    expect(result.syncLatencyMs).toBe(0);
    expect(result.isLateSync).toBe(false);
    expect(result.clockSkewWarning).toBe(false);
    expect(result.administeredAtUtc.getTime()).toBe(SERVER.getTime());
    expect(result.recordedAtUtc.getTime()).toBe(SERVER.getTime());
  });

  it('écart de 10 s : latence faible, pas de flag', () => {
    const administered = offsetMs(SERVER, -10_000);
    const result = assignAuthoritativeTimestamp({
      administeredAtUtc: administered,
      serverReceivedAtUtc: SERVER,
    });
    expect(result.syncLatencyMs).toBe(10_000);
    expect(result.isLateSync).toBe(false);
  });

  it('écart de 59 999 ms : sous le seuil, pas de flag', () => {
    const administered = offsetMs(SERVER, -59_999);
    const result = assignAuthoritativeTimestamp({
      administeredAtUtc: administered,
      serverReceivedAtUtc: SERVER,
    });
    expect(result.isLateSync).toBe(false);
  });

  it('écart de 60 000 ms pile : borne stricte — encore hors flag', () => {
    // Borne exclusive : isLateSync TRUE ssi syncLatencyMs > 60 000
    const administered = offsetMs(SERVER, -60_000);
    const result = assignAuthoritativeTimestamp({
      administeredAtUtc: administered,
      serverReceivedAtUtc: SERVER,
    });
    expect(result.isLateSync).toBe(false);
  });

  it('écart de 60 001 ms : franchit le seuil de sync tardive', () => {
    const administered = offsetMs(SERVER, -60_001);
    const result = assignAuthoritativeTimestamp({
      administeredAtUtc: administered,
      serverReceivedAtUtc: SERVER,
    });
    expect(result.isLateSync).toBe(true);
  });
});

describe('RM14 — assignAuthoritativeTimestamp (sync tardive)', () => {
  it('saisie synchronisée 6 h plus tard : latence ≈ 6 h, isLateSync=true', () => {
    const administered = offsetMs(SERVER, -(6 * 60 * 60_000));
    const result = assignAuthoritativeTimestamp({
      administeredAtUtc: administered,
      serverReceivedAtUtc: SERVER,
    });
    expect(result.syncLatencyMs).toBe(6 * 60 * 60_000);
    expect(result.isLateSync).toBe(true);
    expect(result.clockSkewWarning).toBe(false);
    expect(result.administeredAtUtc.getTime()).toBe(administered.getTime());
    expect(result.recordedAtUtc.getTime()).toBe(SERVER.getTime());
  });
});

describe('RM14 — assignAuthoritativeTimestamp (dérive horloge client)', () => {
  it('administered dans le futur (+500 ms) : latence négative, pas de warn (tolérance)', () => {
    // Tolérance d'horloge : un écart ≤ 1 s vers le futur est absorbé
    // silencieusement (bruit NTP usuel) et ne lève pas clockSkewWarning.
    const administered = offsetMs(SERVER, 500);
    const result = assignAuthoritativeTimestamp({
      administeredAtUtc: administered,
      serverReceivedAtUtc: SERVER,
    });
    expect(result.syncLatencyMs).toBe(-500);
    expect(result.isLateSync).toBe(false);
    expect(result.clockSkewWarning).toBe(false);
  });

  it('administered +5 min dans le futur : clockSkewWarning=true', () => {
    const administered = offsetMs(SERVER, 5 * 60_000);
    const result = assignAuthoritativeTimestamp({
      administeredAtUtc: administered,
      serverReceivedAtUtc: SERVER,
    });
    expect(result.syncLatencyMs).toBe(-5 * 60_000);
    expect(result.isLateSync).toBe(false);
    expect(result.clockSkewWarning).toBe(true);
  });

  it('préserve administeredAtUtc tel quel, même dans le futur (client fait foi)', () => {
    const administered = offsetMs(SERVER, 5 * 60_000);
    const result = assignAuthoritativeTimestamp({
      administeredAtUtc: administered,
      serverReceivedAtUtc: SERVER,
    });
    expect(result.administeredAtUtc.getTime()).toBe(administered.getTime());
  });
});

describe('RM14 — pureté', () => {
  it('ne mute pas les Date en entrée', () => {
    const administered = offsetMs(SERVER, -30_000);
    const adminMs = administered.getTime();
    const serverMs = SERVER.getTime();
    const result = assignAuthoritativeTimestamp({
      administeredAtUtc: administered,
      serverReceivedAtUtc: SERVER,
    });
    // Mutation explicite sur la sortie
    result.administeredAtUtc.setTime(0);
    result.recordedAtUtc.setTime(0);
    expect(administered.getTime()).toBe(adminMs);
    expect(SERVER.getTime()).toBe(serverMs);
  });

  it('renvoie de nouvelles instances de Date (défense contre aliasing)', () => {
    const administered = offsetMs(SERVER, -30_000);
    const result = assignAuthoritativeTimestamp({
      administeredAtUtc: administered,
      serverReceivedAtUtc: SERVER,
    });
    expect(result.administeredAtUtc).not.toBe(administered);
    expect(result.recordedAtUtc).not.toBe(SERVER);
  });
});

describe('RM14 — seuil configurable', () => {
  it('accepte un seuil personnalisé', () => {
    const administered = offsetMs(SERVER, -30_000);
    const result = assignAuthoritativeTimestamp({
      administeredAtUtc: administered,
      serverReceivedAtUtc: SERVER,
      lateSyncThresholdMs: 10_000,
    });
    expect(result.isLateSync).toBe(true);
  });
});
