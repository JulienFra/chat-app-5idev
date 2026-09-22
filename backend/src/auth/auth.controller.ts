import { Controller, Post, Body } from '@nestjs/common';
import { AuthService } from './auth.service';
import { RegisterDto } from './dto/register.dto';

@Controller('auth')
export class AuthController {
  // On injecte le service d'authentification pour pouvoir l'utiliser
  constructor(private readonly authService: AuthService) {}

  // Cette route réagira à une requête POST sur http://localhost:3000/auth/register
  @Post('register')
  async register(@Body() registerDto: RegisterDto) {
    // On passe les données reçues au service qui s'occupe du reste
    return this.authService.register(registerDto);
  }
}