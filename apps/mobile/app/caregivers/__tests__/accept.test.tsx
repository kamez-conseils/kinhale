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
  acceptInvitation: jest.fn(),
  fetchSealedGroupKey: jest.fn().mockResolvedValue(null),
}));

const mockSetAuth = jest.fn();

jest.mock('../../../src/stores/auth-store', () => ({
  useAuthStore: { getState: () => ({ setAuth: mockSetAuth }) },
}));

jest.mock('../../../src/lib/device', () => ({
  getDeviceX25519Keypair: jest.fn(async () => ({
    publicKey: new Uint8Array(32),
    privateKey: new Uint8Array(32),
  })),
  setGroupKey: jest.fn(async () => undefined),
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
    // session token contenant un payload {householdId} valide
    const headerB64 = Buffer.from('{"alg":"none"}').toString('base64url');
    const payloadB64 = Buffer.from('{"householdId":"hh-xyz"}').toString('base64url');
    mockAcceptInvitation.mockResolvedValue({
      sessionToken: `${headerB64}.${payloadB64}.sig`,
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

  it('appelle acceptInvitation avec recipientPublicKeyHex puis affiche awaiting-seal (KIN-096)', async () => {
    renderWithProviders(<AcceptInvitationScreen />);

    await waitFor(() => {
      expect(screen.getByText('Garderie')).toBeTruthy();
    });

    const pinInput = screen.getByLabelText(/pin/i);
    fireEvent.changeText(pinInput, '123456');

    const consentBtn = screen.getByLabelText(/j'accepte|i agree/i);
    fireEvent.press(consentBtn);

    const submitBtn = screen.getByLabelText(/rejoindre|join/i);
    fireEvent.press(submitBtn);

    await waitFor(() => {
      expect(mockAcceptInvitation).toHaveBeenCalledWith(
        'tok-abc',
        '123456',
        true,
        expect.stringMatching(/^[0-9a-f]{64}$/u),
      );
    });

    // Affichage de l'écran "awaiting seal" (l'admin n'a pas encore scellé)
    await waitFor(() => {
      expect(screen.getByText(/En attente|Waiting/i)).toBeTruthy();
    });
  });
});
