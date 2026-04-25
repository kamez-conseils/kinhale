import { describe, it, expect, vi } from 'vitest';
import type { Transporter } from 'nodemailer';
import { sendDeletionStepUp } from '../send-deletion-step-up.js';
import { sendDeletionScheduled } from '../send-deletion-scheduled.js';
import { sendDeletionCompleted } from '../send-deletion-completed.js';
import { sendDeletionCancelled } from '../send-deletion-cancelled.js';
import { testEnv } from '../../env.js';

function makeMockTransport(): Transporter {
  return {
    sendMail: vi.fn().mockResolvedValue({ messageId: 'm' }),
  } as unknown as Transporter;
}

const HEALTH_KEYWORDS = ['pompe', 'dose', 'asthme', 'symptôme', 'médicament', 'ventolin'];

function assertNoHealthData(payload: { subject: string; text: string; html: string }): void {
  for (const kw of HEALTH_KEYWORDS) {
    expect(payload.subject.toLowerCase()).not.toContain(kw);
    expect(payload.text.toLowerCase()).not.toContain(kw);
    expect(payload.html.toLowerCase()).not.toContain(kw);
  }
}

describe('sendDeletionStepUp', () => {
  it('envoie un e-mail avec le token et le TTL', async () => {
    const transport = makeMockTransport();
    const env = testEnv({ WEB_URL: 'https://app.kinhale.health' });
    await sendDeletionStepUp(transport, env, {
      to: 'user@example.com',
      token: 'abc'.repeat(20),
      ttlMinutes: 5,
    });
    expect(transport.sendMail).toHaveBeenCalledOnce();
    const args = vi.mocked(transport.sendMail).mock.calls[0]?.[0] as {
      to: string;
      subject: string;
      text: string;
      html: string;
    };
    expect(args.to).toBe('user@example.com');
    expect(args.text).toContain(
      'https://app.kinhale.health/account/deletion-confirm?token=abcabcabcabcabcabcabcabcabcabcabcabcabcabcabcabcabcabcabcabc',
    );
    expect(args.text).toContain('5 minutes');
    assertNoHealthData(args);
  });

  it('contient les deux locales (FR + EN)', async () => {
    const transport = makeMockTransport();
    await sendDeletionStepUp(transport, testEnv(), {
      to: 'a@b.com',
      token: 'a'.repeat(64),
      ttlMinutes: 5,
    });
    const args = vi.mocked(transport.sendMail).mock.calls[0]?.[0] as { text: string };
    expect(args.text).toContain('Bonjour');
    expect(args.text).toContain('[EN]');
  });
});

describe('sendDeletionScheduled', () => {
  it('inclut le scheduledAtIso et le lien d annulation', async () => {
    const transport = makeMockTransport();
    const env = testEnv({ WEB_URL: 'https://app.kinhale.health' });
    await sendDeletionScheduled(transport, env, {
      to: 'user@example.com',
      scheduledAtIso: '2026-05-01T12:00:00.000Z',
      cancelToken: 'c'.repeat(40),
    });
    const args = vi.mocked(transport.sendMail).mock.calls[0]?.[0] as {
      text: string;
      html: string;
      subject: string;
    };
    expect(args.text).toContain('2026-05-01T12:00:00.000Z');
    expect(args.text).toContain(
      'https://app.kinhale.health/account/deletion-cancel?token=cccccccccccccccccccccccccccccccccccccccc',
    );
    assertNoHealthData(args);
  });
});

describe('sendDeletionCompleted', () => {
  it('confirme la purge sans donnée santé', async () => {
    const transport = makeMockTransport();
    await sendDeletionCompleted(transport, testEnv(), { to: 'user@example.com' });
    const args = vi.mocked(transport.sendMail).mock.calls[0]?.[0] as {
      text: string;
      html: string;
      subject: string;
    };
    assertNoHealthData(args);
    expect(args.text).toContain('effac');
  });
});

describe('sendDeletionCancelled', () => {
  it('confirme l annulation sans donnée santé', async () => {
    const transport = makeMockTransport();
    await sendDeletionCancelled(transport, testEnv(), { to: 'user@example.com' });
    const args = vi.mocked(transport.sendMail).mock.calls[0]?.[0] as {
      text: string;
      html: string;
      subject: string;
    };
    assertNoHealthData(args);
    expect(args.text.toLowerCase()).toContain('annul');
    expect(args.text).toContain('[EN]');
  });
});
