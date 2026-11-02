import { useSyncExternalStore } from 'react';

// =============================================================================
// ⚠️ À COMPLÉTER : les informations légales, en un seul endroit
// =============================================================================
export const LEGAL_INFO = {
  siteName: 'ChatPulse',
  // Les personnes qui éditent le site (projet étudiant : pas de société)
  editors: 'Julien Francis et Florentin Muraille',
  school: '5IDEV — projet d’intégration de développement 2026-2027',
  // Adresse e-mail de contact (affichée publiquement)
  contactEmail: 'julien.francis@ifosup.wavre.be',
  // Hébergeur du serveur (VPS) : nom, adresse, site web
  host: 'HOSTKEY B.V., Tussen de Bogen 6, 1013 JB Amsterdam, Pays-Bas, hostkey.com',
  hostCountry: 'Pays-Bas (Union européenne)',
  lastUpdate: '2 novembre 2026',
};

// =============================================================================
// Navigation par « #/… » dans l'URL : liens partageables, sans routeur
// =============================================================================
export type LegalPageId = 'mentions-legales' | 'confidentialite' | 'cookies' | 'conditions' | 'contact';

export const PAGE_TITLES: Record<LegalPageId, string> = {
  'mentions-legales': 'Mentions légales',
  confidentialite: 'Politique de confidentialité',
  cookies: 'Cookies et stockage local',
  conditions: 'Conditions générales d’utilisation et de vente',
  contact: 'Contact',
};

function readHash(): LegalPageId | null {
  const id = window.location.hash.replace(/^#\/?/, '');
  return Object.hasOwn(PAGE_TITLES, id) ? (id as LegalPageId) : null;
}

function subscribeHash(callback: () => void) {
  window.addEventListener('hashchange', callback);
  return () => window.removeEventListener('hashchange', callback);
}

// Page légale ouverte (ou null)
export function useLegalPage(): LegalPageId | null {
  return useSyncExternalStore(subscribeHash, readHash);
}

export function legalHref(id: LegalPageId): string {
  return `#/${id}`;
}

// Retire le « #/… » de l'URL et revient à l'application
export function closeLegalPage() {
  window.history.pushState(null, '', window.location.pathname + window.location.search);
  window.dispatchEvent(new HashChangeEvent('hashchange'));
}