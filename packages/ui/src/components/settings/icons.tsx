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

export function BellIcon({ size = 13, color = 'currentColor' }: IconProps): React.JSX.Element {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      {...baseStroke}
      stroke={color}
      strokeWidth="1.6"
    >
      <path d="M5 17h14l-1.5-2V11a5.5 5.5 0 00-11 0v4L5 17z" />
      <path d="M10 20a2 2 0 004 0" />
    </svg>
  );
}

export function PaintIcon({ size = 13, color = 'currentColor' }: IconProps): React.JSX.Element {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      {...baseStroke}
      stroke={color}
      strokeWidth="1.6"
    >
      <circle cx="12" cy="12" r="9" />
      <circle cx="8" cy="9" r="1.2" fill={color} stroke="none" />
      <circle cx="16" cy="9" r="1.2" fill={color} stroke="none" />
      <circle cx="9" cy="14" r="1.2" fill={color} stroke="none" />
      <path d="M14 14a4 4 0 003 3" />
    </svg>
  );
}

export function ShieldIcon({ size = 13, color = 'currentColor' }: IconProps): React.JSX.Element {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      {...baseStroke}
      stroke={color}
      strokeWidth="1.6"
    >
      <path d="M12 2L4 5v6c0 5 3.5 9 8 11 4.5-2 8-6 8-11V5l-8-3z" />
    </svg>
  );
}

export function InfoIcon({ size = 13, color = 'currentColor' }: IconProps): React.JSX.Element {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      {...baseStroke}
      stroke={color}
      strokeWidth="1.6"
    >
      <circle cx="12" cy="12" r="9" />
      <path d="M12 8v.01M12 11v5" />
    </svg>
  );
}

export function ChevronIcon({ size = 13, color = 'currentColor' }: IconProps): React.JSX.Element {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 14 14"
      {...baseStroke}
      stroke={color}
      strokeWidth="1.6"
    >
      <path d="M5 3l4 4-4 4" />
    </svg>
  );
}

export function ExternalIcon({ size = 12, color = 'currentColor' }: IconProps): React.JSX.Element {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 12 12"
      {...baseStroke}
      stroke={color}
      strokeWidth="1.5"
    >
      <path d="M5 3H3v6h6V7M7 3h2v2M9 3l-4 4" />
    </svg>
  );
}
