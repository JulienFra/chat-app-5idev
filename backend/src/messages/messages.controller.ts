import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Req,
  Res,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { MessagesService, MAX_IMAGE_BYTES } from './messages.service';
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
  // Multer coupe la réception au-delà de 8 Mo (erreur 413) :
  // un fichier énorme n'est jamais chargé entièrement en mémoire.
  @UseInterceptors(FileInterceptor('image', { limits: { fileSize: MAX_IMAGE_BYTES, files: 1 } }))
  create(
    @Req() req: any,
    @Param('conversationId', ParseUUIDPipe) conversationId: string,
    @Body() dto: CreateMessageDto,
    @UploadedFile() file?: any,
  ) {
    return this.messagesService.create(req.user.sub, conversationId, dto.content, file);
  }

  @Get('uploads/:filename')
  async serveImage(
    @Req() req: any,
    @Param('conversationId', ParseUUIDPipe) conversationId: string,
    @Param('filename') filename: string,
    @Res() res: any,
  ) {
    // Vérifie que l'utilisateur est membre du salon et que l'image appartient bien à ce salon
    const filePath = await this.messagesService.resolveImage(req.user.sub, conversationId, filename);

    // nosniff : le navigateur ne devine jamais un autre type que celui annoncé.
    // CSP : même ouvert directement, le fichier ne peut exécuter aucun script.
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Content-Security-Policy', "default-src 'none'");
    res.setHeader('Cache-Control', 'private, max-age=86400');
    return res.sendFile(filePath);
  }
}