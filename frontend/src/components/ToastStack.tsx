import { useEffect, useState } from 'react';

export interface NotificationToast {
  id: string; // id du dernier message : sert à relancer le minuteur
  conversationId: string;
  senderName: string;
  title: string;
  content: string;
  count: number; // nombre de messages regroupés dans ce toast
}

interface Props {
  toasts: NotificationToast[];
  onOpen: (conversationId: string) => void;
  onDismiss: (conversationId: string) => void;
}

const DURATION_MS = 5000;

function ToastItem({
  toast,
  hiddenOnMobile,
  onOpen,
  onDismiss,
}: {
  toast: NotificationToast;
  hiddenOnMobile: boolean;
  onOpen: (conversationId: string) => void;
  onDismiss: (conversationId: string) => void;
}) {
  const [paused, setPaused] = useState(false);

  // Disparition automatique. Le minuteur repart de zéro à chaque nouveau
  // message regroupé (toast.id change) et s'arrête pendant le survol.
  useEffect(() => {
    if (paused) return;
    const timer = setTimeout(() => onDismiss(toast.conversationId), DURATION_MS);
    return () => clearTimeout(timer);
  }, [toast.id, toast.conversationId, paused, onDismiss]);

  const grouped = toast.count > 1;
  // Conversation privée : le titre est déjà le nom de l'expéditeur
  const isDirect = toast.title === toast.senderName;

  return (
    <div
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      className={`pointer-events-auto items-start gap-2 rounded-xl border border-violet-500/40 bg-zinc-900/95 p-3 shadow-2xl backdrop-blur-md ${
        hiddenOnMobile ? 'hidden md:flex' : 'flex'
      }`}
    >
      <button
        type="button"
        onClick={() => onOpen(toast.conversationId)}
        className="flex min-w-0 flex-1 items-start gap-3 text-left"
      >
        <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-violet-600 text-sm font-bold text-white">
          {toast.title.charAt(0).toUpperCase()}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-xs font-semibold text-violet-300">{toast.title}</span>
          <span className="block text-xs font-bold text-white">
            {grouped
              ? `${toast.count} nouveaux messages`
              : isDirect
                ? 'Message privé'
                : toast.senderName}
          </span>
          <span className="block truncate text-xs text-zinc-400">
            {grouped && !isDirect ? `${toast.senderName} : ${toast.content}` : toast.content}
          </span>
        </span>
      </button>
      <button
        type="button"
        onClick={() => onDismiss(toast.conversationId)}
        aria-label="Fermer la notification"
        className="shrink-0 rounded px-1 text-xs text-zinc-500 hover:text-white"
      >
        ✕
      </button>
    </div>
  );
}

export default function ToastStack({ toasts, onOpen, onDismiss }: Props) {
  if (toasts.length === 0) return null;

  return (
    <div
      aria-live="polite"
      className="pointer-events-none fixed inset-x-3 top-3 z-50 flex flex-col gap-2 md:inset-x-auto md:top-5 md:right-5 md:w-96"
    >
      {toasts.map((t, i) => (
        <ToastItem
          key={t.conversationId}
          toast={t}
          hiddenOnMobile={i > 0}
          onOpen={onOpen}
          onDismiss={onDismiss}
        />
      ))}
    </div>
  );
}