import type { Metadata } from 'next';
import { Inter, Inter_Tight, JetBrains_Mono, DM_Sans, Source_Serif_4 } from 'next/font/google';
import { Providers } from '../providers';

// Polices "clinical-calm" — alignées sur la maquette de référence
// docs/design/handoffs/2026-04-26-clinical-calm/project/tokens.css
//   --k-display = "Inter Tight"   → titres
//   --k-text    = "Inter"          → UI courante
//   --k-mono    = "JetBrains Mono" → pills monospace (e-mails, hash, codes)
// Source Serif 4 + DM Sans sont chargées pour les variantes sérif / humanist
// (panneau Tweaks à venir dans Réglages).
//
// `next/font/google` télécharge et auto-héberge les polices au build, donc
// pas de requête runtime vers fonts.googleapis.com — compatibilité CSP
// stricte (KIN-102) et pas de fuite Referer vers Google.
const interTight = Inter_Tight({
  subsets: ['latin', 'latin-ext'],
  display: 'swap',
  weight: ['400', '500', '600'],
  variable: '--font-display',
});
const inter = Inter({
  subsets: ['latin', 'latin-ext'],
  display: 'swap',
  weight: ['400', '500', '600'],
  variable: '--font-body',
});
const jetbrainsMono = JetBrains_Mono({
  subsets: ['latin', 'latin-ext'],
  display: 'swap',
  weight: ['400', '500'],
  variable: '--font-mono',
});
const sourceSerif = Source_Serif_4({
  subsets: ['latin', 'latin-ext'],
  display: 'swap',
  weight: ['400', '500', '600'],
  variable: '--font-serif',
});
const dmSans = DM_Sans({
  subsets: ['latin', 'latin-ext'],
  display: 'swap',
  weight: ['400', '500', '600'],
  variable: '--font-humanist',
});

export const metadata: Metadata = {
  title: 'Kinhale',
  description: 'Coordonnez les soins de votre enfant asthmatique',
};

export default function RootLayout({ children }: { children: React.ReactNode }): React.JSX.Element {
  const fontVariables = [
    interTight.variable,
    inter.variable,
    jetbrainsMono.variable,
    sourceSerif.variable,
    dmSans.variable,
  ].join(' ');
  return (
    <html lang="fr" className={fontVariables}>
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
