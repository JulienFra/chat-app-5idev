import type { Invitation } from '../types';

interface Props {
  invitations: Invitation[];
  respondingId: string | null;
  error: string | null;
  onRespond: (invitation: Invitation, accept: boolean) => void;
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('fr-BE', { day: 'numeric', month: 'short' });
}

export default function InvitationsList({ invitations, respondingId, error, onRespond }: Props) {
  return (
    <div className="pt-2">
      {error && (
        <p className="m-2 rounded-lg bg-red-500/10 p-3 text-sm text-red-400">{error}</p>
      )}

      {invitations.length === 0 ? (
        <p className="px-2 py-4 text-sm text-zinc-500">Aucune invitation en attente.</p>
      ) : (
        <ul className="space-y-2">
          {invitations.map((inv) => {
            const team = inv.conversation.name?.trim() || 'Équipe sans nom';
            const busy = respondingId === inv.id;
            return (
              <li key={inv.id} className="rounded-lg border border-zinc-800 bg-zinc-950/40 p-3">
                <div className="flex items-center gap-3">
                  <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-violet-600 font-semibold text-white">
                    {team.charAt(0).toUpperCase()}
                  </span>
                  <div className="min-w-0">
                    <p className="truncate font-semibold text-white">{team}</p>
                    <p className="truncate text-xs text-zinc-500">
                      Invité par {inv.inviter.displayName} · {formatDate(inv.createdAt)}
                    </p>
                  </div>
                </div>
                <div className="mt-3 flex gap-2">
                  <button
                    type="button"
                    disabled={respondingId !== null}
                    onClick={() => onRespond(inv, true)}
                    className="flex-1 rounded-lg bg-violet-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-violet-500 disabled:opacity-50"
                  >
                    {busy ? '…' : 'Accepter'}
                  </button>
                  <button
                    type="button"
                    disabled={respondingId !== null}
                    onClick={() => onRespond(inv, false)}
                    className="flex-1 rounded-lg border border-zinc-700 px-3 py-1.5 text-sm text-zinc-300 hover:bg-zinc-800 disabled:opacity-50"
                  >
                    Refuser
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}