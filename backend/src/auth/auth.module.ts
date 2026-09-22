import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { UsersModule } from '../users/users.module';

@Module({
  imports: [
    UsersModule,
    JwtModule.register({
      global: true,
      secret: process.env.JWT_SECRET || 'cle_secrete_provisoire', // En prod, cela ira dans le .env
      signOptions: { expiresIn: '1d' }, // Le token expire dans 1 jour
    }),
  ],
  controllers: [AuthController],
  providers: [AuthService],
})
export class AuthModule {}