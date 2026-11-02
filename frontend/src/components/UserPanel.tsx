import { useEffect, useState } from 'react';
import { api } from '../api';
import type { Profile } from '../types';
import ProfileModal from './ProfileModal';

interface Props {
  onLogout: () => void;
  onPlanChange?: () => void; // ex : recharger les équipes (limites, #admin)
}

// Zone « utilisateur » intégrée à la barre du haut : sans fond ni bordure, elle se fond dans le header
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
    return <div className="h-10 w-10 shrink-0" />;
  }

  const isPremium = profile.plan === 'PREMIUM';

  const handleChange = (updated: Profile) => {
    const planChanged = updated.plan !== profile.plan;
    setProfile(updated);
    if (planChanged) onPlanChange?.();
  };

  const iconButton =
    'grid size-10 shrink-0 place-items-center rounded-lg text-xl leading-none text-[#9aa1ab] transition-colors hover:bg-[#1c2025] hover:text-white';

  return (
    <>
      <div className="flex shrink-0 items-center gap-1">
        {/* Avatar + pseudo : ouvre le profil */}
        <button
          type="button"
          onClick={() => setIsOpen(true)}
          className="flex min-w-0 items-center gap-3 rounded-lg py-1.5 pl-1.5 pr-2 text-left transition-colors hover:bg-[#1c2025] sm:pr-3"
          title="Ouvrir mon profil"
        >
          <span
            className={`grid size-9 shrink-0 place-items-center rounded-full bg-[#262b31] text-sm font-bold text-white ${
              isPremium ? 'ring-2 ring-[#d7ff3a]' : ''
            }`}
          >
            {profile.displayName.charAt(0).toUpperCase()}
          </span>
          <span className="hidden min-w-0 sm:block">
            <span className="block max-w-[140px] truncate text-[15px] font-semibold leading-5 text-white">
              {profile.displayName}
            </span>
            <span
              className={`block text-xs font-semibold leading-4 ${
                isPremium ? 'text-[#d7ff3a]' : 'text-[#9aa1ab]'
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
          className="fixed inset-0 z-[60] flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm"
          onClick={() => setConfirmLogout(false)}
        >
          <div
            role="alertdialog"
            aria-labelledby="logout-title"
            className="w-full max-w-sm rounded-2xl border border-[#2a3037] bg-[#0f1215] p-7 text-center shadow-2xl shadow-black/60"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mx-auto grid size-14 place-items-center rounded-full bg-red-500/15 text-2xl text-red-400">
              ⏻
            </div>
            <p id="logout-title" className="mt-4 text-xl font-bold text-white">
              Se déconnecter ?
            </p>
            <p className="mt-2 text-[15px] text-[#9aa1ab]">Voulez-vous vraiment vous déconnecter ?</p>
            <div className="mt-6 flex gap-3">
              <button
                type="button"
                autoFocus
                onClick={() => setConfirmLogout(false)}
                className="h-11 flex-1 rounded-lg border border-[#363d45] px-3 text-[15px] font-semibold text-[#d5d9de] transition-colors hover:border-[#4a525c] hover:bg-[#1c2025] hover:text-white"
              >
                Annuler
              </button>
              <button
                type="button"
                onClick={onLogout}
                className="h-11 flex-1 rounded-lg bg-red-600 px-3 text-[15px] font-bold text-white transition-colors hover:bg-red-500"
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
