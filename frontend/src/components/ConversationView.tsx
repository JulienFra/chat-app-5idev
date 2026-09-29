import { useEffect, useRef, useState } from 'react';
import type { FormEvent } from 'react';
import { api, conversationTitle, errorMessage } from '../api';
import { connectSocket } from '../socket';
import type { Conversation, Message, Membership } from '../types';

interface Props {
  conversation: Conversation;
  meId: string | null;
  onBack: () => void;
  onMessageSent: (message: Message) => void;
}

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString('fr-BE', { hour: '2-digit', minute: '2-digit' });
}

function addMessage(list: Message[], message: Message): Message[] {
  return list.some((m) => m.id === message.id) ? list : [...list, message];
}

export default function ConversationView({ conversation, meId, onBack, onMessageSent }: Props) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [memberships, setMemberships] = useState<Membership[]>(conversation.memberships ?? []);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  // Gestion du modal d'ajout de membre (S4)
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [identifier, setIdentifier] = useState('');
  const [addingMember, setAddingMember] = useState(false);
  const [addMemberError, setAddMemberError] = useState<string | null>(null);

  // Vérifier si l'utilisateur connecté est ADMIN de ce salon
  const myMembership = memberships.find((m) => m.userId === meId);
  const isAdmin = conversation.isGroup && myMembership?.role === 'ADMIN';

  // Synchroniser les membres si la conversation change
  useEffect(() => {
    setMemberships(conversation.memberships ?? []);
  }, [conversation]);

  // Charger l'historique
  useEffect(() => {
    let cancelled = false;
    api<Message[]>(`/conversations/${conversation.id}/messages`)
      .then((data) => {
        if (!cancelled) setMessages(data);
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
  }, [conversation.id]);

  // Messages Socket.io en direct
  useEffect(() => {
    const socket = connectSocket();
    const onNewMessage = (message: Message) => {
      if (message.conversationId !== conversation.id) return;
      setMessages((prev) => addMessage(prev, message));
    };
    socket.on('message:new', onNewMessage);
    return () => {
      socket.off('message:new', onNewMessage);
    };
  }, [conversation.id]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ block: 'end' });
  }, [messages]);

  const handleSend = async (e: FormEvent) => {
    e.preventDefault();
    const content = draft.trim();
    if (!content || sending) return;

    setSending(true);
    setSendError(null);
    try {
      const message = await api<Message>(`/conversations/${conversation.id}/messages`, {
        method: 'POST',
        body: { content },
      });
      setMessages((prev) => addMessage(prev, message));
      setDraft('');
      onMessageSent(message);
    } catch (err) {
      setSendError(errorMessage(err));
    } finally {
      setSending(false);
    }
  };

  const handleAddMember = async (e: FormEvent) => {
    e.preventDefault();
    if (!identifier.trim()) return;

    setAddingMember(true);
    setAddMemberError(null);
    try {
      const newMembership = await api<Membership>(`/conversations/${conversation.id}/members`, {
        method: 'POST',
        body: { identifier: identifier.trim() },
      });
      setMemberships((prev) => [...prev.filter((m) => m.userId !== newMembership.userId), newMembership]);
      setIsAddModalOpen(false);
      setIdentifier('');
    } catch (err) {
      setAddMemberError(errorMessage(err));
    } finally {
      setAddingMember(false);
    }
  };

  return (
    <>
      <header className="flex items-center justify-between border-b border-zinc-800 bg-zinc-900 px-4 py-3">
        <div className="flex items-center gap-3 min-w-0">
          <button
            type="button"
            onClick={onBack}
            className="text-xl text-zinc-400 hover:text-white md:hidden"
            aria-label="Retour"
          >
            ←
          </button>
          <div className="min-w-0">
            <h2 className="truncate font-semibold">{conversationTitle(conversation, meId)}</h2>
            {conversation.isGroup && (
              <p className="truncate text-xs text-zinc-500">
                {memberships.map((m) => m.user.displayName).join(', ')}
              </p>
            )}
          </div>
        </div>

        {/* Bouton visible uniquement pour l'ADMIN du salon */}
        {isAdmin && (
          <button
            type="button"
            onClick={() => setIsAddModalOpen(true)}
            className="rounded-lg border border-violet-500/30 bg-violet-600/10 px-3 py-1.5 text-xs font-semibold text-violet-300 hover:bg-violet-600/20"
          >
            + Ajouter membre
          </button>
        )}
      </header>

      <div className="flex-1 overflow-y-auto px-4 py-4">
        {loading && <p className="text-center text-sm text-zinc-500">Chargement…</p>}

        {error && (
          <p className="mx-auto max-w-md rounded-lg bg-red-500/10 p-3 text-center text-sm text-red-400">
            {error}
          </p>
        )}

        {!loading && !error && messages.length === 0 && (
          <p className="text-center text-sm text-zinc-500">Aucun message. Écris le premier !</p>
        )}

        {messages.map((m, i) => {
          const mine = m.authorId === meId;
          const sameAuthorAsPrevious = messages[i - 1]?.authorId === m.authorId;
          const showAuthor = conversation.isGroup && !mine && !sameAuthorAsPrevious;

          return (
            <div
              key={m.id}
              className={`flex ${mine ? 'justify-end' : 'justify-start'} ${
                sameAuthorAsPrevious ? 'mt-1' : 'mt-3'
              }`}
            >
              <div
                className={`max-w-[75%] rounded-2xl px-3 py-2 ${
                  mine
                    ? 'rounded-br-md bg-indigo-600 text-white'
                    : 'rounded-bl-md bg-zinc-800 text-zinc-100'
                }`}
              >
                {showAuthor && (
                  <p className="mb-0.5 text-xs font-semibold text-violet-300">
                    {m.author?.displayName ?? 'Inconnu'}
                  </p>
                )}
                <p className="break-words whitespace-pre-wrap">{m.content}</p>
                <p
                  className={`mt-1 text-right text-[11px] ${
                    mine ? 'text-indigo-200' : 'text-zinc-500'
                  }`}
                >
                  {formatTime(m.createdAt)}
                </p>
              </div>
            </div>
          );
        })}
        <div ref={bottomRef} />
      </div>

      <form onSubmit={handleSend} className="border-t border-zinc-800 bg-zinc-900 px-4 py-3">
        {sendError && <p className="mb-2 text-sm text-red-400">{sendError}</p>}
        <div className="flex gap-2">
          <input
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            maxLength={4000}
            placeholder="Écris un message…"
            className="min-w-0 flex-1 rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-zinc-100 placeholder:text-zinc-500 focus:border-indigo-500 focus:outline-none"
          />
          <button
            type="submit"
            disabled={sending || draft.trim().length === 0}
            className="rounded-lg bg-indigo-600 px-4 py-2 font-medium text-white hover:bg-indigo-500 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Envoyer
          </button>
        </div>
      </form>

      {/* Modal d'invitation de membre */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
          <div className="w-full max-w-sm rounded-xl border border-zinc-800 bg-zinc-900 p-6 shadow-xl">
            <h3 className="text-lg font-semibold text-white">Ajouter un membre</h3>
            <p className="mt-1 text-xs text-zinc-400">
              Entre l'adresse email de l'utilisateur à ajouter.
            </p>
            <form onSubmit={handleAddMember} className="mt-4 space-y-4">
              <div>
                <label htmlFor="userIdentifier" className="block text-xs font-medium text-zinc-400">
                  Email du membre
                </label>
                <input
                  id="userIdentifier"
                  type="text"
                  required
                  value={identifier}
                  onChange={(e) => setIdentifier(e.target.value)}
                  placeholder="ex: alice@test.com"
                  className="mt-1 w-full rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-white placeholder-zinc-500 outline-none focus:border-violet-500"
                />
              </div>

              {addMemberError && (
                <p className="text-xs text-red-400">{addMemberError}</p>
              )}

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => {
                    setIsAddModalOpen(false);
                    setAddMemberError(null);
                  }}
                  className="rounded-lg px-3 py-1.5 text-sm text-zinc-400 hover:text-white"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  disabled={addingMember || !identifier.trim()}
                  className="rounded-lg bg-violet-600 px-4 py-1.5 text-sm font-medium text-white transition hover:bg-violet-500 disabled:opacity-50"
                >
                  {addingMember ? 'Ajout…' : 'Ajouter'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}