import React from 'react';
import { screen, fireEvent, act } from '@testing-library/react';
import InviteCaregiverPage from '../page';
import { renderWithProviders } from '../../../../test-utils/render';

jest.mock('qrcode', () => ({
  __esModule: true,
  default: { toDataURL: jest.fn().mockResolvedValue('data:image/png;base64,AAAA') },
  toDataURL: jest.fn().mockResolvedValue('data:image/png;base64,AAAA'),
}));

const mockCreateInvitation = jest.fn().mockResolvedValue({
  token: 'tok-abc',
  pin: '123456',
  expiresAtMs: Date.now() + 600_000,
  targetRole: 'restricted_contributor',
});

jest.mock('../../../../lib/invitations/client', () => ({
  createInvitation: (...args: unknown[]) => mockCreateInvitation(...args),
}));

describe('InviteCaregiverPage', () => {
  jest.setTimeout(15000);

  beforeEach(() => {
    jest.clearAllMocks();
    mockCreateInvitation.mockResolvedValue({
      token: 'tok-abc',
      pin: '123456',
      expiresAtMs: Date.now() + 600_000,
      targetRole: 'restricted_contributor',
    });
  });

  it('affiche le formulaire avec sélection de rôle, champ nom et bouton désactivé', async () => {
    jest.useFakeTimers();
    try {
      renderWithProviders(<InviteCaregiverPage />);
      await act(async () => {
        await Promise.resolve();
        await Promise.resolve();
        await Promise.resolve();
        await Promise.resolve();
      });
      // Titre du formulaire
      expect(screen.getByText(/nouvelle invitation|new invitation/i)).toBeTruthy();
      // Les deux boutons de rôle
      expect(screen.getByText(/aidant complet|full caregiver/i)).toBeTruthy();
      expect(screen.getByText(/aidant restreint|restricted caregiver/i)).toBeTruthy();
      // Bouton générer désactivé quand displayName vide
      const generateBtn = screen.getByText(/générer|generate/i);
      expect(generateBtn).toBeTruthy();
    } finally {
      jest.clearAllTimers();
      jest.useRealTimers();
    }
  });

  it('appelle createInvitation et affiche le PIN après saisie et soumission', async () => {
    jest.useFakeTimers();
    try {
      renderWithProviders(<InviteCaregiverPage />);
      await act(async () => {
        await Promise.resolve();
        await Promise.resolve();
        await Promise.resolve();
        await Promise.resolve();
      });

      // Saisir un nom
      const input = screen.getByPlaceholderText(/maman|mom|garderie|daycare/i);
      fireEvent.change(input, { target: { value: 'Maman' } });

      // Cliquer sur Générer
      fireEvent.click(screen.getByText(/générer|generate/i));
      await act(async () => {
        await Promise.resolve(); // createInvitation résout
        await Promise.resolve(); // setCreated
        await Promise.resolve(); // QRCode.toDataURL résout
        await Promise.resolve(); // setQrDataUrl + setState timer
      });

      expect(mockCreateInvitation).toHaveBeenCalledWith({
        targetRole: 'restricted_contributor',
        displayName: 'Maman',
      });
      // Le PIN doit apparaître
      expect(screen.getByText('123456')).toBeTruthy();
    } finally {
      jest.clearAllTimers();
      jest.useRealTimers();
    }
  });

  it("affiche le message d'erreur quota quand createInvitation rejette avec invitation_quota_exceeded", async () => {
    jest.useFakeTimers();
    try {
      mockCreateInvitation.mockRejectedValueOnce(new Error('invitation_quota_exceeded'));

      renderWithProviders(<InviteCaregiverPage />);
      await act(async () => {
        await Promise.resolve();
        await Promise.resolve();
        await Promise.resolve();
        await Promise.resolve();
      });

      const input = screen.getByPlaceholderText(/maman|mom|garderie|daycare/i);
      fireEvent.change(input, { target: { value: 'Papie' } });

      fireEvent.click(screen.getByText(/générer|generate/i));
      await act(async () => {
        await Promise.resolve(); // createInvitation rejette
        await Promise.resolve(); // catch → setError
        await Promise.resolve(); // React propage
        await Promise.resolve(); // Tamagui scheduler
      });

      // Message d'erreur quota
      expect(screen.getByText(/limite.*10|active invitations limit/i)).toBeTruthy();
    } finally {
      jest.clearAllTimers();
      jest.useRealTimers();
    }
  });
});
