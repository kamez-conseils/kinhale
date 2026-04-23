import { useRelaySync } from './useRelaySync';

/**
 * Composant sans rendu visible qui monte la sync WS bidirectionnelle E2EE
 * en arrière-plan dès que l'utilisateur est authentifié et que le doc est
 * initialisé.
 *
 * À inclure dans les Providers ou dans le layout racine.
 * Pas de pragma "use client" côté mobile : React Native n'a pas de distinction
 * serveur/client comme Next.js.
 */
export function RelaySyncBootstrap(): null {
  useRelaySync();
  return null;
}
