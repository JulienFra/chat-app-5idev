import { useEffect, useState } from 'react';
import { api } from '../api';
import type { Profile } from '../types';
import ProfileModal from './ProfileModal';

interface Props {
  onLogout: () => void;
  onPlanChange?: () => void; // ex : recharger les équipes (limites, #admin)
}

// Barre « utilisateur » en bas de la colonne, comme sur Discord
export default function UserPanel({ onLogout, onPlanChange }: Props) {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [isOpen, setIsOpen] = useState(false);
  const [confirmLogout, setConfirmLogout] = useState(false);

  useEffect(() => {
    let cancelled = false;
    api<Profile>('/users/me')
      .then((data) => {
        if (!cancelled) setProfile(data);
      })
      .catch(() => {
        // sans profil, le panneau reste vide ; le reste de l'appli fonctionne
      });
    return () => {
      cancelled = true;
    };
  }, []);

  if (!profile) {
    return <div className="h-14 shrink-0 border-t border-zinc-800 bg-zinc-950/40" />;
  }

  const isPremium = profile.plan === 'PREMIUM';

  const handleChange = (updated: Profile) => {
    const planChanged = updated.plan !== profile.plan;
    setProfile(updated);
    if (planChanged) onPlanChange?.();
  };

  const iconButton =
    'grid size-8 shrink-0 place-items-center rounded-md text-zinc-400 transition hover:bg-zinc-800 hover:text-white';

  return (
    <>
      <div className="flex h-14 shrink-0 items-center gap-1 border-t border-zinc-800 bg-zinc-950/40 px-2">
        {/* Avatar + pseudo : ouvre le profil */}
        <button
          type="button"
          onClick={() => setIsOpen(true)}
          className="flex min-w-0 flex-1 items-center gap-2.5 rounded-md px-1 py-1 text-left transition hover:bg-zinc-800"
          title="Ouvrir mon profil"
        >
          <span className="grid size-9 shrink-0 place-items-center rounded-full bg-indigo-500 text-sm font-semibold text-white">
            {profile.displayName.charAt(0).toUpperCase()}
          </span>
          <span className="min-w-0">
            <span className="block truncate text-sm font-semibold text-white">
              {profile.displayName}
            </span>
            <span
              className={`block text-[11px] font-medium ${
                isPremium ? 'text-amber-400' : 'text-zinc-500'
              }`}
            >
              {isPremium ? '★ Premium' : 'Free'}
            </span>
          </span>
        </button>

        <button
          type="button"
          onClick={() => setIsOpen(true)}
          className={iconButton}
          title="Paramètres du profil"
          aria-label="Paramètres du profil"
        >
          ⚙
        </button>
        <button
          type="button"
          onClick={() => setConfirmLogout(true)}
          className={`${iconButton} hover:bg-red-500/15 hover:text-red-400`}
          title="Se déconnecter"
          aria-label="Se déconnecter"
        >
          ⏻
        </button>
      </div>

      {isOpen && (
        <ProfileModal
          profile={profile}
          onClose={() => setIsOpen(false)}
          onChange={handleChange}
          onLogoutRequest={() => setConfirmLogout(true)}
        />
      )}

      {/* Confirmation de déconnexion (au-dessus de la fenêtre Profil) */}
      {confirmLogout && (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center bg-black/70 p-4"
          onClick={() => setConfirmLogout(false)}
        >
          <div
            role="alertdialog"
            aria-labelledby="logout-title"
            className="w-full max-w-xs rounded-xl border border-zinc-800 bg-zinc-900 p-6 text-center shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mx-auto grid size-12 place-items-center rounded-full bg-red-500/15 text-xl text-red-400">
              ⏻
            </div>
            <p id="logout-title" className="mt-3 text-lg font-semibold text-white">
              Se déconnecter ?
            </p>
            <p className="mt-1 text-sm text-zinc-400">Voulez-vous vraiment vous déconnecter ?</p>
            <div className="mt-5 flex gap-2">
              <button
                type="button"
                autoFocus
                onClick={() => setConfirmLogout(false)}
                className="flex-1 rounded-lg border border-zinc-700 px-3 py-2 text-sm text-zinc-300 hover:bg-zinc-800"
              >
                Annuler
              </button>
              <button
                type="button"
                onClick={onLogout}
                className="flex-1 rounded-lg bg-red-600 px-3 py-2 text-sm font-medium text-white hover:bg-red-500"
              >
                Se déconnecter
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}