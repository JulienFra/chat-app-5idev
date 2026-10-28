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
import { CreateEventDto } from './dto/create-event.dto';

type AuthRequest = { user: { sub: string } };

@Controller('teams')
@UseGuards(JwtAuthGuard)
export class TeamsController {
  constructor(private readonly teamsService: TeamsService) {}

  @Get()
  list(@Req() req: AuthRequest) {
    return this.teamsService.listMyTeams(req.user.sub);
  }

  @Post()
  create(@Body() dto: TeamNameDto, @Req() req: AuthRequest) {
    return this.teamsService.create(req.user.sub, dto.name);
  }

  @Patch(':id')
  rename(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: TeamNameDto,
    @Req() req: AuthRequest,
  ) {
    return this.teamsService.rename(req.user.sub, id, dto.name);
  }

  @Delete(':id')
  @HttpCode(204)
  remove(@Param('id', ParseUUIDPipe) id: string, @Req() req: AuthRequest) {
    return this.teamsService.remove(req.user.sub, id);
  }

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

  @Delete(':id/members/:userId')
  @HttpCode(204)
  kick(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('userId', ParseUUIDPipe) userId: string,
    @Req() req: AuthRequest,
  ) {
    return this.teamsService.kick(req.user.sub, id, userId);
  }

  @Post(':id/leave')
  @HttpCode(204)
  leave(@Param('id', ParseUUIDPipe) id: string, @Req() req: AuthRequest) {
    return this.teamsService.leave(req.user.sub, id);
  }

  @Post(':id/transfer')
  @HttpCode(204)
  transfer(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: TransferDto,
    @Req() req: AuthRequest,
  ) {
    return this.teamsService.transfer(req.user.sub, id, dto.userId);
  }

  // POST /api/teams/:id/events : planifier un scrim ou un match
  @Post(':id/events')
  createEvent(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: CreateEventDto,
    @Req() req: AuthRequest,
  ) {
    return this.teamsService.createEvent(
      req.user.sub,
      id,
      dto.type,
      dto.opponent,
      new Date(dto.startsAt),
    );
  }

  // DELETE /api/teams/:id/events/:eventId : supprimer un événement (et son salon)
  @Delete(':id/events/:eventId')
  @HttpCode(204)
  deleteEvent(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('eventId', ParseUUIDPipe) eventId: string,
    @Req() req: AuthRequest,
  ) {
    return this.teamsService.deleteEvent(req.user.sub, id, eventId);
  }
}
