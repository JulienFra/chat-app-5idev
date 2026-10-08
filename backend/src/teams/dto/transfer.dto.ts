import { IsUUID } from 'class-validator';

export class TransferDto {
  @IsUUID('all', { message: 'Joueur invalide' })
  userId: string;
}