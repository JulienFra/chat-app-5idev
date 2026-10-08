import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { InvitationsService } from './invitations.service';
import { CreateInvitationDto } from './dto/create-invitation.dto';

type AuthRequest = { user: { sub: string } };

@Controller()
@UseGuards(JwtAuthGuard)
export class InvitationsController {
  constructor(private readonly invitationsService: InvitationsService) {}

  // POST /api/teams/:teamId/invitations : inviter un joueur
  @Post('teams/:teamId/invitations')
  create(
    @Param('teamId', ParseUUIDPipe) teamId: string,
    @Body() dto: CreateInvitationDto,
    @Req() req: AuthRequest,
  ) {
    return this.invitationsService.create(req.user.sub, teamId, dto.inviteeId);
  }

  // GET /api/teams/:teamId/invitations : en attente (CEO et coachs)
  @Get('teams/:teamId/invitations')
  listForTeam(@Param('teamId', ParseUUIDPipe) teamId: string, @Req() req: AuthRequest) {
    return this.invitationsService.listForTeam(req.user.sub, teamId);
  }

  // GET /api/invitations : mes invitations reçues
  @Get('invitations')
  listReceived(@Req() req: AuthRequest) {
    return this.invitationsService.listReceived(req.user.sub);
  }

  // POST /api/invitations/:id/accept
  @Post('invitations/:id/accept')
  @HttpCode(204)
  accept(@Param('id', ParseUUIDPipe) id: string, @Req() req: AuthRequest) {
    return this.invitationsService.accept(req.user.sub, id);
  }

  // POST /api/invitations/:id/decline
  @Post('invitations/:id/decline')
  @HttpCode(204)
  decline(@Param('id', ParseUUIDPipe) id: string, @Req() req: AuthRequest) {
    return this.invitationsService.decline(req.user.sub, id);
  }

  // DELETE /api/invitations/:id : annuler (CEO et coachs)
  @Delete('invitations/:id')
  @HttpCode(204)
  cancel(@Param('id', ParseUUIDPipe) id: string, @Req() req: AuthRequest) {
    return this.invitationsService.cancel(req.user.sub, id);
  }
}