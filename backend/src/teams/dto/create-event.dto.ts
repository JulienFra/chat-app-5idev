import { Transform } from 'class-transformer';
import { IsEnum, IsISO8601, IsString, Length } from 'class-validator';
import { EventType } from '@prisma/client';

export class CreateEventDto {
  @IsEnum(EventType, { message: "Type d'événement invalide (SCRIM ou MATCH)" })
  type: EventType;

  // Nom de l'équipe adverse, ex : « Vitality »
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @Length(1, 40, { message: "Le nom de l'adversaire doit faire entre 1 et 40 caractères" })
  opponent: string;

  // Date et heure au format ISO 8601, ex : « 2026-10-30T20:00:00.000Z »
  @IsISO8601({ strict: true }, { message: 'Date de début invalide' })
  startsAt: string;
}
