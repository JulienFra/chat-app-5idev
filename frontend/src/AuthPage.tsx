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
    <div className="auth-container">
      <div className="auth-card">
        <h2>{isLogin ? 'Connexion' : 'Créer un compte'}</h2>

        {message && (
          <div
            className={`auth-alert ${message.error ? 'error' : 'success'}`}
            style={{ whiteSpace: 'pre-line' }}
          >
            {message.text}
          </div>
        )}

        <form onSubmit={handleSubmit} className="auth-form">
          {!isLogin && (
            <div className="form-group">
              <label className="form-label" htmlFor="pseudo">
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
                className="form-input"
                placeholder="Ex: KCorp_iScourP"
              />
              <small style={{ opacity: 0.7, fontSize: '0.8rem' }}>{PSEUDO_HINT}</small>
            </div>
          )}

          <div className="form-group">
            <label className="form-label">Email</label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="form-input"
              placeholder="nom@exemple.com"
            />
          </div>

          <div className="form-group">
            <label className="form-label">Mot de passe</label>
            <input
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="form-input"
              placeholder="••••••••"
            />
          </div>

          <button type="submit" className="btn-primary" disabled={submitting}>
            {submitting ? 'Patiente…' : isLogin ? 'Se connecter' : "S'inscrire"}
          </button>
        </form>

        <p className="auth-footer">
          {isLogin ? 'Pas encore de compte ? ' : 'Déjà inscrit ? '}
          <button
            type="button"
            onClick={() => {
              setIsLogin(!isLogin);
              setMessage(null);
            }}
            className="btn-link"
          >
            {isLogin ? "S'inscrire" : 'Se connecter'}
          </button>
        </p>
      </div>
    </div>
  );
}