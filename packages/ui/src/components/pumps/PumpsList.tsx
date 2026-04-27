import * as React from 'react';
import { Text, Theme, XStack, YStack } from 'tamagui';

import { PumpCard } from './PumpCard';
import type { PumpExpiryKind, PumpView } from './types';

export interface PumpsListCopy {
  pageTitle: string;
  /** « {{n}} pompes actives » — interpolation FR/EN gérée par l'appelant. */
  pageSubtitle: string;
  sectionMaintTitle: string;
  sectionRescueTitle: string;
  emptyTitle: string;
  emptyBody: string;
  addCta: string;
  primaryBadge: string;
  stockLabel: string;
  refillSoonLabel: string;
  locationLabel: string;
}

interface PumpsListProps {
  pumps: PumpView[];
  copy: PumpsListCopy;
  formatExpiry: (pump: PumpView) => { kind: PumpExpiryKind; label: string };
  onPressPump?: ((pump: PumpView) => void) | undefined;
  onPressRefill?: ((pump: PumpView) => void) | undefined;
  onPressAdd?: (() => void) | undefined;
  theme?: 'kinhale_light' | 'kinhale_dark';
}

// Liste des pompes partagée mobile / web. Sections par type
// (fond / secours), bouton « Ajouter » accent en haut à droite,
// disclaimer médical RM27 implicite hérité du shell parent (auth /
// dashboard / etc.).
export function PumpsList({
  pumps,
  copy,
  formatExpiry,
  onPressPump,
  onPressRefill,
  onPressAdd,
  theme = 'kinhale_light',
}: PumpsListProps): React.JSX.Element {
  const maint = pumps.filter((p) => p.kind === 'maint');
  const rescue = pumps.filter((p) => p.kind === 'rescue');
  const cardCopy = {
    primaryBadge: copy.primaryBadge,
    stockLabel: copy.stockLabel,
    refillSoonLabel: copy.refillSoonLabel,
    locationLabel: copy.locationLabel,
  };

  return (
    <Theme name={theme}>
      <YStack flex={1} minHeight="100vh" backgroundColor="$background">
        {/* Header */}
        <XStack
          paddingHorizontal={20}
          paddingVertical={16}
          alignItems="flex-start"
          justifyContent="space-between"
          borderBottomWidth={0.5}
          borderBottomColor="$borderColor"
          gap={12}
        >
          <YStack flex={1} minWidth={0}>
            <Text
              tag="h1"
              margin={0}
              fontFamily="$heading"
              fontSize={24}
              fontWeight="500"
              letterSpacing={-0.48}
              color="$color"
            >
              {copy.pageTitle}
            </Text>
            <Text fontSize={12} color="$colorMore" marginTop={2}>
              {copy.pageSubtitle}
            </Text>
          </YStack>
          {onPressAdd && (
            <XStack
              tag="button"
              cursor="pointer"
              backgroundColor="$maint"
              paddingHorizontal={14}
              paddingVertical={8}
              borderRadius={99}
              borderWidth={0}
              alignItems="center"
              gap={6}
              onPress={onPressAdd}
              accessibilityRole="button"
              accessibilityLabel={copy.addCta}
              testID="pumps-add-cta"
              style={{
                boxShadow: '0 4px 12px color-mix(in oklch, var(--maint) 28%, transparent)',
              }}
            >
              <Text color="white" fontSize={14} fontWeight="600">
                +
              </Text>
              <Text color="white" fontSize={12.5} fontWeight="600">
                {copy.addCta}
              </Text>
            </XStack>
          )}
        </XStack>

        {/* Body — scrollable */}
        <YStack flex={1} paddingHorizontal={16} paddingVertical={16} style={{ overflow: 'auto' }}>
          {pumps.length === 0 ? (
            <EmptyState
              title={copy.emptyTitle}
              body={copy.emptyBody}
              ctaLabel={copy.addCta}
              onPressAdd={onPressAdd}
            />
          ) : (
            <YStack gap={24}>
              {maint.length > 0 && (
                <SectionGroup title={copy.sectionMaintTitle} count={maint.length}>
                  {maint.map((pump) => (
                    <PumpCard
                      key={pump.id}
                      pump={pump}
                      copy={cardCopy}
                      {...formatExpiry(pump)}
                      expiryLabel={formatExpiry(pump).label}
                      expiryKind={formatExpiry(pump).kind}
                      onPress={onPressPump ? (): void => onPressPump(pump) : undefined}
                      onPressRefill={onPressRefill ? (): void => onPressRefill(pump) : undefined}
                    />
                  ))}
                </SectionGroup>
              )}
              {rescue.length > 0 && (
                <SectionGroup title={copy.sectionRescueTitle} count={rescue.length}>
                  {rescue.map((pump) => (
                    <PumpCard
                      key={pump.id}
                      pump={pump}
                      copy={cardCopy}
                      {...formatExpiry(pump)}
                      expiryLabel={formatExpiry(pump).label}
                      expiryKind={formatExpiry(pump).kind}
                      onPress={onPressPump ? (): void => onPressPump(pump) : undefined}
                      onPressRefill={onPressRefill ? (): void => onPressRefill(pump) : undefined}
                    />
                  ))}
                </SectionGroup>
              )}
            </YStack>
          )}
        </YStack>
      </YStack>
    </Theme>
  );
}

interface SectionGroupProps {
  title: string;
  count: number;
  children: React.ReactNode;
}

function SectionGroup({ title, count, children }: SectionGroupProps): React.JSX.Element {
  return (
    <YStack gap={12}>
      <XStack alignItems="baseline" gap={8}>
        <Text
          tag="h2"
          margin={0}
          fontSize={11}
          color="$colorMore"
          textTransform="uppercase"
          letterSpacing={0.88}
          fontWeight="600"
        >
          {title}
        </Text>
        <Text fontSize={11} color="$colorFaint" fontFamily="$mono">
          {count}
        </Text>
      </XStack>
      <YStack gap={12}>{children}</YStack>
    </YStack>
  );
}

interface EmptyStateProps {
  title: string;
  body: string;
  ctaLabel: string;
  onPressAdd?: (() => void) | undefined;
}

function EmptyState({ title, body, ctaLabel, onPressAdd }: EmptyStateProps): React.JSX.Element {
  return (
    <YStack alignItems="center" justifyContent="center" gap={12} paddingVertical={48}>
      <Text fontFamily="$heading" fontSize={20} fontWeight="500" color="$color" textAlign="center">
        {title}
      </Text>
      <Text fontSize={14} color="$colorMore" textAlign="center" maxWidth={320}>
        {body}
      </Text>
      {onPressAdd && (
        <XStack
          tag="button"
          marginTop={12}
          cursor="pointer"
          paddingHorizontal={18}
          paddingVertical={12}
          borderRadius={99}
          borderWidth={0}
          backgroundColor="$maint"
          gap={6}
          alignItems="center"
          onPress={onPressAdd}
          accessibilityRole="button"
          accessibilityLabel={ctaLabel}
        >
          <Text color="white" fontSize={14} fontWeight="600">
            +
          </Text>
          <Text color="white" fontSize={14} fontWeight="600">
            {ctaLabel}
          </Text>
        </XStack>
      )}
    </YStack>
  );
}
