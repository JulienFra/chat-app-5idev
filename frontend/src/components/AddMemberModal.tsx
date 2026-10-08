import { useEffect, useState } from 'react';
import { api, errorMessage } from '../api';
import type { Invitation, UserSummary } from '../types';

interface Props {
  teamId: string;
  memberIds: string[]; // pour afficher « Membre »
  onClose: () => void;
}

const MIN_CHARS = 2;
const DEBOUNCE_MS = 250;

export default function AddMemberModal({ teamId, memberIds, onClose }: Props) {
  const [query, setQuery] = useState('');
  // On garde la recherche qui a produit les résultats, pour ne jamais
  // afficher les résultats d'une ancienne frappe
  const [results, setResults] = useState<{ term: string; users: UserSummary[] }>({
    term: '',
    users: [],
  });
  const [searchError, setSearchError] = useState<string | null>(null);
  const [pending, setPending] = useState<Invitation[]>([]); // invitations en attente de l'équipe
  const [busyId, setBusyId] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const term = query.trim();
  const tooShort = term.length < MIN_CHARS;

  // Invitations déjà envoyées et en attente
  useEffect(() => {
    let cancelled = false;
    api<Invitation[]>(`/teams/${teamId}/invitations`)
      .then((list) => {
        if (!cancelled) setPending(list);
      })
      .catch(() => {
        // sans cette liste, on n'affiche simplement pas « Invité »
      });
    return () => {
      cancelled = true;
    };
  }, [teamId]);

  // Recherche avec un petit délai : on attend que l'utilisateur arrête de taper
  useEffect(() => {
    if (tooShort) return;
    let cancelled = false;
    const timer = setTimeout(() => {
      api<UserSummary[]>(`/users?search=${encodeURIComponent(term)}`)
        .then((users) => {
          if (!cancelled) setResults({ term, users });
        })
        .catch((err) => {
          if (!cancelled) setSearchError(errorMessage(err));
        });
    }, DEBOUNCE_MS);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [term, tooShort]);

  const upToDate = !tooShort && results.term === term;
  const users = upToDate ? results.users : [];
  const searching = !tooShort && !upToDate && !searchError;

  const invite = async (user: UserSummary) => {
    setBusyId(user.id);
    setActionError(null);
    try {
      const invitation = await api<Invitation>(`/teams/${teamId}/invitations`, {
        method: 'POST',
        body: { inviteeId: user.id },
      });
      setPending((prev) => [invitation, ...prev]);
    } catch (err) {
      setActionError(errorMessage(err));
    } finally {
      setBusyId(null);
    }
  };

  const cancel = async (invitation: Invitation) => {
    setBusyId(invitation.inviteeId);
    setActionError(null);
    try {
      await api<void>(`/invitations/${invitation.id}`, { method: 'DELETE' });
      setPending((prev) => prev.filter((i) => i.id !== invitation.id));
    } catch (err) {
      setActionError(errorMessage(err));
    } finally {
      setBusyId(null);
    }
  };

  const avatar = (name: string) => (
    <span className="grid size-8 shrink-0 place-items-center rounded-full bg-indigo-500 text-sm font-semibold text-white">
      {name.charAt(0).toUpperCase()}
    </span>
  );

  const cancelButton = (invitation: Invitation) => (
    <button
      type="button"
      onClick={() => void cancel(invitation)}
      disabled={busyId !== null}
      className="text-xs text-zinc-400 underline hover:text-white disabled:opacity-50"
    >
      {busyId === invitation.inviteeId ? '…' : 'Annuler'}
    </button>
  );

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-sm rounded-xl border border-zinc-800 bg-zinc-900 p-6 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between">
          <div>
            <h3 className="text-lg font-semibold text-white">Inviter un joueur</h3>
            <p className="mt-1 text-xs text-zinc-400">
              Il devra accepter l'invitation pour rejoindre l'équipe.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-xl leading-none text-zinc-500 hover:text-white"
            aria-label="Fermer"
          >
            ×
          </button>
        </div>

        <input
          autoFocus
          type="search"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setSearchError(null);
            setActionError(null);
          }}
          maxLength={20}
          placeholder="Pseudo, ex : nouveau"
          className="mt-4 w-full rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-white placeholder-zinc-500 outline-none focus:border-violet-500"
        />

        <div className="mt-3 max-h-64 min-h-[3rem] overflow-y-auto">
          {/* Barre vide : les invitations déjà envoyées */}
          {tooShort &&
            (pending.length === 0 ? (
              <p className="px-1 py-2 text-xs text-zinc-500">
                Tape au moins {MIN_CHARS} caractères pour chercher un joueur.
              </p>
            ) : (
              <>
                <p className="px-1 pb-1 text-xs font-semibold tracking-wider text-zinc-500 uppercase">
                  En attente de réponse
                </p>
                <ul className="space-y-1">
                  {pending.map((inv) => (
                    <li key={inv.id} className="flex items-center gap-3 rounded-lg px-2 py-2">
                      {avatar(inv.invitee.displayName)}
                      <span className="min-w-0 flex-1 truncate text-sm text-zinc-100">
                        {inv.invitee.displayName}
                      </span>
                      {cancelButton(inv)}
                    </li>
                  ))}
                </ul>
              </>
            ))}

          {searching && <p className="px-1 py-2 text-xs text-zinc-500">Recherche…</p>}
          {searchError && <p className="px-1 py-2 text-xs text-red-400">{searchError}</p>}
          {upToDate && users.length === 0 && (
            <p className="px-1 py-2 text-xs text-zinc-500">Aucun joueur trouvé pour « {term} ».</p>
          )}

          <ul className="space-y-1">
            {users.map((user) => {
              const isMember = memberIds.includes(user.id);
              const invitation = pending.find((i) => i.inviteeId === user.id);
              return (
                <li
                  key={user.id}
                  className="flex items-center gap-3 rounded-lg px-2 py-2 hover:bg-zinc-800"
                >
                  {avatar(user.displayName)}
                  <span className="min-w-0 flex-1 truncate text-sm text-zinc-100">
                    {user.displayName}
                  </span>
                  {isMember ? (
                    <span className="text-xs text-zinc-500">Membre</span>
                  ) : invitation ? (
                    <span className="flex items-center gap-2">
                      <span className="text-xs text-amber-400">Invité</span>
                      {cancelButton(invitation)}
                    </span>
                  ) : (
                    <button
                      type="button"
                      onClick={() => void invite(user)}
                      disabled={busyId !== null}
                      className="rounded-md bg-violet-600 px-3 py-1 text-xs font-medium text-white hover:bg-violet-500 disabled:opacity-50"
                    >
                      {busyId === user.id ? '…' : 'Inviter'}
                    </button>
                  )}
                </li>
              );
            })}
          </ul>
        </div>

        {actionError && <p className="mt-2 text-xs text-red-400">{actionError}</p>}
      </div>
    </div>
  );
}