import { describe, it, expect, vi } from 'vitest';
import type { Transporter } from 'nodemailer';
import { sendMagicLink } from '../send-magic-link.js';
import { testEnv } from '../../env.js';

function makeMockTransport() {
  return {
    sendMail: vi.fn().mockResolvedValue({ messageId: 'test-message-id' }),
  } as unknown as Transporter;
}

describe('sendMagicLink', () => {
  it('appelle transport.sendMail avec les bons champs', async () => {
    const transport = makeMockTransport();
    const env = testEnv({ WEB_URL: 'http://localhost:3000', MAIL_FROM: 'no-reply@kinhale.health' });

    await sendMagicLink(transport, env, { to: 'user@example.com', token: 'abc123token' });

    expect(transport.sendMail).toHaveBeenCalledOnce();
    const callArgs = vi.mocked(transport.sendMail).mock.calls[0]?.[0];
    expect(callArgs).toMatchObject({
      from: 'no-reply@kinhale.health',
      to: 'user@example.com',
      subject: 'Votre lien de connexion Kinhale',
    });
  });

  it("inclut le token dans l'URL du lien de vérification (text)", async () => {
    const transport = makeMockTransport();
    const env = testEnv({ WEB_URL: 'http://localhost:3000' });

    await sendMagicLink(transport, env, { to: 'user@example.com', token: 'abc123token' });

    const callArgs = vi.mocked(transport.sendMail).mock.calls[0]?.[0] as {
      text: string;
      html: string;
    };
    expect(callArgs.text).toContain('http://localhost:3000/auth/verify?token=abc123token');
    expect(callArgs.html).toContain('http://localhost:3000/auth/verify?token=abc123token');
  });

  it('utilise WEB_URL de env pour construire le lien', async () => {
    const transport = makeMockTransport();
    const env = testEnv({ WEB_URL: 'https://app.kinhale.health' });

    await sendMagicLink(transport, env, { to: 'user@example.com', token: 'tok789' });

    const callArgs = vi.mocked(transport.sendMail).mock.calls[0]?.[0] as { text: string };
    expect(callArgs.text).toContain('https://app.kinhale.health/auth/verify?token=tok789');
  });

  it("ne contient aucune donnée santé dans le payload de l'email", async () => {
    const transport = makeMockTransport();
    const env = testEnv();

    await sendMagicLink(transport, env, { to: 'user@example.com', token: 'safetok' });

    const callArgs = vi.mocked(transport.sendMail).mock.calls[0]?.[0] as {
      text: string;
      html: string;
      subject: string;
    };
    // Le sujet, text et html ne doivent contenir aucune info santé
    const healthKeywords = ['pompe', 'dose', 'asthme', 'symptôme', 'médicament'];
    for (const kw of healthKeywords) {
      expect(callArgs.subject.toLowerCase()).not.toContain(kw);
      expect(callArgs.text.toLowerCase()).not.toContain(kw);
      expect(callArgs.html.toLowerCase()).not.toContain(kw);
    }
  });
});
