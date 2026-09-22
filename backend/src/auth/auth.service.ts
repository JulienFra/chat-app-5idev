import { Injectable, ConflictException } from '@nestjs/common';
import { UsersService } from '../users/users.service';
import { RegisterDto } from './dto/register.dto';
import * as bcrypt from 'bcrypt';

@Injectable()
export class AuthService {
  constructor(private usersService: UsersService) {}

  async register(registerDto: RegisterDto) {
    const { email, password, displayName } = registerDto;

    // 1. Vérifier si l'utilisateur existe déjà pour éviter un crash de la base de données
    const existingUser = await this.usersService.findByEmail(email);
    if (existingUser) {
      throw new ConflictException('Cet email est déjà utilisé.');
    }

    // 2. Transformer le mot de passe en clair en un hash indéchiffrable
    const passwordHash = await bcrypt.hash(password, 10);

    // 3. Sauvegarder le vrai modèle dans la base de données
    const newUser = await this.usersService.create(email, passwordHash, displayName);

    // 4. Retirer le mot de passe haché de la réponse finale par sécurité
    const { passwordHash: _, ...result } = newUser;
    return result;
  }
}