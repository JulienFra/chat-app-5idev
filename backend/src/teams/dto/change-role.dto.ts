import { IsIn } from 'class-validator';
import { TeamRole } from '@prisma/client';

export class ChangeRoleDto {
  // CEO n'est pas proposé : on devient CEO par un transfert de propriété
  @IsIn([TeamRole.COACH, TeamRole.PLAYER], { message: 'Rôle invalide (COACH ou PLAYER)' })
  role: TeamRole;
}