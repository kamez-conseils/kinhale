import React from 'react';
import { screen, fireEvent, act } from '@testing-library/react';
import CaregiversPage from '../page';
import { renderWithProviders } from '../../../test-utils/render';

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
jest.mock('../../../stores/auth-store', () => ({
  useAuthStore: jest.fn((selector: (s: { accessToken: string | null }) => unknown) =>
    selector({ accessToken: mockAccessToken }),
  ),
}));

const mockListInvitations = jest.fn().mockResolvedValue([]);
const mockRevokeInvitation = jest.fn().mockResolvedValue(undefined);
jest.mock('../../../lib/invitations/client', () => ({
  listInvitations: (...args: unknown[]) => mockListInvitations(...args),
  revokeInvitation: (...args: unknown[]) => mockRevokeInvitation(...args),
}));

describe('CaregiversPage', () => {
  jest.setTimeout(15000);

  beforeEach(() => {
    jest.clearAllMocks();
    mockAccessToken = 'tok-valid';
    mockListInvitations.mockResolvedValue([]);
    mockRevokeInvitation.mockResolvedValue(undefined);
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
});
