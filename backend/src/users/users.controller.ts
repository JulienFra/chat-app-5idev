import { Controller, Get, Query, Req, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { UsersService } from './users.service';

@Controller('users')
@UseGuards(JwtAuthGuard)
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  // GET /api/users?search=nouv
  @Get()
  search(@Query('search') search: string | undefined, @Req() req: { user: { sub: string } }) {
    return this.usersService.search((search ?? '').slice(0, 20), req.user.sub);
  }
}