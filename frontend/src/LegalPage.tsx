import { useState, type FormEvent, type ReactNode } from 'react';
import { closeLegalPage, LEGAL_INFO, legalHref, PAGE_TITLES, type LegalPageId } from './legal';

// Liens à afficher en pied de page
export function LegalLinks({ className = '' }: { className?: string }) {
  const ids: LegalPageId[] = ['mentions-legales', 'confidentialite', 'cookies', 'conditions', 'contact'];
  return (
    <nav className={`flex flex-wrap justify-center gap-x-4 gap-y-1 ${className}`}>
      {ids.map((id) => (
        <a key={id} href={legalHref(id)} className="hover:text-zinc-300 hover:underline">
          {PAGE_TITLES[id]}
        </a>
      ))}
    </nav>
  );
}

function H2({ children }: { children: ReactNode }) {
  return <h2 className="mt-8 mb-2 text-lg font-semibold text-white">{children}</h2>;
}

function P({ children }: { children: ReactNode }) {
  return <p className="mb-3 leading-relaxed text-zinc-300">{children}</p>;
}

function UL({ children }: { children: ReactNode }) {
  return <ul className="mb-3 list-disc space-y-1 pl-6 text-zinc-300">{children}</ul>;
}

const mail = (
  <a href={`mailto:${LEGAL_INFO.contactEmail}`} className="text-violet-400 underline">
    {LEGAL_INFO.contactEmail}
  </a>
);

function MentionsLegales() {
  return (
    <>
      <H2>Éditeur du site</H2>
      <P>
        {LEGAL_INFO.siteName} est un projet étudiant réalisé par {LEGAL_INFO.editors}, dans le cadre
        du cours {LEGAL_INFO.school}. Il ne s’agit pas d’un service commercial et aucune société
        n’édite ce site.
      </P>
      <P>Contact : {mail}</P>

      <H2>Hébergement</H2>
      <P>
        Le site et sa base de données sont hébergés par : {LEGAL_INFO.host}. Serveur situé en :{' '}
        {LEGAL_INFO.hostCountry}.
      </P>

      <H2>Propriété intellectuelle</H2>
      <P>
        Le code, les textes et l’interface de {LEGAL_INFO.siteName} sont la propriété de leurs
        auteurs. Les noms d’équipes e-sport cités en exemple (Vitality, KCorp…) appartiennent à
        leurs détenteurs respectifs et ne sont utilisés qu’à titre d’illustration.
      </P>

      <H2>Responsabilité</H2>
      <P>
        Les messages publiés dans les équipes et les conversations privées relèvent de la seule
        responsabilité de leurs auteurs. Tout contenu illicite peut être signalé à l’adresse {mail}.
      </P>
    </>
  );
}

function Confidentialite() {
  return (
    <>
      <P>
        Cette politique explique quelles données personnelles {LEGAL_INFO.siteName} traite,
        pourquoi, et quels sont tes droits, conformément au Règlement général sur la protection des
        données (RGPD).
      </P>

      <H2>Responsable du traitement</H2>
      <P>
        {LEGAL_INFO.editors} ({LEGAL_INFO.school}). Contact : {mail}
      </P>

      <H2>Données traitées</H2>
      <UL>
        <li>
          <strong>Compte</strong> : adresse e-mail, pseudo, mot de passe (jamais stocké en clair :
          seulement une empreinte bcrypt), plan Free ou Premium, date d’inscription.
        </li>
        <li>
          <strong>Utilisation du service</strong> : équipes, rôles (CEO, coach, joueur), invitations,
          événements (scrims, matchs), messages envoyés et date de dernière lecture des
          conversations.
        </li>
        <li>
          <strong>Présence en ligne</strong> : le fait d’être connecté ou non est calculé en direct et
          n’est pas enregistré en base de données.
        </li>
      </UL>
      <P>Nous ne collectons aucune donnée bancaire : le plan Premium est une démonstration.</P>

      <H2>Finalités et base légale</H2>
      <P>
        Ces données servent uniquement à fournir le service (créer un compte, échanger des messages,
        gérer les équipes). La base légale est l’exécution du contrat d’utilisation (article 6.1.b
        du RGPD). Aucune publicité, aucun profilage, aucune revente de données.
      </P>

      <H2>Destinataires</H2>
      <UL>
        <li>Les membres des conversations et des équipes dont tu fais partie voient ton pseudo et tes messages.</li>
        <li>Les autres utilisateurs peuvent trouver ton pseudo (jamais ton e-mail) via la recherche de joueurs.</li>
        <li>L’hébergeur du serveur ({LEGAL_INFO.host}), qui stocke techniquement les données.</li>
      </UL>

      <H2>Durée de conservation</H2>
      <P>
        Les données sont conservées tant que ton compte existe. Les invitations expirent après 7
        jours. Sur demande de suppression du compte, ses équipes, messages et invitations sont
        effacés.
      </P>

      <H2>Sécurité</H2>
      <P>
        Mots de passe hachés avec bcrypt, accès à l’API protégé par un jeton de connexion valable 7
        jours, contrôle des droits sur chaque salon et chaque action (CEO, coach, joueur), base de
        données non exposée sur Internet.
      </P>

      <H2>Tes droits</H2>
      <P>
        Tu peux demander l’accès à tes données, leur rectification, leur effacement (suppression du
        compte), leur portabilité, ou t’opposer à leur traitement, en écrivant à {mail}. Nous
        répondons dans un délai d’un mois. Ton mot de passe se modifie aussi directement depuis
        ton profil.
      </P>
      <P>
        Si tu estimes que tes droits ne sont pas respectés, tu peux introduire une plainte auprès de
        l’Autorité de protection des données (APD) : www.autoriteprotectiondonnees.be.
      </P>
    </>
  );
}

function Cookies() {
  return (
    <>
      <P>
        <strong>{LEGAL_INFO.siteName} n’utilise aucun cookie publicitaire, de mesure d’audience ou de
        réseau social.</strong>
      </P>
      <P>
        Pour fonctionner, le site enregistre seulement deux informations dans le stockage local de
        ton navigateur (« localStorage », qui fonctionne comme un cookie) :
      </P>
      <div className="mb-3 overflow-x-auto">
        <table className="w-full text-left text-sm text-zinc-300">
          <thead className="text-xs text-zinc-500 uppercase">
            <tr>
              <th className="py-2 pr-4">Nom</th>
              <th className="py-2 pr-4">Rôle</th>
              <th className="py-2">Durée</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-800">
            <tr>
              <td className="py-2 pr-4 font-mono">token</td>
              <td className="py-2 pr-4">Te garder connecté (jeton de connexion)</td>
              <td className="py-2">7 jours, ou jusqu’à la déconnexion</td>
            </tr>
            <tr>
              <td className="py-2 pr-4 font-mono">cookie-notice</td>
              <td className="py-2 pr-4">Se souvenir que tu as fermé le bandeau d’information</td>
              <td className="py-2">Jusqu’à ce que tu vides ton navigateur</td>
            </tr>
          </tbody>
        </table>
      </div>
      <P>
        Ces deux éléments sont strictement nécessaires au service que tu demandes : ils ne
        nécessitent donc pas ton consentement (directive ePrivacy, article 5.3), mais nous t’en
        informons via le bandeau affiché lors de ta première visite.
      </P>
      <P>
        Tu peux les supprimer à tout moment en te déconnectant ou en vidant les données du site
        dans ton navigateur (tu devras alors te reconnecter).
      </P>
    </>
  );
}

function Conditions() {
  return (
    <>
      <H2>1. Objet</H2>
      <P>
        {LEGAL_INFO.siteName} est une messagerie en temps réel pour les structures e-sport :
        équipes, rôles, salons, invitations et planning des scrims et matchs. Ces conditions
        encadrent son utilisation. Créer un compte vaut acceptation de ces conditions.
      </P>

      <H2>2. Compte</H2>
      <P>
        Tu dois fournir une adresse e-mail valide et choisir un pseudo unique. Tu es responsable de
        la confidentialité de ton mot de passe et de l’activité de ton compte.
      </P>

      <H2>3. Règles d’utilisation</H2>
      <UL>
        <li>Pas de harcèlement, de propos haineux, de contenu illégal ni d’usurpation d’identité.</li>
        <li>Pas de spam : les invitations sont limitées (20 par heure, une seule en attente par joueur et par équipe).</li>
        <li>Pas de tentative d’accès aux salons ou comptes d’autrui.</li>
      </UL>
      <P>Un compte qui enfreint ces règles peut être suspendu ou supprimé.</P>

      <H2>4. Plans Free et Premium</H2>
      <UL>
        <li><strong>Free</strong> : 1 équipe de 5 places, salon #général, événements au calendrier.</li>
        <li>
          <strong>Premium</strong> : jusqu’à 10 équipes de 20 places, rôles CEO / coach / joueur,
          salon #admin et salons dédiés aux événements.
        </li>
      </UL>
      <P>
        <strong>Projet académique</strong> : le passage en Premium est une démonstration activable
        depuis le profil. Aucun paiement n’est demandé ni encaissé, et les prix affichés sur la page
        d’accueil sont indicatifs. Dans une version commerciale, le droit de rétractation de 14 jours
        prévu par le Code de droit économique belge s’appliquerait aux abonnements.
      </P>
      <P>
        En cas de retour en Free, rien n’est supprimé, mais la création d’équipes, de membres et
        d’événements est bloquée tant que les limites du plan Free sont dépassées.
      </P>

      <H2>5. Disponibilité et responsabilité</H2>
      <P>
        Le service est fourni « en l’état », sans garantie de disponibilité permanente. Les auteurs ne
        peuvent être tenus responsables d’une interruption, d’une perte de données ou du contenu
        publié par les utilisateurs.
      </P>

      <H2>6. Modification et droit applicable</H2>
      <P>
        Ces conditions peuvent évoluer ; la date de mise à jour figure en bas de page. Elles sont
        soumises au droit belge.
      </P>
    </>
  );
}

function Contact() {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [subject, setSubject] = useState('Question sur ChatPulse');
  const [message, setMessage] = useState('');
  const [sent, setSent] = useState(false);

  // Ouvre la messagerie de l'utilisateur avec le message pré-rempli
  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    const body = `${message}\n\n— ${name} (${email})`;
    window.location.href = `mailto:${LEGAL_INFO.contactEmail}?subject=${encodeURIComponent(
      subject,
    )}&body=${encodeURIComponent(body)}`;
    setSent(true);
  };

  const inputClass =
    'mt-1 w-full rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-white placeholder-zinc-500 outline-none focus:border-violet-500';

  return (
    <>
      <P>
        Une question, un bug, une demande sur tes données personnelles, ou l’offre Organisation
        pour une structure multi-rosters ? Écris-nous à {mail} ou via le formulaire ci-dessous.
      </P>

      <form onSubmit={handleSubmit} className="mt-6 space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block text-sm text-zinc-400">
            Nom ou pseudo
            <input required maxLength={60} value={name} onChange={(e) => setName(e.target.value)} className={inputClass} />
          </label>
          <label className="block text-sm text-zinc-400">
            Ton e-mail
            <input required type="email" maxLength={120} value={email} onChange={(e) => setEmail(e.target.value)} className={inputClass} />
          </label>
        </div>
        <label className="block text-sm text-zinc-400">
          Sujet
          <select value={subject} onChange={(e) => setSubject(e.target.value)} className={inputClass}>
            <option>Question sur ChatPulse</option>
            <option>Signaler un bug</option>
            <option>Offre Organisation (multi-rosters)</option>
            <option>Mes données personnelles (RGPD)</option>
            <option>Signaler un contenu</option>
          </select>
        </label>
        <label className="block text-sm text-zinc-400">
          Message
          <textarea required rows={6} maxLength={3000} value={message} onChange={(e) => setMessage(e.target.value)} className={inputClass} />
        </label>
        <button
          type="submit"
          className="rounded-lg bg-violet-600 px-5 py-2 text-sm font-medium text-white transition hover:bg-violet-500"
        >
          Envoyer le message
        </button>
        {sent && (
          <p className="text-sm text-emerald-400">
            Ta messagerie s’est ouverte avec le message pré-rempli : il ne reste qu’à l’envoyer. Si
            rien ne s’ouvre, écris directement à {LEGAL_INFO.contactEmail}.
          </p>
        )}
      </form>
    </>
  );
}

const PAGE_CONTENT: Record<LegalPageId, () => ReactNode> = {
  'mentions-legales': MentionsLegales,
  confidentialite: Confidentialite,
  cookies: Cookies,
  conditions: Conditions,
  contact: Contact,
};

export default function LegalPage({ page }: { page: LegalPageId }) {
  const Content = PAGE_CONTENT[page];
  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100">
      <header className="border-b border-zinc-800 px-6 py-4">
        <div className="mx-auto flex max-w-3xl items-center justify-between">
          <button
            type="button"
            onClick={closeLegalPage}
            className="rounded-lg border border-zinc-800 bg-zinc-900 px-3 py-1.5 text-xs font-medium text-zinc-400 transition hover:bg-zinc-800 hover:text-white"
          >
            ← Retour
          </button>
          <span className="text-sm font-bold text-white">{LEGAL_INFO.siteName}</span>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-6 py-10">
        <h1 className="text-3xl font-bold text-white">{PAGE_TITLES[page]}</h1>
        {page !== 'contact' && (
          <p className="mt-1 text-xs text-zinc-500">Dernière mise à jour : {LEGAL_INFO.lastUpdate}</p>
        )}
        <div className="mt-6">
          <Content />
        </div>
      </main>

      <footer className="border-t border-zinc-900 px-6 py-6 text-xs text-zinc-600">
        <LegalLinks />
      </footer>
    </div>
  );
}