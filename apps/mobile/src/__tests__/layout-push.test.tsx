import React from 'react';
import { render } from '@testing-library/react-native';

jest.mock('expo-notifications');
jest.mock('expo-device');

jest.mock('expo-router', () => ({
  Stack: () => null,
}));

jest.mock('../hooks/use-push-registration', () => ({
  usePushRegistration: jest.fn(),
}));

// Mock i18n + tamagui to avoid native module issues in test env
jest.mock('../lib/i18n', () => ({}));
jest.mock('../lib/tamagui.config', () => ({}));
jest.mock('tamagui', () => ({
  TamaguiProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  createTamagui: jest.fn(() => ({})),
}));
jest.mock('react-i18next', () => ({
  I18nextProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

describe('RootLayout — push integration', () => {
  it('appelle usePushRegistration au montage', () => {
    const { usePushRegistration } = require('../hooks/use-push-registration') as {
      usePushRegistration: jest.Mock;
    };

    const RootLayout = require('../../app/_layout').default as React.ComponentType;

    render(<RootLayout />);

    expect(usePushRegistration).toHaveBeenCalled();
  });
});
