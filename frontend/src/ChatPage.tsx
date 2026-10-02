import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react';
import { api, conversationTitle, errorMessage, getCurrentUserId } from './api';
import { connectSocket, disconnectSocket } from './socket';
import type { Conversation, Message } from './types';
import ConversationView from './components/ConversationView';

interface Props {
  onLogout: () => void;
}

interface NotificationToast {
  id: string;
  conversationId: string;
  senderName: string;
  title: string;
  content: string;
}

export default function ChatPage({ onLogout }: Props) {
  const meId = getCurrentUserId();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  // État des messages non lus par conversation : { [convId]: number }
  const [unreadCounts, setUnreadCounts] = useState<Record<string, number>>({});

  // État du toast de notification en haut à droite
  const [toast, setToast] = useState<NotificationToast | null>(null);

  // Modal de création de groupe
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [newGroupName, setNewGroupName] = useState('');
  const [creatingGroup, setCreatingGroup] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  // Références stables pour les écouteurs Socket.io
  const conversationsRef = useRef<Conversation[]>([]);
  const selectedIdRef = useRef<string | null>(null);

  useEffect(() => {
    conversationsRef.current = conversations;
  }, [conversations]);

  useEffect(() => {
    selectedIdRef.current = selectedId;
    // Quand on ouvre une conversation, on réinitialise son compteur de messages non lus
    if (selectedId) {
      setUnreadCounts((prev) => {
        if (!prev[selectedId]) return prev;
        const next = { ...prev };
        delete next[selectedId];
        return next;
      });
    }
  }, [selectedId]);

  // Demander la permission pour les notifications natives du navigateur
  useEffect(() => {
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission().catch(() => {});
    }
  }, []);

  // Rechargement des conversations
  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setConversations(await api<Conversation[]>('/conversations'));
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setLoading(false);
    }
  }, []);

  // Premier chargement
  useEffect(() => {
    let cancelled = false;
    api<Conversation[]>('/conversations')
      .then((data) => {
        if (!cancelled) setConversations(data);
      })
      .catch((err) => {
        if (!cancelled) setError(errorMessage(err));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // Réception d'un nouveau message Socket.io
  const handleNewMessage = useCallback(
    (message: Message) => {
      const isFromMe = message.authorId === meId;
      const isCurrentConv = selectedIdRef.current === message.conversationId;

      // 1. Mettre à jour l'aperçu et remonter la conversation
      const known = conversationsRef.current.some((c) => c.id === message.conversationId);
      if (!known) {
        void load();
      } else {
        setConversations((prev) => {
          const conv = prev.find((c) => c.id === message.conversationId);
          if (!conv) return prev;
          const updated = { ...conv, messages: [message] };
          return [updated, ...prev.filter((c) => c.id !== conv.id)];
        });
      }

      // 2. Déclencher les notifications si ce n'est pas nous et que la conv n'est pas ouverte
      if (!isFromMe && !isCurrentConv) {
        // Incrémenter le badge non-lu
        setUnreadCounts((prev) => ({
          ...prev,
          [message.conversationId]: (prev[message.conversationId] || 0) + 1,
        }));

        const targetConv = conversationsRef.current.find((c) => c.id === message.conversationId);
        const title = targetConv ? conversationTitle(targetConv, meId) : 'Nouveau message';
        const sender = message.author?.displayName ?? 'Un collègue';

        // Notification Toast dans l'UI
        setToast({
          id: message.id,
          conversationId: message.conversationId,
          senderName: sender,
          title,
          content: message.content,
        });

        // Notification native du navigateur (si document caché ou minimisé)
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
    [load, meId],
  );

  // Auto-effacement du toast au bout de 4 secondes
  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(null), 4000);
    return () => clearTimeout(timer);
  }, [toast]);

  // Écouter Socket.io
  useEffect(() => {
    const socket = connectSocket();
    socket.on('message:new', handleNewMessage);
    return () => {
      socket.off('message:new', handleNewMessage);
    };
  }, [handleNewMessage]);

  useEffect(() => {
    return () => disconnectSocket();
  }, []);

  const handleCreateGroup = async (e: FormEvent) => {
    e.preventDefault();
    if (!newGroupName.trim()) return;

    setCreatingGroup(true);
    setCreateError(null);
    try {
      const created = await api<Conversation>('/conversations', {
        method: 'POST',
        body: { name: newGroupName.trim() },
      });
      setConversations((prev) => [created, ...prev]);
      setSelectedId(created.id);
      setIsModalOpen(false);
      setNewGroupName('');
    } catch (err) {
      setCreateError(errorMessage(err));
    } finally {
      setCreatingGroup(false);
    }
  };

  const teams = conversations.filter((c) => c.isGroup);
  const directs = conversations.filter((c) => !c.isGroup);
  const selected = conversations.find((c) => c.id === selectedId) ?? null;

  const renderItem = (c: Conversation) => {
    const title = conversationTitle(c, meId);
    const last = c.messages?.[0];
    const active = c.id === selectedId;
    const unread = unreadCounts[c.id] || 0;

    return (
      <li key={c.id}>
        <button
          type="button"
          onClick={() => setSelectedId(c.id)}
          className={`relative flex w-full items-center justify-between gap-3 rounded-lg px-2 py-2 text-left transition ${
            active ? 'bg-zinc-700/70 text-white' : 'text-zinc-300 hover:bg-zinc-800'
          }`}
        >
          <div className="flex min-w-0 items-center gap-3">
            <span
              className={`grid size-10 shrink-0 place-items-center font-semibold text-white ${
                c.isGroup ? 'rounded-xl bg-violet-600' : 'rounded-full bg-indigo-500'
              }`}
            >
              {title.charAt(0).toUpperCase()}
            </span>
            <span className="min-w-0">
              <span className={`block truncate ${unread > 0 ? 'font-bold text-white' : 'font-medium'}`}>
                {title}
              </span>
              <span className={`block truncate text-sm ${unread > 0 ? 'font-medium text-zinc-300' : 'text-zinc-500'}`}>
                {last ? last.content : 'Aucun message'}
              </span>
            </span>
          </div>

          {/* Badge de messages non lus */}
          {unread > 0 && (
            <span className="shrink-0 rounded-full bg-violet-600 px-2 py-0.5 text-[11px] font-bold text-white shadow-sm shadow-violet-600/50">
              {unread > 99 ? '99+' : unread}
            </span>
          )}
        </button>
      </li>
    );
  };

  return (
    <div className="fixed inset-0 grid grid-cols-1 bg-zinc-950 text-zinc-100 md:grid-cols-[300px_1fr]">
      {/* Toast de Notification Flottant */}
      {toast && (
        <div
          role="status"
          onClick={() => {
            setSelectedId(toast.conversationId);
            setToast(null);
          }}
          className="fixed top-5 right-5 z-50 flex max-w-sm cursor-pointer items-start gap-3 rounded-xl border border-violet-500/40 bg-zinc-900/95 p-4 shadow-2xl backdrop-blur-md transition hover:border-violet-400 animate-in fade-in slide-in-from-top-3 duration-300"
        >
          <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-violet-600 text-sm font-bold text-white">
            💬
          </span>
          <div className="min-w-0 flex-1">
            <div className="flex items-center justify-between">
              <p className="text-xs font-semibold text-violet-300">{toast.title}</p>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setToast(null);
                }}
                className="text-xs text-zinc-500 hover:text-white"
              >
                ✕
              </button>
            </div>
            <p className="mt-0.5 text-xs font-bold text-white">{toast.senderName}</p>
            <p className="mt-0.5 truncate text-xs text-zinc-400">{toast.content}</p>
          </div>
        </div>
      )}

      {/* Barre latérale */}
      <aside
        className={`min-h-0 flex-col border-r border-zinc-800 bg-zinc-900 ${
          selected ? 'hidden md:flex' : 'flex'
        }`}
      >
        <header className="flex items-center justify-between border-b border-zinc-800 px-4 py-4">
          <h1 className="text-lg font-bold">Messages</h1>
          <button
            type="button"
            onClick={onLogout}
            className="text-sm text-zinc-400 hover:text-white"
          >
            Déconnexion
          </button>
        </header>

        <div className="flex-1 overflow-y-auto px-2 pb-4">
          {loading && <p className="px-2 py-4 text-sm text-zinc-500">Chargement…</p>}

          {error && (
            <div className="m-2 rounded-lg bg-red-500/10 p-3 text-sm text-red-400">
              {error}{' '}
              <button type="button" onClick={() => void load()} className="underline">
                Réessayer
              </button>
            </div>
          )}

          {!loading && !error && (
            <>
              <div className="flex items-center justify-between px-2 pt-4 pb-1">
                <h2 className="text-xs font-semibold tracking-wider text-zinc-500 uppercase">
                  Équipes
                </h2>
                <button
                  type="button"
                  onClick={() => setIsModalOpen(true)}
                  className="rounded px-1.5 py-0.5 text-xs font-bold text-violet-400 hover:bg-zinc-800 hover:text-violet-300"
                  title="Créer une nouvelle équipe"
                >
                  + Nouveau
                </button>
              </div>

              {teams.length === 0 ? (
                <p className="px-2 text-sm text-zinc-500">Aucune équipe</p>
              ) : (
                <ul>{teams.map(renderItem)}</ul>
              )}

              <h2 className="px-2 pt-4 pb-1 text-xs font-semibold tracking-wider text-zinc-500 uppercase">
                Messages privés
              </h2>
              {directs.length === 0 ? (
                <p className="px-2 text-sm text-zinc-500">Aucun message privé</p>
              ) : (
                <ul>{directs.map(renderItem)}</ul>
              )}
            </>
          )}
        </div>
      </aside>

      {/* Vue de la discussion sélectionnée */}
      <main className={`min-h-0 min-w-0 flex-col ${selected ? 'flex' : 'hidden md:flex'}`}>
        {selected ? (
          <ConversationView
            key={selected.id}
            conversation={selected}
            meId={meId}
            onBack={() => setSelectedId(null)}
            onMessageSent={handleNewMessage}
          />
        ) : (
          <div className="grid flex-1 place-items-center text-zinc-500">
            Sélectionne une conversation
          </div>
        )}
      </main>

      {/* Modal de création d'équipe */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
          <div className="w-full max-w-sm rounded-xl border border-zinc-800 bg-zinc-900 p-6 shadow-xl">
            <h3 className="text-lg font-semibold text-white">Créer une équipe</h3>
            <form onSubmit={handleCreateGroup} className="mt-4 space-y-4">
              <div>
                <label htmlFor="groupName" className="block text-xs font-medium text-zinc-400">
                  Nom du salon
                </label>
                <input
                  id="groupName"
                  type="text"
                  required
                  value={newGroupName}
                  onChange={(e) => setNewGroupName(e.target.value)}
                  placeholder="Ex: Projet S4, Général..."
                  className="mt-1 w-full rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-white placeholder-zinc-500 outline-none focus:border-violet-500"
                />
              </div>

              {createError && (
                <p className="text-xs text-red-400">{createError}</p>
              )}

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => {
                    setIsModalOpen(false);
                    setCreateError(null);
                  }}
                  className="rounded-lg px-3 py-1.5 text-sm text-zinc-400 hover:text-white"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  disabled={creatingGroup || !newGroupName.trim()}
                  className="rounded-lg bg-violet-600 px-4 py-1.5 text-sm font-medium text-white transition hover:bg-violet-500 disabled:opacity-50"
                >
                  {creatingGroup ? 'Création…' : 'Créer'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}