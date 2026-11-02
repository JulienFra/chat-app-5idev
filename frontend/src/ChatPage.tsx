import { useCallback, useEffect, useRef, useState } from 'react';
import {
  api,
  ApiError,
  conversationTitle,
  errorMessage,
  getCurrentUserId,
  markConversationRead,
} from './api';
import { connectSocket, disconnectSocket } from './socket';
import type { Conversation, ConversationType, Invitation, Message, Team, Event } from './types';
import AddMemberModal from './components/AddMemberModal';
import ConversationView from './components/ConversationView';
import CreateTeamModal from './components/CreateTeamModal';
import CreateEventModal from './components/CreateEventModal';
import MyEventsList from './components/MyEventsList';
import {
  EVENT_DURATION_MS,
  eventLabel,
  eventsOfTeams,
  findConflicts,
  formatEventDate,
  isArchived,
  useNow,
} from './events';
import InvitationsList from './components/InvitationsList';
import MemberList from './components/MemberList';
import TeamSettingsModal from './components/TeamSettingsModal';
import ToastStack, { type NotificationToast } from './components/ToastStack';
import UserPanel from './components/UserPanel';

interface Props {
  onLogout: () => void;
}

const MAX_TOASTS = 3;
const INVITE_PREFIX = 'invite:';

const CHANNEL_ORDER: Record<ConversationType, number> = {
  GENERAL: 0,
  ADMIN: 1,
  EVENT: 2,
  DIRECT: 3,
};

function unreadFrom(list: Conversation[]): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const c of list) {
    if (c.unreadCount) counts[c.id] = c.unreadCount;
  }
  return counts;
}

function fetchAll() {
  return Promise.all([api<Conversation[]>('/conversations'), api<Team[]>('/teams')]);
}

const isDesktop = () => window.matchMedia('(min-width: 768px)').matches;

const monogram = (name: string) => name.trim().slice(0, 2).toUpperCase();

const dayOf = (iso: string) => new Date(iso).getDate();
const monthOf = (iso: string) =>
  new Date(iso).toLocaleDateString('fr-FR', { month: 'short' }).replace('.', '');

const NO_SCROLLBAR = '[scrollbar-width:none] [&::-webkit-scrollbar]:hidden';

function Badge({ count }: { count: number }) {
  return (
    <span className="min-w-[22px] rounded-full bg-[#d7ff3a] px-1.5 py-0.5 text-center text-xs font-bold leading-4 text-black tabular-nums">
      {count > 99 ? '99+' : count}
    </span>
  );
}

function SectionTitle({ children, action }: { children: React.ReactNode; action?: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between px-5 pb-2 pt-6">
      <h3 className="text-xs font-semibold uppercase tracking-wider text-[#9aa1ab]">{children}</h3>
      {action}
    </div>
  );
}

const HashIcon = () => (
  <svg width="18" height="18" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
    <path d="M6 2 4.5 14M11.5 2 10 14M2.5 5.5h11.5M2 10.5h11.5" />
  </svg>
);

const LockIcon = () => (
  <svg width="15" height="15" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="7" width="10" height="7" rx="1.5" />
    <path d="M5.5 7V5a2.5 2.5 0 0 1 5 0v2" />
  </svg>
);

const TrashIcon = () => (
  <svg width="17" height="17" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M2.5 4.5h11M6 4.5V3h4v1.5M4 4.5l.7 9h6.6l.7-9" />
  </svg>
);

const PlusIcon = () => (
  <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
    <path d="M8 2v12M2 8h12" />
  </svg>
);

export default function ChatPage({ onLogout }: Props) {
  const meId = getCurrentUserId();
  const now = useNow();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [teams, setTeams] = useState<Team[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const [activeTeamId, setActiveTeamId] = useState<string | null>(null);
  const [homeTab, setHomeTab] = useState<'dms' | 'invitations' | 'events'>('dms');

  const [invitations, setInvitations] = useState<Invitation[]>([]);
  const [respondingId, setRespondingId] = useState<string | null>(null);
  const [invitationError, setInvitationError] = useState<string | null>(null);

  const [unreadCounts, setUnreadCounts] = useState<Record<string, number>>({});
  const [toasts, setToasts] = useState<NotificationToast[]>([]);

  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [settingsTeamId, setSettingsTeamId] = useState<string | null>(null);
  const [inviteTeamId, setInviteTeamId] = useState<string | null>(null);
  const [createEventTeamId, setCreateEventTeamId] = useState<string | null>(null);

  const conversationsRef = useRef<Conversation[]>([]);
  const teamsRef = useRef<Team[]>([]);
  const selectedIdRef = useRef<string | null>(null);

  useEffect(() => { conversationsRef.current = conversations; }, [conversations]);
  useEffect(() => { teamsRef.current = teams; }, [teams]);
  useEffect(() => { selectedIdRef.current = selectedId; }, [selectedId]);

  useEffect(() => {
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission().catch(() => {});
    }
  }, []);

  const applyData = useCallback((convs: Conversation[], teamList: Team[]) => {
    setConversations(convs);
    setTeams(teamList);
    setUnreadCounts(unreadFrom(convs));
  }, []);

  const refresh = useCallback(async (): Promise<Conversation[] | null> => {
    try {
      const [convs, teamList] = await fetchAll();
      applyData(convs, teamList);
      return convs;
    } catch {
      return null;
    }
  }, [applyData]);

  useEffect(() => {
    let cancelled = false;
    fetchAll()
      .then(([convs, teamList]) => {
        if (cancelled) return;
        applyData(convs, teamList);
        if (teamList.length > 0) setActiveTeamId(teamList[0].id);
      })
      .catch((err) => {
        if (!cancelled) setError(errorMessage(err));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    api<Invitation[]>('/invitations')
      .then((data) => {
        if (!cancelled) setInvitations(data);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [applyData]);

  const fullTitle = useCallback(
    (c: Conversation, teamList: Team[]) => {
      const base = conversationTitle(c, meId);
      const team = c.teamId ? teamList.find((t) => t.id === c.teamId) : undefined;
      return team ? `${team.name} · ${base}` : base;
    },
    [meId],
  );

  const pushToast = useCallback((toast: Omit<NotificationToast, 'count'>) => {
    setToasts((prev) => {
      const existing = prev.find((t) => t.conversationId === toast.conversationId);
      const merged: NotificationToast = { ...toast, count: (existing?.count ?? 0) + 1 };
      const others = prev.filter((t) => t.conversationId !== toast.conversationId);
      return [merged, ...others].slice(0, MAX_TOASTS);
    });
  }, []);

  const dismissToast = useCallback((conversationId: string) => {
    setToasts((prev) => prev.filter((t) => t.conversationId !== conversationId));
  }, []);

  const openConversation = useCallback(
    (id: string, teamId?: string | null) => {
      const conv = conversationsRef.current.find((c) => c.id === id);
      const team = teamId !== undefined ? teamId : (conv?.teamId ?? null);
      setActiveTeamId(team);
      if (!team) setHomeTab('dms');
      setSelectedId(id);
      setUnreadCounts((prev) => {
        if (!prev[id]) return prev;
        const next = { ...prev };
        delete next[id];
        return next;
      });
      dismissToast(id);
      void markConversationRead(id);
    },
    [dismissToast],
  );

  const openTeamGeneral = useCallback(
    (convs: Conversation[] | null, teamId: string) => {
      const general = convs?.find((c) => c.teamId === teamId && c.type === 'GENERAL');
      if (general) openConversation(general.id, teamId);
      else setActiveTeamId(teamId);
    },
    [openConversation],
  );

  const openDirect = useCallback(
    async (userId: string) => {
      try {
        const conv = await api<Conversation>('/conversations/direct', {
          method: 'POST',
          body: { otherUserId: userId },
        });
        await refresh();
        openConversation(conv.id, null);
      } catch (err) {
        window.alert(errorMessage(err));
      }
    },
    [refresh, openConversation],
  );

  const handleToastOpen = useCallback(
    (key: string) => {
      if (key.startsWith(INVITE_PREFIX)) {
        dismissToast(key);
        setActiveTeamId(null);
        setHomeTab('invitations');
        setSelectedId(null);
        return;
      }
      openConversation(key);
    },
    [dismissToast, openConversation],
  );

  const handleNewMessage = useCallback(
    (message: Message) => {
      const isFromMe = message.authorId === meId;
      const isCurrentConv = selectedIdRef.current === message.conversationId;

      const known = conversationsRef.current.some((c) => c.id === message.conversationId);
      if (!known) {
        void refresh();
      } else {
        setConversations((prev) => {
          const conv = prev.find((c) => c.id === message.conversationId);
          if (!conv) return prev;
          const updated = { ...conv, messages: [message] };
          return [updated, ...prev.filter((c) => c.id !== conv.id)];
        });
      }

      if (!isFromMe && isCurrentConv) {
        void markConversationRead(message.conversationId);
      }

      if (!isFromMe && !isCurrentConv) {
        setUnreadCounts((prev) => ({
          ...prev,
          [message.conversationId]: (prev[message.conversationId] || 0) + 1,
        }));

        const targetConv = conversationsRef.current.find((c) => c.id === message.conversationId);
        const title = targetConv ? fullTitle(targetConv, teamsRef.current) : 'Nouveau message';
        const sender = message.author?.displayName ?? 'Un membre';

        pushToast({
          id: message.id,
          conversationId: message.conversationId,
          senderName: sender,
          title,
          content: message.content,
        });
      }
    },
    [refresh, meId, pushToast, fullTitle],
  );

  useEffect(() => {
    const socket = connectSocket();
    socket.on('message:new', handleNewMessage);
    return () => {
      socket.off('message:new', handleNewMessage);
    };
  }, [handleNewMessage]);

  useEffect(() => {
    const socket = connectSocket();
    const onChange = () => { void refresh(); };
    socket.on('conversation:new', onChange);
    socket.on('teams:changed', onChange);
    return () => {
      socket.off('conversation:new', onChange);
      socket.off('teams:changed', onChange);
    };
  }, [refresh]);

  useEffect(() => {
    const socket = connectSocket();
    const onInvitation = (invitation: Invitation) => {
      setInvitations((prev) => [invitation, ...prev.filter((i) => i.id !== invitation.id)]);
      const team = invitation.team.name;
      const inviter = invitation.inviter.displayName;
      pushToast({
        id: invitation.id,
        conversationId: `${INVITE_PREFIX}${invitation.id}`,
        senderName: inviter,
        title: team,
        content: "t'invite à rejoindre l'équipe",
      });
    };

    const onInvitationRemoved = ({ id }: { id: string }) => {
      setInvitations((prev) => prev.filter((i) => i.id !== id));
      dismissToast(`${INVITE_PREFIX}${id}`);
    };

    socket.on('invitation:new', onInvitation);
    socket.on('invitation:removed', onInvitationRemoved);
    return () => {
      socket.off('invitation:new', onInvitation);
      socket.off('invitation:removed', onInvitationRemoved);
    };
  }, [pushToast, dismissToast]);

  useEffect(() => {
    return () => disconnectSocket();
  }, []);

  const respondToInvitation = async (invitation: Invitation, accept: boolean) => {
    setRespondingId(invitation.id);
    setInvitationError(null);
    try {
      await api<void>(`/invitations/${invitation.id}/${accept ? 'accept' : 'decline'}`, {
        method: 'POST',
      });
      setInvitations((prev) => prev.filter((i) => i.id !== invitation.id));
      dismissToast(`${INVITE_PREFIX}${invitation.id}`);
      if (accept) {
        openTeamGeneral(await refresh(), invitation.teamId);
      }
    } catch (err) {
      setInvitationError(errorMessage(err));
      if (err instanceof ApiError && err.status === 404) {
        setInvitations((prev) => prev.filter((i) => i.id !== invitation.id));
      }
    } finally {
      setRespondingId(null);
    }
  };

  const handleTeamCreated = async (team: Team) => {
    setIsCreateOpen(false);
    openTeamGeneral(await refresh(), team.id);
  };

  const channelsOf = (teamId: string) =>
    conversations
      .filter((c) => c.teamId === teamId)
      .sort(
        (a, b) =>
          CHANNEL_ORDER[a.type] - CHANNEL_ORDER[b.type] || (a.name ?? '').localeCompare(b.name ?? ''),
      );

  const unreadOfTeam = (teamId: string) =>
    channelsOf(teamId).reduce((sum, c) => sum + (unreadCounts[c.id] || 0), 0);

  const directs = conversations.filter((c) => c.type === 'DIRECT');
  const unreadDirects = directs.reduce((sum, c) => sum + (unreadCounts[c.id] || 0), 0);

  const myEvents = eventsOfTeams(teams);
  const conflictMap = findConflicts(
    myEvents.filter((e) => new Date(e.startsAt).getTime() > now - EVENT_DURATION_MS),
  );

  const activeTeam = activeTeamId ? teams.find((t) => t.id === activeTeamId) : undefined;
  const selected = conversations.find((c) => c.id === selectedId) ?? null;
  const selectedTeam = selected?.teamId ? teams.find((t) => t.id === selected.teamId) : undefined;
  const settingsTeam = settingsTeamId ? teams.find((t) => t.id === settingsTeamId) : undefined;
  const inviteTeam = inviteTeamId ? teams.find((t) => t.id === inviteTeamId) : undefined;
  const createEventTeam = createEventTeamId
    ? teams.find((t) => t.id === createEventTeamId)
    : undefined;

  const selectTeam = (team: Team) => {
    setActiveTeamId(team.id);
    if (selected?.teamId === team.id) return;
    const general = channelsOf(team.id).find((c) => c.type === 'GENERAL');
    if (general && isDesktop()) openConversation(general.id, team.id);
    else setSelectedId(null);
  };

  const selectHome = () => {
    setActiveTeamId(null);
    if (selected && selected.type !== 'DIRECT') setSelectedId(null);
  };

  const deleteEvent = async (teamId: string, event: Event) => {
    const warning = event.conversationId ? ' Son salon et tous ses messages seront supprimés.' : '';
    if (!window.confirm(`Supprimer « ${eventLabel(event)} » ?${warning}`)) return;
    try {
      await api(`/teams/${teamId}/events/${event.id}`, { method: 'DELETE' });
      await refresh();
    } catch (err) {
      window.alert(errorMessage(err));
    }
  };

  const renderChannel = (c: Conversation) => {
    const active = c.id === selectedId;
    const unread = unreadCounts[c.id] || 0;
    const isDirect = c.type === 'DIRECT';
    const label = isDirect ? conversationTitle(c, meId) : c.name;

    return (
      <li key={c.id} className="px-3">
        <button
          type="button"
          onClick={() => openConversation(c.id)}
          className={`relative flex w-full items-center gap-3 rounded-lg px-3 py-3 text-left text-[15px] transition-colors ${
            active
              ? 'bg-[#1c2025] text-white'
              : unread > 0
                ? 'text-white hover:bg-[#15181c]'
                : 'text-[#aab1bb] hover:bg-[#15181c] hover:text-white'
          }`}
        >
          {active && <span className="absolute inset-y-2.5 left-0 w-[3px] rounded-r bg-[#d7ff3a]" />}
          {isDirect ? (
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#262b31] text-xs font-bold text-[#d5d9de]">
              {monogram(label ?? '?')}
            </span>
          ) : (
            <span className={active ? 'text-[#d7ff3a]' : 'text-[#6f7782]'}>
              <HashIcon />
            </span>
          )}
          <span className={`flex-1 truncate ${unread > 0 || active ? 'font-semibold' : 'font-medium'}`}>{label}</span>
          {c.type === 'ADMIN' && (
            <span className="text-[#6f7782]" title="Accès restreint">
              <LockIcon />
            </span>
          )}
          {unread > 0 && <Badge count={unread} />}
        </button>
      </li>
    );
  };

  const renderEvent = (e: Event, teamId: string, canManage: boolean) => {
    const channelId = e.conversationId;
    const active = channelId !== null && channelId === selectedId;
    const unread = channelId ? unreadCounts[channelId] || 0 : 0;

    return (
      <li key={e.id} className="group/event relative px-3">
        <button
          type="button"
          disabled={!channelId}
          onClick={() => channelId && openConversation(channelId)}
          className={`flex w-full items-center gap-3 rounded-lg border p-2.5 text-left transition-colors ${
            active
              ? 'border-[#d7ff3a]/50 bg-[#1c2025]'
              : channelId
                ? 'border-[#23282e] bg-[#111418] hover:border-[#363d45] hover:bg-[#15181c]'
                : 'cursor-default border-[#23282e] bg-[#111418] opacity-50'
          }`}
        >
          <span
            className={`flex h-12 w-12 shrink-0 flex-col items-center justify-center rounded-md ${
              active ? 'bg-[#d7ff3a] text-black' : 'bg-[#1c2025] text-white'
            }`}
          >
            <span className="text-lg font-extrabold leading-5 tabular-nums">{dayOf(e.startsAt)}</span>
            <span className="text-[11px] font-semibold uppercase leading-3">{monthOf(e.startsAt)}</span>
          </span>
          <span className="min-w-0 flex-1">
            <span className="block truncate text-[15px] font-semibold text-white">{eventLabel(e)}</span>
            <span className="mt-0.5 block truncate text-[13px] text-[#9aa1ab]">{formatEventDate(e.startsAt)}</span>
          </span>
          {unread > 0 && <Badge count={unread} />}
        </button>
        {canManage && (
          <button
            type="button"
            title="Supprimer l'événement"
            onClick={() => void deleteEvent(teamId, e)}
            className="absolute right-5 top-1/2 hidden -translate-y-1/2 rounded-md bg-[#111418] p-2 text-[#9aa1ab] hover:bg-red-500/15 hover:text-red-400 md:group-hover/event:flex"
          >
            <TrashIcon />
          </button>
        )}
      </li>
    );
  };

  const canCreateEvent =
    activeTeam &&
    (activeTeam.myRole === 'CEO' || (activeTeam.myRole === 'COACH' && activeTeam.owner.plan === 'PREMIUM'));

  const upcoming = (activeTeam?.events ?? []).filter((e) => !isArchived(e, now));
  const nextEvent = [...upcoming].sort(
    (a, b) => new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime(),
  )[0];

  const tabBase =
    'relative flex h-16 shrink-0 items-center gap-2.5 px-4 text-sm font-semibold transition-colors';

  const renderTabs = () => (
    <>
      <button
        onClick={selectHome}
        className={`${tabBase} ${!activeTeam ? 'text-white' : 'text-[#9aa1ab] hover:text-white'}`}
      >
        Messages
        {unreadDirects + invitations.length > 0 && <Badge count={unreadDirects + invitations.length} />}
        {!activeTeam && <span className="absolute inset-x-3 bottom-0 h-[3px] rounded-t bg-[#d7ff3a]" />}
      </button>

      <span className="mx-2 h-6 w-px shrink-0 bg-[#2a3037]" />

      {teams.map((team) => {
        const active = activeTeam?.id === team.id;
        const unread = unreadOfTeam(team.id);
        return (
          <button
            key={team.id}
            onClick={() => selectTeam(team)}
            className={`${tabBase} ${active ? 'text-white' : 'text-[#9aa1ab] hover:text-white'}`}
          >
            <span
              className={`flex h-7 w-7 items-center justify-center rounded-md text-xs font-extrabold ${
                active ? 'bg-[#d7ff3a] text-black' : 'bg-[#262b31] text-[#d5d9de]'
              }`}
            >
              {monogram(team.name)}
            </span>
            <span className="whitespace-nowrap">{team.name}</span>
            {unread > 0 && !active && <span className="h-2 w-2 rounded-full bg-[#d7ff3a]" />}
            {active && <span className="absolute inset-x-3 bottom-0 h-[3px] rounded-t bg-[#d7ff3a]" />}
          </button>
        );
      })}

      <button
        onClick={() => setIsCreateOpen(true)}
        className="ml-3 flex h-9 shrink-0 items-center gap-2 self-center whitespace-nowrap rounded-lg border border-[#363d45] px-3.5 text-sm font-semibold text-[#d7ff3a] transition-colors hover:border-[#d7ff3a]/60 hover:bg-[#d7ff3a]/10"
      >
        <PlusIcon /> Nouvelle équipe
      </button>
    </>
  );

  return (
    <div className="flex h-screen flex-col bg-[#0b0d0f] font-sans text-[15px] text-[#e9ebee] antialiased">
      <ToastStack toasts={toasts} onOpen={handleToastOpen} onDismiss={dismissToast} />

      {/* ============ BARRE DU HAUT ============ */}
      <header className="z-10 shrink-0 border-b border-[#23282e] bg-[#0f1215]">
        <div className="flex h-16 items-center justify-between pl-4 pr-3 md:pl-5">
          <div className="flex min-w-0 items-center">
            <div className="flex shrink-0 items-center gap-3 pr-4 md:pr-6">
              <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-[#d7ff3a] text-black">
                <svg width="18" height="18" viewBox="0 0 16 16" fill="currentColor">
                  <path d="M9.2 1 3 9h4l-1 6 7-8.5H8.8z" />
                </svg>
              </span>
              <span className="text-lg font-extrabold tracking-wide text-white">HUB</span>
            </div>

            <nav className={`hidden min-w-0 items-center overflow-x-auto md:flex ${NO_SCROLLBAR}`}>{renderTabs()}</nav>
          </div>

          <div className="flex shrink-0 items-center">
            <UserPanel onLogout={onLogout} onPlanChange={() => void refresh()} />
          </div>
        </div>

        {!selected && (
          <nav className={`flex items-center overflow-x-auto border-t border-[#23282e] px-2 md:hidden ${NO_SCROLLBAR}`}>
            {renderTabs()}
          </nav>
        )}
      </header>

      {/* ============ CORPS ============ */}
      <div className="flex min-h-0 flex-1">
        {/* ----- Panneau latéral ----- */}
        <aside
          className={`w-full shrink-0 flex-col border-r border-[#23282e] bg-[#0f1215] md:w-[340px] ${
            selected ? 'hidden md:flex' : 'flex'
          }`}
        >
          {loading ? (
            <div className="space-y-3 p-5">
              {[0, 1, 2, 3].map((i) => (
                <div key={i} className="h-11 animate-pulse rounded-lg bg-[#171a1e]" />
              ))}
              <p className="pt-2 text-sm text-[#9aa1ab]">Chargement…</p>
            </div>
          ) : activeTeam ? (
            <div className="flex-1 overflow-y-auto pb-8">
              <div className="flex items-center gap-3 px-5 pb-1 pt-5">
                <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-[#d7ff3a] text-base font-extrabold text-black">
                  {monogram(activeTeam.name)}
                </span>
                <div className="min-w-0 flex-1">
                  <h2 className="truncate text-lg font-bold leading-6 text-white">{activeTeam.name}</h2>
                  <div className="mt-0.5 flex items-center gap-2 text-[13px] text-[#9aa1ab]">
                    <span
                      className={`rounded px-1.5 py-0.5 text-xs font-bold ${
                        activeTeam.owner.plan === 'PREMIUM'
                          ? 'bg-[#d7ff3a]/15 text-[#d7ff3a]'
                          : 'bg-[#262b31] text-[#c3c9d0]'
                      }`}
                    >
                      {activeTeam.owner.plan === 'PREMIUM' ? 'PRO' : 'FREE'}
                    </span>
                    <span>{activeTeam.members.length} membres</span>
                  </div>
                </div>
                <button
                  onClick={() => setSettingsTeamId(activeTeam.id)}
                  title="Paramètres de l'équipe"
                  className="flex h-10 w-10 items-center justify-center rounded-lg text-2xl leading-none text-[#9aa1ab] transition-colors hover:bg-[#1c2025] hover:text-white"
                >
                  ⚙
                </button>
              </div>

              <div className="px-5 pt-5">
                {nextEvent ? (
                  <button
                    type="button"
                    disabled={!nextEvent.conversationId}
                    onClick={() => nextEvent.conversationId && openConversation(nextEvent.conversationId)}
                    className="w-full rounded-xl border border-[#d7ff3a]/30 bg-gradient-to-br from-[#d7ff3a]/15 to-transparent p-4 text-left transition-colors hover:border-[#d7ff3a]/60 disabled:cursor-default"
                  >
                    <span className="text-xs font-semibold uppercase tracking-wider text-[#d7ff3a]">
                      Prochain rendez-vous
                    </span>
                    <span className="mt-1.5 block truncate text-lg font-bold text-white">{eventLabel(nextEvent)}</span>
                    <span className="mt-0.5 block text-sm text-[#c3c9d0]">{formatEventDate(nextEvent.startsAt)}</span>
                  </button>
                ) : (
                  <div className="rounded-xl border border-dashed border-[#2a3037] p-4 text-sm text-[#9aa1ab]">
                    Aucun scrim ni événement prévu.
                  </div>
                )}
              </div>

              <section>
                <SectionTitle>Salons</SectionTitle>
                <ul className="space-y-0.5">
                  {channelsOf(activeTeam.id)
                    .filter((c) => c.type !== 'EVENT')
                    .map(renderChannel)}
                </ul>
              </section>

              <section>
                <SectionTitle
                  action={
                    canCreateEvent ? (
                      <button
                        onClick={() => setCreateEventTeamId(activeTeam.id)}
                        className="flex items-center gap-1.5 rounded-md border border-[#363d45] px-2.5 py-1.5 text-[13px] font-semibold text-[#d7ff3a] transition-colors hover:border-[#d7ff3a]/60 hover:bg-[#d7ff3a]/10"
                      >
                        <PlusIcon /> Nouveau
                      </button>
                    ) : undefined
                  }
                >
                  Agenda · Scrims &amp; events
                </SectionTitle>
                <ul className="space-y-2">{upcoming.map((e) => renderEvent(e, activeTeam.id, true))}</ul>
              </section>
            </div>
          ) : (
            <div className="flex flex-col h-full">
              {/* Onglets d'accueil rétablis (Comms / Invites / Events) */}
              <div className="flex gap-4 px-5 pt-5 pb-3 border-b border-[#23282e] shrink-0">
                <button
                  type="button"
                  className={`text-xs font-semibold uppercase tracking-wider pb-1 border-b-2 transition-colors ${
                    homeTab === 'dms' ? 'border-[#d7ff3a] text-white' : 'border-transparent text-[#9aa1ab] hover:text-white'
                  }`}
                  onClick={() => setHomeTab('dms')}
                >
                  Comms ({directs.length})
                </button>
                <button
                  type="button"
                  className={`text-xs font-semibold uppercase tracking-wider pb-1 border-b-2 transition-colors ${
                    homeTab === 'invitations' ? 'border-[#d7ff3a] text-white' : 'border-transparent text-[#9aa1ab] hover:text-white'
                  }`}
                  onClick={() => setHomeTab('invitations')}
                >
                  Invites {invitations.length > 0 && `(${invitations.length})`}
                </button>
                <button
                  type="button"
                  className={`text-xs font-semibold uppercase tracking-wider pb-1 border-b-2 transition-colors ${
                    homeTab === 'events' ? 'border-[#d7ff3a] text-white' : 'border-transparent text-[#9aa1ab] hover:text-white'
                  }`}
                  onClick={() => setHomeTab('events')}
                >
                  Events {conflictMap.size > 0 && '⚠️'}
                </button>
              </div>

              <div className="flex-1 overflow-y-auto p-2">
                {homeTab === 'invitations' ? (
                  <InvitationsList
                    invitations={invitations}
                    respondingId={respondingId}
                    error={invitationError}
                    onRespond={(inv, accept) => void respondToInvitation(inv, accept)}
                  />
                ) : homeTab === 'events' ? (
                  <MyEventsList
                    events={myEvents}
                    canOpen={(conversationId) => conversations.some((c) => c.id === conversationId)}
                    onOpen={(conversationId) => openConversation(conversationId)}
                  />
                ) : directs.length === 0 ? (
                  <p className="mx-5 my-4 text-xs font-mono text-[#9aa1ab] uppercase">Aucune conversation privée.</p>
                ) : (
                  <ul className="space-y-0.5">{directs.map((c) => renderChannel(c))}</ul>
                )}
              </div>
            </div>
          )}
        </aside>

        {/* ----- Zone de discussion ----- */}
        <main className={`min-w-0 flex-1 flex-col bg-[#0b0d0f] ${!selected ? 'hidden md:flex' : 'flex'}`}>
          {selected ? (
            <ConversationView
              key={selected.id}
              conversation={selected}
              meId={meId}
              teamName={selectedTeam?.name}
              onOpenSettings={selectedTeam ? () => setSettingsTeamId(selectedTeam.id) : undefined}
              onBack={() => setSelectedId(null)}
              onMessageSent={handleNewMessage}
            />
          ) : (
            <div className="flex h-full flex-col items-center justify-center px-6 text-center">
              <span className="mb-6 flex h-20 w-20 items-center justify-center rounded-2xl border border-[#23282e] bg-[#0f1215] text-[#d7ff3a]">
                <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
                  <circle cx="12" cy="12" r="8" />
                  <circle cx="12" cy="12" r="2" />
                  <path d="M12 1v5M12 18v5M1 12h5M18 12h5" />
                </svg>
              </span>
              <p className="text-xl font-bold text-white">Aucune conversation ouverte</p>
              <p className="mt-2 max-w-sm text-base text-[#9aa1ab]">
                Choisis un salon ou un événement dans le panneau de gauche pour coordonner ton équipe.
              </p>
              {error && (
                <p className="mt-5 rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-2.5 text-sm text-red-300">
                  {error}
                </p>
              )}
            </div>
          )}
        </main>

        {/* ----- Panneau des membres ----- */}
        {selected && selectedTeam && (
          <MemberList
            key={selectedTeam.id}
            team={selectedTeam}
            meId={meId}
            onChanged={() => void refresh()}
            onMessage={(userId) => void openDirect(userId)}
          />
        )}
      </div>

      {isCreateOpen && <CreateTeamModal onClose={() => setIsCreateOpen(false)} onCreated={handleTeamCreated} />}
      {createEventTeam && <CreateEventModal teamId={createEventTeam.id} isPremium={createEventTeam.owner.plan === 'PREMIUM'} onClose={() => setCreateEventTeamId(null)} onCreated={refresh} />}
      {settingsTeam && <TeamSettingsModal key={settingsTeam.id} team={settingsTeam} meId={meId} onClose={() => setSettingsTeamId(null)} onChanged={refresh} />}
      {inviteTeam && <AddMemberModal teamId={inviteTeam.id} memberIds={inviteTeam.members.map(m => m.userId)} onClose={() => setInviteTeamId(null)} />}
    </div>
  );
}