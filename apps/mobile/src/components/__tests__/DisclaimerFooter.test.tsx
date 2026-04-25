import React from 'react';
import { screen, waitFor } from '@testing-library/react-native';
import { DisclaimerFooter, DisclaimerBanner } from '../DisclaimerFooter';
import { renderWithProviders } from '../../test-utils/render';

describe('DisclaimerFooter (mobile)', () => {
  jest.setTimeout(15000);

  it('affiche la version courte avec accessibilityLabel i18n', async () => {
    renderWithProviders(<DisclaimerFooter />);
    await waitFor(() => {
      expect(screen.getByTestId('disclaimer-footer-short')).toBeTruthy();
    });
    expect(screen.getByText(/journal d.aidants|caregiver journal/i)).toBeTruthy();
    // Le label vocal doit être traduit (pas la chaîne brute "ariaLabel").
    const node = screen.getByLabelText(
      /avertissement non.dispositif|non.medical.device disclaimer/i,
    );
    expect(node).toBeTruthy();
  });
});

describe('DisclaimerBanner (mobile)', () => {
  jest.setTimeout(15000);

  it('affiche le texte complet RM27', async () => {
    renderWithProviders(<DisclaimerBanner />);
    await waitFor(() => {
      expect(screen.getByTestId('disclaimer-banner-full')).toBeTruthy();
    });
    expect(
      screen.getByText(/ne remplace pas un avis médical|does not replace medical advice/i),
    ).toBeTruthy();
    expect(screen.getByText(/dispositif médical|medical device/i)).toBeTruthy();
  });

  it('ne contient aucune recommandation médicale (RM8 + RM27)', async () => {
    renderWithProviders(<DisclaimerBanner />);
    await waitFor(() => {
      expect(screen.getByTestId('disclaimer-banner-full')).toBeTruthy();
    });
    // Le texte affiché ne doit comporter aucune injonction médicale type
    // « appelez votre médecin / call your doctor / seek emergency ».
    expect(screen.queryByText(/appelez|call your|consult.+immediately|seek emergency/i)).toBeNull();
  });
});
