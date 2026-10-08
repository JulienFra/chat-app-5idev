import { Body, Controller, Get, HttpCode, Patch, Query, Req, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { UsersService } from './users.service';
import { ChangePasswordDto } from './dto/change-password.dto';
import { UpdatePlanDto } from './dto/update-plan.dto';

type AuthRequest = { user: { sub: string } };

@Controller('users')
@UseGuards(JwtAuthGuard)
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  // GET /api/users?search=nouv
  @Get()
  search(@Query('search') search: string | undefined, @Req() req: AuthRequest) {
    // Un pseudo fait 20 caractères max : inutile de chercher plus long
    return this.usersService.search((search ?? '').slice(0, 20), req.user.sub);
  }

  // GET /api/users/me : mon profil
  @Get('me')
  me(@Req() req: AuthRequest) {
    return this.usersService.getProfile(req.user.sub);
  }

  @Patch('me/password')
  @HttpCode(204)
  async changePassword(@Body() dto: ChangePasswordDto, @Req() req: AuthRequest) {
    await this.usersService.changePassword(req.user.sub, dto.currentPassword, dto.newPassword);
  }

  @Patch('me/plan')
  setPlan(@Body() dto: UpdatePlanDto, @Req() req: AuthRequest) {
    return this.usersService.setPlan(req.user.sub, dto.plan);
  }
}