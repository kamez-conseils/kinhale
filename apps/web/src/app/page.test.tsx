import { render, screen } from '@testing-library/react';
import { I18nextProvider } from 'react-i18next';
import { TamaguiProvider } from 'tamagui';
import i18n from '../lib/i18n';
import config from '../lib/tamagui.config';
import HomePage from './page';

function Wrapper({ children }: { children: React.ReactNode }) {
  return (
    <I18nextProvider i18n={i18n}>
      <TamaguiProvider config={config} defaultTheme="light">
        {children}
      </TamaguiProvider>
    </I18nextProvider>
  );
}

describe('HomePage', () => {
  it('affiche le titre Kinhale', () => {
    render(<HomePage />, { wrapper: Wrapper });
    expect(screen.getByText('Kinhale')).toBeInTheDocument();
  });

  it('affiche le sous-titre en français par défaut', () => {
    render(<HomePage />, { wrapper: Wrapper });
    expect(screen.getByText('Coordonnez les soins de votre enfant')).toBeInTheDocument();
  });
});
