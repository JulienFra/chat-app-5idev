import { useState, type FormEvent } from 'react';
import { api, errorMessage } from '../api';
import type { Team, TeamMember, TeamRole } from '../types';
import AddMemberModal from './AddMemberModal';

interface Props {
  team: Team;
  meId: string | null;
  onClose: () => void;
  onChanged: () => void; // recharge équipes et conversations
}

const ROLE_LABEL: Record<TeamRole, string> = { CEO: 'CEO', COACH: 'Coach', PLAYER: 'Joueur' };
const ROLE_STYLE: Record<TeamRole, string> = {
  CEO: 'bg-amber-500/15 text-amber-300',
  COACH: 'bg-sky-500/15 text-sky-300',
  PLAYER: 'bg-zinc-700/60 text-zinc-300',
};

type Tab = 'general' | 'members' | 'channels';

export default function TeamSettingsModal({ team, meId, onClose, onChanged }: Props) {
  const [tab, setTab] = useState<Tab>('general');
  const [name, setName] = useState(team.name);
  const [transferTo, setTransferTo] = useState('');
  const [deleteConfirm, setDeleteConfirm] = useState('');
  const [inviteOpen, setInviteOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const isPremium = team.owner.plan === 'PREMIUM';
  const isCeo = team.myRole === 'CEO';
  const isStaff = team.myRole === 'CEO' || team.myRole === 'COACH';
  // Mêmes règles que le serveur : le CEO, et les coachs en Premium
  const canManageRoster = isCeo || (team.myRole === 'COACH' && isPremium);
  const others = team.members.filter((m) => m.userId !== team.ownerId);

  // Lance une action : affiche l'erreur éventuelle, recharge en cas de succès
  const run = async (action: () => Promise<unknown>, success?: string) => {
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      await action();
      if (success) setNotice(success);
      onChanged();
      return true;
    } catch (err) {
      setError(errorMessage(err));
      return false;
    } finally {
      setBusy(false);
    }
  };

  const handleRename = async (e: FormEvent) => {
    e.preventDefault();
    await run(
      () => api(`/teams/${team.id}`, { method: 'PATCH', body: { name: name.trim() } }),
      'Nom enregistré ✔',
    );
  };

  const changeRole = (member: TeamMember, role: TeamRole) =>
    run(() => api(`/teams/${team.id}/members/${member.userId}`, { method: 'PATCH', body: { role } }));

  const kick = (member: TeamMember) => {
    if (!window.confirm(`Exclure ${member.user.displayName} de l'équipe ?`)) return;
    void run(() => api(`/teams/${team.id}/members/${member.userId}`, { method: 'DELETE' }));
  };

  const transfer = async () => {
    const target = team.members.find((m) => m.userId === transferTo);
    if (!target) return;
    if (!window.confirm(`Donner la propriété à ${target.user.displayName} ? Tu deviendras coach.`)) {
      return;
    }
    if (await run(() => api(`/teams/${team.id}/transfer`, { method: 'POST', body: { userId: transferTo } }), 'Propriété transférée ✔')) {
      setTransferTo('');
    }
  };

  const leave = async () => {
    if (!window.confirm(`Quitter l'équipe « ${team.name} » ?`)) return;
    if (await run(() => api(`/teams/${team.id}/leave`, { method: 'POST' }))) onClose();
  };

  const remove = async () => {
    if (await run(() => api(`/teams/${team.id}`, { method: 'DELETE' }))) onClose();
  };

  // CEO : exclut tout le monde sauf lui ; coach (Premium) : exclut seulement des joueurs
  const canKick = (m: TeamMember) =>
    m.role !== 'CEO' &&
    m.userId !== meId &&
    (isCeo || (canManageRoster && m.role === 'PLAYER'));

  const tabClass = (t: Tab) =>
    `rounded-md px-3 py-1.5 text-sm font-medium transition ${
      tab === t ? 'bg-zinc-700/70 text-white' : 'text-zinc-400 hover:bg-zinc-800 hover:text-white'
    }`;

  const sectionTitle = 'text-xs font-semibold tracking-wider text-zinc-500 uppercase';
  const inputClass =
    'w-full rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-white placeholder-zinc-500 outline-none focus:border-violet-500';

  return (
    <div
      className="fixed inset-0 z-40 flex items-center justify-center bg-black/70 p-4"
      onClick={onClose}
    >
      <div
        className="flex max-h-[calc(100vh-2rem)] w-full max-w-lg flex-col rounded-xl border border-zinc-800 bg-zinc-900 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* En-tête */}
        <div className="flex items-start justify-between border-b border-zinc-800 p-5">
          <div className="min-w-0">
            <p className={sectionTitle}>Paramètres de l'équipe</p>
            <h3 className="truncate text-lg font-semibold text-white">
              {team.name}
              {isPremium && <span className="ml-2 text-sm text-amber-400">★ Premium</span>}
            </h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-2xl leading-none text-zinc-500 hover:text-white"
            aria-label="Fermer"
          >
            ×
          </button>
        </div>

        {/* Onglets */}
        <div className="flex gap-1 border-b border-zinc-800 px-5 py-2">
          <button type="button" className={tabClass('general')} onClick={() => setTab('general')}>
            Général
          </button>
          <button type="button" className={tabClass('members')} onClick={() => setTab('members')}>
            Membres ({team.members.length})
          </button>
          <button type="button" className={tabClass('channels')} onClick={() => setTab('channels')}>
            Salons
          </button>
        </div>

        <div className="flex-1 space-y-6 overflow-y-auto p-5">
          {/* ---------- Général ---------- */}
          {tab === 'general' && (
            <>
              <section>
                <p className={sectionTitle}>Abonnement</p>
                <p className="mt-2 text-sm text-zinc-300">
                  Plan {isPremium ? 'Premium' : 'Free'} (celui du CEO, {team.owner.displayName}) ·{' '}
                  {team.members.length} / {team.limits.maxSlots} places utilisées
                </p>
              </section>

              {isCeo ? (
                <form onSubmit={handleRename} className="space-y-2">
                  <label htmlFor="teamName" className={sectionTitle}>
                    Nom de l'équipe
                  </label>
                  <div className="flex gap-2">
                    <input
                      id="teamName"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      minLength={2}
                      maxLength={40}
                      required
                      className={inputClass}
                    />
                    <button
                      type="submit"
                      disabled={busy || name.trim() === team.name}
                      className="shrink-0 rounded-lg bg-violet-600 px-4 text-sm font-medium text-white hover:bg-violet-500 disabled:opacity-50"
                    >
                      Enregistrer
                    </button>
                  </div>
                </form>
              ) : null}

              {isCeo && others.length > 0 && (
                <section className="space-y-2">
                  <p className={sectionTitle}>Transférer la propriété</p>
                  <div className="flex gap-2">
                    <select
                      value={transferTo}
                      onChange={(e) => setTransferTo(e.target.value)}
                      className={inputClass}
                    >
                      <option value="">Choisir un membre…</option>
                      {others.map((m) => (
                        <option key={m.userId} value={m.userId}>
                          {m.user.displayName}
                        </option>
                      ))}
                    </select>
                    <button
                      type="button"
                      onClick={() => void transfer()}
                      disabled={busy || !transferTo}
                      className="shrink-0 rounded-lg border border-zinc-700 px-4 text-sm text-zinc-200 hover:bg-zinc-800 disabled:opacity-50"
                    >
                      Transférer
                    </button>
                  </div>
                </section>
              )}

              {/* Zone dangereuse */}
              <section className="space-y-2 rounded-lg border border-red-500/30 p-4">
                <p className="text-xs font-semibold tracking-wider text-red-400 uppercase">
                  Zone dangereuse
                </p>
                {isCeo ? (
                  <>
                    <p className="text-sm text-zinc-400">
                      Supprimer l'équipe efface ses salons et tous leurs messages. Tape{' '}
                      <span className="font-semibold text-white">{team.name}</span> pour confirmer.
                    </p>
                    <div className="flex gap-2">
                      <input
                        value={deleteConfirm}
                        onChange={(e) => setDeleteConfirm(e.target.value)}
                        placeholder={team.name}
                        className={inputClass}
                      />
                      <button
                        type="button"
                        onClick={() => void remove()}
                        disabled={busy || deleteConfirm !== team.name}
                        className="shrink-0 rounded-lg bg-red-600 px-4 text-sm font-medium text-white hover:bg-red-500 disabled:opacity-40"
                      >
                        Supprimer
                      </button>
                    </div>
                  </>
                ) : (
                  <button
                    type="button"
                    onClick={() => void leave()}
                    disabled={busy}
                    className="rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-500 disabled:opacity-50"
                  >
                    Quitter l'équipe
                  </button>
                )}
              </section>
            </>
          )}

          {/* ---------- Membres ---------- */}
          {tab === 'members' && (
            <section>
              <div className="flex items-center justify-between">
                <p className={sectionTitle}>
                  {team.members.length} / {team.limits.maxSlots} membres
                </p>
                {canManageRoster && (
                  <button
                    type="button"
                    onClick={() => setInviteOpen(true)}
                    className="rounded-lg border border-violet-500/30 bg-violet-600/10 px-3 py-1.5 text-xs font-semibold text-violet-300 hover:bg-violet-600/20"
                  >
                    + Inviter
                  </button>
                )}
              </div>
              {!isPremium && (
                <p className="mt-2 text-xs text-zinc-500">
                  Les rôles (CEO, coach, joueur) sont disponibles en Premium.
                </p>
              )}

              <ul className="mt-3 space-y-1">
                {team.members.map((m) => (
                  <li key={m.userId} className="flex items-center gap-3 rounded-lg px-2 py-2 hover:bg-zinc-800/60">
                    <span className="grid size-8 shrink-0 place-items-center rounded-full bg-indigo-500 text-sm font-semibold text-white">
                      {m.user.displayName.charAt(0).toUpperCase()}
                    </span>
                    <span className="min-w-0 flex-1 truncate text-sm text-zinc-100">
                      {m.user.displayName}
                      {m.userId === meId && <span className="text-zinc-500"> (toi)</span>}
                    </span>

                    {/* Rôle : modifiable par le CEO en Premium, sinon simple badge */}
                    {isPremium && isCeo && m.role !== 'CEO' ? (
                      <select
                        value={m.role}
                        disabled={busy}
                        onChange={(e) => void changeRole(m, e.target.value as TeamRole)}
                        className="rounded-md border border-zinc-700 bg-zinc-800 px-2 py-1 text-xs text-white"
                      >
                        <option value="COACH">Coach</option>
                        <option value="PLAYER">Joueur</option>
                      </select>
                    ) : isPremium ? (
                      <span className={`rounded-full px-2 py-0.5 text-xs ${ROLE_STYLE[m.role]}`}>
                        {ROLE_LABEL[m.role]}
                      </span>
                    ) : m.role === 'CEO' ? (
                      <span className="rounded-full bg-zinc-700/60 px-2 py-0.5 text-xs text-zinc-300">
                        Créateur
                      </span>
                    ) : null}

                    {canKick(m) && (
                      <button
                        type="button"
                        onClick={() => kick(m)}
                        disabled={busy}
                        className="text-xs text-red-400 hover:text-red-300 disabled:opacity-50"
                      >
                        Exclure
                      </button>
                    )}
                  </li>
                ))}
              </ul>
            </section>
          )}

          {/* ---------- Salons ---------- */}
          {tab === 'channels' && (
            <section>
              <p className={sectionTitle}>Salons de l'équipe</p>
              <ul className="mt-3 space-y-2 text-sm">
                <li className="rounded-lg border border-zinc-800 p-3">
                  <p className="font-medium text-white"># général</p>
                  <p className="text-xs text-zinc-500">Tous les membres de l'équipe.</p>
                </li>
                <li className="rounded-lg border border-zinc-800 p-3">
                  <p className="font-medium text-white">
                    # admin 🔒 {!isPremium && <span className="text-xs text-amber-400">Premium</span>}
                  </p>
                  <p className="text-xs text-zinc-500">
                    Le CEO et les coachs.{' '}
                    {isPremium && !isStaff && 'Tu n’y as pas accès.'}
                  </p>
                </li>
                <li className="rounded-lg border border-zinc-800 p-3">
                  <p className="font-medium text-white">
                    # salons d'events {!isPremium && <span className="text-xs text-amber-400">Premium</span>}
                  </p>
                  <p className="text-xs text-zinc-500">
                    Créés automatiquement pour chaque scrim ou match, archivés 7 jours après.
                  </p>
                </li>
              </ul>
            </section>
          )}
        </div>

        {/* Messages */}
        {(error || notice) && (
          <div className="border-t border-zinc-800 px-5 py-3 text-sm">
            {error && <p className="text-red-400">{error}</p>}
            {notice && <p className="text-emerald-400">{notice}</p>}
          </div>
        )}
      </div>

      {inviteOpen && (
        <AddMemberModal
          teamId={team.id}
          memberIds={team.members.map((m) => m.userId)}
          onClose={() => setInviteOpen(false)}
        />
      )}
    </div>
  );
}