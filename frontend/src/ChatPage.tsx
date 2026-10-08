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
import type { Conversation, ConversationType, Invitation, Message, Team } from './types';
import AddMemberModal from './components/AddMemberModal';
import ConversationView from './components/ConversationView';
import CreateTeamModal from './components/CreateTeamModal';
import InvitationsList from './components/InvitationsList';
import MemberList from './components/MemberList';
import TeamSettingsModal from './components/TeamSettingsModal';
import ToastStack, { type NotificationToast } from './components/ToastStack';
import UserPanel from './components/UserPanel';

interface Props {
  onLogout: () => void;
}

const MAX_TOASTS = 3;

// Les toasts d'invitation ont une clé « invite:<id> » pour ne pas être
// confondus avec ceux des conversations
const INVITE_PREFIX = 'invite:';

// Ordre des salons dans une équipe
const CHANNEL_ORDER: Record<ConversationType, number> = {
  GENERAL: 0,
  ADMIN: 1,
  EVENT: 2,
  DIRECT: 3,
};

// Couleurs des icônes d'équipe (choisies selon l'id, donc stables)
const TEAM_COLORS = [
  'from-violet-500 to-indigo-600',
  'from-rose-500 to-orange-500',
  'from-emerald-500 to-teal-600',
  'from-sky-500 to-blue-600',
  'from-amber-500 to-red-500',
  'from-fuchsia-500 to-purple-600',
];

function teamColor(id: string): string {
  let hash = 0;
  for (const char of id) hash = (hash * 31 + char.charCodeAt(0)) >>> 0;
  return TEAM_COLORS[hash % TEAM_COLORS.length];
}

// « KCorp Valorant » → « KV », « Scrims » → « SC »
function initials(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean);
  if (words.length >= 2) return (words[0][0] + words[1][0]).toUpperCase();
  return name.trim().slice(0, 2).toUpperCase();
}

// Transforme les compteurs renvoyés par le serveur en { [convId]: nombre }
function unreadFrom(list: Conversation[]): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const c of list) {
    if (c.unreadCount) counts[c.id] = c.unreadCount;
  }
  return counts;
}

// Charge conversations et équipes en parallèle
function fetchAll() {
  return Promise.all([api<Conversation[]>('/conversations'), api<Team[]>('/teams')]);
}

const isDesktop = () => window.matchMedia('(min-width: 768px)').matches;

export default function ChatPage({ onLogout }: Props) {
  const meId = getCurrentUserId();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [teams, setTeams] = useState<Team[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  // Ce qui est choisi dans le rail : une équipe, ou null = messages privés
  const [activeTeamId, setActiveTeamId] = useState<string | null>(null);
  const [homeTab, setHomeTab] = useState<'dms' | 'invitations'>('dms');

  // Invitations reçues
  const [invitations, setInvitations] = useState<Invitation[]>([]);
  const [respondingId, setRespondingId] = useState<string | null>(null);
  const [invitationError, setInvitationError] = useState<string | null>(null);

  // Messages non lus par conversation : { [convId]: number }
  const [unreadCounts, setUnreadCounts] = useState<Record<string, number>>({});

  // Pile de toasts (le plus récent en premier)
  const [toasts, setToasts] = useState<NotificationToast[]>([]);

  // Fenêtres
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [settingsTeamId, setSettingsTeamId] = useState<string | null>(null);
  const [inviteTeamId, setInviteTeamId] = useState<string | null>(null);

  // Références stables pour les écouteurs Socket.io
  const conversationsRef = useRef<Conversation[]>([]);
  const teamsRef = useRef<Team[]>([]);
  const selectedIdRef = useRef<string | null>(null);

  useEffect(() => {
    conversationsRef.current = conversations;
  }, [conversations]);

  useEffect(() => {
    teamsRef.current = teams;
  }, [teams]);

  useEffect(() => {
    selectedIdRef.current = selectedId;
  }, [selectedId]);

  // Demander la permission pour les notifications natives du navigateur
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

  // Rechargement avec écran de chargement (bouton « Réessayer »)
  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [convs, teamList] = await fetchAll();
      applyData(convs, teamList);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setLoading(false);
    }
  }, [applyData]);

  // Rechargement silencieux. Renvoie les conversations, pour pouvoir en ouvrir une juste après.
  const refresh = useCallback(async (): Promise<Conversation[] | null> => {
    try {
      const [convs, teamList] = await fetchAll();
      applyData(convs, teamList);
      return convs;
    } catch {
      return null; // en cas d'échec, l'affichage actuel reste en place
    }
  }, [applyData]);

  // Premier chargement : on ouvre la première équipe s'il y en a une
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
      .catch(() => {
        // sans invitations, l'onglet reste simplement vide
      });
    return () => {
      cancelled = true;
    };
  }, [applyData]);

  // Nom complet d'une conversation : « KCorp · #général » ou le pseudo pour un MP
  const fullTitle = useCallback(
    (c: Conversation, teamList: Team[]) => {
      const base = conversationTitle(c, meId);
      const team = c.teamId ? teamList.find((t) => t.id === c.teamId) : undefined;
      return team ? `${team.name} · ${base}` : base;
    },
    [meId],
  );

  // Ajoute un toast en haut de la pile. Un nouveau message d'une conversation
  // qui a déjà un toast le met à jour au lieu d'en créer un deuxième.
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

  // Ouvrir une conversation : bonne équipe dans le rail, badge et toast effacés,
  // lecture enregistrée. teamId peut être fourni quand la liste vient d'être rechargée.
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

  // Ouvre le #général d'une équipe (après création ou acceptation)
  const openTeamGeneral = useCallback(
    (convs: Conversation[] | null, teamId: string) => {
      const general = convs?.find((c) => c.teamId === teamId && c.type === 'GENERAL');
      if (general) openConversation(general.id, teamId);
      else setActiveTeamId(teamId);
    },
    [openConversation],
  );

  // Ouvre (ou crée) un message privé avec un joueur
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

  // Clic sur un toast : invitation → onglet Invitations, sinon → la conversation
  const handleToastOpen = useCallback(
    (key: string) => {
      if (key.startsWith(INVITE_PREFIX)) {
        dismissToast(key);
        setActiveTeamId(null);
        setHomeTab('invitations');
        setSelectedId(null); // sur mobile, la liste doit être visible
        return;
      }
      openConversation(key);
    },
    [dismissToast, openConversation],
  );

  // Réception d'un nouveau message Socket.io
  const handleNewMessage = useCallback(
    (message: Message) => {
      const isFromMe = message.authorId === meId;
      const isCurrentConv = selectedIdRef.current === message.conversationId;

      // 1. Mettre à jour l'aperçu
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

      // Message reçu dans la conversation ouverte : on le considère lu
      if (!isFromMe && isCurrentConv) {
        void markConversationRead(message.conversationId);
      }

      // 2. Notifications si ce n'est pas nous et que la conversation n'est pas ouverte
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

        // Notification native du navigateur (si l'onglet n'est pas visible)
        if ('Notification' in window && Notification.permission === 'granted' && document.hidden) {
          try {
            new Notification(`${sender} (${title})`, {
              body: message.content,
              icon: '/favicon.ico',
            });
          } catch {}
        }
      }
    },
    [refresh, meId, pushToast, fullTitle],
  );

  // Écouter les nouveaux messages
  useEffect(() => {
    const socket = connectSocket();
    socket.on('message:new', handleNewMessage);
    return () => {
      socket.off('message:new', handleNewMessage);
    };
  }, [handleNewMessage]);

  // Accès à un nouveau salon, ou équipes modifiées (membres, rôles, nom, suppression…)
  useEffect(() => {
    const socket = connectSocket();
    const onChange = () => {
      void refresh();
    };
    socket.on('conversation:new', onChange);
    socket.on('teams:changed', onChange);
    return () => {
      socket.off('conversation:new', onChange);
      socket.off('teams:changed', onChange);
    };
  }, [refresh]);

  // Invitations reçues ou annulées en direct
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

      if ('Notification' in window && Notification.permission === 'granted' && document.hidden) {
        try {
          new Notification(`Invitation : ${team}`, {
            body: `${inviter} t'invite à rejoindre l'équipe`,
            icon: '/favicon.ico',
          });
        } catch {}
      }
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

  // Accepter ou refuser une invitation
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
      // Expirée ou annulée entre-temps : on la retire de la liste
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

  // ---------- Données dérivées ----------

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

  // Si l'équipe active a disparu (supprimée, exclu…), on retombe sur les messages privés
  const activeTeam = activeTeamId ? teams.find((t) => t.id === activeTeamId) : undefined;
  const selected = conversations.find((c) => c.id === selectedId) ?? null;
  const selectedTeam = selected?.teamId ? teams.find((t) => t.id === selected.teamId) : undefined;
  const settingsTeam = settingsTeamId ? teams.find((t) => t.id === settingsTeamId) : undefined;
  const inviteTeam = inviteTeamId ? teams.find((t) => t.id === inviteTeamId) : undefined;

  // Clic sur une équipe dans le rail : sur ordinateur, on ouvre directement son #général
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

  // ---------- Morceaux d'interface ----------

  const countBadge = (count: number, extra = '') =>
    count > 0 ? (
      <span
        className={`min-w-5 rounded-full bg-red-500 px-1.5 text-center text-[11px] leading-5 font-bold text-white ${extra}`}
      >
        {count > 99 ? '99+' : count}
      </span>
    ) : null;

  // Barre blanche à gauche d'une icône du rail (comme Discord)
  const railPill = (active: boolean, hasUnread: boolean) => (
    <span
      className={`absolute top-1/2 left-0 w-1 -translate-y-1/2 rounded-r-full bg-white transition-all duration-200 ${
        active ? 'h-10' : hasUnread ? 'h-2 group-hover:h-5' : 'h-0 group-hover:h-5'
      }`}
    />
  );

  const renderChannel = (c: Conversation) => {
    const active = c.id === selectedId;
    const unread = unreadCounts[c.id] || 0;
    return (
      <li key={c.id}>
        <button
          type="button"
          onClick={() => openConversation(c.id)}
          className={`group flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-[15px] transition ${
            active
              ? 'bg-zinc-700/60 text-white'
              : unread > 0
                ? 'font-semibold text-white hover:bg-zinc-800/80'
                : 'text-zinc-400 hover:bg-zinc-800/80 hover:text-zinc-200'
          }`}
        >
          <span className="text-lg leading-none text-zinc-500">#</span>
          <span className="min-w-0 flex-1 truncate">{c.name}</span>
          {c.type === 'ADMIN' && (
            <span className="text-xs opacity-70" title="CEO et coachs uniquement">
              🔒
            </span>
          )}
          {countBadge(unread)}
        </button>
      </li>
    );
  };

  const renderDirect = (c: Conversation) => {
    const title = conversationTitle(c, meId);
    const last = c.messages?.[0];
    const active = c.id === selectedId;
    const unread = unreadCounts[c.id] || 0;
    return (
      <li key={c.id}>
        <button
          type="button"
          onClick={() => openConversation(c.id, null)}
          className={`flex w-full items-center gap-3 rounded-md px-2 py-2 text-left transition ${
            active ? 'bg-zinc-700/60 text-white' : 'text-zinc-300 hover:bg-zinc-800/80'
          }`}
        >
          <span className="grid size-9 shrink-0 place-items-center rounded-full bg-indigo-500 text-sm font-semibold text-white">
            {title.charAt(0).toUpperCase()}
          </span>
          <span className="min-w-0 flex-1">
            <span className={`block truncate text-sm ${unread > 0 ? 'font-bold text-white' : 'font-medium'}`}>
              {title}
            </span>
            <span className={`block truncate text-xs ${unread > 0 ? 'text-zinc-300' : 'text-zinc-500'}`}>
              {last ? last.content : 'Aucun message'}
            </span>
          </span>
          {countBadge(unread)}
        </button>
      </li>
    );
  };

  const sectionTitle = 'px-2 pb-1 text-xs font-semibold tracking-wider text-zinc-500 uppercase';

  // Colonne du milieu quand une équipe est choisie : ses salons
  const renderTeamPanel = (team: Team) => {
    const isPremium = team.owner.plan === 'PREMIUM';
    const canInvite = team.myRole === 'CEO' || (team.myRole === 'COACH' && isPremium);

    return (
      <>
        <header className="flex h-14 shrink-0 items-center justify-between gap-2 border-b border-zinc-800/80 px-4 shadow-sm">
          <div className="min-w-0">
            <h2 className="truncate font-bold text-white">{team.name}</h2>
            <p className="text-[11px] text-zinc-500">
              {isPremium ? <span className="text-amber-400">★ Premium</span> : 'Free'} ·{' '}
              {team.members.length}/{team.limits.maxSlots} membres
            </p>
          </div>
          <button
            type="button"
            onClick={() => setSettingsTeamId(team.id)}
            className="grid size-8 shrink-0 place-items-center rounded-md text-zinc-400 transition hover:bg-zinc-800 hover:text-white"
            title="Paramètres de l'équipe"
            aria-label="Paramètres de l'équipe"
          >
            ⚙
          </button>
        </header>

        <div className="flex-1 space-y-5 overflow-y-auto px-2 py-4">
          {canInvite && (
            <button
              type="button"
              onClick={() => setInviteTeamId(team.id)}
              className="flex w-full items-center justify-center gap-2 rounded-md bg-violet-600 px-3 py-2 text-sm font-medium text-white transition hover:bg-violet-500"
            >
              + Inviter des joueurs
            </button>
          )}

          <section>
            <h3 className={sectionTitle}>Salons</h3>
            <ul className="space-y-0.5">{channelsOf(team.id).map(renderChannel)}</ul>
          </section>
        </div>
      </>
    );
  };

  // Colonne du milieu pour les messages privés et les invitations
  const renderHomePanel = () => {
    const pill = (active: boolean) =>
      `flex flex-1 items-center justify-center gap-1.5 rounded-md px-2 py-1.5 text-sm font-medium transition ${
        active ? 'bg-zinc-700/60 text-white' : 'text-zinc-400 hover:bg-zinc-800 hover:text-white'
      }`;
    return (
      <>
        <header className="flex h-14 shrink-0 items-center border-b border-zinc-800/80 px-4 shadow-sm">
          <h2 className="font-bold text-white">Messages privés</h2>
        </header>
        <div className="flex gap-1 p-2">
          <button type="button" className={pill(homeTab === 'dms')} onClick={() => setHomeTab('dms')}>
            Discussions
          </button>
          <button
            type="button"
            className={pill(homeTab === 'invitations')}
            onClick={() => setHomeTab('invitations')}
          >
            Invitations
            {invitations.length > 0 && (
              <span className="rounded-full bg-amber-500 px-1.5 text-[10px] leading-4 font-bold text-zinc-950">
                {invitations.length}
              </span>
            )}
          </button>
        </div>
        <div className="flex-1 overflow-y-auto px-2 pb-4">
          {homeTab === 'invitations' ? (
            <InvitationsList
              invitations={invitations}
              respondingId={respondingId}
              error={invitationError}
              onRespond={(inv, accept) => void respondToInvitation(inv, accept)}
            />
          ) : directs.length === 0 ? (
            <p className="px-2 py-4 text-sm text-zinc-500">Aucun message privé pour l'instant.</p>
          ) : (
            <ul className="space-y-0.5">{directs.map(renderDirect)}</ul>
          )}
        </div>
      </>
    );
  };

  // ---------- Rendu ----------

  return (
    <div className="fixed inset-0 flex bg-zinc-950 text-zinc-100">
      {/* Pile de toasts */}
      <ToastStack toasts={toasts} onOpen={handleToastOpen} onDismiss={dismissToast} />

      {/* Navigation : rail + colonne du milieu (cachée sur mobile quand une conversation est ouverte) */}
      <div className={`min-h-0 w-full shrink-0 md:flex md:w-auto ${selected ? 'hidden' : 'flex'}`}>
        {/* Rail des équipes */}
        <nav className="flex w-[72px] shrink-0 flex-col items-center gap-2 overflow-y-auto bg-zinc-950 py-3">
          {/* Messages privés */}
          <div className="group relative flex w-full justify-center">
            {railPill(!activeTeam, unreadDirects > 0)}
            <button
              type="button"
              onClick={selectHome}
              title="Messages privés et invitations"
              className={`grid size-12 place-items-center text-xl transition-all duration-200 ${
                !activeTeam
                  ? 'rounded-2xl bg-indigo-500 text-white'
                  : 'rounded-3xl bg-zinc-800 text-zinc-300 group-hover:rounded-2xl group-hover:bg-indigo-500 group-hover:text-white'
              }`}
            >
              💬
            </button>
            {countBadge(unreadDirects + invitations.length, 'absolute -right-0 bottom-0 ring-4 ring-zinc-950')}
          </div>

          <div className="h-0.5 w-8 rounded-full bg-zinc-800" />

          {/* Une icône par équipe */}
          {teams.map((team) => {
            const active = activeTeam?.id === team.id;
            const unread = unreadOfTeam(team.id);
            return (
              <div key={team.id} className="group relative flex w-full justify-center">
                {railPill(active, unread > 0)}
                <button
                  type="button"
                  onClick={() => selectTeam(team)}
                  title={team.name}
                  className={`grid size-12 place-items-center bg-linear-to-br text-sm font-bold text-white shadow-md transition-all duration-200 ${teamColor(team.id)} ${
                    active ? 'rounded-2xl' : 'rounded-3xl group-hover:rounded-2xl'
                  }`}
                >
                  {initials(team.name)}
                </button>
                {team.owner.plan === 'PREMIUM' && (
                  <span className="absolute top-0 right-2 text-[10px] text-amber-400 drop-shadow">★</span>
                )}
                {countBadge(unread, 'absolute -right-0 bottom-0 ring-4 ring-zinc-950')}
              </div>
            );
          })}

          {/* Créer une équipe */}
          <button
            type="button"
            onClick={() => setIsCreateOpen(true)}
            title="Créer une équipe"
            className="grid size-12 place-items-center rounded-3xl bg-zinc-800 text-2xl text-emerald-400 transition-all duration-200 hover:rounded-2xl hover:bg-emerald-500 hover:text-white"
          >
            +
          </button>
        </nav>

        {/* Colonne du milieu */}
        <aside className="flex min-h-0 min-w-0 flex-1 flex-col bg-zinc-900 md:w-64 md:flex-none">
          {loading ? (
            <p className="p-4 text-sm text-zinc-500">Chargement…</p>
          ) : error ? (
            <div className="m-3 rounded-lg bg-red-500/10 p-3 text-sm text-red-400">
              {error}{' '}
              <button type="button" onClick={() => void load()} className="underline">
                Réessayer
              </button>
            </div>
          ) : activeTeam ? (
            renderTeamPanel(activeTeam)
          ) : (
            renderHomePanel()
          )}

          {/* Mon profil, en bas comme sur Discord */}
          <UserPanel onLogout={onLogout} onPlanChange={() => void refresh()} />        </aside>
      </div>

      {/* Conversation sélectionnée */}
      <main className={`min-h-0 min-w-0 flex-1 flex-col bg-zinc-950 ${selected ? 'flex' : 'hidden md:flex'}`}>
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
          <div className="grid flex-1 place-items-center p-6 text-center">
            <div>
              <div className="mx-auto grid size-16 place-items-center rounded-2xl bg-zinc-900 text-3xl">
                {activeTeam ? '#' : '💬'}
              </div>
              <p className="mt-4 font-semibold text-zinc-300">
                {activeTeam ? `Bienvenue dans ${activeTeam.name}` : 'Tes messages privés'}
              </p>
              <p className="mt-1 text-sm text-zinc-500">
                {activeTeam ? 'Choisis un salon pour commencer.' : 'Choisis une conversation.'}
              </p>
            </div>
          </div>
        )}
      </main>

      {/* Membres à droite, quand un salon d'équipe est ouvert (grands écrans) */}
      {selected && selectedTeam && (
        <MemberList
          key={selectedTeam.id}
          team={selectedTeam}
          meId={meId}
          onChanged={() => void refresh()}
          onMessage={(userId) => void openDirect(userId)}
        />
      )}

      {isCreateOpen && (
        <CreateTeamModal
          onClose={() => setIsCreateOpen(false)}
          onCreated={(team) => void handleTeamCreated(team)}
        />
      )}

      {/* Si l'équipe disparaît (supprimée, exclu…), la fenêtre se ferme toute seule */}
      {settingsTeam && (
        <TeamSettingsModal
          key={settingsTeam.id}
          team={settingsTeam}
          meId={meId}
          onClose={() => setSettingsTeamId(null)}
          onChanged={() => void refresh()}
        />
      )}

      {inviteTeam && (
        <AddMemberModal
          teamId={inviteTeam.id}
          memberIds={inviteTeam.members.map((m) => m.userId)}
          onClose={() => setInviteTeamId(null)}
        />
      )}
    </div>
  );
}