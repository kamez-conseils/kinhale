import React from 'react';
import { screen, fireEvent, act } from '@testing-library/react';
import AcceptInvitationPage from '../page';
import { renderWithProviders } from '../../../../test-utils/render';

const mockPush = jest.fn();
jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockPush }),
  useParams: () => ({ token: 'tok-abc' }),
}));

const mockGetInvitationPublic = jest.fn();
const mockAcceptInvitation = jest.fn();
jest.mock('../../../../lib/invitations/client', () => ({
  getInvitationPublic: (...args: unknown[]) => mockGetInvitationPublic(...args),
  acceptInvitation: (...args: unknown[]) => mockAcceptInvitation(...args),
}));

const mockSetAuth = jest.fn();
jest.mock('../../../../stores/auth-store', () => ({
  useAuthStore: {
    getState: () => ({ setAuth: mockSetAuth }),
  },
}));

describe('AcceptInvitationPage', () => {
  jest.setTimeout(15000);

  beforeEach(() => {
    jest.clearAllMocks();
    mockGetInvitationPublic.mockResolvedValue({
      targetRole: 'restricted_contributor',
      displayName: 'Garderie',
    });
    mockAcceptInvitation.mockResolvedValue({
      sessionToken: 'jwt-xyz',
      targetRole: 'restricted_contributor',
      displayName: 'Garderie',
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

  it('affiche errorExpired si le lookup renvoie 404', async () => {
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
      // Le formulaire ne doit pas être affiché
      expect(screen.queryByText(/Rejoindre|Join/i)).toBeNull();
    } finally {
      jest.clearAllTimers();
      jest.useRealTimers();
    }
  });

  it('soumet avec PIN valide + consentement et redirige vers /journal', async () => {
    jest.useFakeTimers();
    try {
      renderWithProviders(<AcceptInvitationPage />);
      await act(async () => {
        await Promise.resolve();
        await Promise.resolve();
        await Promise.resolve();
        await Promise.resolve();
      });

      // Saisir le PIN
      const pinInput = screen.getByPlaceholderText(/pin/i);
      fireEvent.change(pinInput, { target: { value: '123456' } });

      // Cocher le consentement
      fireEvent.click(screen.getByTestId('consent-toggle'));

      await act(async () => {
        await Promise.resolve();
        await Promise.resolve();
      });

      // Soumettre
      fireEvent.click(screen.getByTestId('consent-toggle')); // uncheck
      fireEvent.click(screen.getByTestId('consent-toggle')); // recheck — ensure state is true

      // Click submit button
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

      expect(mockAcceptInvitation).toHaveBeenCalledWith('tok-abc', '123456', true);
      expect(mockSetAuth).toHaveBeenCalledWith('jwt-xyz', '', '');
      expect(mockPush).toHaveBeenCalledWith('/journal');
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

      // Activer le consentement
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
});
