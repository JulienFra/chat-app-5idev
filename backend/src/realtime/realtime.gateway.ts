import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import {
  ConnectedSocket,
  MessageBody,
  OnGatewayConnection,
  OnGatewayDisconnect,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { PrismaService } from '../prisma/prisma.service';

export const conversationRoom = (conversationId: string) => `conv:${conversationId}`;
export const userRoom = (userId: string) => `user:${userId}`;

@WebSocketGateway()
export class RealtimeGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  private activeSockets = new Map<string, Set<string>>();

  constructor(
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly prisma: PrismaService,
  ) {}

  async handleConnection(client: Socket) {
    try {
      const token: unknown = client.handshake.auth?.token;
      if (typeof token !== 'string') throw new Error('Token manquant');

      const payload = await this.jwtService.verifyAsync<{ sub: string }>(token, {
        secret: this.configService.getOrThrow<string>('JWT_SECRET'),
      });
      const userId = payload.sub;
      client.data.userId = userId;

      if (!this.activeSockets.has(userId)) {
        this.activeSockets.set(userId, new Set());
        this.server.emit('user:online', { userId });
      }
      this.activeSockets.get(userId)!.add(client.id);

      client.emit('users:online_list', Array.from(this.activeSockets.keys()));

      const memberships = await this.prisma.membership.findMany({
        where: { userId },
        select: { conversationId: true },
      });
      await client.join([
        userRoom(userId),
        ...memberships.map((m) => conversationRoom(m.conversationId)),
      ]);
    } catch {
      client.disconnect(true);
    }
  }

  handleDisconnect(client: Socket) {
    const userId = client.data.userId;
    if (!userId) return;

    const userSockets = this.activeSockets.get(userId);
    if (userSockets) {
      userSockets.delete(client.id);
      if (userSockets.size === 0) {
        this.activeSockets.delete(userId);
        this.server.emit('user:offline', { userId });
      }
    }
  }

  @SubscribeMessage('users:request_online')
  handleRequestOnline(@ConnectedSocket() client: Socket) {
    client.emit('users:online_list', Array.from(this.activeSockets.keys()));
  }

  @SubscribeMessage('typing')
  handleTyping(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { conversationId: string; isTyping: boolean },
  ) {
    const userId = client.data.userId;
    if (!userId) return;

    client.broadcast
      .to(conversationRoom(data.conversationId))
      .emit('typing', {
        conversationId: data.conversationId,
        userId,
        isTyping: data.isTyping,
      });
  }

  emitNewMessage(message: { conversationId: string }) {
    this.server.to(conversationRoom(message.conversationId)).emit('message:new', message);
  }

  addMembersToConversation(userIds: string[], conversationId: string) {
    if (userIds.length === 0) return;
    const rooms = userIds.map(userRoom);
    this.server.in(rooms).socketsJoin(conversationRoom(conversationId));
    this.server.to(rooms).emit('conversation:new', { conversationId });
  }

  removeMembersFromConversation(userIds: string[], conversationId: string) {
    if (userIds.length === 0) return;
    this.server.in(userIds.map(userRoom)).socketsLeave(conversationRoom(conversationId));
  }

  notifyTeamsChanged(userIds: string[]) {
    if (userIds.length === 0) return;
    this.server.to(userIds.map(userRoom)).emit('teams:changed');
  }

  emitToUser(userId: string, event: string, payload: unknown) {
    this.server.to(userRoom(userId)).emit(event, payload);
  }
}