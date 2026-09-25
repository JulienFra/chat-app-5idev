import { useState } from 'react';
import './App.css';

export default function App() {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [message, setMessage] = useState<{ text: string; error: boolean } | null>(null);
  const [token, setToken] = useState<string | null>(localStorage.getItem('token'));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setMessage(null);

    const endpoint = isLogin ? '/api/auth/login' : '/api/auth/register';
    const body = isLogin 
      ? { email, password } 
      : { email, password, displayName };

    try {
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.message || 'Une erreur est survenue');
      }

      if (isLogin) {
        localStorage.setItem('token', data.access_token);
        setToken(data.access_token);
        setMessage({ text: 'Connexion réussie !', error: false });
      } else {
        setMessage({ text: 'Compte créé avec succès ! Connecte-toi maintenant.', error: false });
        setIsLogin(true);
      }
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : 'Erreur réseau';
      setMessage({ text: errorMessage, error: true });
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('token');
    setToken(null);
    setMessage(null);
  };

  if (token) {
    return (
      <div className="auth-container">
        <div className="auth-card">
          <h2 style={{ color: '#16a34a' }}>Connecté avec succès</h2>
          <p className="token-info">
            <strong>Token JWT :</strong> {token.slice(0, 32)}...
          </p>
          <button onClick={handleLogout} className="btn-primary btn-danger">
            Se déconnecter
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="auth-container">
      <div className="auth-card">
        <h2>{isLogin ? 'Connexion' : 'Créer un compte'}</h2>

        {message && (
          <div className={`auth-alert ${message.error ? 'error' : 'success'}`}>
            {message.text}
          </div>
        )}

        <form onSubmit={handleSubmit} className="auth-form">
          {!isLogin && (
            <div className="form-group">
              <label className="form-label">Pseudo</label>
              <input
                type="text"
                required
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                className="form-input"
                placeholder="Ex: Joueur 1"
              />
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

          <button type="submit" className="btn-primary">
            {isLogin ? 'Se connecter' : "S'inscrire"}
          </button>
        </form>

        <p className="auth-footer">
          {isLogin ? "Pas encore de compte ? " : "Déjà inscrit ? "}
          <button
            type="button"
            onClick={() => { setIsLogin(!isLogin); setMessage(null); }}
            className="btn-link"
          >
            {isLogin ? "S'inscrire" : 'Se connecter'}
          </button>
        </p>
      </div>
    </div>
  );
}