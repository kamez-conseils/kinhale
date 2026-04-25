import React from 'react';
import { screen, act } from '@testing-library/react';
import SettingsAboutPage from '../page';
import { renderWithProviders } from '../../../../test-utils/render';

async function flushPromises(): Promise<void> {
  await Promise.resolve();
  await Promise.resolve();
  await Promise.resolve();
  await Promise.resolve();
}

describe('SettingsAboutPage (web)', () => {
  jest.setTimeout(15000);

  it('affiche le DisclaimerBanner complet (RM27)', async () => {
    jest.useFakeTimers();
    try {
      renderWithProviders(<SettingsAboutPage />);
      await act(async () => {
        await flushPromises();
      });
      expect(screen.getByTestId('disclaimer-banner-full')).toBeTruthy();
    } finally {
      jest.clearAllTimers();
      jest.useRealTimers();
    }
  });

  it('affiche la version applicative et la licence AGPL v3', async () => {
    jest.useFakeTimers();
    try {
      renderWithProviders(<SettingsAboutPage />);
      await act(async () => {
        await flushPromises();
      });
      expect(screen.getByTestId('settings-about-version')).toBeTruthy();
      expect(screen.getByText(/AGPL v3/)).toBeTruthy();
    } finally {
      jest.clearAllTimers();
      jest.useRealTimers();
    }
  });

  it('affiche le lien vers la politique de confidentialité', async () => {
    jest.useFakeTimers();
    try {
      renderWithProviders(<SettingsAboutPage />);
      await act(async () => {
        await flushPromises();
      });
      // Le label est unique entre Card heading + lien — au moins une occurrence.
      expect(
        screen.getAllByText(/politique de confidentialité|privacy policy/i).length,
      ).toBeGreaterThan(0);
    } finally {
      jest.clearAllTimers();
      jest.useRealTimers();
    }
  });
});
