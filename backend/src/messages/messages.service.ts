import { BadRequestException, Injectable } from '@nestjs/common';
import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto'; 
import { PrismaService } from '../prisma/prisma.service';
import { ConversationsService } from '../conversations/conversations.service';
import { RealtimeGateway } from '../realtime/realtime.gateway';

@Injectable()
export class MessagesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly conversations: ConversationsService,
    private readonly realtime: RealtimeGateway,
  ) {}

  private readonly messageInclude = {
    author: { select: { id: true, displayName: true } },
  };

  async create(userId: string, conversationId: string, content?: string, file?: any) {
    await this.conversations.assertIsMember(userId, conversationId);

    let imageUrl = null;

    if (file) {
      const allowedMimeTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
      if (!allowedMimeTypes.includes(file.mimetype)) {
        throw new BadRequestException('Format invalide. Seuls JPG, PNG, WEBP et GIF sont autorisés.');
      }

      const user = await this.prisma.user.findUnique({ where: { id: userId } });
      const isPremium = user?.plan === 'PREMIUM';
      
      const maxMb = isPremium ? 8 : 2; 
      const maxSize = maxMb * 1024 * 1024;

      if (file.size > maxSize) {
        throw new BadRequestException(`Image trop volumineuse. Limite : ${maxMb} Mo (Statut ${isPremium ? 'Premium' : 'Free'}).`);
      }

      const uploadDir = path.join(process.cwd(), 'uploads');
      if (!fs.existsSync(uploadDir)) {
        fs.mkdirSync(uploadDir, { recursive: true });
      }

      const ext = path.extname(file.originalname);
      // NOUVEAU : On utilise crypto.randomUUID()
      const filename = `${crypto.randomUUID()}${ext}`;
      fs.writeFileSync(path.join(uploadDir, filename), file.buffer);

      imageUrl = `/api/conversations/${conversationId}/messages/uploads/${filename}`;
    }

    const cleanContent = content?.trim() || '';
    if (!cleanContent && !imageUrl) {
      throw new BadRequestException('Un message texte ou une image est requis.');
    }

    const message = await this.prisma.message.create({
      data: { content: cleanContent, authorId: userId, conversationId, imageUrl },
      include: this.messageInclude,
    });

    this.realtime.emitNewMessage(message);

    return message;
  }

  async findForConversation(userId: string, conversationId: string) {
    await this.conversations.assertIsMember(userId, conversationId);

    return this.prisma.message.findMany({
      where: { conversationId },
      orderBy: { createdAt: 'asc' },
      include: this.messageInclude,
    });
  }
}