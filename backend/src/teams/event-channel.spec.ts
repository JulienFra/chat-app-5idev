import { EventType } from '@prisma/client';
import { eventChannelBase } from './teams.service';

// Tests unitaires du nom de salon généré pour un scrim ou un match
describe('eventChannelBase', () => {
  // 30 octobre 2026 à 18:00 UTC = 19:00 à Bruxelles
  const date = new Date('2026-10-30T18:00:00.000Z');

  it('construit « type-adversaire-jour-mois »', () => {
    expect(eventChannelBase(EventType.SCRIM, 'Vitality', date)).toBe('scrim-vitality-30-10');
    expect(eventChannelBase(EventType.MATCH, 'Vitality', date)).toBe('match-vitality-30-10');
  });

  it('retire les accents et remplace espaces et symboles par des tirets', () => {
    expect(eventChannelBase(EventType.SCRIM, 'Équipe  Rouge!', date)).toBe(
      'scrim-equipe-rouge-30-10',
    );
  });

  it('coupe un adversaire trop long à 20 caractères', () => {
    const name = eventChannelBase(EventType.SCRIM, 'Une équipe au nom vraiment très long', date);
    expect(name).toBe('scrim-une-equipe-au-nom-vr-30-10');
  });

  it('ne laisse pas de tiret à la fin après la coupe', () => {
    // « team-liquid-academy-x » coupé à 20 caractères donne « team-liquid-academy- »
    expect(eventChannelBase(EventType.SCRIM, 'Team Liquid Academy X', date)).toBe(
      'scrim-team-liquid-academy-30-10',
    );
  });

  it('utilise un nom par défaut si l’adversaire ne contient que des symboles', () => {
    expect(eventChannelBase(EventType.MATCH, '!!!', date)).toBe('match-adversaire-30-10');
  });

  it('prend la date à l’heure de Bruxelles, pas en UTC', () => {
    // 30 octobre 23:30 UTC = 31 octobre 00:30 à Bruxelles (heure d'hiver, UTC+1)
    const lateEvening = new Date('2026-10-30T23:30:00.000Z');
    expect(eventChannelBase(EventType.SCRIM, 'Vitality', lateEvening)).toBe(
      'scrim-vitality-31-10',
    );
  });
});