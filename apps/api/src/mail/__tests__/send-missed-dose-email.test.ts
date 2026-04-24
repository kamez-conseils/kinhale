import { describe, it, expect, vi } from 'vitest';
import type { Transporter } from 'nodemailer';
import { sendMissedDoseEmail } from '../send-missed-dose-email.js';
import { testEnv } from '../../env.js';

function makeMockTransport() {
  return {
    sendMail: vi.fn().mockResolvedValue({ messageId: 'test-message-id' }),
  } as unknown as Transporter;
}

/**
 * E5-S04 — L'e-mail fallback `missed_dose` est **strictement générique**.
 * Aucun prénom d'enfant, aucune dose, aucun nom de pompe, aucune note santé.
 * Les tests ci-dessous verrouillent cette promesse pour éviter une régression
 * silencieuse lors d'une future refonte du template (ex. i18n dynamique).
 */
describe('sendMissedDoseEmail', () => {
  it('appelle transport.sendMail avec sujet générique et expéditeur configuré (FR)', async () => {
    const transport = makeMockTransport();
    const env = testEnv({ WEB_URL: 'http://localhost:3000', MAIL_FROM: 'no-reply@kinhale.health' });

    await sendMissedDoseEmail(transport, env, {
      to: 'user@example.com',
      openToken: 'tok123',
      locale: 'fr',
    });

    expect(transport.sendMail).toHaveBeenCalledOnce();
    const callArgs = vi.mocked(transport.sendMail).mock.calls[0]?.[0];
    expect(callArgs).toMatchObject({
      from: 'no-reply@kinhale.health',
      to: 'user@example.com',
      subject: 'Kinhale — Nouvelle activité',
    });
  });

  it('inclut le token dans une URL /notify (text et html)', async () => {
    const transport = makeMockTransport();
    const env = testEnv({ WEB_URL: 'https://app.kinhale.health' });

    await sendMissedDoseEmail(transport, env, {
      to: 'user@example.com',
      openToken: 'abc.def.ghi',
      locale: 'fr',
    });

    const callArgs = vi.mocked(transport.sendMail).mock.calls[0]?.[0] as {
      text: string;
      html: string;
    };
    expect(callArgs.text).toContain('https://app.kinhale.health/notify?t=abc.def.ghi');
    expect(callArgs.html).toContain('https://app.kinhale.health/notify?t=abc.def.ghi');
  });

  it('utilise les chaînes anglaises si locale = en', async () => {
    const transport = makeMockTransport();
    const env = testEnv();

    await sendMissedDoseEmail(transport, env, {
      to: 'user@example.com',
      openToken: 'tok',
      locale: 'en',
    });

    const callArgs = vi.mocked(transport.sendMail).mock.calls[0]?.[0] as {
      subject: string;
      text: string;
    };
    expect(callArgs.subject).toBe('Kinhale — New activity');
    expect(callArgs.text).toContain('Open the app');
  });

  it('retombe sur FR si locale invalide / absente', async () => {
    const transport = makeMockTransport();
    const env = testEnv();

    await sendMissedDoseEmail(transport, env, {
      to: 'user@example.com',
      openToken: 'tok',
    });

    const callArgs = vi.mocked(transport.sendMail).mock.calls[0]?.[0] as {
      subject: string;
    };
    expect(callArgs.subject).toBe('Kinhale — Nouvelle activité');
  });

  it("ne contient AUCUNE donnée santé (prénom, dose, pompe, symptôme) dans l'e-mail", async () => {
    const transport = makeMockTransport();
    const env = testEnv();

    for (const locale of ['fr', 'en'] as const) {
      vi.mocked(transport.sendMail).mockClear();
      await sendMissedDoseEmail(transport, env, {
        to: 'user@example.com',
        openToken: 'tok',
        locale,
      });
      const callArgs = vi.mocked(transport.sendMail).mock.calls[0]?.[0] as {
        text: string;
        html: string;
        subject: string;
      };
      const healthKeywords = [
        'pompe',
        'pump',
        'dose',
        'asthme',
        'asthma',
        'symptôme',
        'symptom',
        'médicament',
        'medication',
        'ventolin',
        'flixotide',
        'inhaler',
        'inhalateur',
        'salbutamol',
        'ponto',
        'hérit',
      ];
      const haystack = (callArgs.subject + ' ' + callArgs.text + ' ' + callArgs.html).toLowerCase();
      for (const kw of healthKeywords) {
        expect(haystack).not.toContain(kw);
      }
    }
  });

  it('ne mentionne ni prénom ni identifiant de rappel dans le corps', async () => {
    const transport = makeMockTransport();
    const env = testEnv();

    await sendMissedDoseEmail(transport, env, {
      to: 'user@example.com',
      openToken: 'opaque-token-xyz',
      locale: 'fr',
    });

    const callArgs = vi.mocked(transport.sendMail).mock.calls[0]?.[0] as {
      text: string;
      html: string;
    };
    // Le seul "token" autorisé est celui du lien /notify
    expect(callArgs.text).not.toMatch(/reminder[-_]?id/i);
    expect(callArgs.html).not.toMatch(/reminder[-_]?id/i);
    // Pas de household_id en clair non plus
    expect(callArgs.text).not.toMatch(/household[-_]?id/i);
    expect(callArgs.html).not.toMatch(/household[-_]?id/i);
  });
});
