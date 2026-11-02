import { useState } from 'react';
import type { FormEvent } from 'react';
import { api, errorMessage } from './api';

interface Props {
  onLoggedIn: (token: string) => void;
  initialMode?: 'login' | 'register';
}

// Même règle que le backend (RegisterDto) : 3 à 20 caractères, sans espace
const PSEUDO_PATTERN = '[A-Za-z0-9_.\\-]{3,20}';
const PSEUDO_HINT = '3 à 20 caractères, sans espace : lettres, chiffres, _ - .';

const FEATURES = [
  { title: 'Scrims & événements', text: 'Planifie tes sessions et crée un salon dédié pour chacune.' },
  { title: 'Coachs & joueurs', text: 'Des rôles clairs et des salons réservés au staff.' },
  { title: 'Messages en direct', text: 'Notifications instantanées, images et statut en ligne.' },
];

const inputClass =
  'h-12 w-full rounded-lg border border-[#2a3037] bg-[#0b0d0f] px-4 text-[15px] text-[#e9ebee] placeholder:text-[#6f7782] transition-colors focus:border-[#d7ff3a] focus:outline-none';
const labelClass = 'mb-2 block text-sm font-semibold text-[#d5d9de]';

export default function AuthPage({ onLoggedIn, initialMode = 'login' }: Props) {
  const [isLogin, setIsLogin] = useState(initialMode === 'login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [message, setMessage] = useState<{ text: string; error: boolean } | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setMessage(null);
    setSubmitting(true);

    try {
      if (isLogin) {
        const data = await api<{ access_token: string }>('/auth/login', {
          method: 'POST',
          body: { email, password },
        });
        onLoggedIn(data.access_token);
      } else {
        await api('/auth/register', {
          method: 'POST',
          body: { email, password, displayName: displayName.trim() },
        });
        setMessage({ text: 'Compte créé avec succès ! Connecte-toi maintenant.', error: false });
        setIsLogin(true);
        setPassword('');
      }
    } catch (err) {
      setMessage({ text: errorMessage(err), error: true });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="flex min-h-screen bg-[#0b0d0f] font-sans text-[15px] text-[#e9ebee] antialiased">
      {/* ============ PANNEAU MARQUE (desktop) ============ */}
      <aside
        className="relative hidden w-[46%] max-w-[640px] shrink-0 flex-col justify-between overflow-hidden border-r border-[#23282e] bg-[#0f1215] p-12 lg:flex"
        style={{
          backgroundImage:
            'linear-gradient(#171b1f 1px, transparent 1px), linear-gradient(90deg, #171b1f 1px, transparent 1px)',
          backgroundSize: '48px 48px',
        }}
      >
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top_left,transparent_0%,#0f1215_75%)]" />

        <div className="relative flex items-center gap-3">
          <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-[#d7ff3a] text-black">
            <svg width="20" height="20" viewBox="0 0 16 16" fill="currentColor">
              <path d="M9.2 1 3 9h4l-1 6 7-8.5H8.8z" />
            </svg>
          </span>
          <span className="text-xl font-extrabold tracking-wide text-white">HUB</span>
        </div>

        <div className="relative">
          <h1 className="text-4xl font-extrabold leading-tight tracking-tight text-white">
            Le QG de ton équipe,
            <br />
            <span className="text-[#d7ff3a]">du scrim à la victoire.</span>
          </h1>
          <ul className="mt-10 space-y-5">
            {FEATURES.map((f) => (
              <li key={f.title} className="flex gap-4">
                <span className="mt-2 h-2 w-2 shrink-0 rounded-full bg-[#d7ff3a]" />
                <div>
                  <p className="text-base font-bold text-white">{f.title}</p>
                  <p className="mt-0.5 text-[15px] text-[#9aa1ab]">{f.text}</p>
                </div>
              </li>
            ))}
          </ul>
        </div>

        <p className="relative text-sm text-[#6f7782]">Messagerie dédiée aux équipes esport.</p>
      </aside>

      {/* ============ FORMULAIRE ============ */}
      <main className="flex flex-1 items-center justify-center px-5 py-10">
        <div className="w-full max-w-[420px]">
          {/* Logo mobile */}
          <div className="mb-8 flex items-center gap-3 lg:hidden">
            <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-[#d7ff3a] text-black">
              <svg width="20" height="20" viewBox="0 0 16 16" fill="currentColor">
                <path d="M9.2 1 3 9h4l-1 6 7-8.5H8.8z" />
              </svg>
            </span>
            <span className="text-xl font-extrabold tracking-wide text-white">HUB</span>
          </div>

          <h2 className="text-3xl font-extrabold tracking-tight text-white">
            {isLogin ? 'Connexion' : 'Créer un compte'}
          </h2>
          <p className="mt-2 text-base text-[#9aa1ab]">
            {isLogin ? 'Retrouve ton équipe et tes prochains scrims.' : 'Rejoins le hub en quelques secondes.'}
          </p>

          {message && (
            <div
              className={`mt-6 rounded-lg border px-4 py-3 text-sm ${
                message.error
                  ? 'border-red-500/30 bg-red-500/10 text-red-300'
                  : 'border-[#d7ff3a]/30 bg-[#d7ff3a]/10 text-[#d7ff3a]'
              }`}
              style={{ whiteSpace: 'pre-line' }}
            >
              {message.text}
            </div>
          )}

          <form onSubmit={handleSubmit} className="mt-8 space-y-5">
            {!isLogin && (
              <div>
                <label className={labelClass} htmlFor="pseudo">
                  Pseudo
                </label>
                <input
                  id="pseudo"
                  type="text"
                  required
                  minLength={3}
                  maxLength={20}
                  pattern={PSEUDO_PATTERN}
                  title={PSEUDO_HINT}
                  autoComplete="username"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  className={inputClass}
                  placeholder="Ex: KCorp_iScourP"
                />
                <p className="mt-2 text-[13px] text-[#9aa1ab]">{PSEUDO_HINT}</p>
              </div>
            )}

            <div>
              <label className={labelClass} htmlFor="email">
                Email
              </label>
              <input
                id="email"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className={inputClass}
                placeholder="nom@exemple.com"
              />
            </div>

            <div>
              <label className={labelClass} htmlFor="password">
                Mot de passe
              </label>
              <input
                id="password"
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className={inputClass}
                placeholder="••••••••"
              />
            </div>

            {!isLogin && (
              <p className="text-[13px] leading-5 text-[#9aa1ab]">
                En créant un compte, tu acceptes les{' '}
                <a href="#/conditions" className="font-semibold text-[#d5d9de] underline hover:text-white">
                  conditions d'utilisation
                </a>{' '}
                et la{' '}
                <a href="#/confidentialite" className="font-semibold text-[#d5d9de] underline hover:text-white">
                  politique de confidentialité
                </a>
                .
              </p>
            )}

            <button
              type="submit"
              disabled={submitting}
              className="h-12 w-full rounded-lg bg-[#d7ff3a] text-base font-bold text-black transition-colors hover:bg-[#e4ff72] disabled:cursor-not-allowed disabled:opacity-50"
            >
              {submitting ? 'Patiente…' : isLogin ? 'Se connecter' : "S'inscrire"}
            </button>
          </form>

          <p className="mt-8 border-t border-[#23282e] pt-6 text-center text-[15px] text-[#9aa1ab]">
            {isLogin ? 'Pas encore de compte ? ' : 'Déjà inscrit ? '}
            <button
              type="button"
              onClick={() => {
                setIsLogin(!isLogin);
                setMessage(null);
              }}
              className="font-bold text-[#d7ff3a] hover:underline"
            >
              {isLogin ? "S'inscrire" : 'Se connecter'}
            </button>
          </p>
        </div>
      </main>
    </div>
  );
}
