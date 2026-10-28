import { useSyncExternalStore } from 'react';
import type { Event, Team } from './types';

// Durée supposée d'un scrim ou d'un match : sert à détecter les chevauchements
export const EVENT_DURATION_MS = 2 * 60 * 60 * 1000; // 2 h

// Un événement passe dans les archives 7 jours après sa date
export const ARCHIVE_AFTER_MS = 7 * 24 * 60 * 60 * 1000;

export function isArchived(event: Event, now = Date.now()): boolean {
  return new Date(event.startsAt).getTime() < now - ARCHIVE_AFTER_MS;
}

// Un événement de mes équipes, avec le nom de son équipe
export interface MyEvent extends Event {
  teamName: string;
}

// Tous les événements de mes équipes, triés par date
export function eventsOfTeams(teams: Team[]): MyEvent[] {
  return teams
    .flatMap((team) => (team.events ?? []).map((e) => ({ ...e, teamName: team.name })))
    .sort((a, b) => new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime());
}

// Deux événements se chevauchent s'ils commencent à moins de 2 h d'écart.
// Renvoie, pour chaque événement en conflit, la liste des événements qui le chevauchent.
export function findConflicts<T extends Event>(events: T[]): Map<string, T[]> {
  const sorted = [...events].sort(
    (a, b) => new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime(),
  );
  const conflicts = new Map<string, T[]>();

  for (let i = 0; i < sorted.length; i++) {
    const start = new Date(sorted[i].startsAt).getTime();
    for (let j = i + 1; j < sorted.length; j++) {
      const other = new Date(sorted[j].startsAt).getTime();
      if (other - start >= EVENT_DURATION_MS) break; // liste triée : les suivants sont plus loin
      conflicts.set(sorted[i].id, [...(conflicts.get(sorted[i].id) ?? []), sorted[j]]);
      conflicts.set(sorted[j].id, [...(conflicts.get(sorted[j].id) ?? []), sorted[i]]);
    }
  }
  return conflicts;
}

export function formatEventDate(iso: string): string {
  return new Date(iso).toLocaleString('fr-BE', {
    weekday: 'short',
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function eventLabel(event: Event): string {
  return `${event.type === 'SCRIM' ? '⚔️ Scrim' : '🏆 Match'} vs ${event.opponent}`;
}

// ---------- Horloge partagée ----------
// Les composants ne doivent pas appeler Date.now() pendant le rendu (résultat instable).
// useNow() renvoie l'heure actuelle, mise à jour toutes les 30 s pour tous les composants.

let clock = Date.now();
const listeners = new Set<() => void>();
let timer: ReturnType<typeof setInterval> | null = null;

function subscribe(listener: () => void) {
  listeners.add(listener);
  clock = Date.now(); // à jour dès qu'un composant s'abonne
  if (!timer) {
    timer = setInterval(() => {
      clock = Date.now();
      listeners.forEach((notify) => notify());
    }, 30_000);
  }
  return () => {
    listeners.delete(listener);
    if (listeners.size === 0 && timer) {
      clearInterval(timer);
      timer = null;
    }
  };
}

export function useNow(): number {
  return useSyncExternalStore(subscribe, () => clock);
}