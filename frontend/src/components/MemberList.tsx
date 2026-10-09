import { useEffect, useState } from 'react';
import { api, errorMessage } from '../api';
import { connectSocket } from '../socket';
import type { Team, TeamMember, TeamRole } from '../types';

interface Props {
  team: Team;
  meId: string | null;
  onChanged: () => void;
  onMessage: (userId: string) => void;
}

const ROLE_LABEL: Record<TeamRole, string> = { CEO: 'CEO', COACH: 'Coach', PLAYER: 'Joueur' };
const GROUP_LABEL: Record<TeamRole, string> = { CEO: 'CEO', COACH: 'Coachs', PLAYER: 'Joueurs' };
const ROLE_STYLE: Record<TeamRole, string> = {
  CEO: 'bg-amber-500/15 text-amber-300',
  COACH: 'bg-sky-500/15 text-sky-300',
  PLAYER: 'bg-zinc-700/60 text-zinc-400',
};

export default function MemberList({ team, meId, onChanged, onMessage }: Props) {
  const [openId, setOpenId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const [onlineUsers, setOnlineUsers] = useState<Set<string>>(new Set());

  useEffect(() => {
    const socket = connectSocket();

    const onOnlineList = (userIds: string[]) => {
      setOnlineUsers(new Set(userIds));
    };

    const onUserOnline = ({ userId }: { userId: string }) => {
      setOnlineUsers((prev) => {
        const next = new Set(prev);
        next.add(userId);
        return next;
      });
    };

    const onUserOffline = ({ userId }: { userId: string }) => {
      setOnlineUsers((prev) => {
        const next = new Set(prev);
        next.delete(userId);
        return next;
      });
    };

    socket.on('users:online_list', onOnlineList);
    socket.on('user:online', onUserOnline);
    socket.on('user:offline', onUserOffline);

    socket.emit('users:request_online');

    return () => {
      socket.off('users:online_list', onOnlineList);
      socket.off('user:online', onUserOnline);
      socket.off('user:offline', onUserOffline);
    };
  }, []);

  const isPremium = team.owner.plan === 'PREMIUM';
  const isCeo = team.myRole === 'CEO';
  const canManageRoster = isCeo || (team.myRole === 'COACH' && isPremium);
  const canChangeRole = (m: TeamMember) => isPremium && isCeo && m.role !== 'CEO';
  const canKick = (m: TeamMember) =>
    m.role !== 'CEO' && m.userId !== meId && (isCeo || (canManageRoster && m.role === 'PLAYER'));

  const run = async (action: () => Promise<unknown>) => {
    setBusy(true);
    setError(null);
    try {
      await action();
      setOpenId(null);
      onChanged();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  const changeRole = (m: TeamMember, role: TeamRole) => {
    if (role === m.role) return;
    void run(() =>
      api(`/teams/${team.id}/members/${m.userId}`, { method: 'PATCH', body: { role } }),
    );
  };

  const kick = (m: TeamMember) => {
    if (!window.confirm(`Exclure ${m.user.displayName} de « ${team.name} » ?`)) return;
    void run(() => api(`/teams/${team.id}/members/${m.userId}`, { method: 'DELETE' }));
  };

  const groups: (TeamRole | null)[] = isPremium ? ['CEO', 'COACH', 'PLAYER'] : [null];

  const renderMember = (m: TeamMember) => {
    const open = openId === m.userId;
    const isMe = m.userId === meId;
    const isOnline = onlineUsers.has(m.userId);
    const actions = canChangeRole(m) || canKick(m) || !isMe;

    return (
      <li key={m.userId}>
        <button
          type="button"
          onClick={() => {
            setOpenId(open ? null : m.userId);
            setError(null);
          }}
          className={`flex w-full items-center gap-2.5 rounded-md px-2 py-1.5 text-left transition ${
            open ? 'bg-zinc-700/60' : 'hover:bg-zinc-800/80'
          }`}
        >
          <div className="relative">
            <span className="grid size-8 shrink-0 place-items-center rounded-full bg-zinc-700 text-xs font-semibold text-white">
              {m.user.displayName.charAt(0).toUpperCase()}
            </span>
            <span
              className={`absolute bottom-0 right-0 size-2.5 rounded-full border-[1.5px] border-zinc-900 ${
                isOnline ? 'bg-green-500' : 'bg-zinc-500'
              }`}
              title={isOnline ? 'En ligne' : 'Hors ligne'}
            />
          </div>

          <span className={`min-w-0 flex-1 truncate text-sm transition-colors ${isOnline ? 'text-zinc-200' : 'text-zinc-400'}`}>
            {m.user.displayName}
            {isMe && <span className="text-zinc-600"> (toi)</span>}
          </span>
          {!isPremium && m.role === 'CEO' && (
            <span className="text-xs" title="Créateur de l'équipe">
              👑
            </span>
          )}
        </button>

        {open && (
          <div className="mx-1 mt-1 mb-2 space-y-2 rounded-lg border border-zinc-700/60 bg-zinc-950/60 p-3">
            <div className="flex items-center justify-between">
              <span className="text-sm font-semibold text-white">{m.user.displayName}</span>
              {isPremium && (
                <span className={`rounded px-1.5 py-0.5 text-[10px] font-semibold ${ROLE_STYLE[m.role]}`}>
                  {ROLE_LABEL[m.role]}
                </span>
              )}
            </div>

            {canChangeRole(m) && (
              <div>
                <p className="mb-1 text-[11px] font-semibold tracking-wider text-zinc-500 uppercase">
                  Rôle
                </p>
                <div className="flex gap-1">
                  {(['COACH', 'PLAYER'] as const).map((role) => (
                    <button
                      key={role}
                      type="button"
                      disabled={busy}
                      onClick={() => changeRole(m, role)}
                      className={`flex-1 rounded-md px-2 py-1 text-xs font-medium transition disabled:opacity-50 ${
                        m.role === role
                          ? 'bg-violet-600 text-white'
                          : 'bg-zinc-800 text-zinc-300 hover:bg-zinc-700'
                      }`}
                    >
                      {ROLE_LABEL[role]}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {!isMe && (
              <button
                type="button"
                onClick={() => onMessage(m.userId)}
                className="w-full rounded-md bg-zinc-800 px-2 py-1.5 text-xs font-medium text-zinc-200 hover:bg-zinc-700"
              >
                💬 Message privé
              </button>
            )}

            {canKick(m) && (
              <button
                type="button"
                disabled={busy}
                onClick={() => kick(m)}
                className="w-full rounded-md bg-red-500/10 px-2 py-1.5 text-xs font-medium text-red-400 hover:bg-red-500/20 disabled:opacity-50"
              >
                Exclure de l'équipe
              </button>
            )}

            {!actions && <p className="text-xs text-zinc-500">Aucune action disponible.</p>}
            {error && <p className="text-xs text-red-400">{error}</p>}
          </div>
        )}
      </li>
    );
  };

  return (
    <aside className="hidden w-60 shrink-0 flex-col border-l border-zinc-800/80 bg-zinc-900 lg:flex">
      <header className="flex h-14 shrink-0 items-center border-b border-zinc-800/80 px-4 shadow-sm">
        <h2 className="text-sm font-bold text-white">
          Membres <span className="font-normal text-zinc-500">— {team.members.length}</span>
        </h2>
      </header>
      <div className="flex-1 space-y-4 overflow-y-auto px-2 py-4">
        {groups.map((role) => {
          const members = role ? team.members.filter((m) => m.role === role) : team.members;
          if (members.length === 0) return null;
          return (
            <section key={role ?? 'all'}>
              {role && (
                <h3 className="px-2 pb-1 text-xs font-semibold tracking-wider text-zinc-500 uppercase">
                  {GROUP_LABEL[role]} — {members.length}
                </h3>
              )}
              <ul className="space-y-0.5">{members.map(renderMember)}</ul>
            </section>
          );
        })}
      </div>
    </aside>
  );
}