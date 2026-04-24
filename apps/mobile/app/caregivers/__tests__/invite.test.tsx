import React from 'react';
import { screen, fireEvent, waitFor } from '@testing-library/react-native';
import InviteCaregiverScreen from '../invite';
import { renderWithProviders } from '../../../src/test-utils/render';
import { createInvitation } from '../../../src/lib/invitations/client';

jest.mock('react-native-qrcode-svg', () => {
  const React = require('react');
  return {
    __esModule: true,
    default: (props: { value: string }) =>
      React.createElement('QRCode', { testID: 'qr', value: props.value }),
  };
});

jest.mock('expo-clipboard', () => ({
  setStringAsync: jest.fn().mockResolvedValue(undefined),
}));

const mockCreated = {
  token: 'tok-abc',
  pin: '123456',
  expiresAtMs: Date.now() + 600_000,
  targetRole: 'restricted_contributor' as const,
};

jest.mock('../../../src/lib/invitations/client', () => ({
  createInvitation: jest.fn().mockResolvedValue({
    token: 'tok-abc',
    pin: '123456',
    expiresAtMs: Date.now() + 600_000,
    targetRole: 'restricted_contributor',
  }),
}));

// Par défaut : en ligne, pour que les tests existants ne butent pas sur le
// guard E7-S08. Un test dédié couvrira la branche hors-ligne plus tard.
jest.mock('../../../src/stores/sync-status-store', () => ({
  useSyncStatusStore: jest.fn(
    (selector: (s: { connected: boolean; pulling: boolean }) => unknown) =>
      selector({ connected: true, pulling: false }),
  ),
}));

const mockCreateInvitation = createInvitation as jest.MockedFunction<typeof createInvitation>;

describe('InviteCaregiverScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockCreateInvitation.mockResolvedValue(mockCreated);
  });

  it('affiche le formulaire de création avec le champ nom et les boutons de rôle', async () => {
    renderWithProviders(<InviteCaregiverScreen />);

    await waitFor(() => {
      expect(screen.getByRole('header')).toBeTruthy();
    });

    // Form elements are present
    expect(screen.getByLabelText(/nom affiché|display name/i)).toBeTruthy();
    expect(screen.getByLabelText(/aidant complet|full caregiver/i)).toBeTruthy();
    expect(screen.getByLabelText(/aidant restreint|restricted caregiver/i)).toBeTruthy();
    expect(screen.getByLabelText(/générer|generate/i)).toBeTruthy();
  });

  it('affiche le QR et le PIN après saisie du nom et appui sur générer', async () => {
    renderWithProviders(<InviteCaregiverScreen />);

    await waitFor(() => {
      expect(screen.getByRole('header')).toBeTruthy();
    });

    const input = screen.getByLabelText(/nom affiché|display name/i);
    fireEvent.changeText(input, 'Grand-mère');

    const generateButton = screen.getByLabelText(/générer|generate/i);
    fireEvent.press(generateButton);

    await waitFor(() => {
      expect(mockCreateInvitation).toHaveBeenCalledWith({
        targetRole: 'restricted_contributor',
        displayName: 'Grand-mère',
      });
    });

    await waitFor(() => {
      expect(screen.getByTestId('pin-value')).toBeTruthy();
    });

    expect(screen.getByTestId('pin-value').props['children']).toBe('123456');
    expect(screen.getByTestId('qr')).toBeTruthy();
  });

  it('affiche le message erreur quota quand createInvitation lève invitation_quota_exceeded', async () => {
    mockCreateInvitation.mockRejectedValue(new Error('invitation_quota_exceeded'));

    renderWithProviders(<InviteCaregiverScreen />);

    await waitFor(() => {
      expect(screen.getByRole('header')).toBeTruthy();
    });

    const input = screen.getByLabelText(/nom affiché|display name/i);
    fireEvent.changeText(input, 'Papa');

    const generateButton = screen.getByLabelText(/générer|generate/i);
    fireEvent.press(generateButton);

    await waitFor(() => {
      expect(screen.getByText(/limite de 10|active invitations limit/i)).toBeTruthy();
    });
  });
});
