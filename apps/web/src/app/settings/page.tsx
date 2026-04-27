'use client';

import * as React from 'react';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslation } from 'react-i18next';

import { projectChild } from '@kinhale/sync';
import {
  SettingsListMobile,
  SettingsListWeb,
  type ChildProfileSummary,
  type SettingsListMessages,
  type SettingsNavItem,
  type SettingsSection,
} from '@kinhale/ui/settings';

import { useAuthStore } from '../../stores/auth-store';
import { useDocStore } from '../../stores/doc-store';
import { useRequireAuth } from '../../lib/useRequireAuth';

const DESKTOP_BREAKPOINT_PX = 1024;

const APPEARANCE_THEME_DEFAULT = 'auto';
const APPEARANCE_TEXT_DEFAULT = 'm';

// ──────────────────────────────────────────────────────────────────────────
// Stratégie de câblage (KIN-115 follow-up — fix/clinical-calm-data-wiring)
// ──────────────────────────────────────────────────────────────────────────
// Le hub Réglages clinical-calm v2 a été livré avec des `useState` locaux
// non persistés (toggles décoratifs). Cette refonte applique une stratégie
// hybride :
//
// - Notifications (morning, evening, missed, lowStock, quiet) → converties
//   en *liens* qui routent vers `/settings/notifications`. Raison : les
//   labels du hub ne mappent pas 1-1 sur l'enum `NotificationType` côté
//   API (il n'existe pas de préférence séparée « morning » / « evening » ;
//   c'est un seul booléen `reminder`). Dupliquer la logique métier dans
//   le hub serait risqué et redondant — la sous-page existante est déjà
//   câblée via TanStack Query + l'endpoint `PUT /me/notification-prefs`.
//   Le hub devient une « carte de navigation + aperçu » comme le commentaire
//   d'origine le revendiquait, mais pour de vrai cette fois.
//
// - Privacy / anonymize → désactivé visuellement (rendu en `value` row
//   marquée `readOnly: true` → « Bientôt disponible », non pressable).
//   Aucun endpoint analytics n'existe en v1.
//
// - Privacy / share, export, delete → liens (déjà câblés via `handlePressRow`,
//   inchangés).
//
// - Apparence / theme + textSize → persistés en `localStorage` côté web
//   uniquement. Ces préférences UI n'ont pas besoin de côté serveur. NOTE
//   IMPORTANTE : la valeur est sauvegardée et relue, mais TamaguiProvider
//   (`apps/web/src/providers/index.tsx`) utilise toujours `defaultTheme="light"`.
//   Le câblage *visuel* (application réelle du thème) est hors périmètre
//   de ce fix — il est documenté dans un ticket de suivi. L'utilisateur
//   voit donc ses choix persister (plus de no-op silencieux), mais le
//   rendu reste light tant que le wiring du provider n'est pas fait.

const APPEARANCE_THEME_STORAGE_KEY = 'kinhale-settings-appearance-theme';
const APPEARANCE_TEXT_STORAGE_KEY = 'kinhale-settings-appearance-text-size';

const APPEARANCE_THEME_VALUES = ['auto', 'light', 'dark'] as const;
const APPEARANCE_TEXT_VALUES = ['s', 'm', 'l'] as const;

function readPersistedAppearance<T extends string>(
  key: string,
  allowed: ReadonlyArray<T>,
  fallback: T,
): T {
  if (typeof window === 'undefined') return fallback;
  try {
    const raw = window.localStorage.getItem(key);
    if (raw !== null && (allowed as ReadonlyArray<string>).includes(raw)) {
      return raw as T;
    }
  } catch {
    // localStorage peut throw en mode privé Safari ou si quota dépassé —
    // on retombe sur la valeur par défaut sans casser le rendu.
  }
  return fallback;
}

function writePersistedAppearance(key: string, value: string): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(key, value);
  } catch {
    // Idem : on accepte la perte silencieuse plutôt que de casser l'UI.
  }
}

export default function SettingsPage(): React.JSX.Element | null {
  const { t } = useTranslation('common');
  const router = useRouter();
  const authenticated = useRequireAuth();
  const doc = useDocStore((s) => s.doc);
  const clearAuth = useAuthStore((s) => s.clearAuth);

  const [isDesktop, setIsDesktop] = useState<boolean | null>(null);
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const mq = window.matchMedia(`(min-width: ${DESKTOP_BREAKPOINT_PX}px)`);
      const update = (): void => setIsDesktop(mq.matches);
      update();
      mq.addEventListener('change', update);
      return () => mq.removeEventListener('change', update);
    }
    return undefined;
  }, []);

  // Apparence : `useState` initialisé au défaut, puis hydraté depuis
  // localStorage dans un `useEffect` pour préserver la cohérence SSR/CSR.
  const [theme, setTheme] =
    useState<(typeof APPEARANCE_THEME_VALUES)[number]>(APPEARANCE_THEME_DEFAULT);
  const [textSize, setTextSize] =
    useState<(typeof APPEARANCE_TEXT_VALUES)[number]>(APPEARANCE_TEXT_DEFAULT);

  useEffect(() => {
    setTheme(
      readPersistedAppearance(
        APPEARANCE_THEME_STORAGE_KEY,
        APPEARANCE_THEME_VALUES,
        APPEARANCE_THEME_DEFAULT,
      ),
    );
    setTextSize(
      readPersistedAppearance(
        APPEARANCE_TEXT_STORAGE_KEY,
        APPEARANCE_TEXT_VALUES,
        APPEARANCE_TEXT_DEFAULT,
      ),
    );
  }, []);

  const child = React.useMemo<ChildProfileSummary>(() => {
    const projected = doc !== null ? projectChild(doc) : null;
    if (projected === null) {
      return {
        name: t('settings.child.fallbackName'),
        initial: t('settings.child.fallbackInitial'),
        hue: 30,
        details: [],
      };
    }
    const currentYear = new Date().getFullYear();
    const ageYears = Math.max(0, currentYear - projected.birthYear);
    const initial = projected.firstName.charAt(0).toUpperCase() || 'L';
    const details: string[] = [t('settings.child.ageYearsFormat', { count: ageYears })];
    return {
      name: projected.firstName,
      initial,
      hue: 30,
      details,
    };
  }, [doc, t]);

  const messages = React.useMemo<SettingsListMessages>(
    () => ({
      childName: t('home.dashboard.childName'),
      title: t('settings.title'),
      subtitle: t('settings.subtitle'),
      signOutCta: t('settings.signOut'),
      notMedical: t('settings.notMedical'),
      editProfileCta: t('settings.editProfile'),
    }),
    [t],
  );

  const sections = React.useMemo<SettingsSection[]>(
    () => [
      {
        key: 'notifications',
        icon: 'bell',
        title: t('settings.section.notifications'),
        // Notifications : aperçu en lecture seule. Chaque rangée renvoie
        // vers `/settings/notifications` qui porte la logique réelle
        // (TanStack Query + `PUT /me/notification-preferences`).
        rows: [
          {
            key: 'morning',
            kind: 'link',
            label: t('settings.notif.morning.label'),
            sub: t('settings.notif.morning.sub'),
          },
          {
            key: 'evening',
            kind: 'link',
            label: t('settings.notif.evening.label'),
            sub: t('settings.notif.evening.sub'),
          },
          {
            key: 'missed',
            kind: 'link',
            label: t('settings.notif.missed.label'),
            sub: t('settings.notif.missed.sub'),
          },
          {
            key: 'lowStock',
            kind: 'link',
            label: t('settings.notif.lowStock.label'),
            sub: t('settings.notif.lowStock.sub'),
          },
          {
            key: 'quiet',
            kind: 'link',
            label: t('settings.notif.quiet.label'),
            sub: t('settings.notif.quiet.sub'),
          },
        ],
      },
      {
        key: 'appearance',
        icon: 'paint',
        title: t('settings.section.appearance'),
        rows: [
          {
            key: 'theme',
            kind: 'segment',
            label: t('settings.appearance.theme'),
            options: [
              { value: 'auto', label: t('settings.appearance.themeAuto') },
              { value: 'light', label: t('settings.appearance.themeLight') },
              { value: 'dark', label: t('settings.appearance.themeDark') },
            ],
            value: theme,
          },
          {
            key: 'language',
            kind: 'value',
            label: t('settings.appearance.language'),
            value: t('settings.appearance.languageValue'),
            mono: true,
          },
          {
            key: 'textSize',
            kind: 'segment',
            label: t('settings.appearance.textSize'),
            options: [
              { value: 's', label: t('settings.appearance.textSm') },
              { value: 'm', label: t('settings.appearance.textMd') },
              { value: 'l', label: t('settings.appearance.textLg') },
            ],
            value: textSize,
          },
        ],
      },
      {
        key: 'privacy',
        icon: 'shield',
        title: t('settings.section.privacy'),
        rows: [
          {
            key: 'share',
            kind: 'link',
            label: t('settings.privacy.share.label'),
            sub: t('settings.privacy.share.sub'),
          },
          // `analytics` n'a aucun endpoint dédié en v1 — affiché en lecture
          // seule avec « Bientôt disponible » plutôt qu'un toggle trompeur.
          // `readOnly: true` est CRITIQUE : sans ce flag, `SettingsRow` rend
          // la rangée comme un `<button>` pressable (curseur, hover, role
          // button) alors qu'aucune action n'est câblée — c'est exactement
          // le bug de confiance que ce fix neutralise.
          {
            key: 'anonymize',
            kind: 'value',
            label: t('settings.privacy.anonymize.label'),
            value: t('settings.privacy.anonymize.comingSoon'),
            readOnly: true,
          },
          {
            key: 'export',
            kind: 'link',
            label: t('settings.privacy.export.label'),
            sub: t('settings.privacy.export.sub'),
          },
          {
            key: 'delete',
            kind: 'danger',
            label: t('settings.privacy.delete.label'),
            sub: t('settings.privacy.delete.sub'),
          },
        ],
      },
      {
        key: 'about',
        icon: 'info',
        title: t('settings.section.about'),
        rows: [
          // `version` est purement informatif (numéro de build) — `readOnly`
          // évite le faux bouton (cf. anonymize ci-dessus).
          {
            key: 'version',
            kind: 'value',
            label: t('settings.about.version'),
            value: t('settings.about.versionValue'),
            mono: true,
            readOnly: true,
          },
          {
            key: 'terms',
            kind: 'link',
            label: t('settings.about.terms'),
          },
          {
            key: 'privacyPolicy',
            kind: 'link',
            label: t('settings.about.privacyPolicy'),
          },
          {
            key: 'openSource',
            kind: 'link',
            label: t('settings.about.openSource'),
            external: true,
          },
          {
            key: 'feedback',
            kind: 'link',
            label: t('settings.about.feedback'),
          },
        ],
      },
    ],
    [t, theme, textSize],
  );

  const navItems = React.useMemo<SettingsNavItem[]>(
    () => [
      { key: 'home', label: t('pumps.nav.home'), onPress: () => router.push('/') },
      {
        key: 'history',
        label: t('pumps.nav.history'),
        onPress: () => router.push('/journal'),
      },
      { key: 'pumps', label: t('pumps.nav.pumps'), onPress: () => router.push('/pumps') },
      {
        key: 'caregivers',
        label: t('pumps.nav.caregivers'),
        onPress: () => router.push('/caregivers'),
      },
      {
        key: 'reports',
        label: t('pumps.nav.reports'),
        onPress: () => router.push('/reports'),
      },
      { key: 'settings', label: t('pumps.nav.settings'), active: true },
    ],
    [router, t],
  );

  if (!authenticated || isDesktop === null) {
    return null;
  }

  // Plus aucun toggle dans le hub — la propriété est conservée pour la
  // compatibilité de signature (`SettingsListHandlers`) mais devient un
  // no-op explicite (toute future row `kind: 'toggle'` ajoutée sans wiring
  // sera donc visible en revue : pas de risque de régression silencieuse).
  const handleChangeToggle = (): void => {
    // intentionnellement vide
  };

  const handleChangeSegment = (sectionKey: string, rowKey: string, value: string): void => {
    if (sectionKey !== 'appearance') return;
    if (rowKey === 'theme') {
      if ((APPEARANCE_THEME_VALUES as ReadonlyArray<string>).includes(value)) {
        const next = value as (typeof APPEARANCE_THEME_VALUES)[number];
        setTheme(next);
        writePersistedAppearance(APPEARANCE_THEME_STORAGE_KEY, next);
      }
      return;
    }
    if (rowKey === 'textSize') {
      if ((APPEARANCE_TEXT_VALUES as ReadonlyArray<string>).includes(value)) {
        const next = value as (typeof APPEARANCE_TEXT_VALUES)[number];
        setTextSize(next);
        writePersistedAppearance(APPEARANCE_TEXT_STORAGE_KEY, next);
      }
    }
  };

  const handlePressRow = (sectionKey: string, rowKey: string): void => {
    // Navigation vers les sous-pages câblées (TanStack Query + API). Le
    // hub ne fait JAMAIS d'écriture lui-même — c'est le contrat fixé par
    // ce fix de wiring.
    if (sectionKey === 'notifications') {
      router.push('/settings/notifications');
      return;
    }
    if (sectionKey === 'privacy') {
      if (rowKey === 'export') {
        router.push('/settings/privacy');
        return;
      }
      if (rowKey === 'delete') {
        router.push('/account/deletion-confirm');
        return;
      }
      if (rowKey === 'share') {
        router.push('/reports');
        return;
      }
      // `anonymize` est désormais une `value` row marquée `readOnly: true` :
      // `SettingsRow` ne la rend pas pressable (pas de cursor pointer, pas
      // de hover, pas d'accessibilityRole=button). Aucun handler requis.
      // Si la row redevenait pressable (changement futur), cette branche
      // silencieuse évite de router vers une page inexistante.
      return;
    }
    if (sectionKey === 'about') {
      if (rowKey === 'openSource') {
        if (typeof window !== 'undefined') {
          window.open('https://github.com/kamez-conseils/kinhale', '_blank', 'noopener');
        }
        return;
      }
      router.push('/settings/about');
    }
  };

  const handleSignOut = (): void => {
    clearAuth();
    router.replace('/auth');
  };

  const props = {
    messages,
    child,
    sections,
    handlers: {
      onPressEditProfile: () => router.push('/onboarding/child'),
      onChangeToggle: handleChangeToggle,
      onChangeSegment: handleChangeSegment,
      onPressRow: handlePressRow,
      onPressSignOut: handleSignOut,
    },
  };

  if (isDesktop) {
    return <SettingsListWeb {...props} navItems={navItems} />;
  }
  return <SettingsListMobile {...props} />;
}
