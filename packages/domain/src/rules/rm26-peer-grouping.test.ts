import { describe, expect, it } from 'vitest';
import type { PeerNotificationEvent, PeerNotificationRecipient } from './rm5-peer-notification';
import {
  DAILY_NOTIFICATION_HARD_CAP,
  PEER_GROUPING_THRESHOLD_COUNT,
  PEER_GROUPING_WINDOW_MS,
  decidePeerNotification,
} from './rm26-peer-grouping';

const NOW = new Date('2026-04-19T09:30:00Z');

function minutesBefore(base: Date, minutes: number): Date {
  return new Date(base.getTime() - minutes * 60_000);
}

function makeRecipient(caregiverId: string): PeerNotificationRecipient {
  return { caregiverId, role: 'contributor' };
}

function makeEvent(
  overrides: Partial<PeerNotificationEvent> & { doseId: string },
): PeerNotificationEvent {
  return {
    kind: 'peer_dose_recorded',
    doseId: overrides.doseId,
    pumpId: 'p1',
    doseType: 'maintenance',
    authorCaregiverId: 'author-1',
    recipients: [makeRecipient('r1'), makeRecipient('r2')],
    ...overrides,
  };
}

describe('RM26 — constantes', () => {
  it('fenêtre de regroupement = 60 min, seuil = 3 prises, cap quotidien = 15', () => {
    expect(PEER_GROUPING_WINDOW_MS).toBe(60 * 60_000);
    expect(PEER_GROUPING_THRESHOLD_COUNT).toBe(3);
    expect(DAILY_NOTIFICATION_HARD_CAP).toBe(15);
  });
});

describe('RM26 — decidePeerNotification (individuel vs regroupé)', () => {
  it('1ère prise de l auteur (aucun historique) : individual', () => {
    const event = makeEvent({ doseId: 'd1' });
    const decision = decidePeerNotification({
      newEvent: event,
      recentPeerEventsByAuthor: [],
      dailyNotificationCountByRecipient: new Map(),
      nowUtc: NOW,
    });
    expect(decision.kind).toBe('individual');
    if (decision.kind === 'individual') {
      expect(decision.event).toEqual(event);
    }
  });

  it('2e prise dans l heure : individual (seuil non atteint)', () => {
    const event = makeEvent({ doseId: 'd2' });
    const decision = decidePeerNotification({
      newEvent: event,
      recentPeerEventsByAuthor: [{ doseId: 'd1', recordedAtUtc: minutesBefore(NOW, 20) }],
      dailyNotificationCountByRecipient: new Map(),
      nowUtc: NOW,
    });
    expect(decision.kind).toBe('individual');
  });

  it('3e prise dans l heure : grouped avec countInWindow=3', () => {
    const event = makeEvent({ doseId: 'd3' });
    const decision = decidePeerNotification({
      newEvent: event,
      recentPeerEventsByAuthor: [
        { doseId: 'd1', recordedAtUtc: minutesBefore(NOW, 40) },
        { doseId: 'd2', recordedAtUtc: minutesBefore(NOW, 15) },
      ],
      dailyNotificationCountByRecipient: new Map(),
      nowUtc: NOW,
    });
    expect(decision.kind).toBe('grouped');
    if (decision.kind === 'grouped') {
      expect(decision.countInWindow).toBe(3);
      expect(decision.authorCaregiverId).toBe('author-1');
      expect(decision.recipients.map((r) => r.caregiverId).sort()).toEqual(['r1', 'r2']);
      expect(decision.windowStartUtc.getTime()).toBe(NOW.getTime() - PEER_GROUPING_WINDOW_MS);
      expect(decision.windowEndUtc.getTime()).toBe(NOW.getTime());
    }
  });

  it('6e prise dans l heure : grouped avec countInWindow=6', () => {
    const event = makeEvent({ doseId: 'd6' });
    const decision = decidePeerNotification({
      newEvent: event,
      recentPeerEventsByAuthor: [
        { doseId: 'd1', recordedAtUtc: minutesBefore(NOW, 55) },
        { doseId: 'd2', recordedAtUtc: minutesBefore(NOW, 45) },
        { doseId: 'd3', recordedAtUtc: minutesBefore(NOW, 30) },
        { doseId: 'd4', recordedAtUtc: minutesBefore(NOW, 20) },
        { doseId: 'd5', recordedAtUtc: minutesBefore(NOW, 10) },
      ],
      dailyNotificationCountByRecipient: new Map(),
      nowUtc: NOW,
    });
    expect(decision.kind).toBe('grouped');
    if (decision.kind === 'grouped') {
      expect(decision.countInWindow).toBe(6);
    }
  });

  it('prises de plus d une heure : individual (fenêtre expirée)', () => {
    const event = makeEvent({ doseId: 'd3' });
    const decision = decidePeerNotification({
      newEvent: event,
      recentPeerEventsByAuthor: [
        { doseId: 'd1', recordedAtUtc: minutesBefore(NOW, 70) },
        { doseId: 'd2', recordedAtUtc: minutesBefore(NOW, 65) },
      ],
      dailyNotificationCountByRecipient: new Map(),
      nowUtc: NOW,
    });
    expect(decision.kind).toBe('individual');
  });

  it('borne exacte 60 min (inclusive) : comptée dans la fenêtre', () => {
    const event = makeEvent({ doseId: 'd3' });
    const decision = decidePeerNotification({
      newEvent: event,
      recentPeerEventsByAuthor: [
        { doseId: 'd1', recordedAtUtc: minutesBefore(NOW, 60) },
        { doseId: 'd2', recordedAtUtc: minutesBefore(NOW, 10) },
      ],
      dailyNotificationCountByRecipient: new Map(),
      nowUtc: NOW,
    });
    expect(decision.kind).toBe('grouped');
  });

  it('borne 60 min 00 s 001 ms : hors fenêtre', () => {
    const event = makeEvent({ doseId: 'd3' });
    const decision = decidePeerNotification({
      newEvent: event,
      recentPeerEventsByAuthor: [
        { doseId: 'd1', recordedAtUtc: new Date(NOW.getTime() - 60 * 60_000 - 1) },
        { doseId: 'd2', recordedAtUtc: minutesBefore(NOW, 10) },
      ],
      dailyNotificationCountByRecipient: new Map(),
      nowUtc: NOW,
    });
    // Seule 1 prise précédente dans la fenêtre + nouvelle = 2 → pas encore grouped
    expect(decision.kind).toBe('individual');
  });
});

describe('RM26 — cap quotidien 15 notifications', () => {
  it('destinataire au cap : filtré de la liste', () => {
    const event = makeEvent({
      doseId: 'd1',
      recipients: [makeRecipient('r1'), makeRecipient('r2')],
    });
    const decision = decidePeerNotification({
      newEvent: event,
      recentPeerEventsByAuthor: [],
      dailyNotificationCountByRecipient: new Map([['r1', 15]]),
      nowUtc: NOW,
    });
    expect(decision.kind).toBe('individual');
    if (decision.kind === 'individual') {
      expect(decision.event.recipients.map((r) => r.caregiverId)).toEqual(['r2']);
    }
  });

  it('tous les destinataires au cap : suppressed (daily_cap_reached)', () => {
    const event = makeEvent({
      doseId: 'd1',
      recipients: [makeRecipient('r1'), makeRecipient('r2')],
    });
    const decision = decidePeerNotification({
      newEvent: event,
      recentPeerEventsByAuthor: [],
      dailyNotificationCountByRecipient: new Map([
        ['r1', 15],
        ['r2', 20],
      ]),
      nowUtc: NOW,
    });
    expect(decision.kind).toBe('suppressed');
    if (decision.kind === 'suppressed') {
      expect(decision.reason).toBe('daily_cap_reached');
    }
  });

  it('cap appliqué aussi au regroupement : filtre les destinataires au cap', () => {
    const event = makeEvent({
      doseId: 'd3',
      recipients: [makeRecipient('r1'), makeRecipient('r2')],
    });
    const decision = decidePeerNotification({
      newEvent: event,
      recentPeerEventsByAuthor: [
        { doseId: 'd1', recordedAtUtc: minutesBefore(NOW, 30) },
        { doseId: 'd2', recordedAtUtc: minutesBefore(NOW, 15) },
      ],
      dailyNotificationCountByRecipient: new Map([['r1', 15]]),
      nowUtc: NOW,
    });
    expect(decision.kind).toBe('grouped');
    if (decision.kind === 'grouped') {
      expect(decision.recipients.map((r) => r.caregiverId)).toEqual(['r2']);
    }
  });

  it('regroupement avec tous destinataires au cap : suppressed (daily_cap_reached)', () => {
    const event = makeEvent({
      doseId: 'd3',
      recipients: [makeRecipient('r1'), makeRecipient('r2')],
    });
    const decision = decidePeerNotification({
      newEvent: event,
      recentPeerEventsByAuthor: [
        { doseId: 'd1', recordedAtUtc: minutesBefore(NOW, 30) },
        { doseId: 'd2', recordedAtUtc: minutesBefore(NOW, 15) },
      ],
      dailyNotificationCountByRecipient: new Map([
        ['r1', 16],
        ['r2', 15],
      ]),
      nowUtc: NOW,
    });
    expect(decision.kind).toBe('suppressed');
    if (decision.kind === 'suppressed') {
      expect(decision.reason).toBe('daily_cap_reached');
    }
  });

  it('cap non atteint (14 notif) : destinataire conservé', () => {
    const event = makeEvent({
      doseId: 'd1',
      recipients: [makeRecipient('r1')],
    });
    const decision = decidePeerNotification({
      newEvent: event,
      recentPeerEventsByAuthor: [],
      dailyNotificationCountByRecipient: new Map([['r1', 14]]),
      nowUtc: NOW,
    });
    expect(decision.kind).toBe('individual');
  });
});

describe('RM26 — suppressed.already_grouped_in_window', () => {
  it('hasActiveGroupedNotification=true : suppressed (mise à jour infra)', () => {
    // Un regroupement a déjà été émis pour la fenêtre ; la nouvelle prise
    // ne doit pas déclencher une nouvelle notification OS. L'infra met à
    // jour le regroupement existant (compteur incrémenté « 3 → 4 prises »).
    const event = makeEvent({ doseId: 'd4' });
    const decision = decidePeerNotification({
      newEvent: event,
      recentPeerEventsByAuthor: [
        { doseId: 'd1', recordedAtUtc: minutesBefore(NOW, 50) },
        { doseId: 'd2', recordedAtUtc: minutesBefore(NOW, 30) },
        { doseId: 'd3', recordedAtUtc: minutesBefore(NOW, 10) },
      ],
      dailyNotificationCountByRecipient: new Map(),
      nowUtc: NOW,
      hasActiveGroupedNotification: true,
    });
    expect(decision.kind).toBe('suppressed');
    if (decision.kind === 'suppressed') {
      expect(decision.reason).toBe('already_grouped_in_window');
    }
  });

  it('hasActiveGroupedNotification=true ET tous dest. au cap : daily_cap_reached prime', () => {
    // Ordre des priorités : cap journalier > regroupement actif.
    // L'absence de destinataire éligible rend toute décision moot ;
    // on remonte la raison la plus fondamentale (aucun destinataire).
    const event = makeEvent({
      doseId: 'd4',
      recipients: [makeRecipient('r1')],
    });
    const decision = decidePeerNotification({
      newEvent: event,
      recentPeerEventsByAuthor: [
        { doseId: 'd1', recordedAtUtc: minutesBefore(NOW, 50) },
        { doseId: 'd2', recordedAtUtc: minutesBefore(NOW, 30) },
        { doseId: 'd3', recordedAtUtc: minutesBefore(NOW, 10) },
      ],
      dailyNotificationCountByRecipient: new Map([['r1', 15]]),
      nowUtc: NOW,
      hasActiveGroupedNotification: true,
    });
    expect(decision.kind).toBe('suppressed');
    if (decision.kind === 'suppressed') {
      expect(decision.reason).toBe('daily_cap_reached');
    }
  });
});

describe('RM26 — pureté', () => {
  it('ne mute ni le newEvent ni la map/le tableau', () => {
    const recentEvents = [{ doseId: 'd1', recordedAtUtc: minutesBefore(NOW, 20) }];
    const originalLength = recentEvents.length;
    const counts = new Map<string, number>([['r1', 5]]);
    const originalR1 = counts.get('r1');
    const event = makeEvent({ doseId: 'd2' });
    decidePeerNotification({
      newEvent: event,
      recentPeerEventsByAuthor: recentEvents,
      dailyNotificationCountByRecipient: counts,
      nowUtc: NOW,
    });
    expect(recentEvents.length).toBe(originalLength);
    expect(counts.get('r1')).toBe(originalR1);
    expect(event.recipients).toHaveLength(2);
  });
});
