/**
 * Tests parser QR invitation web (KIN-096).
 *
 * Le parser accepte deux formats produits par le générateur (mobile + web) :
 *  - URL custom-scheme : `kinhale://accept/<token>?pin=<pin>`
 *  - URL HTTPS du wrapper web : `https://<host>/accept-invitation/<token>?pin=<pin>`
 *
 * Tout autre format est rejeté avec `invalid_qr` afin d'éviter qu'un QR
 * malicieux n'ouvre une URL arbitraire (cf. kz-securite §validation entrée).
 */

import { parseInvitationPayload } from '../invitation-qr';

describe('parseInvitationPayload', () => {
  it('extrait token + pin depuis le scheme kinhale://', () => {
    const result = parseInvitationPayload('kinhale://accept/tok-abc?pin=123456');
    expect(result).toEqual({ token: 'tok-abc', pin: '123456' });
  });

  it('extrait token + pin depuis une URL HTTPS du wrapper web', () => {
    const result = parseInvitationPayload(
      'https://app.kinhale.health/accept-invitation/tok-xyz?pin=987654',
    );
    expect(result).toEqual({ token: 'tok-xyz', pin: '987654' });
  });

  it('accepte un token sans PIN (PIN saisi manuellement après)', () => {
    const result = parseInvitationPayload('kinhale://accept/tok-noPin');
    expect(result).toEqual({ token: 'tok-noPin', pin: '' });
  });

  it('rejette une URL HTTPS avec un token trop court', () => {
    // Le PIN à un caractère pourrait laisser passer un token forgé d'un caractère ;
    // la longueur min protège contre les collisions (token = 32B base64).
    expect(() =>
      parseInvitationPayload('https://evil.example.com/accept-invitation/x?pin=1'),
    ).toThrow('invalid_qr');
  });

  it('rejette une URL HTTPS sans le segment /accept-invitation/', () => {
    expect(() => parseInvitationPayload('https://app.kinhale.health/journal')).toThrow(
      'invalid_qr',
    );
  });

  it('rejette une URL HTTPS avec des segments supplémentaires (anti-injection path)', () => {
    expect(() =>
      parseInvitationPayload(
        'https://app.kinhale.health/accept-invitation/tok-valid/extra?pin=123456',
      ),
    ).toThrow('invalid_qr');
  });

  it('rejette un PIN non numérique', () => {
    expect(() => parseInvitationPayload('kinhale://accept/tok?pin=abcdef')).toThrow('invalid_qr');
  });

  it('rejette un PIN trop long', () => {
    expect(() => parseInvitationPayload('kinhale://accept/tok?pin=1234567')).toThrow('invalid_qr');
  });

  it('rejette un token vide', () => {
    expect(() => parseInvitationPayload('kinhale://accept/?pin=123456')).toThrow('invalid_qr');
  });

  it('rejette une chaîne arbitraire', () => {
    expect(() => parseInvitationPayload('not-a-url')).toThrow('invalid_qr');
  });

  it('rejette le scheme javascript: (anti-XSS)', () => {
    expect(() => parseInvitationPayload('javascript:alert(1)')).toThrow('invalid_qr');
  });

  it('rejette un token contenant des caractères non URL-safe', () => {
    expect(() => parseInvitationPayload('kinhale://accept/tok%20space?pin=123456')).toThrow(
      'invalid_qr',
    );
  });
});
