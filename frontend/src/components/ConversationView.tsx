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
    return <div className={`animate-pulse bg-[#262b31] ${className}`} style={{ minHeight: '150px' }} />;
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
      {/* ============ EN-TÊTE DU SALON ============ */}
      <header className="flex h-16 shrink-0 items-center justify-between gap-3 border-b border-[#23282e] bg-[#0f1215] px-4 md:px-6">
        <div className="flex min-w-0 items-center gap-3">
          <button
            type="button"
            onClick={onBack}
            className="flex h-10 w-10 items-center justify-center rounded-lg text-2xl leading-none text-[#9aa1ab] transition-colors hover:bg-[#1c2025] hover:text-white md:hidden"
          >
            ←
          </button>
          <div className="min-w-0">
            <h2 className="truncate text-lg font-bold leading-6 text-white">{conversationTitle(conversation, meId)}</h2>
            {teamName && (
              <p className="truncate text-[13px] text-[#9aa1ab]">
                {teamName} · {memberships.length} membre{memberships.length > 1 ? 's' : ''}
              </p>
            )}
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <button
            type="button"
            onClick={toggleMute}
            className="rounded-lg border border-[#363d45] px-3.5 py-2 text-sm font-semibold text-[#d5d9de] transition-colors hover:border-[#4a525c] hover:bg-[#1c2025] hover:text-white"
          >
            {isMuted ? '🔕 Muet' : '🔔 Son'}
          </button>
          {onOpenSettings && (
            <button
              type="button"
              onClick={onOpenSettings}
              className="rounded-lg border border-[#363d45] px-3.5 py-2 text-sm font-semibold text-[#d5d9de] transition-colors hover:border-[#4a525c] hover:bg-[#1c2025] hover:text-white"
            >
              ⚙ Équipe
            </button>
          )}
        </div>
      </header>

      {/* ============ MESSAGES ============ */}
      <div className="relative flex flex-1 flex-col overflow-y-auto bg-[#0b0d0f] px-4 py-5 md:px-6">
        {loading && <p className="text-center text-sm text-[#9aa1ab]">Chargement…</p>}
        {error && (
          <p className="mx-auto max-w-md rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-center text-sm text-red-300">
            {error}
          </p>
        )}
        {!loading && !error && messages.length === 0 && (
          <div className="m-auto text-center">
            <p className="text-lg font-bold text-white">Aucun message</p>
            <p className="mt-1 text-[15px] text-[#9aa1ab]">Lance la discussion !</p>
          </div>
        )}

        {messages.map((m, i) => {
          const mine = m.authorId === meId;
          const sameAuthorAsPrevious = messages[i - 1]?.authorId === m.authorId;
          const showAuthor = conversation.isGroup && !mine && !sameAuthorAsPrevious;

          return (
            <div
              key={m.id}
              className={`flex ${mine ? 'justify-end' : 'justify-start'} ${
                sameAuthorAsPrevious ? 'mt-1' : 'mt-4'
              }`}
            >
              <div
                className={`max-w-[85%] rounded-xl px-4 py-2.5 md:max-w-[65%] ${
                  mine
                    ? 'rounded-br-sm bg-[#d7ff3a] text-black'
                    : 'rounded-bl-sm border border-[#23282e] bg-[#1c2025] text-[#e9ebee]'
                }`}
              >
                {showAuthor && (
                  <p className="mb-1 text-[13px] font-bold text-[#d7ff3a]">
                    {m.author?.displayName ?? 'Inconnu'}
                  </p>
                )}
                
                {m.imageUrl && (
                  <AuthImage 
                    url={m.imageUrl} 
                    alt="Pièce jointe" 
                    className="mb-2 mt-1 max-h-64 rounded-lg bg-black/20 object-contain"
                    onClick={(src) => setExpandedImage(src)}
                  />
                )}
                
                {m.content && <p className="whitespace-pre-wrap break-words text-[15px] leading-6">{m.content}</p>}
                
                <p
                  className={`mt-1 text-right text-xs tabular-nums ${
                    mine ? 'text-black/60' : 'text-[#9aa1ab]'
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

      {/* ============ INDICATEUR DE FRAPPE ============ */}
      <div className="min-h-[28px] bg-[#0b0d0f] px-4 pb-1 md:px-6">
        {typingText ? (
          <span className="animate-pulse text-[13px] font-medium text-[#d7ff3a] transition-opacity">
            {typingText}
          </span>
        ) : null}
      </div>

      {/* ============ ZONE DE SAISIE ============ */}
      <form onSubmit={handleSend} className="relative shrink-0 border-t border-[#23282e] bg-[#0f1215] px-4 py-4 md:px-6">
        {selectedFile && (
          <div className="absolute bottom-[100%] left-4 mb-2 flex items-center gap-3 rounded-lg border border-[#363d45] bg-[#1c2025] px-3 py-2 shadow-lg md:left-6">
            <div className="max-w-[200px] truncate text-sm text-[#d5d9de]">{selectedFile.name}</div>
            <button 
              type="button" 
              onClick={() => { setSelectedFile(null); if (fileInputRef.current) fileInputRef.current.value = ''; }}
              className="text-base font-bold text-red-400 hover:text-red-300"
            >
              ✕
            </button>
          </div>
        )}

        {sendError && <p className="mb-2 text-sm text-red-300">{sendError}</p>}
        
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="grid size-11 shrink-0 place-items-center rounded-lg border border-[#363d45] text-lg text-[#d5d9de] transition-colors hover:border-[#4a525c] hover:bg-[#1c2025] hover:text-white"
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
            className="h-11 min-w-0 flex-1 rounded-lg border border-[#2a3037] bg-[#0b0d0f] px-4 text-[15px] text-[#e9ebee] placeholder:text-[#6f7782] transition-colors focus:border-[#d7ff3a] focus:outline-none"
          />
          <button
            type="submit"
            disabled={sending || (!draft.trim() && !selectedFile)}
            className="h-11 shrink-0 rounded-lg bg-[#d7ff3a] px-5 text-[15px] font-bold text-black transition-colors hover:bg-[#e4ff72] disabled:cursor-not-allowed disabled:opacity-40"
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
            className="absolute right-4 top-4 text-4xl text-white/60 hover:text-white md:right-8 md:top-8"
            onClick={() => setExpandedImage(null)}
          >
            &times;
          </button>
        </div>
      )}
    </>
  );
}
