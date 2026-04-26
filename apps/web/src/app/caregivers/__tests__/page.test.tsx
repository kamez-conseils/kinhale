import React from 'react';
import { screen, fireEvent, act } from '@testing-library/react';

const mockPush = jest.fn();
const mockReplace = jest.fn();
jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockPush, replace: mockReplace }),
}));

jest.mock('@kinhale/sync', () => ({
  projectCaregivers: () => [],
}));

jest.mock('../../../stores/doc-store', () => ({
  useDocStore: jest.fn((selector: (s: { doc: null }) => unknown) => selector({ doc: null })),
}));

let mockAccessToken: string | null = 'tok-valid';
let mockHouseholdId: string | null = 'hh-xyz';
jest.mock('../../../stores/auth-store', () => ({
  useAuthStore: jest.fn(
    (selector: (s: { accessToken: string | null; householdId: string | null }) => unknown) =>
      selector({ accessToken: mockAccessToken, householdId: mockHouseholdId }),
  ),
}));

const mockListInvitations = jest.fn().mockResolvedValue([]);
const mockRevokeInvitation = jest.fn().mockResolvedValue(undefined);
const mockSealInvitation = jest.fn().mockResolvedValue(undefined);
jest.mock('../../../lib/invitations/client', () => ({
  listInvitations: (...args: unknown[]) => mockListInvitations(...args),
  revokeInvitation: (...args: unknown[]) => mockRevokeInvitation(...args),
  sealInvitation: (...args: unknown[]) => mockSealInvitation(...args),
}));

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
  sealedBoxEncrypt: jest.fn(async (plaintext: Uint8Array) => {
    // Simule un sealed box (32 octets ephemeral + plaintext + 16 octets MAC)
    return new Uint8Array(plaintext.length + 48);
  }),
}));

const mockGetGroupKey = jest.fn(async (..._args: unknown[]) => new Uint8Array(32));
jest.mock('../../../lib/device', () => ({
  getGroupKey: (householdId: string) => mockGetGroupKey(householdId),
}));

import CaregiversPage from '../page';
import { renderWithProviders } from '../../../test-utils/render';

describe('CaregiversPage', () => {
  jest.setTimeout(15000);

  beforeEach(() => {
    jest.clearAllMocks();
    mockAccessToken = 'tok-valid';
    mockHouseholdId = 'hh-xyz';
    mockListInvitations.mockResolvedValue([]);
    mockRevokeInvitation.mockResolvedValue(undefined);
    mockSealInvitation.mockResolvedValue(undefined);
  });

  it("affiche l'etat vide quand il n'y a ni aidants ni invitations", async () => {
    jest.useFakeTimers();
    try {
      renderWithProviders(<CaregiversPage />);
      await act(async () => {
        await Promise.resolve(); // listInvitations résout
        await Promise.resolve(); // setState invitations
        await Promise.resolve(); // React propage
        await Promise.resolve(); // Tamagui scheduler
      });
      expect(screen.getByText(/aucun aidant|no caregiver/i)).toBeTruthy();
    } finally {
      jest.clearAllTimers();
      jest.useRealTimers();
    }
  });

  it('affiche une invitation et révoque au clic', async () => {
    jest.useFakeTimers();
    try {
      const invitation = {
        token: 'tok-abc',
        targetRole: 'contributor' as const,
        displayName: 'Maman',
        createdAtMs: Date.now(),
      };
      mockListInvitations.mockResolvedValueOnce([invitation]).mockResolvedValue([]);

      renderWithProviders(<CaregiversPage />);
      await act(async () => {
        await Promise.resolve();
        await Promise.resolve();
        await Promise.resolve();
        await Promise.resolve();
      });

      expect(screen.getByText('Maman')).toBeTruthy();

      fireEvent.click(screen.getByText(/révoquer|revoke/i));
      await act(async () => {
        await Promise.resolve(); // revokeInvitation résout
        await Promise.resolve(); // refresh → listInvitations résout
        await Promise.resolve(); // setState
        await Promise.resolve(); // React propage
      });

      expect(mockRevokeInvitation).toHaveBeenCalledWith('tok-abc');
    } finally {
      jest.clearAllTimers();
      jest.useRealTimers();
    }
  });

  it('navigue vers /caregivers/invite au clic sur le bouton Inviter', async () => {
    jest.useFakeTimers();
    try {
      renderWithProviders(<CaregiversPage />);
      await act(async () => {
        await Promise.resolve();
        await Promise.resolve();
        await Promise.resolve();
        await Promise.resolve();
      });

      fireEvent.click(screen.getByText(/inviter un aidant|invite a caregiver/i));
      expect(mockPush).toHaveBeenCalledWith('/caregivers/invite');
    } finally {
      jest.clearAllTimers();
      jest.useRealTimers();
    }
  });

  it('redirige vers /auth quand accessToken est absent', async () => {
    mockAccessToken = null;
    jest.useFakeTimers();
    try {
      renderWithProviders(<CaregiversPage />);
      await act(async () => {
        await Promise.resolve();
        await Promise.resolve();
        await Promise.resolve();
        await Promise.resolve();
      });
      expect(mockReplace).toHaveBeenCalledWith('/auth');
      expect(mockListInvitations).not.toHaveBeenCalled();
    } finally {
      jest.clearAllTimers();
      jest.useRealTimers();
    }
  });

  it("affiche le message d'erreur localisé quand listInvitations échoue", async () => {
    mockListInvitations.mockRejectedValue(new Error('Network error'));
    jest.useFakeTimers();
    try {
      renderWithProviders(<CaregiversPage />);
      await act(async () => {
        await Promise.resolve();
        await Promise.resolve();
        await Promise.resolve();
        await Promise.resolve();
      });
      expect(screen.getByText(/impossible de charger|could not load/i)).toBeTruthy();
    } finally {
      jest.clearAllTimers();
      jest.useRealTimers();
    }
  });

  it("affiche la section 'pending seal' et finalise au clic (KIN-096)", async () => {
    jest.useFakeTimers();
    try {
      const inv = {
        token: 'tok-pending',
        targetRole: 'contributor' as const,
        displayName: 'Tata',
        createdAtMs: Date.now(),
        hasRecipientPublicKey: true,
        hasSealedGroupKey: false,
        recipientPublicKeyHex: 'aa'.repeat(32),
      };
      mockListInvitations
        .mockResolvedValueOnce([inv])
        .mockResolvedValue([{ ...inv, hasSealedGroupKey: true }]);

      renderWithProviders(<CaregiversPage />);
      await act(async () => {
        await Promise.resolve();
        await Promise.resolve();
        await Promise.resolve();
        await Promise.resolve();
      });

      // La section "pending seal" est rendue
      expect(screen.getByTestId('pending-seal-section')).toBeTruthy();
      // Le bouton "Finaliser le partage" est rendu pour l'invitation
      const sealBtn = screen.getByTestId('seal-button-tok-pending');
      expect(sealBtn).toBeTruthy();

      fireEvent.click(sealBtn);
      await act(async () => {
        await Promise.resolve();
        await Promise.resolve();
        await Promise.resolve();
        await Promise.resolve();
      });

      expect(mockGetGroupKey).toHaveBeenCalledWith('hh-xyz');
      expect(mockSealInvitation).toHaveBeenCalledWith(
        'tok-pending',
        expect.stringMatching(/^[0-9a-f]+$/u),
      );
    } finally {
      jest.clearAllTimers();
      jest.useRealTimers();
    }
  });

  it("n'autorise pas le sealing si l'invité n'a pas encore déposé sa pubkey", async () => {
    jest.useFakeTimers();
    try {
      const inv = {
        token: 'tok-no-pubkey',
        targetRole: 'contributor' as const,
        displayName: 'Tata',
        createdAtMs: Date.now(),
        hasRecipientPublicKey: false,
        hasSealedGroupKey: false,
      };
      mockListInvitations.mockResolvedValue([inv]);

      renderWithProviders(<CaregiversPage />);
      await act(async () => {
        await Promise.resolve();
        await Promise.resolve();
        await Promise.resolve();
        await Promise.resolve();
      });

      // Pas de bouton "Finaliser" — l'invitation est dans la section
      // "pending acceptance" (revoke seulement)
      expect(screen.queryByTestId('seal-button-tok-no-pubkey')).toBeNull();
    } finally {
      jest.clearAllTimers();
      jest.useRealTimers();
    }
  });
});
