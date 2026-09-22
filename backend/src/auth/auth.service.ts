import { UsersService } from '../users/users.service';
import { RegisterDto } from './dto/register.dto';
import * as bcrypt from 'bcrypt';
import { Injectable, ConflictException, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { LoginDto } from './dto/login.dto';

@Injectable()
export class AuthService {
  constructor(private usersService: UsersService,
    private jwtService: JwtService // On injecte le service JWT
  ) {}

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
  async login(loginDto: LoginDto) {
    const { email, password } = loginDto;

    // 1. Chercher l'utilisateur par son email
    const user = await this.usersService.findByEmail(email);
    if (!user) {
      throw new UnauthorizedException('Identifiants invalides');
    }

    // 2. Comparer le mot de passe fourni avec le hash stocké en base
    const isPasswordValid = await bcrypt.compare(password, user.passwordHash);
    if (!isPasswordValid) {
      throw new UnauthorizedException('Identifiants invalides');
    }

    // 3. Générer et renvoyer le jeton JWT
    const payload = { sub: user.id, email: user.email };
    return {
      access_token: await this.jwtService.signAsync(payload),
    };
    }
}