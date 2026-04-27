import * as React from 'react';

interface IconProps {
  size?: number;
  color?: string;
}

const baseStroke = {
  fill: 'none' as const,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
};

export function PlusIcon({ size = 14, color = 'currentColor' }: IconProps): React.JSX.Element {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 14 14"
      {...baseStroke}
      stroke={color}
      strokeWidth="1.8"
    >
      <path d="M7 2v10M2 7h10" />
    </svg>
  );
}

export function ShieldIcon({ size = 14, color = 'currentColor' }: IconProps): React.JSX.Element {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 14 14"
      {...baseStroke}
      stroke={color}
      strokeWidth="1.5"
    >
      <path d="M7 1.5L2 3v3.5c0 3 2.5 5.5 5 6 2.5-.5 5-3 5-6V3L7 1.5z" />
    </svg>
  );
}

export function MoreIcon({ size = 16, color = 'currentColor' }: IconProps): React.JSX.Element {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill={color}>
      <circle cx="3.5" cy="8" r="1.4" />
      <circle cx="8" cy="8" r="1.4" />
      <circle cx="12.5" cy="8" r="1.4" />
    </svg>
  );
}

export function EnvelopeIcon({ size = 14, color = 'currentColor' }: IconProps): React.JSX.Element {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 14 14"
      {...baseStroke}
      stroke={color}
      strokeWidth="1.5"
    >
      <rect x="2" y="3" width="10" height="8" rx="1.5" />
      <path d="M2.5 4l4.5 3.5L11.5 4" />
    </svg>
  );
}
