import React from 'react';
import { screen, act } from '@testing-library/react';
import { DisclaimerFooter, DisclaimerBanner } from '../DisclaimerFooter';
import { renderWithProviders } from '../../test-utils/render';

async function flushPromises(): Promise<void> {
  await Promise.resolve();
  await Promise.resolve();
  await Promise.resolve();
  await Promise.resolve();
}

describe('DisclaimerFooter (web)', () => {
  jest.setTimeout(15000);

  it('affiche la version courte par défaut avec un rôle status', async () => {
    jest.useFakeTimers();
    try {
      renderWithProviders(<DisclaimerFooter />);
      await act(async () => {
        await flushPromises();
      });
      expect(screen.getByTestId('disclaimer-footer-short')).toBeTruthy();
      expect(screen.getByText(/journal d.aidants|caregiver journal/i)).toBeTruthy();
      // Rôle ARIA permettant la lecture par lecteurs d'écran sans interrompre.
      expect(screen.getByRole('note')).toBeTruthy();
    } finally {
      jest.clearAllTimers();
      jest.useRealTimers();
    }
  });

  it("expose un aria-label i18n pour les lecteurs d'écran", async () => {
    jest.useFakeTimers();
    try {
      renderWithProviders(<DisclaimerFooter />);
      await act(async () => {
        await flushPromises();
      });
      const node = screen.getByLabelText(
        /avertissement non.dispositif|non.medical.device disclaimer/i,
      );
      expect(node).toBeTruthy();
    } finally {
      jest.clearAllTimers();
      jest.useRealTimers();
    }
  });
});

describe('DisclaimerBanner (web)', () => {
  jest.setTimeout(15000);

  it('affiche le texte complet RM27', async () => {
    jest.useFakeTimers();
    try {
      renderWithProviders(<DisclaimerBanner />);
      await act(async () => {
        await flushPromises();
      });
      expect(screen.getByTestId('disclaimer-banner-full')).toBeTruthy();
      expect(
        screen.getByText(/ne remplace pas un avis médical|does not replace medical advice/i),
      ).toBeTruthy();
      expect(screen.getByText(/dispositif médical|medical device/i)).toBeTruthy();
    } finally {
      jest.clearAllTimers();
      jest.useRealTimers();
    }
  });

  it('ne contient aucune recommandation médicale (RM8 + RM27)', async () => {
    jest.useFakeTimers();
    try {
      renderWithProviders(<DisclaimerBanner />);
      await act(async () => {
        await flushPromises();
      });
      const banner = screen.getByTestId('disclaimer-banner-full');
      const text = banner.textContent ?? '';
      // Aucune phrase imperative type « appelez votre médecin / call your doctor »
      // ne doit apparaître. Le disclaimer reste strictement informatif.
      expect(text).not.toMatch(/appelez|call your|consult.+immediately|seek emergency/i);
    } finally {
      jest.clearAllTimers();
      jest.useRealTimers();
    }
  });
});
