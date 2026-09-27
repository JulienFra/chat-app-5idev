import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { MessagesService } from './messages.service';
import { CreateMessageDto } from './dto/create-message.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@Controller('conversations/:conversationId/messages')
@UseGuards(JwtAuthGuard)
export class MessagesController {
  constructor(private readonly messagesService: MessagesService) {}

  // GET /api/conversations/:conversationId/messages
  @Get()
  findAll(
    @Req() req: any,
    @Param('conversationId', ParseUUIDPipe) conversationId: string,
  ) {
    return this.messagesService.findForConversation(req.user.sub, conversationId);
  }

  // POST /api/conversations/:conversationId/messages
  @Post()
  create(
    @Req() req: any,
    @Param('conversationId', ParseUUIDPipe) conversationId: string,
    @Body() dto: CreateMessageDto,
  ) {
    return this.messagesService.create(req.user.sub, conversationId, dto.content);
  }
}