import * as React from 'react';
import { Stack } from 'tamagui';

interface BreathOrbProps {
  accent?: string;
  size?: number;
}

// Animation discrète : 3 cercles concentriques qui « respirent ».
// Métaphore visuelle calme cohérente avec une app de suivi asthme. Désactivée
// automatiquement quand l'utilisateur a activé `prefers-reduced-motion` —
// l'orbe statique reste visible (juste sans le mouvement).
export function BreathOrb({
  accent = 'var(--maint, #5b8cc7)',
  size = 160,
}: BreathOrbProps): React.JSX.Element {
  const id = React.useId().replace(/[^a-zA-Z0-9-]/g, '');
  return (
    <Stack
      width={size}
      height={size}
      position="relative"
      alignItems="center"
      justifyContent="center"
      accessibilityElementsHidden
      accessibilityRole="image"
      accessibilityLabel=""
      pointerEvents="none"
    >
      {/* Animations en CSS pour bénéficier de la GPU côté web. RN ignore
          ces blocs <style> — sur mobile l'orbe sera simplement statique
          (acceptable, c'est décoratif). */}
      <style>{`
        @keyframes kinhale-breath-${id} {
          0%, 100% { transform: scale(0.85); opacity: 0.65; }
          50% { transform: scale(1); opacity: 1; }
        }
        @keyframes kinhale-auth-spin {
          to { transform: rotate(360deg); }
        }
        @media (prefers-reduced-motion: reduce) {
          .kinhale-breath-ring-${id} { animation: none !important; }
        }
      `}</style>
      {[1, 2, 3].map((i) => (
        <div
          key={i}
          className={`kinhale-breath-ring-${id}`}
          style={{
            position: 'absolute',
            inset: `${(i - 1) * 14}%`,
            borderRadius: '50%',
            border: `1px solid color-mix(in oklch, ${accent} ${30 - i * 6}%, transparent)`,
            animation: `kinhale-breath-${id} ${4 + i * 0.4}s ease-in-out infinite`,
            animationDelay: `${i * -0.3}s`,
          }}
        />
      ))}
      <div
        style={{
          width: '32%',
          height: '32%',
          borderRadius: '50%',
          background: `radial-gradient(circle at 35% 30%, color-mix(in oklch, ${accent} 60%, white), ${accent})`,
          boxShadow: `0 8px 28px color-mix(in oklch, ${accent} 32%, transparent)`,
        }}
      />
    </Stack>
  );
}
