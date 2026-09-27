import { Transform } from 'class-transformer';
import { IsString, MaxLength, MinLength } from 'class-validator';

export class CreateMessageDto {
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @MinLength(1, { message: 'Le message ne peut pas être vide' })
  @MaxLength(4000, { message: 'Le message ne peut pas dépasser 4000 caractères' })
  content: string;
}