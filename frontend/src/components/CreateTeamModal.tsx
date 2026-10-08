import { useState, type FormEvent } from 'react';
import { api, errorMessage } from '../api';
import type { Team } from '../types';

interface Props {
  onClose: () => void;
  onCreated: (team: Team) => void;
}

export default function CreateTeamModal({ onClose, onCreated }: Props) {
  const [name, setName] = useState('');
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    setCreating(true);
    setError(null);
    try {
      const team = await api<Team>('/teams', { method: 'POST', body: { name: name.trim() } });
      onCreated(team);
    } catch (err) {
      // ex : limite Free atteinte, nom déjà utilisé
      setError(errorMessage(err));
    } finally {
      setCreating(false);
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
        <h3 className="text-lg font-semibold text-white">Créer une équipe</h3>
        <p className="mt-1 text-xs text-zinc-400">
          Le salon #général est créé automatiquement (et #admin en Premium).
        </p>
        <form onSubmit={handleSubmit} className="mt-4 space-y-4">
          <div>
            <label htmlFor="teamName" className="block text-xs font-medium text-zinc-400">
              Nom de l'équipe
            </label>
            <input
              id="teamName"
              autoFocus
              type="text"
              required
              minLength={2}
              maxLength={40}
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ex : KCorp Valorant"
              className="mt-1 w-full rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-white placeholder-zinc-500 outline-none focus:border-violet-500"
            />
          </div>

          {error && <p className="text-xs text-red-400">{error}</p>}

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg px-3 py-1.5 text-sm text-zinc-400 hover:text-white"
            >
              Annuler
            </button>
            <button
              type="submit"
              disabled={creating || !name.trim()}
              className="rounded-lg bg-violet-600 px-4 py-1.5 text-sm font-medium text-white transition hover:bg-violet-500 disabled:opacity-50"
            >
              {creating ? 'Création…' : 'Créer'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}