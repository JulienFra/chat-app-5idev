import { Transform } from 'class-transformer';
import { IsEmail, IsString, Matches, MaxLength, MinLength } from 'class-validator';

export class RegisterDto {
  @IsEmail({}, { message: 'Adresse email invalide' })
  email: string;

  @IsString()
  @MinLength(8, {
    message: 'Le mot de passe doit contenir au moins 8 caractères',
  })
  @MaxLength(72, {
    message: 'Le mot de passe ne peut pas dépasser 72 caractères',
  })
  password: string;

  // Pseudo façon Discord : identifie une seule personne, sert à l'inviter
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @Matches(/^[A-Za-z0-9_.-]{3,20}$/, {
    message:
      'Le pseudo doit faire 3 à 20 caractères, sans espace : lettres sans accent, chiffres, _ - . uniquement',
  })
  displayName: string;
}