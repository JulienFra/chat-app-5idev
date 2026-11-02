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
  CEO: 'bg-[#d7ff3a]/15 text-[#d7ff3a]',
  COACH: 'bg-sky-500/15 text-sky-300',
  PLAYER: 'bg-[#262b31] text-[#c3c9d0]',
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
      <li key={m.userId} className="px-3">
        <button
          type="button"
          onClick={() => {
            setOpenId(open ? null : m.userId);
            setError(null);
          }}
          className={`flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left transition-colors ${
            open ? 'bg-[#1c2025]' : 'hover:bg-[#15181c]'
          }`}
        >
          <div className="relative shrink-0">
            <span className="grid size-9 place-items-center rounded-full bg-[#262b31] text-sm font-bold text-[#e9ebee]">
              {m.user.displayName.charAt(0).toUpperCase()}
            </span>
            <span
              className={`absolute -bottom-0.5 -right-0.5 size-3.5 rounded-full border-2 border-[#0f1215] ${
                isOnline ? 'bg-[#d7ff3a]' : 'bg-[#4a525c]'
              }`}
              title={isOnline ? 'En ligne' : 'Hors ligne'}
            />
          </div>

          <span
            className={`min-w-0 flex-1 truncate text-[15px] font-medium transition-colors ${
              isOnline ? 'text-white' : 'text-[#9aa1ab]'
            }`}
          >
            {m.user.displayName}
            {isMe && <span className="font-normal text-[#6f7782]"> (toi)</span>}
          </span>
          {!isPremium && m.role === 'CEO' && (
            <span className="text-base" title="Créateur de l'équipe">
              👑
            </span>
          )}
        </button>

        {open && (
          <div className="mb-2 mt-1 space-y-3 rounded-xl border border-[#2a3037] bg-[#0b0d0f] p-3.5">
            <div className="flex items-center justify-between gap-2">
              <span className="truncate text-[15px] font-bold text-white">{m.user.displayName}</span>
              {isPremium && (
                <span className={`shrink-0 rounded px-2 py-0.5 text-xs font-bold ${ROLE_STYLE[m.role]}`}>
                  {ROLE_LABEL[m.role]}
                </span>
              )}
            </div>

            {canChangeRole(m) && (
              <div>
                <p className="mb-1.5 text-xs font-semibold uppercase tracking-wider text-[#9aa1ab]">Rôle</p>
                <div className="flex gap-2">
                  {(['COACH', 'PLAYER'] as const).map((role) => (
                    <button
                      key={role}
                      type="button"
                      disabled={busy}
                      onClick={() => changeRole(m, role)}
                      className={`flex-1 rounded-lg px-2 py-2 text-sm font-semibold transition-colors disabled:opacity-50 ${
                        m.role === role
                          ? 'bg-[#d7ff3a] text-black'
                          : 'border border-[#363d45] text-[#d5d9de] hover:border-[#4a525c] hover:bg-[#1c2025] hover:text-white'
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
                className="w-full rounded-lg border border-[#363d45] px-3 py-2 text-sm font-semibold text-[#d5d9de] transition-colors hover:border-[#4a525c] hover:bg-[#1c2025] hover:text-white"
              >
                💬 Message privé
              </button>
            )}

            {canKick(m) && (
              <button
                type="button"
                disabled={busy}
                onClick={() => kick(m)}
                className="w-full rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm font-semibold text-red-300 transition-colors hover:bg-red-500/20 disabled:opacity-50"
              >
                Exclure de l'équipe
              </button>
            )}

            {!actions && <p className="text-sm text-[#9aa1ab]">Aucune action disponible.</p>}
            {error && <p className="text-sm text-red-300">{error}</p>}
          </div>
        )}
      </li>
    );
  };

  return (
    <aside className="hidden w-[300px] shrink-0 flex-col border-l border-[#23282e] bg-[#0f1215] lg:flex">
      <header className="flex h-16 shrink-0 items-center justify-between border-b border-[#23282e] px-5">
        <h2 className="text-lg font-bold text-white">Membres</h2>
        <span className="rounded-full bg-[#1c2025] px-2.5 py-1 text-sm font-semibold tabular-nums text-[#d5d9de]">
          {team.members.length}
        </span>
      </header>
      <div className="flex-1 overflow-y-auto pb-6">
        {groups.map((role) => {
          const members = role ? team.members.filter((m) => m.role === role) : team.members;
          if (members.length === 0) return null;
          return (
            <section key={role ?? 'all'}>
              {role && (
                <h3 className="flex items-center justify-between px-5 pb-2 pt-6 text-xs font-semibold uppercase tracking-wider text-[#9aa1ab]">
                  <span>{GROUP_LABEL[role]}</span>
                  <span className="tabular-nums">{members.length}</span>
                </h3>
              )}
              {!role && <div className="pt-3" />}
              <ul className="space-y-0.5">{members.map(renderMember)}</ul>
            </section>
          );
        })}
      </div>
    </aside>
  );
}
