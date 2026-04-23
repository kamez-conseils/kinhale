/**
 * Sous-module framework-agnostique : helpers de synchronisation E2EE
 * consommables par apps/web (Next.js) et apps/mobile (React Native / Expo).
 *
 * Ce sous-module est exposé via `@kinhale/sync/client` (exports map du package).
 * Il ne doit contenir aucun pragma `'use client'`, aucun import DOM-only, aucun
 * import RN-only : les dépendances plateforme (WebSocket, stores, doc) sont
 * injectées par chaque app.
 *
 * Refs: KIN-039, ADR-D9
 */

export { getGroupKey, _resetGroupKeyCache } from './group-key.js';
export { useRelaySync } from './useRelaySync.js';
export type {
  RelayClient,
  RelayIncomingMessage,
  RelayMessageHandler,
  CreateRelayClient,
  UseRelaySyncDeps,
} from './useRelaySync.js';
export { useReminderScheduler } from './useReminderScheduler.js';
export type {
  ScheduleLocalNotificationArgs,
  UseReminderSchedulerDeps,
} from './useReminderScheduler.js';
export { useMissedDoseWatcher } from './useMissedDoseWatcher.js';
export type {
  NotifyMissedDoseArgs,
  UseMissedDoseWatcherDeps,
} from './useMissedDoseWatcher.js';
export { classifyDecryptError, createDecryptFailedReporter } from './telemetry.js';
export type {
  DecryptErrorClass,
  DecryptFailedEvent,
  DecryptFailedEventName,
  HashHousehold,
  ReportDecryptFailed,
} from './telemetry.js';
