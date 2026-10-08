import { IsUUID } from 'class-validator';

export class CreateInvitationDto {
  @IsUUID('all', { message: 'Joueur invalide' })
  inviteeId: string;
}