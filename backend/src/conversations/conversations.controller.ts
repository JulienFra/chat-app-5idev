import {
  Body,
  Controller,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ConversationsService } from './conversations.service';
import { CreateConversationDto } from './dto/create-conversation.dto';
import { CreateDirectDto } from './dto/create-direct.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@Controller('conversations')
@UseGuards(JwtAuthGuard)
export class ConversationsController {
  constructor(private readonly conversationsService: ConversationsService) {}

  @Post()
  createGroup(@Req() req: any, @Body() dto: CreateConversationDto) {
    return this.conversationsService.createGroup(req.user.sub, dto);
  }

  @Post('direct')
  createDirect(@Req() req: any, @Body() dto: CreateDirectDto) {
    return this.conversationsService.findOrCreateDirect(
      req.user.sub,
      dto.otherUserId,
    );
  }

  @Get()
  getUserConversations(@Req() req: any) {
    return this.conversationsService.getUserConversations(req.user.sub);
  }

  // Ajout d'un membre avec vérification de permission ADMIN (S4)
  @Post(':id/members')
  addMember(
    @Req() req: any,
    @Param('id') conversationId: string,
    @Body('identifier') identifier: string,
  ) {
    return this.conversationsService.addMember(
      req.user.sub,
      conversationId,
      identifier,
    );
  }

  // POST /api/conversations/:id/read : marque la conversation comme lue
  @Post(':id/read')
  @HttpCode(204)
  markAsRead(
    @Req() req: any,
    @Param('id', ParseUUIDPipe) conversationId: string,
  ) {
    return this.conversationsService.markAsRead(req.user.sub, conversationId);
  }
}