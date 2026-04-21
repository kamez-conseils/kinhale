import { render, screen } from '@testing-library/react-native'
import { I18nextProvider } from 'react-i18next'
import { TamaguiProvider } from 'tamagui'
import type { ReactNode } from 'react'
import i18n from '../lib/i18n'
import config from '../lib/tamagui.config'
import HomeScreen from './HomeScreen'

function Wrapper({ children }: { children: ReactNode }): JSX.Element {
  return (
    <I18nextProvider i18n={i18n}>
      <TamaguiProvider config={config} defaultTheme="light">
        {children}
      </TamaguiProvider>
    </I18nextProvider>
  )
}

describe('HomeScreen', () => {
  it('affiche le titre Kinhale', () => {
    render(<HomeScreen />, { wrapper: Wrapper })
    expect(screen.getByText('Kinhale')).toBeTruthy()
  })

  it('affiche le sous-titre en français par défaut', () => {
    render(<HomeScreen />, { wrapper: Wrapper })
    expect(screen.getByText('Coordonnez les soins de votre enfant')).toBeTruthy()
  })
})
