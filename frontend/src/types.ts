export interface User {
  id: string;
  displayName: string;
  email: string;
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
}

export interface Conversation {
  id: string;
  isGroup: boolean;
  name: string | null;
  createdAt: string;
  memberships: Membership[];
  messages?: Message[];
}