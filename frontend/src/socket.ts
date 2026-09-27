import { io, type Socket } from 'socket.io-client';
import { getToken } from './api';

// Une seule connexion WebSocket pour toute l'application
let socket: Socket | null = null;

export function connectSocket(): Socket {
  if (!socket) {
    // Même origine que la page : en local, le proxy de Vite redirige /socket.io
    // vers le backend ; en production, c'est Nginx.
    socket = io({ auth: { token: getToken() } });
  }
  return socket;
}

export function disconnectSocket(): void {
  socket?.disconnect();
  socket = null;
}