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

// Mock le badge de statut : ce test ne teste pas son rendu mais monte
// RootLayout qui l'instancie ; le badge importe `tamagui` et `react-i18next`
// qui ne sont que partiellement mockés ici.
jest.mock('../components/SyncStatusBadge', () => ({
  SyncStatusBadge: () => null,
}));

// Mock des bootstraps sync/rappels : pareil, hors scope du test (qui ne
// vérifie que l'appel à usePushRegistration), et ces composants tirent
// des imports natifs (WebSocket, expo-notifications).
jest.mock('../lib/sync', () => ({
  RelaySyncBootstrap: () => null,
  RemindersBootstrap: () => null,
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
