import type { Conversation } from './types';

const TOKEN_KEY = 'token';

export function getToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

export function saveToken(token: string): void {
  localStorage.setItem(TOKEN_KEY, token);
}

export function clearToken(): void {
  localStorage.removeItem(TOKEN_KEY);
}

export class ApiError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

function extractMessage(data: unknown, status: number): string {
  if (status >= 500) {
    return 'Le serveur a rencontré un problème. Réessaie dans un instant.';
  }
  if (data && typeof data === 'object' && 'message' in data) {
    const message = (data as { message: unknown }).message;
    if (Array.isArray(message)) return message.join('\n');
    if (typeof message === 'string') return message;
  }
  return 'Une erreur est survenue';
}

interface ApiOptions {
  method?: 'GET' | 'POST' | 'PATCH' | 'DELETE';
  body?: unknown;
}

export async function api<T>(path: string, options: ApiOptions = {}): Promise<T> {
  const token = getToken();
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (token) headers.Authorization = `Bearer ${token}`;

  let res: Response;
  try {
    res = await fetch(`/api${path}`, {
      method: options.method ?? 'GET',
      headers,
      body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
    });
  } catch {
    throw new ApiError('Impossible de joindre le serveur. Vérifie ta connexion.', 0);
  }

  let data: unknown = null;
  try {
    data = await res.json();
  } catch {
    // réponse vide
  }

  if (!res.ok) {
    if (res.status === 401 && token) {
      clearToken();
      window.dispatchEvent(new Event('auth:logout'));
    }
    throw new ApiError(extractMessage(data, res.status), res.status);
  }

  return data as T;
}

export function errorMessage(err: unknown): string {
  return err instanceof Error ? err.message : 'Une erreur est survenue';
}

// L'id de l'utilisateur est dans le champ "sub" du JWT (lisible côté client).
export function getCurrentUserId(): string | null {
  const token = getToken();
  if (!token) return null;
  try {
    const part = token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/');
    const padded = part.padEnd(part.length + ((4 - (part.length % 4)) % 4), '=');
    const payload: unknown = JSON.parse(atob(padded));
    if (payload && typeof payload === 'object' && 'sub' in payload) {
      const sub = (payload as { sub: unknown }).sub;
      return typeof sub === 'string' ? sub : null;
    }
    return null;
  } catch {
    return null;
  }
}

// Nom à afficher : celui de l'équipe, ou celui de l'autre personne pour un 1:1
export function conversationTitle(conversation: Conversation, meId: string | null): string {
  if (conversation.isGroup) {
    return conversation.name?.trim() || 'Équipe sans nom';
  }
  const other = conversation.memberships.find((m) => m.userId !== meId);
  return other?.user.displayName ?? 'Conversation';
}

// Marque une conversation comme lue côté serveur.
// Une erreur ici ne doit pas gêner l'utilisateur : au pire,
// le badge réapparaîtra au prochain chargement.
export async function markConversationRead(conversationId: string): Promise<void> {
  try {
    await api<void>(`/conversations/${conversationId}/read`, { method: 'POST' });
  } catch {
    // ignoré volontairement
  }
}