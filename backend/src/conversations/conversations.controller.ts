import { Body, Controller, Get, Post, Req, UseGuards } from '@nestjs/common';
import { ConversationsService } from './conversations.service';
import { CreateConversationDto } from './dto/create-conversation.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@Controller('conversations')
@UseGuards(JwtAuthGuard)
export class ConversationsController {
  constructor(private readonly conversationsService: ConversationsService) {}

  @Post()
  createGroup(@Req() req: any, @Body() dto: CreateConversationDto) {
    const userId = req.user.sub || req.user.id;
    return this.conversationsService.createGroup(userId, dto);
  }

  @Get()
  getUserConversations(@Req() req: any) {
    const userId = req.user.sub || req.user.id;
    return this.conversationsService.getUserConversations(userId);
  }
}