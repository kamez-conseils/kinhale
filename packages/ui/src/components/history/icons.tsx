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

export function FilterIcon({ size = 14, color = 'currentColor' }: IconProps): React.JSX.Element {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 14 14"
      {...baseStroke}
      stroke={color}
      strokeWidth="1.5"
    >
      <path d="M2 4h10M4 7h6M5.5 10h3" />
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

export function ChevronLeftIcon({
  size = 14,
  color = 'currentColor',
}: IconProps): React.JSX.Element {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 14 14"
      {...baseStroke}
      stroke={color}
      strokeWidth="1.6"
    >
      <path d="M9 3L5 7l4 4" />
    </svg>
  );
}

export function ChevronRightIcon({
  size = 14,
  color = 'currentColor',
}: IconProps): React.JSX.Element {
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

export function PlusIconSm({ size = 14, color = 'currentColor' }: IconProps): React.JSX.Element {
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
