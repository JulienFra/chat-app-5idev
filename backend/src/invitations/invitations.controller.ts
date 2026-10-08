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

  // POST /api/conversations/:conversationId/invitations : inviter un joueur
  @Post('conversations/:conversationId/invitations')
  create(
    @Param('conversationId', ParseUUIDPipe) conversationId: string,
    @Body() dto: CreateInvitationDto,
    @Req() req: AuthRequest,
  ) {
    return this.invitationsService.create(req.user.sub, conversationId, dto.inviteeId);
  }

  // GET /api/conversations/:conversationId/invitations : en attente (ADMIN)
  @Get('conversations/:conversationId/invitations')
  listForConversation(
    @Param('conversationId', ParseUUIDPipe) conversationId: string,
    @Req() req: AuthRequest,
  ) {
    return this.invitationsService.listForConversation(req.user.sub, conversationId);
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

  // DELETE /api/invitations/:id : annuler (ADMIN du groupe)
  @Delete('invitations/:id')
  @HttpCode(204)
  cancel(@Param('id', ParseUUIDPipe) id: string, @Req() req: AuthRequest) {
    return this.invitationsService.cancel(req.user.sub, id);
  }
}