import * as React from 'react';
import { Stack, Text, Theme, XStack, YStack } from 'tamagui';

import {
  AlertIcon,
  ArrowRightIcon,
  ClockIcon,
  InhalerMaintIcon,
  InhalerRescueIcon,
} from '../../icons';
import { BrandIcon } from '../auth/icons';
import type {
  HomeDashboardData,
  HomeDashboardHandlers,
  HomeDashboardMessages,
} from './HomeDashboard';
import type {
  ActivityItem,
  CaregiverView,
  InhalerView,
  ScheduleSlot,
  ScheduleSlotState,
} from './types';

// Variante desktop du tableau de bord Kinhale, alignée sur la maquette
// `docs/design/handoffs/2026-04-26-clinical-calm/project/Kinhale Home.html`
// (composant `KinhaleWeb`, ~lignes 4141-5050).
//
// Layout :
//   ┌──────────┬───────────────────────────────────────┐
//   │          │  Top bar (date + nom enfant + role)   │
//   │ Sidebar  ├──────────────────┬────────────────────┤
//   │ (224 px) │  Status hero     │  Right rail :      │
//   │          │  Schedule strip  │  Mes pompes        │
//   │          │  Activity        │                    │
//   │          ├──────────────────┴────────────────────┤
//   │          │   Floating action dock (sticky)       │
//   └──────────┴───────────────────────────────────────┘
//
// Les composants partagés mobile (BottomActionBar, Inventory, …) ne sont
// pas réutilisés ici car la maquette desktop a des choix de typographie,
// d'espacement et d'éléments (avatars sidebar, dock pill flottant, etc.)
// suffisamment distincts pour justifier un composant dédié.

export interface HomeNavItem {
  key: string;
  label: string;
  active?: boolean;
  onPress?: (() => void) | undefined;
}

export interface HomeWebDashboardProps {
  messages: HomeDashboardMessages;
  data: HomeDashboardData;
  handlers?: HomeDashboardHandlers | undefined;
  /**
   * Items de navigation de la sidebar. Doivent être déjà localisés (le
   * composant `@kinhale/ui/home` reste pure-presentational ; l'app
   * appelante construit les libellés via son hook i18n).
   * Required pour respecter la règle non-négociable Kinhale FR+EN dès
   * le commit #1 — pas de fallback hardcodé.
   */
  navItems: ReadonlyArray<HomeNavItem>;
  /** Defaults to `kinhale_light`. */
  theme?: 'kinhale_light' | 'kinhale_dark';
}

export function HomeWebDashboard({
  messages,
  data,
  handlers,
  navItems,
  theme = 'kinhale_light',
}: HomeWebDashboardProps): React.JSX.Element {
  const { time, scheduleSlots, inhalers, activity, caregivers } = data;

  return (
    <Theme name={theme}>
      <Stack
        position="absolute"
        top={0}
        right={0}
        bottom={0}
        left={0}
        backgroundColor="$background"
        overflow="hidden"
        // grid 224px sidebar + 1fr main — pas supporté par Tamagui props,
        // on passe par display:grid via style natif.
        style={{ display: 'grid', gridTemplateColumns: '224px 1fr' }}
      >
        <WebSidebar
          navItems={navItems}
          caregiversTitle={messages.caregiversTitle}
          caregivers={caregivers}
        />
        <WebMain
          messages={messages}
          time={time}
          scheduleSlots={scheduleSlots}
          inhalers={inhalers}
          activity={activity}
          handlers={handlers}
        />
      </Stack>
    </Theme>
  );
}

// ── Sidebar (224 px) ─────────────────────────────────────────────────────

function WebSidebar({
  navItems,
  caregiversTitle,
  caregivers,
}: {
  navItems: ReadonlyArray<HomeNavItem>;
  caregiversTitle: string;
  caregivers: CaregiverView[];
}): React.JSX.Element {
  return (
    <YStack
      tag="aside"
      borderRightWidth={0.5}
      borderRightColor="$borderColor"
      paddingHorizontal={14}
      paddingVertical={20}
      gap={4}
      backgroundColor="$surface"
      style={{ overflow: 'auto' }}
    >
      {/* Logo + wordmark */}
      <XStack alignItems="center" gap={10} paddingHorizontal={8} paddingTop={4} paddingBottom={18}>
        <Stack
          width={28}
          height={28}
          borderRadius={8}
          backgroundColor="$maint"
          alignItems="center"
          justifyContent="center"
        >
          <BrandIcon size={15} color="#ffffff" />
        </Stack>
        <Text
          fontFamily="$heading"
          fontSize={17}
          fontWeight="600"
          letterSpacing={-0.17}
          color="$color"
        >
          Kinhale
        </Text>
      </XStack>

      {/* Nav items */}
      {navItems.map((item) => (
        <XStack
          key={item.key}
          tag="button"
          paddingHorizontal={10}
          paddingVertical={9}
          borderRadius={8}
          backgroundColor={item.active ? '$surface2' : 'transparent'}
          cursor="pointer"
          alignItems="center"
          gap={10}
          borderWidth={0}
          hoverStyle={{ backgroundColor: '$surface2' }}
          {...(item.onPress ? { onPress: item.onPress } : {})}
          accessibilityRole="link"
          accessibilityLabel={item.label}
        >
          <Stack
            width={6}
            height={6}
            borderRadius={3}
            backgroundColor={item.active ? '$maint' : '$borderColorStrong'}
          />
          <Text
            fontSize={13.5}
            fontWeight={item.active ? '600' : '500'}
            color={item.active ? '$color' : '$colorMuted'}
            fontFamily="$body"
          >
            {item.label}
          </Text>
        </XStack>
      ))}

      <YStack flex={1} minHeight={16} />

      {/* Caregivers card en pied */}
      <YStack
        padding={12}
        borderRadius={12}
        backgroundColor="$surface2"
        borderWidth={0.5}
        borderColor="$borderColor"
      >
        <Text
          fontSize={10}
          color="$colorMore"
          textTransform="uppercase"
          letterSpacing={0.8}
          fontWeight="600"
        >
          {caregiversTitle}
        </Text>
        <XStack marginTop={8}>
          {caregivers.slice(0, 4).map((c, i) => (
            <Stack
              key={c.id}
              width={26}
              height={26}
              borderRadius={13}
              marginLeft={i === 0 ? 0 : -8}
              borderWidth={1.5}
              borderColor="$surface2"
              alignItems="center"
              justifyContent="center"
              style={{
                background: `color-mix(in oklch, ${c.accentColor} 18%, var(--surface))`,
              }}
            >
              <Text
                fontSize={11}
                fontWeight="600"
                fontFamily="$heading"
                textTransform="uppercase"
                style={{ color: c.accentColor }}
              >
                {c.initial}
              </Text>
            </Stack>
          ))}
        </XStack>
      </YStack>
    </YStack>
  );
}

// ── Main column ──────────────────────────────────────────────────────────

function WebMain({
  messages,
  time,
  scheduleSlots,
  inhalers,
  activity,
  handlers,
}: {
  messages: HomeDashboardMessages;
  time: HomeDashboardData['time'];
  scheduleSlots: ScheduleSlot[];
  inhalers: InhalerView[];
  activity: ActivityItem[];
  handlers?: HomeDashboardHandlers | undefined;
}): React.JSX.Element {
  return (
    <YStack tag="main" flex={1} minHeight={0} position="relative" style={{ overflow: 'auto' }}>
      {/* Top bar sticky */}
      <XStack
        paddingHorizontal={28}
        paddingVertical={18}
        alignItems="center"
        justifyContent="space-between"
        borderBottomWidth={0.5}
        borderBottomColor="$borderColor"
        zIndex={5}
        // sticky top + backdrop-filter passent par style natif (Tamagui ne
        // supporte pas position:'sticky' en typings stricts).
        style={{
          position: 'sticky',
          top: 0,
          background: 'color-mix(in oklch, var(--background) 90%, transparent)',
          backdropFilter: 'blur(12px)',
          WebkitBackdropFilter: 'blur(12px)',
        }}
      >
        <YStack>
          <Text
            fontSize={11}
            color="$colorMore"
            textTransform="uppercase"
            letterSpacing={1.1}
            fontWeight="600"
          >
            {messages.dateLabel}
          </Text>
          <Text
            tag="h1"
            margin={0}
            fontFamily="$heading"
            fontSize={22}
            fontWeight="500"
            letterSpacing={-0.22}
            color="$color"
            marginTop={2}
          >
            {messages.childName}
          </Text>
        </YStack>
        <XStack alignItems="center" gap={12}>
          <XStack
            paddingHorizontal={12}
            paddingVertical={6}
            borderRadius={99}
            backgroundColor="$surface"
            borderWidth={0.5}
            borderColor="$borderColor"
            alignItems="center"
            gap={8}
          >
            <Stack
              width={6}
              height={6}
              borderRadius={3}
              backgroundColor="$ok"
              style={{ boxShadow: '0 0 0 3px var(--okSoft)' }}
            />
            <Text fontSize={12} color="$colorMuted">
              {messages.roleLabel}
            </Text>
          </XStack>
        </XStack>
      </XStack>

      {/* Content grid 1.5fr + 1fr */}
      <Stack
        paddingHorizontal={28}
        paddingTop={24}
        paddingBottom={120}
        gap={24}
        style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1.5fr) minmax(0, 1fr)' }}
      >
        <YStack gap={16} minWidth={0}>
          <WebStatusHero time={time} status={messages.status} />
          <WebScheduleStrip
            title={messages.scheduleTitle}
            stateLabels={messages.scheduleStateLabels}
            slots={scheduleSlots}
          />
          <WebActivity
            title={messages.activityTitle}
            historyLabel={messages.historyLabel}
            items={activity}
            formatBy={messages.formatBy}
            onPressHistory={handlers?.onPressHistory}
          />
        </YStack>

        <YStack tag="aside" gap={16} minWidth={0}>
          <WebPumpRail
            title={messages.inventoryTitle}
            inhalers={inhalers}
            formatDosesLeft={messages.formatDosesLeft}
            formatExpiryStatus={messages.formatExpiryStatus}
            refillSoonLabel={messages.refillSoonLabel}
          />
          <Text fontSize={11} color="$colorFaint" textAlign="center" fontStyle="italic">
            {messages.notMedicalDevice}
          </Text>
        </YStack>
      </Stack>

      <WebActionDock
        caption={messages.quickActionCaption}
        maintLabel={messages.quickMaintLabel}
        rescueLabel={messages.quickRescueLabel}
        onPressMaint={handlers?.onPressMaint}
        onPressRescue={handlers?.onPressRescue}
      />
    </YStack>
  );
}

// ── Status hero (web) ────────────────────────────────────────────────────

function WebStatusHero({
  time,
  status,
}: {
  time: HomeDashboardData['time'];
  status: HomeDashboardMessages['status'];
}): React.JSX.Element {
  const isOverdue = time === 'overdue';
  const isEvening = time === 'evening';
  const tone = isOverdue
    ? {
        bg: '$amberSoft' as const,
        dot: '$amber' as const,
        dotVar: 'var(--amber)',
        ink: '$amberInk' as const,
      }
    : isEvening
      ? {
          bg: '$maintSoft' as const,
          dot: '$maint' as const,
          dotVar: 'var(--maint)',
          ink: '$maintInk' as const,
        }
      : {
          bg: '$okSoft' as const,
          dot: '$ok' as const,
          dotVar: 'var(--ok)',
          ink: '$okInk' as const,
        };
  const title = isOverdue ? status.overdueTitle : isEvening ? status.dueTitle : status.onTrackTitle;
  const sub = isOverdue ? status.overdueSub : isEvening ? status.dueSub : status.onTrackSub;

  return (
    <XStack
      padding={24}
      borderRadius="$radius.7"
      backgroundColor={tone.bg}
      borderWidth={0.5}
      borderColor="$borderColor"
      alignItems="flex-start"
      gap={16}
    >
      <Stack
        width={10}
        height={10}
        borderRadius={5}
        backgroundColor={tone.dot}
        marginTop={10}
        // Halo doux 5 px autour de la pastille — teinté avec la même
        // couleur que le dot (alpha 18 %) pour respecter la maquette
        // (kz-design-review J1) : overdue → halo ambre, evening → halo
        // maint, on-track → halo OK.
        style={{
          boxShadow: `0 0 0 5px color-mix(in oklch, ${tone.dotVar} 18%, transparent)`,
        }}
      />
      <YStack flex={1}>
        <Text
          tag="h2"
          margin={0}
          fontFamily="$heading"
          fontSize={28}
          lineHeight={32}
          fontWeight="500"
          color={tone.ink}
        >
          {title}
        </Text>
        <Text fontSize={14} color="$colorMuted" marginTop={4}>
          {sub}
        </Text>
      </YStack>
    </XStack>
  );
}

// ── Schedule strip (web) ─────────────────────────────────────────────────

function WebScheduleStrip({
  title,
  stateLabels,
  slots,
}: {
  title: string;
  stateLabels: Record<ScheduleSlotState, string>;
  slots: ScheduleSlot[];
}): React.JSX.Element {
  return (
    <YStack
      backgroundColor="$surface"
      borderRadius="$radius.7"
      borderWidth={0.5}
      borderColor="$borderColor"
      padding={20}
    >
      <Text
        tag="h2"
        margin={0}
        fontSize={11}
        color="$colorMore"
        textTransform="uppercase"
        letterSpacing={0.88}
        fontWeight="600"
        marginBottom={12}
      >
        {title}
      </Text>
      <Stack style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
        {slots.map((s, i) => (
          <YStack
            key={i}
            padding={14}
            backgroundColor="$surface2"
            borderRadius={14}
            borderWidth={0.5}
            borderColor="$borderColor"
            gap={8}
          >
            <Text
              fontSize={11}
              color="$colorMore"
              textTransform="uppercase"
              letterSpacing={0.88}
              fontWeight="600"
            >
              {s.label}
            </Text>
            <Text
              fontFamily="$mono"
              fontSize={22}
              fontWeight="500"
              color="$color"
              style={{ fontVariantNumeric: 'tabular-nums' }}
            >
              {s.time}
            </Text>
            <XStack alignItems="center" gap={6}>
              <Stack
                width={7}
                height={7}
                borderRadius={4}
                backgroundColor={
                  s.state === 'done'
                    ? '$ok'
                    : s.state === 'overdue' || s.state === 'missed'
                      ? '$amber'
                      : '$maint'
                }
              />
              <Text
                fontSize={12}
                fontWeight="500"
                color={
                  s.state === 'done'
                    ? '$okInk'
                    : s.state === 'overdue' || s.state === 'missed'
                      ? '$amberInk'
                      : '$maintInk'
                }
              >
                {stateLabels[s.state]}
              </Text>
            </XStack>
          </YStack>
        ))}
      </Stack>
    </YStack>
  );
}

// ── Activity (web) ───────────────────────────────────────────────────────

function WebActivity({
  title,
  historyLabel,
  items,
  formatBy,
  onPressHistory,
}: {
  title: string;
  historyLabel: string;
  items: ActivityItem[];
  formatBy: (name: string) => string;
  onPressHistory?: (() => void) | undefined;
}): React.JSX.Element {
  return (
    <YStack
      backgroundColor="$surface"
      borderRadius="$radius.7"
      borderWidth={0.5}
      borderColor="$borderColor"
      padding={20}
    >
      <XStack alignItems="center" justifyContent="space-between" marginBottom={8}>
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
        <XStack
          alignItems="center"
          gap={4}
          cursor="pointer"
          {...(onPressHistory ? { onPress: onPressHistory } : {})}
        >
          <Text fontSize={12} color="$maint" fontWeight="500">
            {historyLabel}
          </Text>
          <Text color="$maint" display="flex" alignItems="center">
            <ArrowRightIcon size={11} color="currentColor" />
          </Text>
        </XStack>
      </XStack>

      {items.map((it, i) => {
        const isRescue = it.kind === 'rescue';
        return (
          <XStack
            key={it.id}
            alignItems="center"
            gap={14}
            paddingVertical={12}
            borderTopWidth={i === 0 ? 0 : 0.5}
            borderTopColor="$borderColor"
          >
            <Text
              width={32}
              height={32}
              borderRadius={9}
              backgroundColor={isRescue ? '$rescueSoft' : '$maintSoft'}
              color={isRescue ? '$rescue' : '$maint'}
              alignItems="center"
              justifyContent="center"
              flexShrink={0}
              display="flex"
            >
              {isRescue ? (
                <InhalerRescueIcon size={17} color="currentColor" />
              ) : (
                <InhalerMaintIcon size={17} color="currentColor" />
              )}
            </Text>
            <YStack flex={1} minWidth={0}>
              <XStack alignItems="baseline" gap={8}>
                <Text fontSize={14} fontWeight="500" color="$color">
                  {it.label}
                </Text>
                {it.cause && (
                  <Stack
                    paddingHorizontal={7}
                    paddingVertical={2}
                    borderRadius={99}
                    backgroundColor="$rescueSoft"
                  >
                    <Text fontSize={11} color="$rescueInk" fontWeight="500">
                      {it.cause}
                    </Text>
                  </Stack>
                )}
              </XStack>
              <Text fontSize={12} color="$colorMore" marginTop={2}>
                {formatBy(it.who)} · {it.ago}
                {it.syncNote ? ` · sync ${it.syncNote}` : ''}
              </Text>
            </YStack>
            <Text
              fontFamily="$mono"
              fontSize={12}
              color="$colorMore"
              style={{ fontVariantNumeric: 'tabular-nums' }}
            >
              {it.time}
            </Text>
          </XStack>
        );
      })}
    </YStack>
  );
}

// ── Pump rail (web — variante du Inventory mobile) ───────────────────────

function WebPumpRail({
  title,
  inhalers,
  formatDosesLeft,
  formatExpiryStatus,
  refillSoonLabel,
}: {
  title: string;
  inhalers: InhalerView[];
  formatDosesLeft: (n: number) => string;
  formatExpiryStatus: (inh: InhalerView) => { kind: 'normal' | 'soon' | 'expired'; label: string };
  refillSoonLabel: string;
}): React.JSX.Element {
  return (
    <YStack
      backgroundColor="$surface"
      borderRadius="$radius.7"
      borderWidth={0.5}
      borderColor="$borderColor"
      padding={20}
    >
      <Text
        tag="h2"
        margin={0}
        fontSize={11}
        color="$colorMore"
        textTransform="uppercase"
        letterSpacing={0.88}
        fontWeight="600"
        marginBottom={12}
      >
        {title}
      </Text>
      <YStack gap={16}>
        {inhalers.map((inh, i) => {
          const stockPct = Math.max(0, Math.min(100, (inh.doses / Math.max(1, inh.total)) * 100));
          const isMaint = inh.kind === 'maint';
          const expiry = formatExpiryStatus(inh);
          const expiryColor =
            expiry.kind === 'expired'
              ? '$rescueInk'
              : expiry.kind === 'soon'
                ? '$amberInk'
                : '$colorMore';

          return (
            <YStack
              key={inh.id}
              paddingTop={i === 0 ? 0 : 16}
              borderTopWidth={i === 0 ? 0 : 0.5}
              borderTopColor="$borderColor"
            >
              <XStack gap={12}>
                <Text
                  width={42}
                  height={42}
                  borderRadius={11}
                  backgroundColor={isMaint ? '$maintSoft' : '$rescueSoft'}
                  color={isMaint ? '$maint' : '$rescue'}
                  alignItems="center"
                  justifyContent="center"
                  flexShrink={0}
                  display="flex"
                >
                  {isMaint ? (
                    <InhalerMaintIcon size={22} color="currentColor" />
                  ) : (
                    <InhalerRescueIcon size={22} color="currentColor" />
                  )}
                </Text>
                <YStack flex={1} minWidth={0}>
                  <Text fontSize={14} fontWeight="500" color="$color">
                    {inh.name}
                  </Text>
                  <Text fontSize={12} color="$colorMore" marginTop={1}>
                    {inh.contextLabel}
                  </Text>
                </YStack>
              </XStack>

              <XStack justifyContent="space-between" alignItems="baseline" marginTop={12}>
                <Text
                  fontSize={11}
                  color="$colorMore"
                  textTransform="uppercase"
                  letterSpacing={0.66}
                  fontWeight="600"
                >
                  Stock
                </Text>
                <Text
                  fontFamily="$mono"
                  fontSize={13}
                  color={inh.isLow ? '$amberInk' : '$color'}
                  fontWeight="600"
                  style={{ fontVariantNumeric: 'tabular-nums' }}
                >
                  {formatDosesLeft(inh.doses)}
                </Text>
              </XStack>

              <Stack
                marginTop={6}
                height={6}
                backgroundColor="$borderColor"
                borderRadius={99}
                overflow="hidden"
              >
                <Stack
                  width={`${stockPct}%`}
                  height="100%"
                  borderRadius={99}
                  backgroundColor={inh.isLow ? '$amber' : isMaint ? '$maint' : '$rescue'}
                />
              </Stack>

              <XStack justifyContent="space-between" alignItems="center" marginTop={10}>
                <XStack alignItems="center" gap={5}>
                  <Text color={expiryColor} display="flex" alignItems="center">
                    <ClockIcon size={11} color="currentColor" />
                  </Text>
                  <Text fontSize={11} color={expiryColor}>
                    {expiry.label}
                  </Text>
                </XStack>
                {inh.isLow && (
                  <XStack
                    paddingHorizontal={8}
                    paddingVertical={2}
                    borderRadius={99}
                    backgroundColor="$amberSoft"
                    alignItems="center"
                    gap={4}
                  >
                    <Text color="$amberInk" display="flex" alignItems="center">
                      <AlertIcon size={10} color="currentColor" />
                    </Text>
                    <Text fontSize={11} color="$amberInk" fontWeight="600">
                      {refillSoonLabel}
                    </Text>
                  </XStack>
                )}
              </XStack>
            </YStack>
          );
        })}
      </YStack>
    </YStack>
  );
}

// ── Action dock (web — pill flottant centré) ──────────────────────────────

function WebActionDock({
  caption,
  maintLabel,
  rescueLabel,
  onPressMaint,
  onPressRescue,
}: {
  caption: string;
  maintLabel: string;
  rescueLabel: string;
  onPressMaint?: (() => void) | undefined;
  onPressRescue?: (() => void) | undefined;
}): React.JSX.Element {
  return (
    <Stack
      zIndex={10}
      paddingHorizontal={12}
      paddingVertical={10}
      borderRadius={999}
      borderWidth={0.5}
      borderColor="$borderColor"
      flexDirection="row"
      alignItems="center"
      gap={10}
      // sticky bottom centré + glass blur via style natif (Tamagui ne
      // supporte pas position:'sticky' + backdrop-filter en typage strict).
      style={{
        position: 'sticky',
        bottom: 24,
        marginLeft: 'auto',
        marginRight: 'auto',
        marginTop: -100,
        marginBottom: 24,
        width: 'max-content',
        background: 'color-mix(in oklch, var(--surface) 92%, transparent)',
        boxShadow: '0 12px 36px rgba(0,0,0,0.10), inset 0 1px 0 rgba(255,255,255,0.5)',
        backdropFilter: 'blur(20px)',
        WebkitBackdropFilter: 'blur(20px)',
      }}
    >
      <Text
        fontSize={11}
        color="$colorMore"
        textTransform="uppercase"
        letterSpacing={0.88}
        fontWeight="600"
        paddingHorizontal={6}
      >
        {caption}
      </Text>
      <XStack
        tag="button"
        cursor="pointer"
        backgroundColor="$maint"
        paddingHorizontal={20}
        paddingVertical={12}
        borderRadius={99}
        alignItems="center"
        gap={10}
        borderWidth={0}
        {...(onPressMaint ? { onPress: onPressMaint } : {})}
        accessibilityRole="button"
        accessibilityLabel={maintLabel}
        style={{ boxShadow: '0 4px 14px color-mix(in oklch, var(--maint) 35%, transparent)' }}
      >
        <Text
          width={28}
          height={28}
          borderRadius={8}
          alignItems="center"
          justifyContent="center"
          color="white"
          display="flex"
          style={{ background: 'rgba(255,255,255,0.18)' }}
        >
          <InhalerMaintIcon size={20} color="white" />
        </Text>
        <Text fontSize={14} fontWeight="600" color="white" fontFamily="$body">
          {maintLabel}
        </Text>
      </XStack>
      <XStack
        tag="button"
        cursor="pointer"
        backgroundColor="$surface"
        paddingHorizontal={20}
        paddingVertical={12}
        borderRadius={99}
        borderWidth={1.5}
        borderColor="$rescue"
        alignItems="center"
        gap={10}
        {...(onPressRescue ? { onPress: onPressRescue } : {})}
        accessibilityRole="button"
        accessibilityLabel={rescueLabel}
      >
        <Text
          width={28}
          height={28}
          borderRadius={8}
          backgroundColor="$rescueSoft"
          color="$rescue"
          alignItems="center"
          justifyContent="center"
          display="flex"
        >
          <InhalerRescueIcon size={20} color="currentColor" />
        </Text>
        <Text fontSize={14} fontWeight="600" color="$rescue" fontFamily="$body">
          {rescueLabel}
        </Text>
      </XStack>
    </Stack>
  );
}
