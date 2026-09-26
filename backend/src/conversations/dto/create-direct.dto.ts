import { IsUUID } from 'class-validator';

export class CreateDirectDto {
  @IsUUID('4', { message: 'Identifiant utilisateur invalide' })
  otherUserId: string;
}