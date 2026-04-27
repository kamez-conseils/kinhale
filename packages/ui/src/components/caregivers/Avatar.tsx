import * as React from 'react';
import { Stack, Text } from 'tamagui';

export interface AvatarProps {
  /** Initiales (1-2 caractères). Centré dans l'avatar. */
  initials: string;
  /** Hue (0-360) pour générer un fond déterministe via `oklch(85% 0.06 hue)`. */
  hue: number;
  /** Taille du cercle en px. Le ratio texte/cercle reste constant. */
  size?: number;
  /** Pastille verte « online » en bas-droite. */
  online?: boolean;
  /** Cercle pointillé ambré pour les invitations en attente. */
  pending?: boolean;
}

export function Avatar({
  initials,
  hue,
  size = 40,
  online = false,
  pending = false,
}: AvatarProps): React.JSX.Element {
  const halfSize = size / 2;
  const dotSize = Math.round(size * 0.28);
  return (
    <Stack position="relative" flexShrink={0} width={size} height={size}>
      <Stack
        width={size}
        height={size}
        borderRadius={halfSize}
        alignItems="center"
        justifyContent="center"
        opacity={pending ? 0.6 : 1}
        borderWidth={pending ? 1.5 : 0}
        borderStyle={pending ? 'dashed' : 'solid'}
        style={{
          background: `oklch(85% 0.06 ${hue})`,
          ...(pending
            ? {
                borderColor: 'color-mix(in oklch, var(--amber) 60%, transparent)',
              }
            : {}),
        }}
      >
        <Text
          fontSize={Math.round(size * 0.36)}
          fontWeight="600"
          letterSpacing={0.4}
          style={{ color: `oklch(35% 0.10 ${hue})` }}
        >
          {initials}
        </Text>
      </Stack>
      {online && (
        <Stack
          position="absolute"
          bottom={0}
          right={0}
          width={dotSize}
          height={dotSize}
          borderRadius={dotSize / 2}
          backgroundColor="$ok"
          borderWidth={2}
          borderColor="$background"
        />
      )}
    </Stack>
  );
}
