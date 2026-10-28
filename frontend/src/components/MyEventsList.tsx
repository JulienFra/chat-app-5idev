import { EVENT_DURATION_MS, eventLabel, findConflicts, useNow, type MyEvent } from '../events';

interface Props {
  events: MyEvent[]; // les événements de toutes mes équipes
  canOpen: (conversationId: string) => boolean; // ai-je accès au salon ?
  onOpen: (conversationId: string) => void;
}

function dayLabel(iso: string): string {
  const label = new Date(iso).toLocaleDateString('fr-BE', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  });
  return label.charAt(0).toUpperCase() + label.slice(1);
}

function timeLabel(iso: string): string {
  return new Date(iso).toLocaleTimeString('fr-BE', { hour: '2-digit', minute: '2-digit' });
}

// Onglet « Mes événements » : les scrims et matchs à venir de toutes mes équipes,
// avec une alerte quand deux événements tombent en même temps
export default function MyEventsList({ events, canOpen, onOpen }: Props) {
  // À venir = pas encore terminé (on garde ceux qui ont commencé il y a moins de 2 h)
  const now = useNow();
  const upcoming = events.filter((e) => new Date(e.startsAt).getTime() > now - EVENT_DURATION_MS);
  const conflicts = findConflicts(upcoming);

  if (upcoming.length === 0) {
    return (
      <p className="px-2 py-4 text-sm text-zinc-500">
        Aucun événement à venir dans tes équipes.
      </p>
    );
  }

  // Regroupement par jour
  const days: { label: string; events: MyEvent[] }[] = [];
  for (const event of upcoming) {
    const label = dayLabel(event.startsAt);
    const last = days[days.length - 1];
    if (last?.label === label) last.events.push(event);
    else days.push({ label, events: [event] });
  }

  return (
    <div className="space-y-4 pt-1">
      {conflicts.size > 0 && (
        <div className="rounded-lg border border-amber-500/40 bg-amber-500/10 p-3 text-sm text-amber-300">
          ⚠️ <strong>Attention :</strong> {conflicts.size} événements se chevauchent. Tu ne pourras
          pas être partout à la fois !
        </div>
      )}

      {days.map((day) => (
        <section key={day.label}>
          <h3 className="px-2 pb-1 text-xs font-semibold tracking-wider text-zinc-500 uppercase">
            {day.label}
          </h3>
          <ul className="space-y-1.5">
            {day.events.map((e) => {
              const overlapping = conflicts.get(e.id) ?? [];
              const openable = e.conversationId !== null && canOpen(e.conversationId);
              return (
                <li
                  key={e.id}
                  className={`rounded-lg border p-2.5 ${
                    overlapping.length > 0
                      ? 'border-amber-500/50 bg-amber-500/5'
                      : 'border-zinc-800 bg-zinc-950/40'
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-white">{eventLabel(e)}</p>
                      <p className="mt-0.5 flex items-center gap-1.5 text-xs text-zinc-400">
                        <span className="font-medium text-zinc-200">{timeLabel(e.startsAt)}</span>
                        <span>·</span>
                        <span className="truncate rounded bg-zinc-800 px-1.5 py-0.5 text-[11px] text-zinc-300">
                          {e.teamName}
                        </span>
                      </p>
                    </div>
                    {openable && (
                      <button
                        type="button"
                        onClick={() => onOpen(e.conversationId!)}
                        className="shrink-0 rounded-md bg-violet-600/20 px-2 py-1 text-[11px] font-semibold text-violet-300 hover:bg-violet-600/30"
                      >
                        Salon ➔
                      </button>
                    )}
                  </div>

                  {overlapping.length > 0 && (
                    <p className="mt-2 text-xs text-amber-300">
                      ⚠️ En même temps que{' '}
                      {overlapping
                        .map((o) => `${eventLabel(o)} (${o.teamName}, ${timeLabel(o.startsAt)})`)
                        .join(', ')}
                    </p>
                  )}
                </li>
              );
            })}
          </ul>
        </section>
      ))}
    </div>
  );
}