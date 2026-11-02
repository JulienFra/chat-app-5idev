import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { ConversationsService } from '../conversations/conversations.service';
import { RealtimeGateway } from '../realtime/realtime.gateway';

const MB = 1024 * 1024;
export const MAX_IMAGE_BYTES = 8 * MB; // limite Premium, appliquée dès la réception
const FREE_IMAGE_BYTES = 2 * MB;

const UPLOAD_DIR = path.join(process.cwd(), 'uploads');

// Nom d'un fichier enregistré : UUID + extension autorisée, rien d'autre
const STORED_NAME = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.(jpg|png|gif|webp)$/;

// Détecte le vrai format à partir des premiers octets du fichier (« signature »),
// sans faire confiance au type ni au nom envoyés par le navigateur
function detectImageExtension(buffer: Buffer): 'jpg' | 'png' | 'gif' | 'webp' | null {
  if (!buffer || buffer.length < 12) return null;
  if (buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) return 'jpg';
  if (buffer.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return 'png';
  const head = buffer.subarray(0, 6).toString('ascii');
  if (head === 'GIF87a' || head === 'GIF89a') return 'gif';
  if (buffer.subarray(0, 4).toString('ascii') === 'RIFF' && buffer.subarray(8, 12).toString('ascii') === 'WEBP') {
    return 'webp';
  }
  return null;
}

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

    const cleanContent = content?.trim() || '';
    let imageUrl: string | null = null;

    if (file) {
      const ext = detectImageExtension(file.buffer);
      if (!ext) {
        throw new BadRequestException('Format invalide. Seuls JPG, PNG, WEBP et GIF sont autorisés.');
      }

      const user = await this.prisma.user.findUnique({ where: { id: userId }, select: { plan: true } });
      const isPremium = user?.plan === 'PREMIUM';
      const maxSize = isPremium ? MAX_IMAGE_BYTES : FREE_IMAGE_BYTES;
      if (file.size > maxSize) {
        throw new BadRequestException(
          `Image trop volumineuse. Limite : ${maxSize / MB} Mo (offre ${isPremium ? 'Premium' : 'Free'}).`,
        );
      }

      // Nom aléatoire et extension déduite du contenu réel : le nom d'origine n'est jamais utilisé
      fs.mkdirSync(UPLOAD_DIR, { recursive: true });
      const filename = `${crypto.randomUUID()}.${ext}`;
      await fs.promises.writeFile(path.join(UPLOAD_DIR, filename), file.buffer);

      imageUrl = `/api/conversations/${conversationId}/messages/uploads/${filename}`;
    }

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

  // Renvoie le chemin d'une image seulement si l'utilisateur est membre du salon
  // et si l'image a bien été envoyée dans ce salon
  async resolveImage(userId: string, conversationId: string, filename: string): Promise<string> {
    if (!STORED_NAME.test(filename)) {
      throw new NotFoundException('Image introuvable');
    }

    await this.conversations.assertIsMember(userId, conversationId);

    const imageUrl = `/api/conversations/${conversationId}/messages/uploads/${filename}`;
    const message = await this.prisma.message.findFirst({
      where: { conversationId, imageUrl },
      select: { id: true },
    });
    if (!message) {
      throw new NotFoundException('Image introuvable');
    }

    const filePath = path.join(UPLOAD_DIR, filename);
    if (!fs.existsSync(filePath)) {
      throw new NotFoundException('Image introuvable');
    }
    return filePath;
  }
}