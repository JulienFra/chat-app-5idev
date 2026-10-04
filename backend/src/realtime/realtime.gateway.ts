import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import {
  OnGatewayConnection,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { PrismaService } from '../prisma/prisma.service';

// Nom de la room d'une conversation
export const conversationRoom = (conversationId: string) => `conv:${conversationId}`;

// Nom de la room personnelle d'un utilisateur (tous ses onglets et appareils)
export const userRoom = (userId: string) => `user:${userId}`;

@WebSocketGateway()
export class RealtimeGateway implements OnGatewayConnection {
  @WebSocketServer()
  server: Server;

  constructor(
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly prisma: PrismaService,
  ) {}

  // Appelé à chaque nouvelle connexion WebSocket
  async handleConnection(client: Socket) {
    try {
      // 1. Le token est envoyé une seule fois, à la connexion
      const token: unknown = client.handshake.auth?.token;
      if (typeof token !== 'string') throw new Error('Token manquant');

      const payload = await this.jwtService.verifyAsync<{ sub: string }>(token, {
        secret: this.configService.getOrThrow<string>('JWT_SECRET'),
      });
      client.data.userId = payload.sub;

      // 2. Room personnelle + une room par conversation dont l'utilisateur est membre
      const memberships = await this.prisma.membership.findMany({
        where: { userId: payload.sub },
        select: { conversationId: true },
      });
      await client.join([
        userRoom(payload.sub),
        ...memberships.map((m) => conversationRoom(m.conversationId)),
      ]);
    } catch {
      // Token absent, invalide ou expiré : on coupe la connexion
      client.disconnect(true);
    }
  }

  // Appelé par MessagesService APRÈS l'enregistrement en base
  emitNewMessage(message: { conversationId: string }) {
    this.server.to(conversationRoom(message.conversationId)).emit('message:new', message);
  }

  // Appelé quand une conversation est créée ou qu'on y ajoute des membres :
  // leurs sockets déjà connectés rejoignent la room, et leur liste se met à jour.
  addMembersToConversation(userIds: string[], conversationId: string) {
    if (userIds.length === 0) return;
    const rooms = userIds.map(userRoom);
    this.server.in(rooms).socketsJoin(conversationRoom(conversationId));
    this.server.to(rooms).emit('conversation:new', { conversationId });
  }
}