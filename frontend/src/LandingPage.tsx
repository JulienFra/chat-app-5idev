import { useState } from 'react';

interface Props {
  onGetStarted: () => void;
  onLogin: () => void;
}

const faqs = [
  {
    q: 'Que se passe-t-il si je rétrograde mon abonnement vers l\'offre Rookie (Free) ?',
    a: 'Vous ne perdez aucune donnée ! Vos équipes et salons actuels sont conservés. Cependant, la création de nouvelles équipes, l\'invitation de nouveaux membres et la création d\'événements seront bloquées tant que vous dépasserez les limites du plan gratuit.',
  },
  {
    q: 'Comment fonctionnent les rôles (CEO, Coach, Joueur) ?',
    a: "Le créateur d'une équipe est automatiquement CEO. Il peut inviter des membres et leur assigner des rôles. Les CEO et Coachs ont un accès exclusif au salon #admin et sont les seuls à pouvoir planifier des événements (scrims/matchs).",
  },
  {
    q: 'Comment fonctionne la création des salons de Scrims ou Matchs ?',
    a: "Dans l'offre Team Pro, lorsqu'un CEO ou Coach planifie un scrim dans le calendrier, un salon textuel dédié (ex: #scrim-vitality-08-10) est généré automatiquement. Il est archivé 7 jours après la date de l'événement pour garder votre serveur propre, tout en restant consultable.",
  },
  {
    q: 'Les messages sont-ils instantanés pendant les matchs ?',
    a: 'Oui, notre architecture exploite des WebSockets (Socket.io) pour garantir un échange en temps réel sans latence, parfait pour communiquer en pleine compétition.',
  },
];

export default function LandingPage({ onGetStarted, onLogin }: Props) {
  const [billingCycle, setBillingCycle] = useState<'monthly' | 'yearly'>('monthly');
  const [openFaq, setOpenFaq] = useState<number | null>(null);

  const toggleFaq = (index: number) => {
    setOpenFaq(openFaq === index ? null : index);
  };

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 selection:bg-violet-500 selection:text-white">
      {/* Barre de navigation */}
      <header className="sticky top-0 z-40 border-b border-zinc-800/80 bg-zinc-950/80 backdrop-blur-md">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <div className="flex items-center gap-3">
            <span className="grid size-9 place-items-center rounded-xl bg-gradient-to-tr from-violet-600 to-indigo-500 font-bold text-white shadow-lg shadow-violet-500/20">
              C
            </span>
            <span className="text-lg font-bold tracking-tight text-white">ChatPulse</span>
          </div>

          <nav className="hidden items-center gap-8 text-sm font-medium text-zinc-400 md:flex">
            <a href="#features" className="transition hover:text-white">
              Fonctionnalités
            </a>
            <a href="#pricing" className="transition hover:text-white">
              Tarifs
            </a>
            <a href="#faq" className="transition hover:text-white">
              FAQ
            </a>
          </nav>

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={onLogin}
              className="rounded-lg px-4 py-2 text-sm font-medium text-zinc-300 transition hover:text-white"
            >
              Connexion
            </button>
            <button
              type="button"
              onClick={onGetStarted}
              className="rounded-lg bg-violet-600 px-4 py-2 text-sm font-medium text-white shadow-md shadow-violet-600/30 transition hover:bg-violet-500"
            >
              Jouer maintenant
            </button>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="relative overflow-hidden px-6 pt-20 pb-24 text-center md:pt-32 md:pb-32">
        <div className="pointer-events-none absolute inset-0 -z-10 flex items-center justify-center">
          <div className="size-[500px] rounded-full bg-violet-600/15 blur-3xl" />
        </div>

        <div className="mx-auto max-w-3xl">
          <span className="inline-flex items-center gap-2 rounded-full border border-violet-500/30 bg-violet-500/10 px-3 py-1 text-xs font-semibold text-violet-300">
            ⚡ Le QG de votre équipe e-sport
          </span>
          <h1 className="mt-6 text-4xl font-extrabold tracking-tight text-white sm:text-6xl sm:leading-tight">
            Gérez vos rosters et dominez <br />
            <span className="bg-gradient-to-r from-violet-400 via-indigo-300 to-violet-200 bg-clip-text text-transparent">
              vos prochains scrims.
            </span>
          </h1>
          <p className="mt-6 text-lg text-zinc-400">
            Salons dédiés par matchs, rôles stratégiques (CEO, Coach, Joueur), et planification intégrée. La plateforme de communication taillée pour la compétition.
          </p>

          <div className="mt-8 flex flex-col items-center justify-center gap-4 sm:flex-row">
            <button
              type="button"
              onClick={onGetStarted}
              className="w-full rounded-xl bg-violet-600 px-7 py-3 text-base font-semibold text-white shadow-lg shadow-violet-600/40 transition hover:bg-violet-500 sm:w-auto"
            >
              Créer mon équipe gratuitement
            </button>
            <a
              href="#pricing"
              className="w-full rounded-xl border border-zinc-700 bg-zinc-900/60 px-7 py-3 text-base font-semibold text-zinc-300 transition hover:border-zinc-500 hover:text-white sm:w-auto"
            >
              Voir les offres Pro
            </a>
          </div>
        </div>

        {/* Aperçu Mockup UI */}
        <div className="mx-auto mt-16 max-w-4xl rounded-2xl border border-zinc-800 bg-zinc-900/60 p-2 shadow-2xl backdrop-blur-sm sm:p-4">
          <div className="rounded-xl border border-zinc-800/80 bg-zinc-950 p-6 text-left">
            <div className="flex items-center gap-2 border-b border-zinc-800/80 pb-4">
              <span className="size-3 rounded-full bg-red-500/80" />
              <span className="size-3 rounded-full bg-yellow-500/80" />
              <span className="size-3 rounded-full bg-green-500/80" />
              <span className="ml-2 text-xs font-mono text-zinc-500"># scrim-vitality-08-10 • Événement en cours</span>
            </div>
            <div className="mt-4 space-y-3 font-sans text-sm">
              <div className="flex items-start gap-3">
                <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-yellow-600 text-xs font-bold text-white">F</span>
                <div>
                  <div className="flex items-baseline gap-2">
                    <span className="font-semibold text-white">Florentin</span>
                    <span className="rounded bg-yellow-500/20 px-1.5 py-0.5 text-[10px] font-bold text-yellow-500">CEO</span>
                    <span className="text-[11px] text-zinc-500">19:41</span>
                  </div>
                  <p className="text-zinc-300 mt-0.5">Le scrim contre Vitality est confirmé. Coach, la draft est prête ?</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-violet-600 text-xs font-bold text-white">A</span>
                <div>
                  <div className="flex items-baseline gap-2">
                    <span className="font-semibold text-white">Alice</span>
                    <span className="rounded bg-violet-500/20 px-1.5 py-0.5 text-[10px] font-bold text-violet-400">COACH</span>
                    <span className="text-[11px] text-zinc-500">19:42</span>
                  </div>
                  <p className="text-zinc-300 mt-0.5">Yes, on part sur la compo agressive. Les joueurs, go en vocal dans 5 min !</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section id="features" className="border-t border-zinc-800/80 bg-zinc-900/30 px-6 py-24">
        <div className="mx-auto max-w-6xl">
          <div className="text-center">
            <h2 className="text-xs font-semibold tracking-wider text-violet-400 uppercase">
              Pensé pour la compétition
            </h2>
            <p className="mt-3 text-3xl font-bold tracking-tight text-white sm:text-4xl">
              L'arsenal complet de votre structure
            </p>
          </div>

          <div className="mt-16 grid grid-cols-1 gap-8 md:grid-cols-3">
            <div className="rounded-2xl border border-zinc-800 bg-zinc-900/60 p-8">
              <div className="grid size-12 place-items-center rounded-xl bg-violet-600/10 text-xl font-bold text-violet-400">
                🛡️
              </div>
              <h3 className="mt-5 text-xl font-semibold text-white">Rôles et Permissions</h3>
              <p className="mt-2 text-sm text-zinc-400">
                Hiérarchie claire (CEO, Coach, Joueur). Le staff gère les invitations et profite d'un salon #admin strictement privé.
              </p>
            </div>

            <div className="rounded-2xl border border-zinc-800 bg-zinc-900/60 p-8">
              <div className="grid size-12 place-items-center rounded-xl bg-violet-600/10 text-xl font-bold text-violet-400">
                📅
              </div>
              <h3 className="mt-5 text-xl font-semibold text-white">Salons de Scrims Auto</h3>
              <p className="mt-2 text-sm text-zinc-400">
                Chaque événement (Match, Scrim) génère son propre salon textuel. Les données sont archivées 7 jours après pour un serveur propre.
              </p>
            </div>

            <div className="rounded-2xl border border-zinc-800 bg-zinc-900/60 p-8">
              <div className="grid size-12 place-items-center rounded-xl bg-violet-600/10 text-xl font-bold text-violet-400">
                ⚡
              </div>
              <h3 className="mt-5 text-xl font-semibold text-white">Latence Zéro</h3>
              <p className="mt-2 text-sm text-zinc-400">
                Architecture WebSockets (Socket.io) garantissant la réception instantanée des stratégies et call-outs, sans délai.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Pricing Section */}
      <section id="pricing" className="px-6 py-24">
        <div className="mx-auto max-w-6xl">
          <div className="text-center">
            <h2 className="text-xs font-semibold tracking-wider text-violet-400 uppercase">
              Grille Tarifaire
            </h2>
            <p className="mt-3 text-3xl font-bold tracking-tight text-white sm:text-4xl">
              Des tarifs pour chaque division
            </p>
            <p className="mt-4 text-zinc-400">
              Démarrez en ligue amateur, débloquez la puissance Pro quand le roster s'agrandit.
            </p>

            <div className="mt-8 inline-flex items-center rounded-xl border border-zinc-800 bg-zinc-900 p-1">
              <button
                type="button"
                onClick={() => setBillingCycle('monthly')}
                className={`rounded-lg px-4 py-1.5 text-xs font-medium transition ${
                  billingCycle === 'monthly' ? 'bg-violet-600 text-white' : 'text-zinc-400 hover:text-white'
                }`}
              >
                Facturation mensuelle
              </button>
              <button
                type="button"
                onClick={() => setBillingCycle('yearly')}
                className={`rounded-lg px-4 py-1.5 text-xs font-medium transition ${
                  billingCycle === 'yearly' ? 'bg-violet-600 text-white' : 'text-zinc-400 hover:text-white'
                }`}
              >
                Annuelle (-20%)
              </button>
            </div>
          </div>

          <div className="mt-14 grid grid-cols-1 gap-8 lg:grid-cols-3">
            {/* Plan Gratuit */}
            <div className="flex flex-col justify-between rounded-2xl border border-zinc-800 bg-zinc-900/50 p-8">
              <div>
                <h3 className="text-lg font-semibold text-white">Rookie (Free)</h3>
                <p className="mt-1 text-xs text-zinc-400">Idéal pour un roster de potes qui se lance.</p>
                <div className="mt-6 flex items-baseline gap-1">
                  <span className="text-4xl font-extrabold text-white">0€</span>
                </div>
                <ul className="mt-8 space-y-3 text-xs text-zinc-300">
                  <li className="flex items-center gap-2">✓ 1 Équipe</li>
                  <li className="flex items-center gap-2">✓ Jusqu'à 5 membres (créateur inclus)</li>
                  <li className="flex items-center gap-2">✓ Salon unique #général</li>
                  <li className="flex items-center gap-2">✓ Calendrier (Matchs & Scrims basiques)</li>
                </ul>
              </div>
              <button
                type="button"
                onClick={onGetStarted}
                className="mt-8 w-full rounded-xl border border-zinc-700 bg-zinc-800/50 py-2.5 text-sm font-medium text-white transition hover:bg-zinc-800"
              >
                Créer l'équipe
              </button>
            </div>

            {/* Plan Pro */}
            <div className="relative flex flex-col justify-between rounded-2xl border-2 border-violet-500 bg-zinc-900 p-8 shadow-xl shadow-violet-600/10">
              <span className="absolute -top-3 right-6 rounded-full bg-violet-600 px-3 py-0.5 text-[11px] font-bold tracking-wide text-white uppercase">
                Le plus populaire
              </span>
              <div>
                <h3 className="text-lg font-semibold text-white">Team Pro</h3>
                <p className="mt-1 text-xs text-zinc-400">Pour les équipes compétitives et staffs structurés.</p>
                <div className="mt-6 flex items-baseline gap-1">
                  <span className="text-4xl font-extrabold text-white">
                    {billingCycle === 'monthly' ? '9,99€' : '7,99€'}
                  </span>
                  <span className="text-xs text-zinc-500">/ mois</span>
                </div>
                <ul className="mt-8 space-y-3 text-xs text-zinc-200">
                  <li className="flex items-center gap-2">✓ <strong>Jusqu'à 10 équipes de 20 membres</strong></li>
                  <li className="flex items-center gap-2">✓ Rôles visibles (CEO, Coach, Joueur)</li>
                  <li className="flex items-center gap-2">✓ Salon #admin réservé au staff</li>
                  <li className="flex items-center gap-2">✓ <strong>Génération auto des salons de Scrims</strong></li>
                  <li className="flex items-center gap-2">✓ Archivage automatique (J+7)</li>
                </ul>
              </div>
              <button
                type="button"
                onClick={onGetStarted}
                className="mt-8 w-full rounded-xl bg-violet-600 py-2.5 text-sm font-medium text-white shadow-md shadow-violet-600/30 transition hover:bg-violet-500"
              >
                Passer Premium
              </button>
            </div>

            {/* Plan Entreprise */}
            <div className="flex flex-col justify-between rounded-2xl border border-zinc-800 bg-zinc-900/50 p-8">
              <div>
                <h3 className="text-lg font-semibold text-white">Structure</h3>
                <p className="mt-1 text-xs text-zinc-400">Pour les organisations e-sport multi-rosters.</p>
                <div className="mt-6 flex items-baseline gap-1">
                  <span className="text-4xl font-extrabold text-white">Sur mesure</span>
                </div>
                <ul className="mt-8 space-y-3 text-xs text-zinc-300">
                  <li className="flex items-center gap-2">✓ Équipes et joueurs illimités</li>
                  <li className="flex items-center gap-2">✓ Rôles personnalisés (Manager, Analyste...)</li>
                  <li className="flex items-center gap-2">✓ Déploiement serveur dédié</li>
                  <li className="flex items-center gap-2">✓ Support prioritaire H24</li>
                </ul>
              </div>
              <button
                type="button"
                onClick={onGetStarted}
                className="mt-8 w-full rounded-xl border border-zinc-700 bg-zinc-800/50 py-2.5 text-sm font-medium text-white transition hover:bg-zinc-800"
              >
                Contacter l'équipe
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* FAQ Section */}
      <section id="faq" className="border-t border-zinc-800/80 bg-zinc-900/30 px-6 py-24">
        <div className="mx-auto max-w-4xl">
          <div className="text-center">
            <h2 className="text-xs font-semibold tracking-wider text-violet-400 uppercase">
              Foire Aux Questions
            </h2>
            <p className="mt-3 text-3xl font-bold tracking-tight text-white sm:text-4xl">
              Vous avez des questions ?
            </p>
          </div>

          <div className="mt-12 space-y-4">
            {faqs.map((faq, i) => {
              const isOpen = openFaq === i;
              return (
                <div
                  key={i}
                  className="rounded-xl border border-zinc-800 bg-zinc-900/60 transition hover:border-zinc-700"
                >
                  <button
                    type="button"
                    onClick={() => toggleFaq(i)}
                    className="flex w-full items-center justify-between p-5 text-left font-medium text-white"
                  >
                    <span>{faq.q}</span>
                    <span className="ml-4 text-violet-400 text-lg transition-transform duration-200">
                      {isOpen ? '−' : '+'}
                    </span>
                  </button>
                  {isOpen && (
                    <div className="px-5 pb-5 text-sm text-zinc-400 border-t border-zinc-800/50 pt-3">
                      {faq.a}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-zinc-900 bg-zinc-950 px-6 py-8 text-center text-xs text-zinc-600">
        <p>© 2026 ChatPulse — Projet chat-app-5idev (Édition E-sport). Tous droits réservés.</p>
      </footer>
    </div>
  );
}