import { useEffect, useState } from 'react';
import { api, errorMessage } from '../api';
import type { Membership, UserSummary } from '../types';

interface Props {
  conversationId: string;
  memberIds: string[]; // pour afficher « Déjà membre »
  onClose: () => void;
  onAdded: (membership: Membership) => void;
}

const MIN_CHARS = 2;
const DEBOUNCE_MS = 250;

export default function AddMemberModal({ conversationId, memberIds, onClose, onAdded }: Props) {
  const [query, setQuery] = useState('');
  // On garde la recherche qui a produit les résultats, pour ne jamais
  // afficher les résultats d'une ancienne frappe
  const [results, setResults] = useState<{ term: string; users: UserSummary[] }>({
    term: '',
    users: [],
  });
  const [searchError, setSearchError] = useState<string | null>(null);
  const [addingId, setAddingId] = useState<string | null>(null);
  const [addError, setAddError] = useState<string | null>(null);

  const term = query.trim();
  const tooShort = term.length < MIN_CHARS;

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

  const handleAdd = async (user: UserSummary) => {
    setAddingId(user.id);
    setAddError(null);
    try {
      const membership = await api<Membership>(`/conversations/${conversationId}/members`, {
        method: 'POST',
        body: { identifier: user.id },
      });
      onAdded(membership);
    } catch (err) {
      setAddError(errorMessage(err));
    } finally {
      setAddingId(null);
    }
  };

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
            <h3 className="text-lg font-semibold text-white">Ajouter un membre</h3>
            <p className="mt-1 text-xs text-zinc-400">Cherche un joueur par son pseudo.</p>
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
            setAddError(null);
          }}
          maxLength={20}
          placeholder="Pseudo, ex : nouveau"
          className="mt-4 w-full rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-white placeholder-zinc-500 outline-none focus:border-violet-500"
        />

        <div className="mt-3 max-h-64 min-h-[3rem] overflow-y-auto">
          {tooShort && (
            <p className="px-1 py-2 text-xs text-zinc-500">
              Tape au moins {MIN_CHARS} caractères.
            </p>
          )}
          {searching && <p className="px-1 py-2 text-xs text-zinc-500">Recherche…</p>}
          {searchError && <p className="px-1 py-2 text-xs text-red-400">{searchError}</p>}
          {upToDate && users.length === 0 && (
            <p className="px-1 py-2 text-xs text-zinc-500">Aucun joueur trouvé pour « {term} ».</p>
          )}

          <ul className="space-y-1">
            {users.map((user) => {
              const alreadyMember = memberIds.includes(user.id);
              return (
                <li
                  key={user.id}
                  className="flex items-center gap-3 rounded-lg px-2 py-2 hover:bg-zinc-800"
                >
                  <span className="grid size-8 shrink-0 place-items-center rounded-full bg-indigo-500 text-sm font-semibold text-white">
                    {user.displayName.charAt(0).toUpperCase()}
                  </span>
                  <span className="min-w-0 flex-1 truncate text-sm text-zinc-100">
                    {user.displayName}
                  </span>
                  {alreadyMember ? (
                    <span className="text-xs text-zinc-500">Déjà membre</span>
                  ) : (
                    <button
                      type="button"
                      onClick={() => void handleAdd(user)}
                      disabled={addingId !== null}
                      className="rounded-md bg-violet-600 px-3 py-1 text-xs font-medium text-white hover:bg-violet-500 disabled:opacity-50"
                    >
                      {addingId === user.id ? 'Ajout…' : 'Ajouter'}
                    </button>
                  )}
                </li>
              );
            })}
          </ul>
        </div>

        {addError && <p className="mt-2 text-xs text-red-400">{addError}</p>}
      </div>
    </div>
  );
}