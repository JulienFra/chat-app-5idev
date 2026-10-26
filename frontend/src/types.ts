export type Plan = 'FREE' | 'PREMIUM';
export type TeamRole = 'CEO' | 'COACH' | 'PLAYER';
export type ConversationType = 'DIRECT' | 'GENERAL' | 'ADMIN' | 'EVENT';
export type EventType = 'SCRIM' | 'MATCH';

export interface User {
  id: string;
  displayName: string;
  email: string;
}

export interface Profile {
  id: string;
  email: string;
  displayName: string;
  plan: Plan;
  createdAt: string;
}

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
  type: ConversationType;
  isGroup: boolean;
  name: string | null;
  teamId: string | null;
  createdAt: string;
  memberships: Membership[];
  messages?: Message[];
  unreadCount?: number;
}

export interface TeamMember {
  id: string;
  role: TeamRole;
  joinedAt: string;
  teamId: string;
  userId: string;
  user: UserSummary;
}

export interface Event {
  id: string;
  type: EventType;
  opponent: string;
  startsAt: string;
  teamId: string;
  createdById: string;
  conversationId: string | null;
}

export interface Team {
  id: string;
  name: string;
  createdAt: string;
  ownerId: string;
  owner: { id: string; displayName: string; plan: Plan };
  members: TeamMember[];
  events: Event[];
  myRole: TeamRole | null;
  limits: { maxTeams: number; maxSlots: number };
}

export interface Invitation {
  id: string;
  status: 'PENDING' | 'ACCEPTED' | 'DECLINED' | 'CANCELLED';
  createdAt: string;
  teamId: string;
  inviterId: string;
  inviteeId: string;
  team: { id: string; name: string };
  inviter: UserSummary;
  invitee: UserSummary;
}