import { useState } from 'react';
import { LegalLinks } from './LegalPage';

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

const GRID_BG = {
  backgroundImage:
    'linear-gradient(#14171a 1px, transparent 1px), linear-gradient(90deg, #14171a 1px, transparent 1px)',
  backgroundSize: '56px 56px',
};

const planBtnOutline =
  'mt-8 h-12 w-full rounded-lg border border-[#363d45] text-[15px] font-semibold text-[#e9ebee] transition-colors hover:border-[#4a525c] hover:bg-[#1c2025] hover:text-white';
const planBtnPrimary =
  'mt-8 h-12 w-full rounded-lg bg-[#d7ff3a] text-[15px] font-bold text-black transition-colors hover:bg-[#e4ff72]';

const Check = () => <span className="mt-[1px] shrink-0 font-bold text-[#d7ff3a]">✓</span>;

function SectionHead({ eyebrow, title, subtitle }: { eyebrow: string; title: string; subtitle?: string }) {
  return (
    <div className="text-center">
      <h2 className="text-sm font-semibold uppercase tracking-wider text-[#d7ff3a]">{eyebrow}</h2>
      <p className="mt-3 text-3xl font-extrabold tracking-tight text-white sm:text-4xl">{title}</p>
      {subtitle && <p className="mx-auto mt-4 max-w-2xl text-base text-[#9aa1ab] sm:text-lg">{subtitle}</p>}
    </div>
  );
}

export default function LandingPage({ onGetStarted, onLogin }: Props) {
  const [billingCycle, setBillingCycle] = useState<'monthly' | 'yearly'>('monthly');
  const [openFaq, setOpenFaq] = useState<number | null>(null);

  const toggleFaq = (index: number) => {
    setOpenFaq(openFaq === index ? null : index);
  };

  return (
    <div className="min-h-screen bg-[#0b0d0f] font-sans text-[15px] text-[#e9ebee] antialiased selection:bg-[#d7ff3a] selection:text-black">
      {/* ============ BARRE DE NAVIGATION ============ */}
      <header className="sticky top-0 z-40 border-b border-[#23282e] bg-[#0f1215]/90 backdrop-blur-md">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-5 sm:px-6">
          <div className="flex items-center gap-3">
            <span className="grid size-9 place-items-center rounded-lg bg-[#d7ff3a] text-base font-extrabold text-black">
              C
            </span>
            <span className="text-lg font-extrabold tracking-tight text-white">ChatPulse</span>
          </div>

          <nav className="hidden items-center gap-8 text-[15px] font-medium text-[#9aa1ab] md:flex">
            <a href="#features" className="transition-colors hover:text-white">
              Fonctionnalités
            </a>
            <a href="#pricing" className="transition-colors hover:text-white">
              Tarifs
            </a>
            <a href="#faq" className="transition-colors hover:text-white">
              FAQ
            </a>
          </nav>

          <div className="flex items-center gap-2 sm:gap-3">
            <button
              type="button"
              onClick={onLogin}
              className="rounded-lg px-3 py-2 text-sm font-semibold text-[#d5d9de] transition-colors hover:text-white sm:px-4"
            >
              Connexion
            </button>
            <button
              type="button"
              onClick={onGetStarted}
              className="rounded-lg bg-[#d7ff3a] px-4 py-2.5 text-sm font-bold text-black transition-colors hover:bg-[#e4ff72]"
            >
              Jouer maintenant
            </button>
          </div>
        </div>
      </header>

      {/* ============ HERO ============ */}
      <section className="relative overflow-hidden px-5 pb-24 pt-20 text-center sm:px-6 md:pb-32 md:pt-28" style={GRID_BG}>
        <div className="pointer-events-none absolute inset-0 -z-0 bg-[radial-gradient(ellipse_at_center,transparent_0%,#0b0d0f_75%)]" />

        <div className="relative mx-auto max-w-3xl">
          <span className="inline-flex items-center gap-2 rounded-full border border-[#d7ff3a]/30 bg-[#d7ff3a]/10 px-4 py-1.5 text-sm font-semibold text-[#d7ff3a]">
            ⚡ Le QG de votre équipe e-sport
          </span>
          <h1 className="mt-6 text-4xl font-extrabold tracking-tight text-white sm:text-6xl sm:leading-tight">
            Gérez vos rosters et dominez <br />
            <span className="text-[#d7ff3a]">vos prochains scrims.</span>
          </h1>
          <p className="mx-auto mt-6 max-w-2xl text-lg leading-8 text-[#aab1bb]">
            Salons dédiés par matchs, rôles stratégiques (CEO, Coach, Joueur), et planification intégrée. La plateforme de communication taillée pour la compétition.
          </p>

          <div className="mt-10 flex flex-col items-center justify-center gap-4 sm:flex-row">
            <button
              type="button"
              onClick={onGetStarted}
              className="h-12 w-full rounded-lg bg-[#d7ff3a] px-7 text-base font-bold text-black transition-colors hover:bg-[#e4ff72] sm:w-auto"
            >
              Créer mon équipe gratuitement
            </button>
            <a
              href="#pricing"
              className="flex h-12 w-full items-center justify-center rounded-lg border border-[#363d45] bg-[#0f1215]/80 px-7 text-base font-semibold text-[#e9ebee] transition-colors hover:border-[#4a525c] hover:bg-[#1c2025] hover:text-white sm:w-auto"
            >
              Voir les offres Pro
            </a>
          </div>
        </div>

        {/* Aperçu de l'interface */}
        <div className="relative mx-auto mt-16 max-w-4xl rounded-2xl border border-[#23282e] bg-[#0f1215] p-2 shadow-2xl shadow-black/60 sm:p-3">
          <div className="rounded-xl border border-[#23282e] bg-[#0b0d0f] p-5 text-left sm:p-6">
            <div className="flex items-center gap-2 border-b border-[#23282e] pb-4">
              <span className="size-3 rounded-full bg-[#363d45]" />
              <span className="size-3 rounded-full bg-[#363d45]" />
              <span className="size-3 rounded-full bg-[#d7ff3a]" />
              <span className="ml-2 truncate text-sm font-medium text-[#9aa1ab]"># scrim-vitality-08-10 • Événement en cours</span>
            </div>
            <div className="mt-5 space-y-5">
              <div className="flex items-start gap-3">
                <span className="grid size-10 shrink-0 place-items-center rounded-full bg-[#262b31] text-sm font-bold text-white">F</span>
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-[15px] font-bold text-white">Julien</span>
                    <span className="rounded bg-[#d7ff3a]/15 px-2 py-0.5 text-xs font-bold text-[#d7ff3a]">CEO</span>
                    <span className="text-xs tabular-nums text-[#9aa1ab]">19:41</span>
                  </div>
                  <p className="mt-1 text-[15px] leading-6 text-[#d5d9de]">Le scrim contre Vitality est confirmé. Coach, la draft est prête ?</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <span className="grid size-10 shrink-0 place-items-center rounded-full bg-[#262b31] text-sm font-bold text-white">A</span>
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-[15px] font-bold text-white">Florentin</span>
                    <span className="rounded bg-sky-500/15 px-2 py-0.5 text-xs font-bold text-sky-300">COACH</span>
                    <span className="text-xs tabular-nums text-[#9aa1ab]">19:42</span>
                  </div>
                  <p className="mt-1 text-[15px] leading-6 text-[#d5d9de]">Yes, on part sur la compo agressive. Les joueurs, go en vocal dans 5 min !</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ============ FONCTIONNALITÉS ============ */}
      <section id="features" className="border-t border-[#23282e] bg-[#0f1215] px-5 py-24 sm:px-6">
        <div className="mx-auto max-w-6xl">
          <SectionHead eyebrow="Pensé pour la compétition" title="L'arsenal complet de votre structure" />

          <div className="mt-16 grid grid-cols-1 gap-6 md:grid-cols-3">
            {[
              {
                icon: '🛡️',
                title: 'Rôles et Permissions',
                text: "Hiérarchie claire (CEO, Coach, Joueur). Le staff gère les invitations et profite d'un salon #admin strictement privé.",
              },
              {
                icon: '📅',
                title: 'Salons de Scrims Auto',
                text: 'Chaque événement (Match, Scrim) génère son propre salon textuel. Les données sont archivées 7 jours après pour un serveur propre.',
              },
              {
                icon: '⚡',
                title: 'Latence Zéro',
                text: 'Architecture WebSockets (Socket.io) garantissant la réception instantanée des stratégies et call-outs, sans délai.',
              },
            ].map((f) => (
              <div
                key={f.title}
                className="rounded-2xl border border-[#23282e] bg-[#111418] p-8 transition-colors hover:border-[#363d45]"
              >
                <div className="grid size-14 place-items-center rounded-xl border border-[#d7ff3a]/25 bg-[#d7ff3a]/10 text-2xl">
                  {f.icon}
                </div>
                <h3 className="mt-6 text-xl font-bold text-white">{f.title}</h3>
                <p className="mt-3 text-[15px] leading-7 text-[#9aa1ab]">{f.text}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ============ TARIFS ============ */}
      <section id="pricing" className="px-5 py-24 sm:px-6">
        <div className="mx-auto max-w-6xl">
          <SectionHead
            eyebrow="Grille Tarifaire"
            title="Des tarifs pour chaque division"
            subtitle="Démarrez en ligue amateur, débloquez la puissance Pro quand le roster s'agrandit."
          />

          <div className="mt-8 flex justify-center">
            <div className="inline-flex items-center rounded-lg border border-[#2a3037] bg-[#0f1215] p-1">
              <button
                type="button"
                onClick={() => setBillingCycle('monthly')}
                className={`rounded-md px-4 py-2 text-sm font-semibold transition-colors ${
                  billingCycle === 'monthly' ? 'bg-[#d7ff3a] text-black' : 'text-[#9aa1ab] hover:text-white'
                }`}
              >
                Facturation mensuelle
              </button>
              <button
                type="button"
                onClick={() => setBillingCycle('yearly')}
                className={`rounded-md px-4 py-2 text-sm font-semibold transition-colors ${
                  billingCycle === 'yearly' ? 'bg-[#d7ff3a] text-black' : 'text-[#9aa1ab] hover:text-white'
                }`}
              >
                Annuelle (-20%)
              </button>
            </div>
          </div>

          <div className="mt-14 grid grid-cols-1 gap-6 lg:grid-cols-3">
            {/* Plan Gratuit */}
            <div className="flex flex-col justify-between rounded-2xl border border-[#23282e] bg-[#111418] p-8">
              <div>
                <h3 className="text-xl font-bold text-white">Rookie (Free)</h3>
                <p className="mt-2 text-[15px] text-[#9aa1ab]">Idéal pour un roster de potes qui se lance.</p>
                <div className="mt-6 flex items-baseline gap-1">
                  <span className="text-5xl font-extrabold tracking-tight text-white">0€</span>
                </div>
                <ul className="mt-8 space-y-4 text-[15px] text-[#d5d9de]">
                  <li className="flex items-start gap-3"><Check /> 1 Équipe</li>
                  <li className="flex items-start gap-3"><Check /> Jusqu'à 5 membres (créateur inclus)</li>
                  <li className="flex items-start gap-3"><Check /> Salon unique #général</li>
                  <li className="flex items-start gap-3"><Check /> Calendrier (Matchs & Scrims basiques)</li>
                </ul>
              </div>
              <button type="button" onClick={onGetStarted} className={planBtnOutline}>
                Créer l'équipe
              </button>
            </div>

            {/* Plan Pro */}
            <div className="relative flex flex-col justify-between rounded-2xl border-2 border-[#d7ff3a] bg-[#14181c] p-8 shadow-xl shadow-[#d7ff3a]/5">
              <span className="absolute -top-3.5 right-6 rounded-full bg-[#d7ff3a] px-3.5 py-1 text-xs font-extrabold uppercase tracking-wide text-black">
                Le plus populaire
              </span>
              <div>
                <h3 className="text-xl font-bold text-white">Team Pro</h3>
                <p className="mt-2 text-[15px] text-[#aab1bb]">Pour les équipes compétitives et staffs structurés.</p>
                <div className="mt-6 flex items-baseline gap-1.5">
                  <span className="text-5xl font-extrabold tracking-tight text-white">
                    {billingCycle === 'monthly' ? '9,99€' : '7,99€'}
                  </span>
                  <span className="text-[15px] text-[#9aa1ab]">/ mois</span>
                </div>
                <ul className="mt-8 space-y-4 text-[15px] text-[#e9ebee]">
                  <li className="flex items-start gap-3"><Check /> <span><strong>Jusqu'à 10 équipes de 20 membres</strong></span></li>
                  <li className="flex items-start gap-3"><Check /> Rôles visibles (CEO, Coach, Joueur)</li>
                  <li className="flex items-start gap-3"><Check /> Salon #admin réservé au staff</li>
                  <li className="flex items-start gap-3"><Check /> <span><strong>Génération auto des salons de Scrims</strong></span></li>
                  <li className="flex items-start gap-3"><Check /> Archivage automatique (J+7)</li>
                </ul>
              </div>
              <button type="button" onClick={onGetStarted} className={planBtnPrimary}>
                Passer Premium
              </button>
            </div>

            {/* Plan Entreprise */}
            <div className="flex flex-col justify-between rounded-2xl border border-[#23282e] bg-[#111418] p-8">
              <div>
                <h3 className="text-xl font-bold text-white">Structure</h3>
                <p className="mt-2 text-[15px] text-[#9aa1ab]">Pour les organisations e-sport multi-rosters.</p>
                <div className="mt-6 flex items-baseline gap-1">
                  <span className="text-4xl font-extrabold leading-[48px] tracking-tight text-white">Sur mesure</span>
                </div>
                <ul className="mt-8 space-y-4 text-[15px] text-[#d5d9de]">
                  <li className="flex items-start gap-3"><Check /> Équipes et joueurs illimités</li>
                  <li className="flex items-start gap-3"><Check /> Rôles personnalisés (Manager, Analyste...)</li>
                  <li className="flex items-start gap-3"><Check /> Déploiement serveur dédié</li>
                  <li className="flex items-start gap-3"><Check /> Support prioritaire H24</li>
                </ul>
              </div>
              <button
                type="button"
                onClick={() => {
                  window.location.hash = '#/contact';
                }}
                className={planBtnOutline}
              >
                Contacter l'équipe
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* ============ FAQ ============ */}
      <section id="faq" className="border-t border-[#23282e] bg-[#0f1215] px-5 py-24 sm:px-6">
        <div className="mx-auto max-w-4xl">
          <SectionHead eyebrow="Foire Aux Questions" title="Vous avez des questions ?" />

          <div className="mt-12 space-y-3">
            {faqs.map((faq, i) => {
              const isOpen = openFaq === i;
              return (
                <div
                  key={i}
                  className={`rounded-xl border bg-[#111418] transition-colors ${
                    isOpen ? 'border-[#d7ff3a]/40' : 'border-[#23282e] hover:border-[#363d45]'
                  }`}
                >
                  <button
                    type="button"
                    onClick={() => toggleFaq(i)}
                    className="flex w-full items-center justify-between gap-4 p-5 text-left text-base font-semibold text-white sm:p-6"
                  >
                    <span>{faq.q}</span>
                    <span
                      className={`grid size-8 shrink-0 place-items-center rounded-md text-xl leading-none transition-colors ${
                        isOpen ? 'bg-[#d7ff3a] text-black' : 'bg-[#1c2025] text-[#d7ff3a]'
                      }`}
                    >
                      {isOpen ? '−' : '+'}
                    </span>
                  </button>
                  {isOpen && (
                    <div className="border-t border-[#23282e] px-5 pb-5 pt-4 text-[15px] leading-7 text-[#aab1bb] sm:px-6 sm:pb-6">
                      {faq.a}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* ============ FOOTER ============ */}
      <footer className="border-t border-[#23282e] bg-[#0b0d0f] px-5 py-10 text-center text-sm text-[#6f7782]">
        <LegalLinks className="mb-4" />
        <p>© 2026 ChatPulse — Projet chat-app-5idev (Édition E-sport). Tous droits réservés.</p>
      </footer>
    </div>
  );
}
