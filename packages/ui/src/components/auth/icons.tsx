// Icônes locales aux composants auth. Restent ici (et non dans
// `packages/ui/src/icons/index.tsx`) pour ne dépendre que de ce qui est
// utilisé par les écrans d'authentification — chaque icône a un viewBox
// 24×24 (sauf Check 14×14 historique) et accepte size + color.

import * as React from 'react';

interface IconProps {
  size?: number;
  color?: string;
}

const baseStroke = {
  fill: 'none' as const,
  stroke: 'currentColor' as const,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
};

export function EnvelopeIcon({ size = 18, color = 'currentColor' }: IconProps): React.JSX.Element {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      {...baseStroke}
      stroke={color}
      strokeWidth="1.6"
    >
      <rect x="3" y="6" width="18" height="13" rx="2.5" />
      <path d="M3.5 7.5l8.5 6 8.5-6" />
    </svg>
  );
}

export function EnvelopeOpenIcon({
  size = 28,
  color = 'currentColor',
}: IconProps): React.JSX.Element {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      {...baseStroke}
      stroke={color}
      strokeWidth="1.6"
    >
      <path d="M3 10.5L12 4l9 6.5V19a2 2 0 01-2 2H5a2 2 0 01-2-2v-8.5z" />
      <path d="M3 10.5l9 6.5 9-6.5" />
    </svg>
  );
}

export function LockIcon({ size = 14, color = 'currentColor' }: IconProps): React.JSX.Element {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      {...baseStroke}
      stroke={color}
      strokeWidth="1.6"
    >
      <rect x="5" y="11" width="14" height="10" rx="2" />
      <path d="M8 11V8a4 4 0 018 0v3" />
    </svg>
  );
}

export function CheckSmallIcon({
  size = 12,
  color = 'currentColor',
}: IconProps): React.JSX.Element {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 14 14"
      {...baseStroke}
      stroke={color}
      strokeWidth="2"
    >
      <path d="M2.5 7.5l3 3 6-6" />
    </svg>
  );
}

// Spinner — anneau qui tourne. Ne dépend pas d'une keyframe globale (la
// définition est inline avec un id unique pour rester portable RN web/mobile).
export function SpinnerIcon({ size = 18, color = 'currentColor' }: IconProps): React.JSX.Element {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke={color}
      strokeWidth="2"
      strokeLinecap="round"
      style={{ animation: 'kinhale-auth-spin 0.9s linear infinite' }}
    >
      <path d="M12 3a9 9 0 019 9" />
      <path d="M21 12a9 9 0 01-9 9" opacity="0.35" />
      <path d="M12 21a9 9 0 01-9-9" opacity="0.15" />
    </svg>
  );
}
