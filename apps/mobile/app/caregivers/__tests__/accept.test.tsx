import React from 'react';
import { screen, fireEvent, waitFor } from '@testing-library/react-native';
import AcceptInvitationScreen from '../accept/[token]';
import { renderWithProviders } from '../../../src/test-utils/render';
import { acceptInvitation, getInvitationPublic } from '../../../src/lib/invitations/client';

const mockReplace = jest.fn();

jest.mock('expo-router', () => ({
  useRouter: () => ({ replace: mockReplace }),
  useLocalSearchParams: () => ({ token: 'tok-abc' }),
}));

jest.mock('../../../src/lib/invitations/client', () => ({
  getInvitationPublic: jest.fn().mockResolvedValue({
    targetRole: 'restricted_contributor',
    displayName: 'Garderie',
  }),
  acceptInvitation: jest.fn().mockResolvedValue({
    sessionToken: 'jwt-xyz',
    targetRole: 'restricted_contributor',
    displayName: 'Garderie',
  }),
}));

const mockSetAuth = jest.fn();

jest.mock('../../../src/stores/auth-store', () => ({
  useAuthStore: { getState: () => ({ setAuth: mockSetAuth }) },
}));

const mockGetInvitationPublic = getInvitationPublic as jest.MockedFunction<
  typeof getInvitationPublic
>;
const mockAcceptInvitation = acceptInvitation as jest.MockedFunction<typeof acceptInvitation>;

describe('AcceptInvitationScreen', () => {
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
    renderWithProviders(<AcceptInvitationScreen />);

    await waitFor(() => {
      expect(screen.getByText('Garderie')).toBeTruthy();
    });

    expect(mockGetInvitationPublic).toHaveBeenCalledWith('tok-abc');
  });

  it("affiche l'erreur de consentement si soumis sans cocher la case", async () => {
    renderWithProviders(<AcceptInvitationScreen />);

    await waitFor(() => {
      expect(screen.getByText('Garderie')).toBeTruthy();
    });

    // Fill in a valid 6-digit PIN
    const pinInput = screen.getByLabelText(/pin/i);
    fireEvent.changeText(pinInput, '123456');

    // Press submit without consent
    const submitBtn = screen.getByLabelText(/rejoindre|join/i);
    fireEvent.press(submitBtn);

    await waitFor(() => {
      expect(screen.getByText(/accepter le partage|accept sharing/i)).toBeTruthy();
    });

    expect(mockAcceptInvitation).not.toHaveBeenCalled();
  });

  it('appelle acceptInvitation et redirige vers /journal avec PIN + consentement', async () => {
    renderWithProviders(<AcceptInvitationScreen />);

    await waitFor(() => {
      expect(screen.getByText('Garderie')).toBeTruthy();
    });

    // Fill in a valid 6-digit PIN
    const pinInput = screen.getByLabelText(/pin/i);
    fireEvent.changeText(pinInput, '123456');

    // Toggle consent
    const consentBtn = screen.getByLabelText(/j'accepte|i agree/i);
    fireEvent.press(consentBtn);

    // Submit
    const submitBtn = screen.getByLabelText(/rejoindre|join/i);
    fireEvent.press(submitBtn);

    await waitFor(() => {
      expect(mockAcceptInvitation).toHaveBeenCalledWith('tok-abc', '123456', true);
    });

    await waitFor(() => {
      expect(mockReplace).toHaveBeenCalledWith('/journal');
    });
  });
});
