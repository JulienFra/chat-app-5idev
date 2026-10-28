import { describe, expect, it } from 'vitest';
import { ARCHIVE_AFTER_MS, eventsOfTeams, findConflicts, isArchived } from './events';
import type { Event, Team } from './types';

// Fabrique un événement de test
function makeEvent(id: string, startsAt: string, teamId = 'team-a'): Event {
  return {
    id,
    type: 'SCRIM',
    opponent: 'Vitality',
    startsAt,
    teamId,
    createdById: 'user-1',
    conversationId: null,
  };
}

describe('findConflicts', () => {
  it('signale deux événements à moins de 2 h d’écart, dans les deux sens', () => {
    const a = makeEvent('a', '2026-11-01T19:00:00.000Z');
    const b = makeEvent('b', '2026-11-01T20:30:00.000Z', 'team-b');
    const conflicts = findConflicts([a, b]);

    expect(conflicts.get('a')?.map((e) => e.id)).toEqual(['b']);
    expect(conflicts.get('b')?.map((e) => e.id)).toEqual(['a']);
  });

  it('ne signale rien à partir de 2 h d’écart', () => {
    const a = makeEvent('a', '2026-11-01T19:00:00.000Z');
    const b = makeEvent('b', '2026-11-01T21:00:00.000Z');
    expect(findConflicts([a, b]).size).toBe(0);
  });

  it('fonctionne même si la liste n’est pas triée', () => {
    const late = makeEvent('late', '2026-11-01T20:00:00.000Z');
    const early = makeEvent('early', '2026-11-01T19:00:00.000Z');
    const other = makeEvent('other', '2026-11-03T19:00:00.000Z');
    const conflicts = findConflicts([late, other, early]);

    expect([...conflicts.keys()].sort()).toEqual(['early', 'late']);
  });

  it('gère trois événements qui se chevauchent', () => {
    const conflicts = findConflicts([
      makeEvent('a', '2026-11-01T19:00:00.000Z'),
      makeEvent('b', '2026-11-01T19:30:00.000Z'),
      makeEvent('c', '2026-11-01T20:00:00.000Z'),
    ]);
    expect(conflicts.get('b')?.map((e) => e.id).sort()).toEqual(['a', 'c']);
    expect(conflicts.size).toBe(3);
  });
});

describe('isArchived', () => {
  const now = new Date('2026-11-10T12:00:00.000Z').getTime();

  it('archive un événement passé depuis plus de 7 jours', () => {
    const old = makeEvent('old', new Date(now - ARCHIVE_AFTER_MS - 60_000).toISOString());
    expect(isArchived(old, now)).toBe(true);
  });

  it('garde un événement récent ou à venir', () => {
    const recent = makeEvent('recent', new Date(now - 6 * 24 * 60 * 60 * 1000).toISOString());
    const upcoming = makeEvent('upcoming', '2026-11-12T19:00:00.000Z');
    expect(isArchived(recent, now)).toBe(false);
    expect(isArchived(upcoming, now)).toBe(false);
  });
});

describe('eventsOfTeams', () => {
  it('rassemble les événements de toutes les équipes, triés par date, avec le nom de l’équipe', () => {
    const teams = [
      { id: 'team-a', name: 'KCorp', events: [makeEvent('a2', '2026-11-05T19:00:00.000Z')] },
      { id: 'team-b', name: 'Vitality', events: [makeEvent('b1', '2026-11-02T19:00:00.000Z', 'team-b')] },
    ] as unknown as Team[];

    const events = eventsOfTeams(teams);
    expect(events.map((e) => e.id)).toEqual(['b1', 'a2']);
    expect(events.map((e) => e.teamName)).toEqual(['Vitality', 'KCorp']);
  });
});