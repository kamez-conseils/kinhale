import * as React from 'react';
import { Stack, Text, YStack } from 'tamagui';

export interface AdherenceSparklineProps {
  /** Pourcentages quotidiens (0-100). */
  data: ReadonlyArray<number>;
  label: string;
  /** Identifiant unique pour le gradient SVG (évite les collisions inter-instances). */
  gradientId?: string;
  mode?: 'mobile' | 'web';
}

const DEFAULT_HEIGHT = 72;

export function AdherenceSparkline({
  data,
  label,
  gradientId = 'kinhale-adherence-grad',
  mode = 'web',
}: AdherenceSparklineProps): React.JSX.Element {
  const w = mode === 'web' ? 360 : 290;
  const h = DEFAULT_HEIGHT;
  const dx = data.length > 1 ? w / (data.length - 1) : 0;
  const points = data
    .map((v, i) => `${i * dx},${h - (Math.max(0, Math.min(100, v)) / 100) * h}`)
    .join(' ');
  const areaPath = `M0,${h} L${points.replace(/\s/g, ' L')} L${w},${h} Z`;

  return (
    <YStack>
      <Text
        fontSize={11}
        color="$colorMore"
        textTransform="uppercase"
        letterSpacing={0.66}
        fontWeight="600"
        marginBottom={8}
      >
        {label}
      </Text>
      <svg
        width={w}
        height={h}
        viewBox={`0 0 ${w} ${h}`}
        style={{ display: 'block', overflow: 'visible' }}
      >
        <defs>
          <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--maint)" stopOpacity="0.3" />
            <stop offset="100%" stopColor="var(--maint)" stopOpacity="0" />
          </linearGradient>
        </defs>
        <line x1="0" y1={h} x2={w} y2={h} stroke="var(--borderColor)" strokeWidth="0.5" />
        <path d={areaPath} fill={`url(#${gradientId})`} />
        <polyline
          points={points}
          fill="none"
          stroke="var(--maint)"
          strokeWidth="1.6"
          strokeLinejoin="round"
        />
        {data.map((v, i) =>
          v < 100 ? (
            <circle
              key={i}
              cx={i * dx}
              cy={h - (v / 100) * h}
              r="2.2"
              fill={v === 0 ? 'var(--miss)' : 'var(--amber)'}
            />
          ) : null,
        )}
      </svg>
    </YStack>
  );
}

export interface RescueBarsProps {
  /** Nombre de prises de secours par jour. */
  data: ReadonlyArray<number>;
  label: string;
  mode?: 'mobile' | 'web';
}

export function RescueBars({ data, label, mode = 'web' }: RescueBarsProps): React.JSX.Element {
  const w = mode === 'web' ? 360 : 290;
  const h = 56;
  const bw = data.length > 0 ? w / data.length - 2 : 0;
  const max = data.length > 0 ? Math.max(...data, 1) : 1;
  return (
    <YStack>
      <Text
        fontSize={11}
        color="$colorMore"
        textTransform="uppercase"
        letterSpacing={0.66}
        fontWeight="600"
        marginBottom={8}
      >
        {label}
      </Text>
      <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} style={{ display: 'block' }}>
        <line
          x1="0"
          y1={h - 0.5}
          x2={w}
          y2={h - 0.5}
          stroke="var(--borderColor)"
          strokeWidth="0.5"
        />
        {data.map((v, i) => {
          const bh = (v / max) * (h - 4);
          const x = i * (bw + 2);
          return v > 0 ? (
            <rect key={i} x={x} y={h - bh} width={bw} height={bh} rx="1.5" fill="var(--rescue)" />
          ) : (
            <rect
              key={i}
              x={x}
              y={h - 1.5}
              width={bw}
              height="1.5"
              rx="0.5"
              fill="var(--borderColorStrong)"
            />
          );
        })}
      </svg>
    </YStack>
  );
}

export interface ChartsCardProps {
  adherence: ReadonlyArray<number>;
  rescue: ReadonlyArray<number>;
  adherenceLabel: string;
  rescueLabel: string;
  mode?: 'mobile' | 'web';
}

export function ChartsCard({
  adherence,
  rescue,
  adherenceLabel,
  rescueLabel,
  mode = 'web',
}: ChartsCardProps): React.JSX.Element {
  return (
    <YStack
      backgroundColor="$surface"
      borderWidth={0.5}
      borderColor="$borderColor"
      borderRadius={14}
      padding={14}
      gap={16}
    >
      <AdherenceSparkline data={adherence} label={adherenceLabel} mode={mode} />
      <Stack height={1} backgroundColor="$borderColor" />
      <RescueBars data={rescue} label={rescueLabel} mode={mode} />
    </YStack>
  );
}
