import React from 'react';
import { screen, fireEvent, waitFor } from '@testing-library/react-native';
import AuthScreen from '../index';
import { renderWithProviders } from '../../../src/test-utils/render';

jest.mock('@kinhale/crypto');
jest.mock('@kinhale/sync');

jest.mock('expo-router', () => ({
  useRouter: () => ({ push: jest.fn(), replace: jest.fn() }),
  useLocalSearchParams: () => ({}),
}));

jest.mock('../../../src/lib/api-client', () => ({
  apiFetch: jest.fn().mockResolvedValue({}),
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  ApiError: class MockApiError extends Error {
    status: number;
    constructor(status: number, message: string) {
      super(message);
      this.status = status;
    }
  },
}));

describe('AuthScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders email input', () => {
    renderWithProviders(<AuthScreen />);
    expect(screen.getByPlaceholderText(/email/i)).toBeTruthy();
  });

  it('does not call API when email is empty', async () => {
    const { apiFetch } = jest.requireMock('../../../src/lib/api-client') as {
      apiFetch: jest.Mock;
    };
    renderWithProviders(<AuthScreen />);
    const btn = screen.getByTestId('submit-btn');
    // Button exists but pressing it with no email must not call the API
    fireEvent.press(btn);
    await new Promise((r) => setTimeout(r, 50));
    expect(apiFetch).not.toHaveBeenCalled();
  });

  it('calls magic-link API on submit', async () => {
    const { apiFetch } = jest.requireMock('../../../src/lib/api-client') as {
      apiFetch: jest.Mock;
    };
    renderWithProviders(<AuthScreen />);
    const input = screen.getByPlaceholderText(/email/i);
    fireEvent.changeText(input, 'test@example.com');
    const btn = screen.getByTestId('submit-btn');
    fireEvent.press(btn);
    await waitFor(() => {
      expect(apiFetch).toHaveBeenCalledWith(
        '/auth/magic-link',
        expect.objectContaining({ method: 'POST' }),
      );
    });
  });

  it('shows confirmation text after submission', async () => {
    renderWithProviders(<AuthScreen />);
    const input = screen.getByPlaceholderText(/email/i);
    fireEvent.changeText(input, 'test@example.com');
    fireEvent.press(screen.getByTestId('submit-btn'));
    await waitFor(() => {
      expect(screen.getByText(/lien|link|envoyé|sent/i)).toBeTruthy();
    });
  });
});
