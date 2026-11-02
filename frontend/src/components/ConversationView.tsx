import { useEffect, useRef, useState } from 'react';
import type { FormEvent } from 'react';
import { api, conversationTitle, errorMessage } from '../api';
import { connectSocket } from '../socket';
import type { Conversation, Message } from '../types';

interface Props {
  conversation: Conversation;
  meId: string | null;
  teamName?: string;
  onOpenSettings?: () => void;
  onBack: () => void;
  onMessageSent: (message: Message) => void;
}

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString('fr-BE', { hour: '2-digit', minute: '2-digit' });
}

function addMessage(list: Message[], message: Message): Message[] {
  return list.some((m) => m.id === message.id) ? list : [...list, message];
}

// 🔒 Composant pour charger l'image avec le token de sécurité ET la rendre cliquable
function AuthImage({ 
  url, 
  alt, 
  className,
  onClick 
}: { 
  url: string; 
  alt: string; 
  className: string;
  onClick?: (src: string) => void;
}) {
  const [src, setSrc] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const token = localStorage.getItem('token');
    
    fetch(url, { headers: { Authorization: `Bearer ${token}` } })
      .then((res) => {
        if (!res.ok) throw new Error('Image inaccessible');
        return res.blob();
      })
      .then((blob) => {
        if (!cancelled) setSrc(URL.createObjectURL(blob));
      })
      .catch(() => {});

    return () => {
      cancelled = true;
    };
  }, [url]);

  if (!src) {
    return <div className={`animate-pulse bg-zinc-800/50 ${className}`} style={{ minHeight: '150px' }} />;
  }
  
  return (
    <img 
      src={src} 
      alt={alt} 
      className={`${className} ${onClick ? 'cursor-pointer hover:opacity-90 transition-opacity' : ''}`}
      onClick={() => onClick && onClick(src)}
    />
  );
}

export default function ConversationView({
  conversation,
  meId,
  teamName,
  onOpenSettings,
  onBack,
  onMessageSent,
}: Props) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);
  
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  // 🔍 ÉTAT POUR L'IMAGE AGRANDIE
  const [expandedImage, setExpandedImage] = useState<string | null>(null);
  
  const [typingUsers, setTypingUsers] = useState<Record<string, number>>({});
  
  const [isMuted, setIsMuted] = useState(() => localStorage.getItem('chat_muted') === 'true');
  const isMutedRef = useRef(isMuted);

  const bottomRef = useRef<HTMLDivElement>(null);
  const typingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const memberships = conversation.memberships ?? [];

  useEffect(() => { isMutedRef.current = isMuted; }, [isMuted]);

  const toggleMute = () => {
    const nextState = !isMuted;
    setIsMuted(nextState);
    localStorage.setItem('chat_muted', String(nextState));
  };

  const playNotificationSound = () => {
    if (isMutedRef.current) return;
    try {
      const AudioContext = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioContext) return;
      const ctx = new AudioContext();
      const osc = ctx.createOscillator();
      const gainNode = ctx.createGain();
      osc.connect(gainNode);
      gainNode.connect(ctx.destination);
      osc.type = 'sine';
      osc.frequency.setValueAtTime(880, ctx.currentTime); 
      osc.frequency.exponentialRampToValueAtTime(440, ctx.currentTime + 0.1);
      gainNode.gain.setValueAtTime(0.1, ctx.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.1);
      osc.start(ctx.currentTime);
      osc.stop(ctx.currentTime + 0.1);
    } catch (e) {}
  };

  useEffect(() => {
    let cancelled = false;
    api<Message[]>(`/conversations/${conversation.id}/messages`)
      .then((data) => { if (!cancelled) setMessages(data); })
      .catch((err) => { if (!cancelled) setError(errorMessage(err)); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [conversation.id]);

  useEffect(() => {
    const socket = connectSocket();
    const onNewMessage = (message: Message) => {
      if (message.conversationId !== conversation.id) return;
      if (message.authorId !== meId) playNotificationSound();
      setMessages((prev) => addMessage(prev, message));
      setTypingUsers((prev) => {
        const next = { ...prev };
        delete next[message.authorId];
        return next;
      });
    };

    const onTyping = (data: { conversationId: string; userId: string; isTyping: boolean }) => {
      if (data.conversationId !== conversation.id || data.userId === meId) return;
      setTypingUsers((prev) => {
        const next = { ...prev };
        if (data.isTyping) next[data.userId] = Date.now();
        else delete next[data.userId];
        return next;
      });
    };

    socket.on('message:new', onNewMessage);
    socket.on('typing', onTyping);
    return () => {
      socket.off('message:new', onNewMessage);
      socket.off('typing', onTyping);
    };
  }, [conversation.id, meId]);

  useEffect(() => {
    const interval = setInterval(() => {
      const now = Date.now();
      setTypingUsers((prev) => {
        let changed = false;
        const next = { ...prev };
        for (const [id, time] of Object.entries(next)) {
          if (now - time > 3000) { delete next[id]; changed = true; }
        }
        return changed ? next : prev;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ block: 'end' });
  }, [messages]);

  const handleTyping = (e: React.ChangeEvent<HTMLInputElement>) => {
    setDraft(e.target.value);
    const socket = connectSocket();
    socket.emit('typing', { conversationId: conversation.id, isTyping: true });

    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    typingTimeoutRef.current = setTimeout(() => {
      socket.emit('typing', { conversationId: conversation.id, isTyping: false });
    }, 2000);
  };

  const handleSend = async (e: FormEvent) => {
    e.preventDefault();
    const content = draft.trim();
    if ((!content && !selectedFile) || sending) return;

    setSending(true);
    setSendError(null);
    
    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    connectSocket().emit('typing', { conversationId: conversation.id, isTyping: false });

    try {
      let message;

      if (selectedFile) {
        const formData = new FormData();
        formData.append('content', content);
        formData.append('image', selectedFile);

        const token = localStorage.getItem('token');
        const res = await fetch(`/api/conversations/${conversation.id}/messages`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}` },
          body: formData,
        });

        if (!res.ok) {
          const errData = await res.json();
          throw new Error(errData.message || "Erreur lors de l'envoi de l'image");
        }
        message = await res.json();
      } else {
        message = await api<Message>(`/conversations/${conversation.id}/messages`, {
          method: 'POST',
          body: { content },
        });
      }

      setMessages((prev) => addMessage(prev, message));
      setDraft('');
      setSelectedFile(null);
      if (fileInputRef.current) fileInputRef.current.value = '';
      onMessageSent(message);
    } catch (err: any) {
      setSendError(errorMessage(err) || err.message);
    } finally {
      setSending(false);
    }
  };

  const activeTypingIds = Object.keys(typingUsers);
  let typingText = null;
  if (activeTypingIds.length > 0) {
    const names = activeTypingIds.map((id) => {
      const m = memberships.find((member) => member.userId === id);
      return m?.user?.displayName || 'Un joueur';
    });
    if (names.length === 1) typingText = `${names[0]} est en train d'écrire...`;
    else if (names.length === 2) typingText = `${names[0]} et ${names[1]} écrivent...`;
    else typingText = 'Plusieurs joueurs écrivent...';
  }

  return (
    <>
      <header className="flex items-center justify-between border-b border-zinc-800 bg-zinc-900 px-4 py-3">
        <div className="flex min-w-0 items-center gap-3">
          <button
            type="button"
            onClick={onBack}
            className="text-xl text-zinc-400 hover:text-white md:hidden"
          >
            ←
          </button>
          <div className="min-w-0">
            <h2 className="truncate font-semibold">{conversationTitle(conversation, meId)}</h2>
            {teamName && (
              <p className="truncate text-xs text-zinc-500">
                {teamName} · {memberships.length} membre{memberships.length > 1 ? 's' : ''}
              </p>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={toggleMute}
            className="shrink-0 rounded-lg border border-zinc-700 px-3 py-1.5 text-xs font-semibold text-zinc-300 hover:bg-zinc-800 transition-colors"
          >
            {isMuted ? '🔕 Muet' : '🔔 Son'}
          </button>
          {onOpenSettings && (
            <button
              type="button"
              onClick={onOpenSettings}
              className="shrink-0 rounded-lg border border-zinc-700 px-3 py-1.5 text-xs font-semibold text-zinc-300 hover:bg-zinc-800 transition-colors"
            >
              ⚙ Équipe
            </button>
          )}
        </div>
      </header>

      <div className="flex-1 overflow-y-auto px-4 py-4 relative flex flex-col">
        {loading && <p className="text-center text-sm text-zinc-500">Chargement…</p>}
        {error && (
          <p className="mx-auto max-w-md rounded-lg bg-red-500/10 p-3 text-center text-sm text-red-400">
            {error}
          </p>
        )}
        {!loading && !error && messages.length === 0 && (
          <p className="text-center text-sm text-zinc-500">Aucun message. Lance la discussion !</p>
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
                
                {m.imageUrl && (
                  <AuthImage 
                    url={m.imageUrl} 
                    alt="Pièce jointe" 
                    className="mt-1 mb-2 max-h-64 rounded-xl object-contain bg-black/20"
                    onClick={(src) => setExpandedImage(src)}
                  />
                )}
                
                {m.content && <p className="break-words whitespace-pre-wrap">{m.content}</p>}
                
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

      <div className="px-4 pb-1 pt-1 bg-zinc-900 min-h-[24px]">
        {typingText ? (
          <span className="text-xs italic text-violet-400 animate-pulse transition-opacity">
            {typingText}
          </span>
        ) : null}
      </div>

      <form onSubmit={handleSend} className="border-t border-zinc-800 bg-zinc-900 px-4 py-3 relative">
        {selectedFile && (
          <div className="absolute bottom-[100%] mb-2 left-4 rounded-lg bg-zinc-800 p-2 shadow-lg border border-zinc-700 flex items-center gap-3">
            <div className="text-xs text-zinc-300 truncate max-w-[150px]">{selectedFile.name}</div>
            <button 
              type="button" 
              onClick={() => { setSelectedFile(null); if (fileInputRef.current) fileInputRef.current.value = ''; }}
              className="text-red-400 hover:text-red-300 text-sm font-bold"
            >
              ✕
            </button>
          </div>
        )}

        {sendError && <p className="mb-2 text-sm text-red-400">{sendError}</p>}
        
        <div className="flex gap-2 items-center">
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="grid size-10 shrink-0 place-items-center rounded-lg bg-zinc-800 text-zinc-400 hover:bg-zinc-700 hover:text-zinc-200 transition-colors"
            title="Joindre une image"
          >
            📎
          </button>
          <input
            type="file"
            accept="image/jpeg, image/png, image/webp, image/gif"
            ref={fileInputRef}
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) setSelectedFile(file);
            }}
            className="hidden"
          />

          <input
            value={draft}
            onChange={handleTyping}
            maxLength={4000}
            placeholder={`Écris dans ${conversationTitle(conversation, meId)}…`}
            className="min-w-0 flex-1 rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-zinc-100 placeholder:text-zinc-500 focus:border-indigo-500 focus:outline-none transition-colors"
          />
          <button
            type="submit"
            disabled={sending || (!draft.trim() && !selectedFile)}
            className="rounded-lg bg-indigo-600 px-4 py-2 font-medium text-white hover:bg-indigo-500 disabled:cursor-not-allowed disabled:opacity-50 transition-colors"
          >
            Envoyer
          </button>
        </div>
      </form>

      {/* 🔍 MODALE IMAGE AGRANDIE */}
      {expandedImage && (
        <div 
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/90 p-4 backdrop-blur-sm"
          onClick={() => setExpandedImage(null)}
        >
          <img 
            src={expandedImage} 
            alt="Image agrandie" 
            className="max-h-full max-w-full object-contain drop-shadow-2xl"
          />
          <button 
            type="button"
            className="absolute top-4 right-4 md:top-8 md:right-8 text-white/50 hover:text-white text-4xl"
            onClick={() => setExpandedImage(null)}
          >
            &times;
          </button>
        </div>
      )}
    </>
  );
}