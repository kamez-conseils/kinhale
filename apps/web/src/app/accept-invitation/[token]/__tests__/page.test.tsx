import React from 'react';
import { screen, fireEvent, act } from '@testing-library/react';

// ── Mocks (DOIVENT être déclarés avant l'import du SUT) ────────────────────

const mockPush = jest.fn();
jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockPush }),
  useParams: () => ({ token: 'tok-abc' }),
}));

const mockGetInvitationPublic = jest.fn();
const mockAcceptInvitation = jest.fn();
const mockFetchSealedGroupKey = jest.fn();
jest.mock('../../../../lib/invitations/client', () => ({
  getInvitationPublic: (...args: unknown[]) => mockGetInvitationPublic(...args),
  acceptInvitation: (...args: unknown[]) => mockAcceptInvitation(...args),
  fetchSealedGroupKey: (...args: unknown[]) => mockFetchSealedGroupKey(...args),
}));

const mockSetAuth = jest.fn();
jest.mock('../../../../stores/auth-store', () => ({
  useAuthStore: {
    getState: () => ({ setAuth: mockSetAuth }),
  },
}));

// `@kinhale/crypto` n'est pas importable depuis Jest (ESM `.js` extensions
// + libsodium WASM). On mocke uniquement les helpers utilisés par la page.
jest.mock('@kinhale/crypto', () => ({
  toHex: (bytes: Uint8Array): string => {
    let h = '';
    for (const b of bytes) h += b.toString(16).padStart(2, '0');
    return h;
  },
  fromHex: (hex: string): Uint8Array => {
    const out = new Uint8Array(hex.length / 2);
    for (let i = 0; i < out.length; i++) out[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16);
    return out;
  },
  sealedBoxDecrypt: jest.fn(async () => new Uint8Array(32)),
}));

const mockGetDeviceX25519Keypair = jest.fn(async () => ({
  publicKey: new Uint8Array(32),
  privateKey: new Uint8Array(32),
}));
const mockSetGroupKey = jest.fn(async (..._args: unknown[]) => undefined);
jest.mock('../../../../lib/device', () => ({
  getDeviceX25519Keypair: () => mockGetDeviceX25519Keypair(),
  setGroupKey: (householdId: string, key: Uint8Array) => mockSetGroupKey(householdId, key),
}));

import AcceptInvitationPage from '../page';
import { renderWithProviders } from '../../../../test-utils/render';

describe('AcceptInvitationPage', () => {
  jest.setTimeout(15000);

  beforeEach(() => {
    jest.clearAllMocks();
    mockGetInvitationPublic.mockResolvedValue({
      targetRole: 'restricted_contributor',
      displayName: 'Garderie',
    });
    // sessionToken = base64url JSON {"householdId":"hh-xyz"}
    // header.payload.sig — on n'a besoin que du payload
    const payload = btoa(JSON.stringify({ householdId: 'hh-xyz' }))
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/u, '');
    mockAcceptInvitation.mockResolvedValue({
      sessionToken: `header.${payload}.sig`,
      targetRole: 'restricted_contributor',
      displayName: 'Garderie',
    });
    mockFetchSealedGroupKey.mockResolvedValue({
      recipientPublicKeyHex: 'aa'.repeat(32),
      sealedGroupKeyHex: 'bb'.repeat(80),
    });
  });

  it("affiche le displayName après le lookup de l'invitation", async () => {
    jest.useFakeTimers();
    try {
      renderWithProviders(<AcceptInvitationPage />);
      await act(async () => {
        await Promise.resolve();
        await Promise.resolve();
        await Promise.resolve();
        await Promise.resolve();
      });
      expect(screen.getByText('Garderie')).toBeTruthy();
    } finally {
      jest.clearAllTimers();
      jest.useRealTimers();
    }
  });

  it('affiche errorExpired et le bouton backToAuth si le lookup renvoie 404', async () => {
    jest.useFakeTimers();
    try {
      mockGetInvitationPublic.mockRejectedValueOnce(new Error('not_found_or_expired'));
      renderWithProviders(<AcceptInvitationPage />);
      await act(async () => {
        await Promise.resolve();
        await Promise.resolve();
        await Promise.resolve();
        await Promise.resolve();
      });
      expect(screen.getByText(/expir/i)).toBeTruthy();
      expect(screen.queryByText(/Rejoindre|Join/i)).toBeNull();
      expect(screen.getByText(/retour à la connexion|back to login/i)).toBeTruthy();
    } finally {
      jest.clearAllTimers();
      jest.useRealTimers();
    }
  });

  it('navigue vers /auth au clic sur le bouton backToAuth (#179)', async () => {
    jest.useFakeTimers();
    try {
      mockGetInvitationPublic.mockRejectedValueOnce(new Error('not_found_or_expired'));
      renderWithProviders(<AcceptInvitationPage />);
      await act(async () => {
        await Promise.resolve();
        await Promise.resolve();
        await Promise.resolve();
        await Promise.resolve();
      });
      fireEvent.click(screen.getByText(/retour à la connexion|back to login/i));
      expect(mockPush).toHaveBeenCalledWith('/auth');
    } finally {
      jest.clearAllTimers();
      jest.useRealTimers();
    }
  });

  it('soumet avec PIN valide + consentement et envoie recipientPublicKeyHex (KIN-096)', async () => {
    jest.useFakeTimers();
    try {
      renderWithProviders(<AcceptInvitationPage />);
      await act(async () => {
        await Promise.resolve();
        await Promise.resolve();
        await Promise.resolve();
        await Promise.resolve();
      });

      const pinInput = screen.getByPlaceholderText(/pin/i);
      fireEvent.change(pinInput, { target: { value: '123456' } });

      fireEvent.click(screen.getByTestId('consent-toggle'));

      await act(async () => {
        await Promise.resolve();
        await Promise.resolve();
      });

      fireEvent.click(screen.getByTestId('consent-toggle'));
      fireEvent.click(screen.getByTestId('consent-toggle'));

      const buttons = screen.getAllByRole('button');
      const submitBtn = buttons.find((b) => /Rejoindre|Join/i.test(b.textContent ?? ''));
      if (submitBtn === undefined) throw new Error('Submit button not found');
      fireEvent.click(submitBtn);

      await act(async () => {
        await Promise.resolve();
        await Promise.resolve();
        await Promise.resolve();
        await Promise.resolve();
      });

      expect(mockAcceptInvitation).toHaveBeenCalledWith(
        'tok-abc',
        '123456',
        true,
        expect.stringMatching(/^[0-9a-f]{64}$/u),
      );
      expect(mockSetAuth).toHaveBeenCalledWith(expect.any(String), '', 'hh-xyz');
      // Affichage de l'écran "awaiting seal"
      expect(screen.getByText(/En attente|Waiting/i)).toBeTruthy();
    } finally {
      jest.clearAllTimers();
      jest.useRealTimers();
    }
  });

  it('affiche errorLocked si acceptInvitation rejette avec locked', async () => {
    jest.useFakeTimers();
    try {
      mockAcceptInvitation.mockRejectedValueOnce(new Error('locked'));

      renderWithProviders(<AcceptInvitationPage />);
      await act(async () => {
        await Promise.resolve();
        await Promise.resolve();
        await Promise.resolve();
        await Promise.resolve();
      });

      const pinInput = screen.getByPlaceholderText(/pin/i);
      fireEvent.change(pinInput, { target: { value: '654321' } });

      fireEvent.click(screen.getByTestId('consent-toggle'));

      await act(async () => {
        await Promise.resolve();
        await Promise.resolve();
      });

      const buttons = screen.getAllByRole('button');
      const submitBtn = buttons.find((b) => /Rejoindre|Join/i.test(b.textContent ?? ''));
      if (submitBtn === undefined) throw new Error('Submit button not found');
      fireEvent.click(submitBtn);

      await act(async () => {
        await Promise.resolve();
        await Promise.resolve();
        await Promise.resolve();
        await Promise.resolve();
      });

      expect(screen.getByText(/verrouill|locked/i)).toBeTruthy();
    } finally {
      jest.clearAllTimers();
      jest.useRealTimers();
    }
  });

  it('après acceptation, poll fetchSealedGroupKey et appelle setGroupKey si OK (KIN-096)', async () => {
    jest.useFakeTimers();
    try {
      renderWithProviders(<AcceptInvitationPage />);
      await act(async () => {
        await Promise.resolve();
        await Promise.resolve();
        await Promise.resolve();
        await Promise.resolve();
      });
      const pinInput = screen.getByPlaceholderText(/pin/i);
      fireEvent.change(pinInput, { target: { value: '123456' } });
      fireEvent.click(screen.getByTestId('consent-toggle'));
      await act(async () => {
        await Promise.resolve();
        await Promise.resolve();
      });

      const buttons = screen.getAllByRole('button');
      const submitBtn = buttons.find((b) => /Rejoindre|Join/i.test(b.textContent ?? ''));
      if (submitBtn === undefined) throw new Error('Submit button not found');
      fireEvent.click(submitBtn);

      // Laisse le polling effectuer 1 cycle complet
      await act(async () => {
        await Promise.resolve();
        await Promise.resolve();
        await Promise.resolve();
        await Promise.resolve();
        await Promise.resolve();
        await Promise.resolve();
      });

      expect(mockFetchSealedGroupKey).toHaveBeenCalledWith('tok-abc');
      expect(mockSetGroupKey).toHaveBeenCalledWith('hh-xyz', expect.any(Uint8Array));
      expect(mockPush).toHaveBeenCalledWith('/journal');
    } finally {
      jest.clearAllTimers();
      jest.useRealTimers();
    }
  });
});
