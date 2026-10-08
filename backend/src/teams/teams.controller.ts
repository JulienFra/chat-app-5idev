import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { TeamsService } from './teams.service';
import { TeamNameDto } from './dto/team-name.dto';
import { ChangeRoleDto } from './dto/change-role.dto';
import { TransferDto } from './dto/transfer.dto';

type AuthRequest = { user: { sub: string } };

@Controller('teams')
@UseGuards(JwtAuthGuard)
export class TeamsController {
  constructor(private readonly teamsService: TeamsService) {}

  // GET /api/teams : mes équipes
  @Get()
  list(@Req() req: AuthRequest) {
    return this.teamsService.listMyTeams(req.user.sub);
  }

  // POST /api/teams : créer une équipe
  @Post()
  create(@Body() dto: TeamNameDto, @Req() req: AuthRequest) {
    return this.teamsService.create(req.user.sub, dto.name);
  }

  // PATCH /api/teams/:id : renommer (CEO)
  @Patch(':id')
  rename(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: TeamNameDto,
    @Req() req: AuthRequest,
  ) {
    return this.teamsService.rename(req.user.sub, id, dto.name);
  }

  // DELETE /api/teams/:id : supprimer (CEO)
  @Delete(':id')
  @HttpCode(204)
  remove(@Param('id', ParseUUIDPipe) id: string, @Req() req: AuthRequest) {
    return this.teamsService.remove(req.user.sub, id);
  }

  // PATCH /api/teams/:id/members/:userId : changer le rôle (CEO)
  @Patch(':id/members/:userId')
  @HttpCode(204)
  changeRole(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('userId', ParseUUIDPipe) userId: string,
    @Body() dto: ChangeRoleDto,
    @Req() req: AuthRequest,
  ) {
    return this.teamsService.changeRole(req.user.sub, id, userId, dto.role);
  }

  // DELETE /api/teams/:id/members/:userId : exclure (CEO, ou coach pour un joueur)
  @Delete(':id/members/:userId')
  @HttpCode(204)
  kick(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('userId', ParseUUIDPipe) userId: string,
    @Req() req: AuthRequest,
  ) {
    return this.teamsService.kick(req.user.sub, id, userId);
  }

  // POST /api/teams/:id/leave : quitter l'équipe
  @Post(':id/leave')
  @HttpCode(204)
  leave(@Param('id', ParseUUIDPipe) id: string, @Req() req: AuthRequest) {
    return this.teamsService.leave(req.user.sub, id);
  }

  // POST /api/teams/:id/transfer : transférer la propriété (CEO)
  @Post(':id/transfer')
  @HttpCode(204)
  transfer(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: TransferDto,
    @Req() req: AuthRequest,
  ) {
    return this.teamsService.transfer(req.user.sub, id, dto.userId);
  }
}