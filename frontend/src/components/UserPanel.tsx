import { useEffect, useState } from 'react';
import { api } from '../api';
import type { Profile } from '../types';
import ProfileModal from './ProfileModal';

export default function UserPanel() {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [isOpen, setIsOpen] = useState(false);

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

  return (
    <>
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        className="flex h-14 w-full shrink-0 items-center gap-3 border-t border-zinc-800 bg-zinc-950/40 px-3 text-left transition hover:bg-zinc-800"
        title="Ouvrir mon profil"
      >
        <span className="grid size-9 shrink-0 place-items-center rounded-full bg-indigo-500 text-sm font-semibold text-white">
          {profile.displayName.charAt(0).toUpperCase()}
        </span>
        <span className="min-w-0 flex-1">
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
        <span className="text-lg text-zinc-500" aria-hidden="true">
          ⚙
        </span>
      </button>

      {isOpen && (
        <ProfileModal profile={profile} onClose={() => setIsOpen(false)} onChange={setProfile} />
      )}
    </>
  );
}