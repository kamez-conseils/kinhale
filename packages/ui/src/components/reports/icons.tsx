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

export function CalendarIcon({ size = 14, color = 'currentColor' }: IconProps): React.JSX.Element {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 14 14"
      {...baseStroke}
      stroke={color}
      strokeWidth="1.4"
    >
      <rect x="2" y="3" width="10" height="9" rx="1.5" />
      <path d="M2 6h10M5 1.5v3M9 1.5v3" />
    </svg>
  );
}

export function DownloadIcon({ size = 14, color = 'currentColor' }: IconProps): React.JSX.Element {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 14 14"
      {...baseStroke}
      stroke={color}
      strokeWidth="1.5"
    >
      <path d="M7 2v7M4 6.5l3 3 3-3M2.5 11.5h9" />
    </svg>
  );
}

export function ShareIcon({ size = 14, color = 'currentColor' }: IconProps): React.JSX.Element {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 14 14"
      {...baseStroke}
      stroke={color}
      strokeWidth="1.5"
    >
      <path d="M7 9V2M4.5 4.5L7 2l2.5 2.5M3 9v3a1 1 0 001 1h6a1 1 0 001-1V9" />
    </svg>
  );
}
