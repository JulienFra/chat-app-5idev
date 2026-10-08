import { useState } from 'react';
import type { FormEvent } from 'react';
import { api, errorMessage } from '../api';
import type { Profile } from '../types';

interface Props {
  profile: Profile;
  onClose: () => void;
  onChange: (profile: Profile) => void;
  onLogoutRequest: () => void; // ouvre la confirmation de déconnexion
}

export default function ProfileModal({ profile, onClose, onChange, onLogoutRequest }: Props) {
  // Interrupteur Premium
  const [savingPlan, setSavingPlan] = useState(false);
  const [planError, setPlanError] = useState<string | null>(null);

  // Changement de mot de passe
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [savingPassword, setSavingPassword] = useState(false);
  const [passwordMessage, setPasswordMessage] = useState<{ text: string; error: boolean } | null>(
    null,
  );

  const isPremium = profile.plan === 'PREMIUM';

  const togglePremium = async () => {
    setSavingPlan(true);
    setPlanError(null);
    try {
      const updated = await api<Profile>('/users/me/plan', {
        method: 'PATCH',
        body: { plan: isPremium ? 'FREE' : 'PREMIUM' },
      });
      onChange(updated);
    } catch (err) {
      setPlanError(errorMessage(err));
    } finally {
      setSavingPlan(false);
    }
  };

  const handleChangePassword = async (e: FormEvent) => {
    e.preventDefault();
    setPasswordMessage(null);

    // Vérification locale : inutile d'appeler le serveur si les deux ne correspondent pas
    if (newPassword !== confirmPassword) {
      setPasswordMessage({ text: 'Les deux nouveaux mots de passe ne correspondent pas', error: true });
      return;
    }

    setSavingPassword(true);
    try {
      await api<void>('/users/me/password', {
        method: 'PATCH',
        body: { currentPassword, newPassword },
      });
      setPasswordMessage({ text: 'Mot de passe modifié ✔', error: false });
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (err) {
      setPasswordMessage({ text: errorMessage(err), error: true });
    } finally {
      setSavingPassword(false);
    }
  };

  const inputClass =
    'mt-1 w-full rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-white placeholder-zinc-500 outline-none focus:border-violet-500';

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
      onClick={onClose}
    >
      <div
        className="max-h-[calc(100vh-2rem)] w-full max-w-md overflow-y-auto rounded-xl border border-zinc-800 bg-zinc-900 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* En-tête : avatar, pseudo, plan */}
        <div className="flex items-center gap-4 border-b border-zinc-800 p-6">
          <span className="grid size-14 shrink-0 place-items-center rounded-full bg-indigo-500 text-xl font-bold text-white">
            {profile.displayName.charAt(0).toUpperCase()}
          </span>
          <div className="min-w-0 flex-1">
            <p className="truncate text-lg font-semibold text-white">{profile.displayName}</p>
            <p className="truncate text-sm text-zinc-400">{profile.email}</p>
            <p className="mt-0.5 text-xs text-zinc-500">
              Membre depuis le {new Date(profile.createdAt).toLocaleDateString('fr-BE')}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="self-start text-2xl leading-none text-zinc-500 hover:text-white"
            aria-label="Fermer"
          >
            ×
          </button>
        </div>

        {/* Abonnement */}
        <section className="border-b border-zinc-800 p-6">
          <h3 className="text-xs font-semibold tracking-wider text-zinc-500 uppercase">
            Abonnement
          </h3>
          <div className="mt-3 flex items-center justify-between gap-4">
            <div>
              <p className="font-medium text-white">
                Plan actuel :{' '}
                <span className={isPremium ? 'text-amber-400' : 'text-zinc-300'}>
                  {isPremium ? 'Premium' : 'Free'}
                </span>
              </p>
              <p className="mt-0.5 text-xs text-zinc-500">
                Mode démo : en production, le passage en Premium se ferait par paiement.
              </p>
            </div>
            <label className="flex shrink-0 cursor-pointer items-center gap-2 text-sm text-zinc-300">
              <input
                type="checkbox"
                checked={isPremium}
                disabled={savingPlan}
                onChange={() => void togglePremium()}
                className="size-4 accent-amber-500"
              />
              Premium
            </label>
          </div>
          {planError && <p className="mt-2 text-xs text-red-400">{planError}</p>}
        </section>

        {/* Mot de passe */}
        <section className="border-b border-zinc-800 p-6">
          <h3 className="text-xs font-semibold tracking-wider text-zinc-500 uppercase">
            Changer le mot de passe
          </h3>
          <form onSubmit={handleChangePassword} className="mt-3 space-y-3">
            <div>
              <label htmlFor="currentPassword" className="block text-xs font-medium text-zinc-400">
                Mot de passe actuel
              </label>
              <input
                id="currentPassword"
                type="password"
                required
                autoComplete="current-password"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                className={inputClass}
              />
            </div>
            <div>
              <label htmlFor="newPassword" className="block text-xs font-medium text-zinc-400">
                Nouveau mot de passe
              </label>
              <input
                id="newPassword"
                type="password"
                required
                minLength={8}
                maxLength={72}
                autoComplete="new-password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="8 caractères minimum"
                className={inputClass}
              />
            </div>
            <div>
              <label htmlFor="confirmPassword" className="block text-xs font-medium text-zinc-400">
                Confirmer le nouveau mot de passe
              </label>
              <input
                id="confirmPassword"
                type="password"
                required
                autoComplete="new-password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className={inputClass}
              />
            </div>

            {passwordMessage && (
              <p className={`text-xs ${passwordMessage.error ? 'text-red-400' : 'text-emerald-400'}`}>
                {passwordMessage.text}
              </p>
            )}

            <div className="flex justify-end">
              <button
                type="submit"
                disabled={savingPassword}
                className="rounded-lg bg-violet-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-violet-500 disabled:opacity-50"
              >
                {savingPassword ? 'Enregistrement…' : 'Changer le mot de passe'}
              </button>
            </div>
          </form>
        </section>

        {/* Déconnexion */}
        <section className="p-6">
          <button
            type="button"
            onClick={onLogoutRequest}
            className="w-full rounded-lg bg-red-500/10 px-4 py-2 text-sm font-medium text-red-400 transition hover:bg-red-500/20"
          >
            ⏻ Se déconnecter
          </button>
        </section>
      </div>
    </div>
  );
}