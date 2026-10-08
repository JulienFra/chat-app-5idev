import { Transform } from 'class-transformer';
import { IsString, Length } from 'class-validator';

export class TeamNameDto {
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @Length(2, 40, { message: "Le nom de l'équipe doit faire entre 2 et 40 caractères" })
  name: string;
}