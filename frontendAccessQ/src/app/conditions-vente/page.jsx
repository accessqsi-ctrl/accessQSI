import Link from "next/link";
import LegalDocument, { CompanyIdentity } from "../components/LegalDocument";
import { COMPANY } from "../lib/legal";

export const metadata = {
  title: "Conditions de vente des billets",
  description: "Conditions applicables aux billets et pass obtenus ou achetés sur AccessQ : paiement Mobile Money, box, QR code, transfert et remboursement.",
  alternates: { canonical: "/conditions-vente" }
};

const link = "text-blue-700 underline dark:text-blue-300";

const sections = [
  {
    id: "roles",
    title: "Qui vend le billet",
    body: <>
      <p>Les billets et pass proposés sur {COMPANY.brand} sont émis et vendus par l’<strong>organisateur</strong> de l’événement, dont le nom figure sur la page d’inscription. L’organisateur est seul responsable de l’événement : sa tenue, son contenu, ses horaires, sa sécurité et le respect de ce qu’il annonce.</p>
      <p>{COMPANY.brand}, plateforme éditée par {COMPANY.legalName}, fournit l’outil de billetterie, la box et le contrôle d’accès, et encaisse le paiement au nom et pour le compte de l’organisateur.</p>
      <CompanyIdentity />
      <p>Ces conditions complètent les <Link href="/conditions-utilisation" className={link}>conditions d’utilisation</Link>. L’organisateur peut ajouter ses propres règles (âge minimum, objets interdits, tenue exigée…) : elles sont alors indiquées sur la page de l’offre.</p>
    </>
  },
  {
    id: "box",
    title: "Votre box et votre compte",
    body: <>
      <p>Pour obtenir un billet, gratuit ou payant, vous créez votre box avec votre nom et votre adresse e-mail, confirmée par un code à 6 chiffres. Vos billets y sont conservés et restent accessibles avec la même adresse. Vous pouvez ensuite protéger votre box par un mot de passe.</p>
      <p>Le nom indiqué doit être le vôtre ou celui du titulaire réel du billet : il peut être imprimé sur le billet et vérifié à l’entrée.</p>
    </>
  },
  {
    id: "prix",
    title: "Prix et paiement",
    body: <>
      <ul>
        <li>Le prix est fixé par l’organisateur et affiché, avec sa devise, avant le paiement. C’est le montant total que vous payez à {COMPANY.brand}. La commission de service de {COMPANY.brand} est prise sur ce prix et payée par l’organisateur : elle ne vous est pas facturée en plus.</li>
        <li>Le paiement se fait par Mobile Money, via notre prestataire pawaPay, avec les opérateurs proposés pour la devise du billet. Votre opérateur peut appliquer ses propres frais de transaction, selon ses conditions.</li>
        <li>Après avoir choisi votre offre, vous recevez une demande de confirmation sur votre téléphone. Votre place est réservée pendant quelques minutes (15 minutes en règle générale). Sans confirmation dans ce délai, la réservation est libérée.</li>
        <li>La vente est conclue dès que l’opérateur confirme le paiement. Le billet est alors déposé dans votre box. Si un paiement reste en vérification, le billet est émis ou le paiement remboursé dès que la vérification est terminée.</li>
      </ul>
    </>
  },
  {
    id: "billet",
    title: "Votre billet et son QR code",
    body: <>
      <ul>
        <li>Chaque billet porte un QR code unique. <strong>Le QR code vaut titre d’entrée : la personne qui le présente est admise.</strong> Ne le partagez pas, ne le publiez pas sur les réseaux sociaux et ne l’envoyez pas en capture d’écran : une copie peut être utilisée avant vous.</li>
        <li>Pour certaines offres, l’organisateur n’affiche le QR code que dans votre box (pas de PDF ni d’e-mail). Présentez alors votre box à l’entrée.</li>
        <li>Chaque billet donne droit au nombre de passages et à la période de validité indiqués sur l’offre. Un passage déjà enregistré ne peut pas être annulé.</li>
        <li>Si l’offre exige la photo du titulaire, l’agent compare la personne avec la photo à l’entrée. L’organisateur peut refuser l’entrée si la personne ne correspond pas.</li>
        <li>Un billet falsifié, dupliqué ou obtenu par fraude peut être révoqué par l’organisateur sans remboursement.</li>
      </ul>
    </>
  },
  {
    id: "transfert",
    title: "Transfert et revente",
    body: <>
      <p>Lorsque l’organisateur l’autorise pour une offre, vous pouvez transférer un billet de votre box vers la box d’une autre personne, désignée par son adresse e-mail. Le transfert est immédiat et définitif : le billet appartient alors au destinataire et un nouveau QR code est généré, l’ancien ne fonctionnant plus.</p>
      <p>Le transfert n’est pas possible pour un billet déjà scanné, après la date limite fixée par l’organisateur, pour une offre qui exige la photo du titulaire, ni au-delà du nombre de transferts autorisé.</p>
      <p>Le transfert ne donne lieu à aucun paiement sur {COMPANY.brand}. En cas de remboursement ultérieur, celui-ci reste versé au numéro qui a payé le billet à l’origine. La revente d’un billet à un prix supérieur à son prix d’achat est interdite, sauf accord de l’organisateur.</p>
    </>
  },
  {
    id: "remboursement",
    title: "Annulation, report et remboursement",
    body: <>
      <ul>
        <li><strong>Pas de droit de rétractation.</strong> Un billet donne accès à un événement à une date déterminée : il n’est ni repris ni échangé à votre seule demande, sauf si l’organisateur le prévoit sur l’offre.</li>
        <li><strong>Événement annulé.</strong> Le prix du billet est remboursé. Le remboursement est versé sur le numéro Mobile Money qui a payé, quel que soit le titulaire actuel du billet. Les frais de transaction prélevés par votre opérateur au moment du paiement peuvent ne pas être remboursés.</li>
        <li><strong>Événement reporté ou modifié de façon importante</strong> (date, lieu, artiste principal) : le billet reste valable pour la nouvelle date. Si vous ne pouvez pas y assister, vous pouvez demander le remboursement dans le délai annoncé par l’organisateur.</li>
        <li>L’organisateur est responsable du remboursement. {COMPANY.brand} l’exécute à partir des sommes qu’elle détient pour le compte de l’organisateur et vous informe de son avancement. Si ces sommes ne suffisent pas, votre demande est à adresser à l’organisateur, et {COMPANY.brand} vous aide à le joindre.</li>
        <li>Pour toute demande, écrivez à <a href={`mailto:${COMPANY.supportEmail}`} className={link}>{COMPANY.supportEmail}</a> en indiquant l’adresse de votre box et l’événement concerné.</li>
      </ul>
    </>
  },
  {
    id: "paiement-errone",
    title: "Paiement débité sans billet",
    body: <p>Si votre compte Mobile Money a été débité mais qu’aucun billet n’apparaît dans votre box, ne payez pas une seconde fois. Contactez-nous avec la date, le montant et le numéro utilisé. Après vérification auprès de l’opérateur, le billet est émis ou le montant vous est remboursé.</p>
  },
  {
    id: "acces",
    title: "Accès à l’événement",
    body: <p>L’organisateur peut refuser l’accès ou exclure une personne qui ne respecte pas le règlement de l’événement, la loi ou les consignes de sécurité, sans remboursement. Une entrée refusée pour un billet valide, sans motif légitime, relève de la responsabilité de l’organisateur.</p>
  },
  {
    id: "responsabilite",
    title: "Responsabilité",
    body: <p>{COMPANY.brand} n’est responsable ni de la tenue de l’événement ni des dommages subis pendant celui-ci. Elle répond du bon fonctionnement de la box, de l’émission du billet après paiement confirmé et de l’exécution des remboursements dans les conditions ci-dessus.</p>
  },
  {
    id: "droit",
    title: "Droit applicable et réclamations",
    body: <p>Ces conditions sont régies par le droit de la République démocratique du Congo. Adressez d’abord toute réclamation à {COMPANY.supportEmail} : nous y répondons dans un délai raisonnable. À défaut de solution amiable, le litige est porté devant {COMPANY.courts}, sans préjudice des droits que la loi vous reconnaît en tant que consommateur.</p>
  }
];

export default function TicketSaleTermsPage() {
  return <LegalDocument
    current="/conditions-vente"
    title="Conditions de vente des billets"
    intro={<p>Ces conditions s’appliquent à tout billet ou pass, gratuit ou payant, obtenu sur {COMPANY.brand}. En créant votre box ou en payant un billet, vous les acceptez.</p>}
    sections={sections}
  />;
}
