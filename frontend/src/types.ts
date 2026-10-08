export type Plan = 'FREE' | 'PREMIUM';

export interface User {
  id: string;
  displayName: string;
  email: string;
}

// Mon profil : GET /api/users/me
export interface Profile {
  id: string;
  email: string;
  displayName: string;
  plan: Plan;
  createdAt: string;
}

// Ce que renvoie la recherche GET /api/users?search= (jamais l'email)
export interface UserSummary {
  id: string;
  displayName: string;
}

export interface Membership {
  id: string;
  role: 'MEMBER' | 'ADMIN';
  userId: string;
  conversationId: string;
  user: User;
}

export interface Message {
  id: string;
  content: string;
  createdAt: string;
  authorId: string;
  conversationId: string;
  author?: { id: string; displayName: string };
}

export interface Conversation {
  id: string;
  isGroup: boolean;
  name: string | null;
  createdAt: string;
  memberships: Membership[];
  messages?: Message[];
  unreadCount?: number;
}