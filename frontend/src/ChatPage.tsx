import { useCallback, useEffect, useState } from 'react';
import { api, conversationTitle, errorMessage, getCurrentUserId } from './api';
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

  useEffect(() => {
    void load();
  }, [load]);

  // Après un envoi : l'aperçu se met à jour et la conversation remonte en tête
  const handleMessageSent = (message: Message) => {
    setConversations((prev) => {
      const conv = prev.find((c) => c.id === message.conversationId);
      if (!conv) return prev;
      const updated = { ...conv, messages: [message] };
      return [updated, ...prev.filter((c) => c.id !== conv.id)];
    });
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
              <h2 className="px-2 pt-4 pb-1 text-xs font-semibold tracking-wider text-zinc-500 uppercase">
                Équipes
              </h2>
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
            onMessageSent={handleMessageSent}
          />
        ) : (
          <div className="grid flex-1 place-items-center text-zinc-500">
            Sélectionne une conversation
          </div>
        )}
      </main>
    </div>
  );
}