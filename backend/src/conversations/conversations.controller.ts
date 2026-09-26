import { Body, Controller, Get, Post, Req, UseGuards } from '@nestjs/common';
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
}