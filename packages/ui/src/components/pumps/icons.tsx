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

export function ScanIcon({ size = 18, color = 'currentColor' }: IconProps): React.JSX.Element {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      {...baseStroke}
      stroke={color}
      strokeWidth="1.6"
    >
      <path d="M3 7V5a2 2 0 012-2h2M21 7V5a2 2 0 00-2-2h-2M3 17v2a2 2 0 002 2h2M21 17v2a2 2 0 01-2 2h-2" />
      <path d="M7 8v8M11 8v8M15 8v8M19 8v8" strokeWidth="1.4" />
    </svg>
  );
}

export function MapPinIcon({ size = 14, color = 'currentColor' }: IconProps): React.JSX.Element {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 14 14"
      {...baseStroke}
      stroke={color}
      strokeWidth="1.5"
    >
      <path d="M7 1.5C4.8 1.5 3 3.3 3 5.5c0 3 4 7 4 7s4-4 4-7c0-2.2-1.8-4-4-4z" />
      <circle cx="7" cy="5.5" r="1.4" />
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

export function BookmarkIcon({ size = 14, color = 'currentColor' }: IconProps): React.JSX.Element {
  return (
    <svg width={size} height={size} viewBox="0 0 14 14" fill={color}>
      <path d="M3 1.5h8v11l-4-2.5-4 2.5z" />
    </svg>
  );
}

export function CounterIcon({ size = 16, color = 'currentColor' }: IconProps): React.JSX.Element {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 16 16"
      {...baseStroke}
      stroke={color}
      strokeWidth="1.5"
    >
      <rect x="2" y="3" width="12" height="10" rx="2" />
      <path d="M5 8h2M9 8h2M5 11h2" />
    </svg>
  );
}

export function BellIcon({ size = 16, color = 'currentColor' }: IconProps): React.JSX.Element {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 16 16"
      {...baseStroke}
      stroke={color}
      strokeWidth="1.5"
    >
      <path d="M8 2.5v1M4 13h8M5 13V8.5a3 3 0 016 0V13M7 14.5h2" />
    </svg>
  );
}

export function ShareIcon({ size = 16, color = 'currentColor' }: IconProps): React.JSX.Element {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 16 16"
      {...baseStroke}
      stroke={color}
      strokeWidth="1.5"
    >
      <circle cx="4" cy="8" r="2" />
      <circle cx="12" cy="4" r="2" />
      <circle cx="12" cy="12" r="2" />
      <path d="M5.7 7l4.6-2.5M5.7 9l4.6 2.5" />
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
      <path d="M5 3.5L8.5 7 5 10.5" />
    </svg>
  );
}

export function CloseIcon({ size = 16, color = 'currentColor' }: IconProps): React.JSX.Element {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 16 16"
      {...baseStroke}
      stroke={color}
      strokeWidth="1.6"
    >
      <path d="M4 4l8 8M12 4l-8 8" />
    </svg>
  );
}

export function MinusIcon({ size = 14, color = 'currentColor' }: IconProps): React.JSX.Element {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 14 14"
      {...baseStroke}
      stroke={color}
      strokeWidth="1.8"
    >
      <path d="M2 7h10" />
    </svg>
  );
}

export function SmallClockIcon({
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
      strokeWidth="1.5"
    >
      <circle cx="7" cy="7" r="5.5" />
      <path d="M7 4v3l2 1.5" />
    </svg>
  );
}

/**
 * Glyph illustratif pour la palette d'état vide. Plus chargé que
 * `InhalerMaintIcon` — silhouette d'inhalateur stylisée pour la
 * composition `EmptyInhalerArt`.
 */
export function EmptyInhalerGlyph({
  size = 24,
  color = 'currentColor',
  fillBody,
  fillSpacer,
  hashStroke,
}: IconProps & {
  fillBody?: string;
  fillSpacer?: string;
  hashStroke?: string;
}): React.JSX.Element {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 48 48"
      {...baseStroke}
      stroke={color}
      strokeWidth="1.6"
    >
      <rect x="13" y="18" width="18" height="22" rx="3" fill={fillBody ?? 'none'} />
      <path d="M31 24h6a4 4 0 010 8h-6" fill={fillSpacer ?? 'none'} />
      <path d="M18 10v8M22 10v8M26 10v8" />
      <path d="M17 27h10M17 31h10M17 35h6" stroke={hashStroke ?? color} strokeWidth="1.2" />
    </svg>
  );
}
