import { useState, type FormEvent } from 'react';
import { api, errorMessage } from '../api';
import type { EventType } from '../types';

interface Props {
  teamId: string;
  isPremium: boolean; // Premium : un salon dédié est créé ; Free : calendrier seulement
  onClose: () => void;
  onCreated: () => void;
}

// Valeur « AAAA-MM-JJTHH:MM » pour un <input type="datetime-local">, en heure locale
function toLocalInputValue(date: Date): string {
  const pad = (n: number) => n.toString().padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(
    date.getHours(),
  )}:${pad(date.getMinutes())}`;
}

export default function CreateEventModal({ teamId, isPremium, onClose, onCreated }: Props) {
  const [type, setType] = useState<EventType>('SCRIM');
  const [opponent, setOpponent] = useState('');
  const [startsAt, setStartsAt] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    const date = new Date(startsAt);
    if (Number.isNaN(date.getTime())) {
      setError('Choisis une date et une heure');
      return;
    }

    setBusy(true);
    setError(null);
    try {
      await api(`/teams/${teamId}/events`, {
        method: 'POST',
        body: { type, opponent: opponent.trim(), startsAt: date.toISOString() },
      });
      onCreated();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  const inputClass =
    'w-full rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-white focus:border-violet-500 focus:outline-none';

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md rounded-2xl border border-zinc-800 bg-zinc-950 p-6 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="mb-1 text-xl font-bold text-white">Planifier un événement</h2>
        <p className="mb-6 text-sm text-zinc-400">
          {isPremium
            ? 'Un salon dédié sera créé automatiquement pour toute l’équipe.'
            : 'L’événement sera ajouté au calendrier. Les salons dédiés sont réservés au Premium.'}
        </p>

        <form onSubmit={handleSubmit} className="space-y-4">
          {error && <p className="rounded bg-red-500/10 p-2 text-sm text-red-400">{error}</p>}

          <div>
            <label htmlFor="eventType" className="mb-1 block text-sm font-medium text-zinc-400">
              Type d'événement
            </label>
            <select
              id="eventType"
              value={type}
              onChange={(e) => setType(e.target.value as EventType)}
              className={inputClass}
            >
              <option value="SCRIM">⚔️ Scrim (entraînement)</option>
              <option value="MATCH">🏆 Match officiel</option>
            </select>
          </div>

          <div>
            <label htmlFor="eventOpponent" className="mb-1 block text-sm font-medium text-zinc-400">
              Équipe adverse
            </label>
            <input
              id="eventOpponent"
              value={opponent}
              onChange={(e) => setOpponent(e.target.value)}
              required
              maxLength={40}
              placeholder="ex : Vitality"
              className={inputClass}
            />
          </div>

          <div>
            <label htmlFor="eventStart" className="mb-1 block text-sm font-medium text-zinc-400">
              Date et heure de début
            </label>
            <input
              id="eventStart"
              type="datetime-local"
              value={startsAt}
              min={toLocalInputValue(new Date())}
              onChange={(e) => setStartsAt(e.target.value)}
              required
              className={inputClass}
            />
          </div>

          <div className="mt-6 flex justify-end gap-3 border-t border-zinc-800 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg px-4 py-2 text-sm font-medium text-zinc-400 transition hover:bg-zinc-800 hover:text-white"
            >
              Annuler
            </button>
            <button
              type="submit"
              disabled={busy || !opponent.trim() || !startsAt}
              className="rounded-lg bg-violet-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-violet-500 disabled:opacity-50"
            >
              {busy ? 'Création…' : isPremium ? 'Planifier et créer le salon' : 'Planifier'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
