import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Req,
  UseGuards,
  UseInterceptors,
  UploadedFile,
  Res,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { join } from 'path';
import { MessagesService } from './messages.service';
import { CreateMessageDto } from './dto/create-message.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@Controller('conversations/:conversationId/messages')
@UseGuards(JwtAuthGuard)
export class MessagesController {
  constructor(private readonly messagesService: MessagesService) {}

  @Get()
  findAll(
    @Req() req: any,
    @Param('conversationId', ParseUUIDPipe) conversationId: string,
  ) {
    return this.messagesService.findForConversation(req.user.sub, conversationId);
  }

  @Post()
  @UseInterceptors(FileInterceptor('image'))
  create(
    @Req() req: any,
    @Param('conversationId', ParseUUIDPipe) conversationId: string,
    @Body() dto: CreateMessageDto,
    @UploadedFile() file?: any, // CORRECTION : 'any' pour éviter l'erreur Multer
  ) {
    return this.messagesService.create(req.user.sub, conversationId, dto.content, file);
  }

  @Get('uploads/:filename')
  serveImage(@Param('filename') filename: string, @Res() res: any) {
    return res.sendFile(filename, { root: join(process.cwd(), 'uploads') });
  }
}