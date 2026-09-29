import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react';
import { api, conversationTitle, errorMessage, getCurrentUserId } from './api';
import { connectSocket, disconnectSocket } from './socket';
import type { Conversation, Message } from './types';
import ConversationView from './components/ConversationView';

interface Props {
  onLogout: () => void;
}

export default function ChatPage({ onLogout }: Props) {
  const meId = getCurrentUserId();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  // État du modal de création de groupe
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [newGroupName, setNewGroupName] = useState('');
  const [creatingGroup, setCreatingGroup] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  // Garde la liste à jour dans une référence, lisible depuis les callbacks
  const conversationsRef = useRef<Conversation[]>([]);
  useEffect(() => {
    conversationsRef.current = conversations;
  }, [conversations]);

  // Rechargement à la demande (bouton « Réessayer », nouvelle conversation)
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

  // Met à jour l'aperçu et remonte la conversation en tête de liste
  const handleNewMessage = useCallback(
    (message: Message) => {
      const known = conversationsRef.current.some((c) => c.id === message.conversationId);
      if (!known) {
        void load();
        return;
      }
      setConversations((prev) => {
        const conv = prev.find((c) => c.id === message.conversationId);
        if (!conv) return prev;
        const updated = { ...conv, messages: [message] };
        return [updated, ...prev.filter((c) => c.id !== conv.id)];
      });
    },
    [load],
  );

  // Écouter les messages en direct
  useEffect(() => {
    const socket = connectSocket();
    socket.on('message:new', handleNewMessage);
    return () => {
      socket.off('message:new', handleNewMessage);
    };
  }, [handleNewMessage]);

  // Fermer la connexion WebSocket en quittant la messagerie
  useEffect(() => {
    return () => disconnectSocket();
  }, []);

  // Création du groupe via l'API (objet direct sans JSON.stringify)
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
    return (
      <li key={c.id}>
        <button
          type="button"
          onClick={() => setSelectedId(c.id)}
          className={`flex w-full items-center gap-3 rounded-lg px-2 py-2 text-left transition ${
            active ? 'bg-zinc-700/70 text-white' : 'text-zinc-300 hover:bg-zinc-800'
          }`}
        >
          <span
            className={`grid size-10 shrink-0 place-items-center font-semibold text-white ${
              c.isGroup ? 'rounded-xl bg-violet-600' : 'rounded-full bg-indigo-500'
            }`}
          >
            {title.charAt(0).toUpperCase()}
          </span>
          <span className="min-w-0">
            <span className="block truncate font-medium">{title}</span>
            <span className="block truncate text-sm text-zinc-500">
              {last ? last.content : 'Aucun message'}
            </span>
          </span>
        </button>
      </li>
    );
  };

  return (
    <div className="fixed inset-0 grid grid-cols-1 bg-zinc-950 text-zinc-100 md:grid-cols-[300px_1fr]">
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