import { useState } from 'react';
import { legalHref } from '../legal';

const STORAGE_KEY = 'cookie-notice';

// Le stockage peut être bloqué (navigation privée stricte…) : on ne plante jamais
function alreadyAcknowledged(): boolean {
  try {
    return localStorage.getItem(STORAGE_KEY) === 'ok';
  } catch {
    return false;
  }
}

// Bandeau d'information à la première visite : stockage strictement nécessaire,
// donc pas de consentement à demander, seulement une information claire
export default function CookieBanner() {
  const [visible, setVisible] = useState(() => !alreadyAcknowledged());

  if (!visible) return null;

  const acknowledge = () => {
    try {
      localStorage.setItem(STORAGE_KEY, 'ok');
    } catch {
      // stockage indisponible : le bandeau réapparaîtra à la prochaine visite
    }
    setVisible(false);
  };

  return (
    <div
      role="region"
      aria-label="Information sur les cookies"
      className="fixed inset-x-3 bottom-3 z-[70] mx-auto max-w-2xl rounded-xl border border-zinc-700 bg-zinc-900/95 p-4 text-sm text-zinc-300 shadow-2xl backdrop-blur-md md:inset-x-auto md:right-5 md:bottom-5"
    >
      <p>
        🍪 <strong className="text-white">Pas de cookies publicitaires ni de suivi.</strong> Nous
        utilisons uniquement le stockage local de ton navigateur pour te garder connecté.{' '}
        <a href={legalHref('cookies')} className="text-violet-400 underline">
          En savoir plus
        </a>
      </p>
      <div className="mt-3 flex justify-end">
        <button
          type="button"
          onClick={acknowledge}
          className="rounded-lg bg-violet-600 px-4 py-1.5 text-sm font-medium text-white transition hover:bg-violet-500"
        >
          J’ai compris
        </button>
      </div>
    </div>
  );
}