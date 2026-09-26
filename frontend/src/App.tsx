import { useEffect, useState } from 'react';
import './App.css';
import { clearToken, getToken, saveToken } from './api';
import AuthPage from './AuthPage';
import ChatPage from './ChatPage';

export default function App() {
  const [token, setToken] = useState<string | null>(getToken());

  // Si le token expire, api.ts émet cet événement
  useEffect(() => {
    const onLogout = () => setToken(null);
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
  };

  if (!token) {
    return <AuthPage onLoggedIn={handleLoggedIn} />;
  }

  return <ChatPage onLogout={handleLogout} />;
}