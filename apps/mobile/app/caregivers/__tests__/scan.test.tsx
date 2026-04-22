import React from 'react';
import { screen, fireEvent, waitFor } from '@testing-library/react-native';
import { Camera } from 'expo-camera';
import ScanInvitationScreen from '../scan';
import { renderWithProviders } from '../../../src/test-utils/render';

const mockPush = jest.fn();

jest.mock('expo-router', () => ({
  useRouter: () => ({ push: mockPush }),
}));

jest.mock('expo-camera', () => ({
  Camera: {
    requestCameraPermissionsAsync: jest.fn().mockResolvedValue({ status: 'granted' }),
  },
  CameraView: ({ onBarcodeScanned }: { onBarcodeScanned: (e: { data: string }) => void }) => {
    const React = require('react');
    return React.createElement('CameraView', {
      testID: 'camera',
      onPress: () => onBarcodeScanned({ data: 'kinhale://accept/tok-abc?pin=123456' }),
    });
  },
}));

const mockRequestPermissions = Camera.requestCameraPermissionsAsync as jest.MockedFunction<
  typeof Camera.requestCameraPermissionsAsync
>;

type PermissionResponse = Awaited<ReturnType<typeof Camera.requestCameraPermissionsAsync>>;

const grantedResponse = {
  status: 'granted',
  expires: 'never',
  granted: true,
  canAskAgain: true,
} as PermissionResponse;

const deniedResponse = {
  status: 'denied',
  expires: 'never',
  granted: false,
  canAskAgain: false,
} as PermissionResponse;

describe('ScanInvitationScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockRequestPermissions.mockResolvedValue(grantedResponse);
  });

  it('affiche le message permission refusée quand la caméra est refusée', async () => {
    mockRequestPermissions.mockResolvedValue(deniedResponse);

    renderWithProviders(<ScanInvitationScreen />);

    await waitFor(() => {
      expect(screen.getByText(/permission caméra refusée|camera permission denied/i)).toBeTruthy();
    });
  });

  it("navigue vers accept avec token et pin après scan d'un QR valide", async () => {
    renderWithProviders(<ScanInvitationScreen />);

    await waitFor(() => {
      expect(screen.getByTestId('camera')).toBeTruthy();
    });

    fireEvent.press(screen.getByTestId('camera'));

    await waitFor(() => {
      expect(mockPush).toHaveBeenCalledWith({
        pathname: '/caregivers/accept/[token]',
        params: { token: 'tok-abc', pin: '123456' },
      });
    });
  });
});
