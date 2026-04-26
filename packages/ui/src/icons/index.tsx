import * as React from 'react';

interface IconProps {
  size?: number;
  color?: string;
}

const baseProps = {
  fill: 'none' as const,
  stroke: 'currentColor' as const,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
};

export function InhalerMaintIcon({
  size = 18,
  color = 'currentColor',
}: IconProps): React.JSX.Element {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      {...baseProps}
      stroke={color}
      strokeWidth="1.6"
    >
      <rect x="6" y="9" width="9" height="11" rx="2" />
      <path d="M15 12h3a2 2 0 010 4h-3" />
      <path d="M9 5v4M12 5v4" />
    </svg>
  );
}

export function InhalerRescueIcon({
  size = 18,
  color = 'currentColor',
}: IconProps): React.JSX.Element {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      {...baseProps}
      stroke={color}
      strokeWidth="1.6"
    >
      <path d="M5 13l5-5 4 4 5-5" />
      <circle cx="10.5" cy="10.5" r="2" />
    </svg>
  );
}

export function CheckIcon({ size = 14, color = 'currentColor' }: IconProps): React.JSX.Element {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 14 14"
      {...baseProps}
      stroke={color}
      strokeWidth="2"
    >
      <path d="M2.5 7.5l3 3 6-6" />
    </svg>
  );
}

export function ClockIcon({ size = 14, color = 'currentColor' }: IconProps): React.JSX.Element {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 14 14"
      {...baseProps}
      stroke={color}
      strokeWidth="1.5"
    >
      <circle cx="7" cy="7" r="5.5" />
      <path d="M7 4v3.2l2 1.3" />
    </svg>
  );
}

export function AlertIcon({ size = 14, color = 'currentColor' }: IconProps): React.JSX.Element {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 14 14"
      {...baseProps}
      stroke={color}
      strokeWidth="1.6"
    >
      <path d="M7 2.5L12.5 11.5h-11L7 2.5z" />
      <path d="M7 6v2.5M7 10v.01" />
    </svg>
  );
}

export function ArrowRightIcon({
  size = 14,
  color = 'currentColor',
}: IconProps): React.JSX.Element {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 14 14"
      {...baseProps}
      stroke={color}
      strokeWidth="1.6"
    >
      <path d="M3 7h8M7.5 3.5L11 7l-3.5 3.5" />
    </svg>
  );
}
