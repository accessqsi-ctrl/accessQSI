import Link from "next/link";
import LegalDocument, { CompanyIdentity } from "../components/LegalDocument";
import { COMPANY } from "../lib/legal";

export const metadata = {
  title: "Conditions d’utilisation",
  description: "Conditions générales d’utilisation de la plateforme AccessQ par les organisateurs, leurs agents et les participants.",
  alternates: { canonical: "/conditions-utilisation" }
};

const sections = [
  {
    id: "objet",
    title: "Objet et éditeur",
    body: <>
      <p>Les présentes conditions générales d’utilisation (les « CGU ») régissent l’accès et l’utilisation de la plateforme {COMPANY.brand} : site web, application de contrôle, box participant et services associés (la « Plateforme »).</p>
      <CompanyIdentity />
      <p>Les achats de billets par les participants sont en plus régis par les <Link href="/conditions-vente" className="text-blue-700 underline dark:text-blue-300">conditions de vente des billets</Link>. Le traitement des données personnelles est décrit dans la <Link href="/confidentialite" className="text-blue-700 underline dark:text-blue-300">politique de confidentialité</Link>.</p>
    </>
  },
  {
    id: "definitions",
    title: "Définitions",
    body: <ul>
      <li><strong>Organisateur</strong> : personne physique ou morale qui crée un compte d’organisation pour gérer des événements, des accès ou des billets.</li>
      <li><strong>Agent</strong> : membre de l’équipe d’un Organisateur, invité par lui, qui contrôle les accès.</li>
      <li><strong>Participant</strong> : personne qui obtient un billet ou un pass, gratuit ou payant, et le retrouve dans sa box.</li>
      <li><strong>Box</strong> : espace personnel du Participant, accessible par adresse e-mail, où sont conservés ses billets.</li>
      <li><strong>QR code</strong> : code d’accès unique attaché à un billet, un pass ou un badge.</li>
    </ul>
  },
  {
    id: "acceptation",
    title: "Acceptation des conditions",
    body: <>
      <p>La création d’un compte, organisateur ou participant, nécessite l’acceptation expresse des présentes CGU par une case à cocher. {COMPANY.brand} enregistre la version acceptée et la date d’acceptation.</p>
      <p>L’Organisateur qui crée un compte au nom d’une organisation déclare disposer du pouvoir de l’engager. Il est responsable de l’usage de la Plateforme par ses Agents.</p>
    </>
  },
  {
    id: "comptes",
    title: "Comptes et sécurité",
    body: <>
      <p>Vous vous engagez à fournir des informations exactes et à les tenir à jour. Les identifiants, mots de passe et codes reçus par e-mail sont personnels et confidentiels. Toute action effectuée depuis votre compte est réputée faite par vous, jusqu’à ce que vous nous signaliez une utilisation frauduleuse.</p>
      <p>Prévenez-nous sans délai à <a href={`mailto:${COMPANY.supportEmail}`} className="text-blue-700 underline dark:text-blue-300">{COMPANY.supportEmail}</a> en cas de perte ou de compromission de vos accès.</p>
    </>
  },
  {
    id: "services",
    title: "Services proposés",
    body: <>
      <p>La Plateforme permet notamment de créer des événements, de générer des QR codes et des cartes personnalisées, de publier des formulaires d’inscription, de vendre des billets payés par Mobile Money, de contrôler les entrées depuis un smartphone et de consulter l’historique des passages.</p>
      <p>Les fonctions disponibles dépendent de la formule souscrite (Découverte, Essential, Pro, Entreprise ou Pass événement). {COMPANY.brand} peut faire évoluer les fonctions de la Plateforme, en veillant à ne pas supprimer sans préavis une fonction essentielle d’une formule payante en cours.</p>
    </>
  },
  {
    id: "abonnements",
    title: "Formules, essai et paiement de l’abonnement",
    body: <>
      <p>Les tarifs en vigueur sont affichés sur le site au moment de la souscription. Les prix de référence sont exprimés en dollars américains ; le paiement Mobile Money peut être présenté dans la devise locale prise en charge par l’opérateur.</p>
      <p>Une nouvelle organisation peut bénéficier d’un essai gratuit de la formule Essential, sans paiement initial, pour la durée indiquée à l’inscription. À la fin de l’essai ou d’une période payée non renouvelée, le compte revient à la formule gratuite et les fonctions ou quotas qui la dépassent sont suspendus. Les données ne sont pas supprimées de ce seul fait.</p>
      <p>Les abonnements sont payés d’avance, pour la période choisie. Sauf disposition légale contraire ou défaillance imputable à {COMPANY.brand}, une période commencée n’est pas remboursable.</p>
    </>
  },
  {
    id: "billetterie",
    title: "Billetterie payante : mandat d’encaissement",
    body: <>
      <p>Lorsque l’Organisateur vend des billets payants, il donne mandat à {COMPANY.legalName} d’encaisser en son nom et pour son compte le prix payé par les Participants, par l’intermédiaire de son prestataire de paiement (pawaPay) et des opérateurs Mobile Money.</p>
      <ul>
        <li><strong>Vendeur du billet.</strong> L’Organisateur est le vendeur du billet et le seul responsable de l’événement : son organisation, son déroulement, sa sécurité, sa conformité aux autorisations administratives, et le respect des engagements annoncés aux Participants.</li>
        <li><strong>Commission.</strong> {COMPANY.brand} prélève sur chaque billet vendu une commission de service. Son taux est de 10 % du prix du billet, sauf taux différent convenu par écrit avec l’Organisateur. Le taux applicable est figé au moment de chaque achat.</li>
        <li><strong>Solde et reversement.</strong> Le montant net (prix encaissé moins la commission et, le cas échéant, les remboursements) est porté au solde de l’Organisateur. L’Organisateur demande un reversement depuis son espace, vers le compte Mobile Money qu’il a enregistré. Chaque demande est vérifiée par {COMPANY.brand} avant envoi. L’Organisateur est responsable de l’exactitude du numéro de reversement qu’il enregistre.</li>
        <li><strong>Vérifications.</strong> {COMPANY.brand} peut retenir un reversement, en tout ou en partie, en cas de suspicion de fraude, de contestation de paiement, d’annulation ou de report de l’événement, ou de demande d’une autorité. Elle informe l’Organisateur de la raison de la retenue.</li>
        <li><strong>Annulation et remboursement.</strong> Si l’événement est annulé, l’Organisateur doit prévenir {COMPANY.brand} et les Participants sans délai. Les remboursements sont versés au numéro Mobile Money qui a payé. Ils sont imputés en priorité sur le solde de l’Organisateur ; si ce solde est insuffisant, l’Organisateur reste redevable de la différence envers les Participants et envers {COMPANY.brand}.</li>
      </ul>
    </>
  },
  {
    id: "obligations-organisateur",
    title: "Obligations de l’Organisateur",
    body: <>
      <p>L’Organisateur s’engage à :</p>
      <ul>
        <li>publier des informations exactes sur ses événements et ses offres (date, lieu, prix, conditions d’accès, nombre de passages autorisés) ;</li>
        <li>disposer de toutes les autorisations nécessaires pour organiser ses événements et vendre des billets ;</li>
        <li>ne collecter auprès des Participants que les données nécessaires à l’événement, les informer de cette collecte et les traiter conformément à la loi ;</li>
        <li>n’exiger la photo du titulaire que lorsque le contrôle d’identité à l’entrée le justifie, et ne l’utiliser à aucune autre fin ;</li>
        <li>contrôler les accès de bonne foi et ne pas refuser l’entrée au titulaire d’un billet valide sans motif légitime ;</li>
        <li>importer uniquement des listes de personnes dont il a le droit d’utiliser les données.</li>
      </ul>
    </>
  },
  {
    id: "usages-interdits",
    title: "Usages interdits",
    body: <>
      <p>Il est interdit d’utiliser la Plateforme pour :</p>
      <ul>
        <li>vendre des billets pour un événement fictif, illicite ou que l’on n’a pas le droit d’organiser ;</li>
        <li>revendre des billets au-delà de leur prix sans l’accord de l’Organisateur, ou dupliquer, falsifier ou partager un QR code pour permettre plusieurs entrées ;</li>
        <li>publier un contenu illicite, haineux, diffamatoire, trompeur ou portant atteinte aux droits d’autrui, notamment dans les modèles de cartes et les logos ;</li>
        <li>contourner les limites techniques, les quotas ou les contrôles de sécurité, tester la Plateforme sans autorisation, ou en extraire massivement les données ;</li>
        <li>blanchir de l’argent ou réaliser toute opération financière frauduleuse.</li>
      </ul>
    </>
  },
  {
    id: "contenus",
    title: "Contenus et propriété intellectuelle",
    body: <>
      <p>La Plateforme, son code, ses modèles, sa marque et ses visuels appartiennent à {COMPANY.legalName}. Vous recevez un droit d’utilisation personnel et non exclusif, limité à la durée de votre compte.</p>
      <p>Vous restez propriétaire des contenus que vous importez (logos, images, textes, listes). Vous accordez à {COMPANY.brand} le droit de les héberger, de les reproduire et de les afficher uniquement pour fournir le service. Vous garantissez détenir les droits nécessaires sur ces contenus.</p>
    </>
  },
  {
    id: "disponibilite",
    title: "Disponibilité et responsabilité",
    body: <>
      <p>{COMPANY.brand} met en œuvre les moyens raisonnables pour assurer la disponibilité et la sécurité de la Plateforme. Le service peut être interrompu pour maintenance ou à cause d’événements extérieurs (réseau internet, opérateurs Mobile Money, hébergeur, coupure d’électricité). Nous conseillons aux Organisateurs de prévoir une solution de secours pour le contrôle des entrées.</p>
      <p>{COMPANY.brand} n’est pas l’organisateur des événements et n’est pas responsable de leur déroulement, de leur annulation ni des dommages qui y surviennent. Sauf faute lourde ou intentionnelle, la responsabilité de {COMPANY.brand} envers un Organisateur est limitée aux sommes payées par lui à {COMPANY.brand} au titre de l’abonnement et des commissions pendant les douze mois précédant le fait générateur.</p>
    </>
  },
  {
    id: "suspension",
    title: "Suspension et résiliation",
    body: <>
      <p>L’Organisateur peut supprimer son organisation depuis ses paramètres. Le Participant peut demander la fermeture de sa box en nous écrivant. Les sommes dues à l’Organisateur ou aux Participants sont réglées avant la fermeture définitive.</p>
      <p>{COMPANY.brand} peut suspendre ou fermer un compte en cas de violation des présentes CGU, de fraude ou de demande d’une autorité, après avoir informé le titulaire sauf urgence. Elle peut alors suspendre les ventes en cours et retenir le solde le temps de régler les remboursements dus.</p>
    </>
  },
  {
    id: "modifications",
    title: "Modification des conditions",
    body: <p>{COMPANY.brand} peut modifier les présentes CGU. La nouvelle version est publiée sur cette page avec sa date. Pour une modification importante, vous serez invité à l’accepter lors de votre prochaine connexion ; si vous la refusez, vous pouvez fermer votre compte.</p>
  },
  {
    id: "droit",
    title: "Droit applicable et litiges",
    body: <p>Les présentes CGU sont régies par le droit de la République démocratique du Congo. En cas de différend, les parties recherchent d’abord une solution amiable en écrivant à {COMPANY.supportEmail}. À défaut d’accord dans un délai de trente jours, le litige est porté devant {COMPANY.courts}, sous réserve des règles impératives de compétence applicables aux consommateurs.</p>
  }
];

export default function TermsOfUsePage() {
  return <LegalDocument
    current="/conditions-utilisation"
    title="Conditions générales d’utilisation"
    intro={<p>Ces conditions s’appliquent à toute personne qui utilise {COMPANY.brand} : organisateurs, agents et participants. Merci de les lire attentivement.</p>}
    sections={sections}
  />;
}
