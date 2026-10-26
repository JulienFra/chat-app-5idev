import { useState } from 'react';
import { api, errorMessage } from '../api';
import type { EventType } from '../types';

interface Props {
  teamId: string;
  onClose: () => void;
  onCreated: () => void;
}

export default function CreateEventModal({ teamId, onClose, onCreated }: Props) {
  const [type, setType] = useState<EventType>('SCRIM');
  const [opponent, setOpponent] = useState('');
  const [startsAt, setStartsAt] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await api(`/teams/${teamId}/events`, {
        method: 'POST',
        body: { type, opponent, startsAt: new Date(startsAt).toISOString() },
      });
      onCreated();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
      <div className="w-full max-w-md rounded-2xl border border-zinc-800 bg-zinc-950 p-6 shadow-2xl">
        <h2 className="mb-1 text-xl font-bold text-white">Planifier un événement</h2>
        <p className="mb-6 text-sm text-zinc-400">
          Un salon textuel dédié sera généré automatiquement (Premium).
        </p>
        
        <form onSubmit={handleSubmit} className="space-y-4">
          {error && <p className="rounded bg-red-500/10 p-2 text-sm text-red-400">{error}</p>}
          
          <div>
            <label className="mb-1 block text-sm font-medium text-zinc-400">Type d'événement</label>
            <select
              value={type}
              onChange={(e) => setType(e.target.value as EventType)}
              className="w-full rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-white focus:border-violet-500 focus:outline-none"
            >
              <option value="SCRIM">⚔️ Scrim (Entraînement)</option>
              <option value="MATCH">🏆 Match Officiel</option>
            </select>
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-zinc-400">Équipe adversaire</label>
            <input
              value={opponent}
              onChange={(e) => setOpponent(e.target.value)}
              required
              placeholder="ex: Vitality"
              className="w-full rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-white focus:border-violet-500 focus:outline-none"
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-zinc-400">Date et heure de début</label>
            <input
              type="datetime-local"
              value={startsAt}
              onChange={(e) => setStartsAt(e.target.value)}
              required
              className="w-full rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-white focus:border-violet-500 focus:outline-none"
            />
          </div>

          <div className="mt-6 flex justify-end gap-3 pt-4 border-t border-zinc-800">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg px-4 py-2 text-sm font-medium text-zinc-400 hover:bg-zinc-800 hover:text-white transition"
            >
              Annuler
            </button>
            <button
              type="submit"
              disabled={busy}
              className="rounded-lg bg-violet-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-violet-500 disabled:opacity-50"
            >
              Planifier et générer le salon
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}