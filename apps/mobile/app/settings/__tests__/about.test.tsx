import React from 'react';
import { screen, waitFor } from '@testing-library/react-native';
import SettingsAboutScreen from '../about';
import { renderWithProviders } from '../../../src/test-utils/render';

describe('SettingsAboutScreen (mobile)', () => {
  jest.setTimeout(15000);

  it('affiche le DisclaimerBanner complet (RM27)', async () => {
    renderWithProviders(<SettingsAboutScreen />);
    await waitFor(() => {
      expect(screen.getByTestId('disclaimer-banner-full')).toBeTruthy();
    });
  });

  it('affiche la version applicative et la licence AGPL v3', async () => {
    renderWithProviders(<SettingsAboutScreen />);
    await waitFor(() => {
      expect(screen.getByTestId('settings-about-version')).toBeTruthy();
    });
    expect(screen.getByText(/AGPL v3/)).toBeTruthy();
  });

  it('affiche les liens licence + source + politique de confidentialité', async () => {
    renderWithProviders(<SettingsAboutScreen />);
    await waitFor(() => {
      expect(
        screen.getByLabelText(/voir le texte de la licence|read the licence text/i),
      ).toBeTruthy();
    });
    expect(screen.getByLabelText(/dépôt public|public repository/i)).toBeTruthy();
    expect(screen.getByLabelText(/politique de confidentialité|privacy policy/i)).toBeTruthy();
  });
});
