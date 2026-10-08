import { IsString, MaxLength, MinLength } from 'class-validator';

export class ChangePasswordDto {
  @IsString()
  @MinLength(1, { message: 'Le mot de passe actuel est requis' })
  currentPassword: string;

  // Mêmes règles qu'à l'inscription
  @IsString()
  @MinLength(8, { message: 'Le nouveau mot de passe doit contenir au moins 8 caractères' })
  @MaxLength(72, { message: 'Le nouveau mot de passe ne peut pas dépasser 72 caractères' })
  newPassword: string;
}