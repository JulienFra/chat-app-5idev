import { useEffect, useState } from 'react';
import './App.css';
import { clearToken, getToken, saveToken } from './api';
import AuthPage from './AuthPage';
import ChatPage from './ChatPage';
import LandingPage from './LandingPage';
import LegalPage from './LegalPage';
import CookieBanner from './components/CookieBanner';
import { useLegalPage } from './legal';

export default function App() {
  const [token, setToken] = useState<string | null>(getToken());
  const [guestView, setGuestView] = useState<'landing' | 'auth'>('landing');
  const [authMode, setAuthMode] = useState<'login' | 'register'>('login');

  // Page légale demandée dans l'URL (#/mentions-legales, #/contact…), connecté ou non
  const legalPage = useLegalPage();

  // Si le token expire, api.ts émet cet événement
  useEffect(() => {
    const onLogout = () => {
      setToken(null);
      setGuestView('landing');
    };
    window.addEventListener('auth:logout', onLogout);
    return () => window.removeEventListener('auth:logout', onLogout);
  }, []);

  const handleLoggedIn = (newToken: string) => {
    saveToken(newToken);
    setToken(newToken);
  };

  const handleLogout = () => {
    clearToken();
    setToken(null);
    setGuestView('landing');
  };

  const openAuth = (mode: 'login' | 'register') => {
    setAuthMode(mode);
    setGuestView('auth');
  };

  let content;
  if (legalPage) {
    content = <LegalPage page={legalPage} />;
  } else if (token) {
    content = <ChatPage onLogout={handleLogout} />;
  } else if (guestView === 'auth') {
    content = (
      <div className="relative">
        <button
          type="button"
          onClick={() => setGuestView('landing')}
          className="absolute top-4 left-4 z-50 rounded-lg border border-zinc-800 bg-zinc-900/90 px-3 py-1.5 text-xs font-medium text-zinc-400 transition hover:bg-zinc-800 hover:text-white"
        >
          ← Retour à l'accueil
        </button>
        <AuthPage key={authMode} onLoggedIn={handleLoggedIn} initialMode={authMode} />
      </div>
    );
  } else {
    content = (
      <LandingPage onGetStarted={() => openAuth('register')} onLogin={() => openAuth('login')} />
    );
  }

  return (
    <>
      {content}
      <CookieBanner />
    </>
  );
}