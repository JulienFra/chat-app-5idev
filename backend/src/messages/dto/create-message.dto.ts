import { Transform } from 'class-transformer';
import { IsOptional, IsString, MaxLength } from 'class-validator';

// Le texte est optionnel : un message peut être une image seule.
// Le service vérifie qu'il y a au moins un texte ou une image.
export class CreateMessageDto {
  @IsOptional()
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @MaxLength(4000, { message: 'Le message ne peut pas dépasser 4000 caractères' })
  content?: string;
}