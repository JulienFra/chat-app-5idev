import { useEffect, useRef, useState } from 'react';
import type { FormEvent } from 'react';
import { api, conversationTitle, errorMessage } from '../api';
import { connectSocket } from '../socket';
import type { Conversation, Message } from '../types';
import AddMemberModal from './AddMemberModal';

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
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);
  const [isInviteOpen, setIsInviteOpen] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  // Les membres viennent directement de la conversation : quand la liste est
  // rechargée (ex : quelqu'un a accepté une invitation), ils se mettent à jour
  const memberships = conversation.memberships ?? [];

  // Vérifier si l'utilisateur connecté est ADMIN de ce salon
  const myMembership = memberships.find((m) => m.userId === meId);
  const isAdmin = conversation.isGroup && myMembership?.role === 'ADMIN';

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

  return (
    <>
      <header className="flex items-center justify-between border-b border-zinc-800 bg-zinc-900 px-4 py-3">
        <div className="flex min-w-0 items-center gap-3">
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
            onClick={() => setIsInviteOpen(true)}
            className="rounded-lg border border-violet-500/30 bg-violet-600/10 px-3 py-1.5 text-xs font-semibold text-violet-300 hover:bg-violet-600/20"
          >
            + Inviter
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

      {isInviteOpen && (
        <AddMemberModal
          conversationId={conversation.id}
          memberIds={memberships.map((m) => m.userId)}
          onClose={() => setIsInviteOpen(false)}
        />
      )}
    </>
  );
}