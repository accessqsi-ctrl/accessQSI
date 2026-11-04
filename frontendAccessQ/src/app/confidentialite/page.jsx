import LegalDocument, { CompanyIdentity } from "../components/LegalDocument";
import { COMPANY } from "../lib/legal";

export const metadata = {
  title: "Politique de confidentialité",
  description: "Données personnelles traitées par AccessQ, finalités, durées de conservation, destinataires et droits des personnes.",
  alternates: { canonical: "/confidentialite" }
};

const link = "text-blue-700 underline dark:text-blue-300";

const sections = [
  {
    id: "responsable",
    title: "Qui traite vos données",
    body: <>
      <p>{COMPANY.legalName}, éditeur de {COMPANY.brand}, est responsable du traitement des données des comptes organisateurs, des box participants, des paiements et de la sécurité de la Plateforme.</p>
      <CompanyIdentity />
      <p>Pour les données des participants liées à un événement (liste des inscrits, photo du titulaire, historique des entrées), l’<strong>organisateur</strong> décide de ce qu’il collecte et pourquoi : il en est responsable, et {COMPANY.brand} les traite pour son compte, selon ses instructions.</p>
    </>
  },
  {
    id: "donnees",
    title: "Données collectées",
    body: <ul>
      <li><strong>Compte organisateur et agents</strong> : nom, adresse e-mail, nom de l’organisation, mot de passe (stocké sous forme d’empreinte, jamais en clair), rôle, date de dernière connexion.</li>
      <li><strong>Box participant</strong> : nom, adresse e-mail, téléphone le cas échéant, mot de passe facultatif (stocké sous forme d’empreinte), billets détenus et historique de leurs transferts.</li>
      <li><strong>Inscription à un événement</strong> : réponses au formulaire de l’organisateur et, si l’offre l’exige, la <strong>photo du titulaire</strong>.</li>
      <li><strong>Paiements</strong> : numéro Mobile Money, opérateur, montant, devise, statut et références de la transaction. Nous ne recevons jamais votre code secret Mobile Money.</li>
      <li><strong>Reversements</strong> : numéro Mobile Money de reversement de l’organisateur et historique des demandes.</li>
      <li><strong>Contrôle d’accès</strong> : date, heure, résultat de chaque scan et agent qui l’a réalisé.</li>
      <li><strong>Données techniques</strong> : journaux de connexion et de sécurité (adresse IP, navigateur, erreurs), cookies de session.</li>
    </ul>
  },
  {
    id: "finalites",
    title: "Pourquoi nous les utilisons",
    body: <ul>
      <li>Créer et sécuriser votre compte ou votre box, vous envoyer les codes de connexion. <em>Base : exécution du contrat.</em></li>
      <li>Émettre les billets, contrôler les entrées, empêcher la fraude et la double utilisation d’un QR code. <em>Base : exécution du contrat et intérêt légitime de sécurité.</em></li>
      <li>Encaisser les paiements, verser les reversements, traiter les remboursements, tenir la comptabilité. <em>Base : exécution du contrat et obligations légales.</em></li>
      <li>Vérifier l’identité du titulaire à l’entrée grâce à sa photo, uniquement pour les offres qui l’exigent. <em>Base : votre consentement, donné en fournissant la photo.</em></li>
      <li>Vous envoyer des messages de service (vérification, billet, paiement, sécurité). Nous ne vous envoyons pas de prospection commerciale sans votre accord.</li>
    </ul>
  },
  {
    id: "photo",
    title: "La photo du titulaire",
    body: <>
      <p>La photo sert uniquement à comparer visuellement le titulaire et la personne qui se présente à l’entrée. Elle n’est pas stockée dans un espace public : elle est conservée dans notre base de données et n’est affichée qu’aux membres connectés de l’organisation concernée, notamment à l’agent au moment du scan d’un billet valide.</p>
      <p>{COMPANY.brand} n’utilise aucune reconnaissance faciale automatique et ne revend ni ne réutilise les photos. Vous pouvez demander à l’organisateur ou à nous-mêmes la suppression de votre photo ; le billet peut alors ne plus être utilisable si l’offre exige une photo.</p>
    </>
  },
  {
    id: "destinataires",
    title: "Qui reçoit vos données",
    body: <>
      <ul>
        <li><strong>L’organisateur</strong> de l’événement auquel vous vous inscrivez, et ses agents de contrôle, pour les données de cet événement uniquement.</li>
        <li><strong>pawaPay</strong> et votre opérateur Mobile Money, pour exécuter les paiements, reversements et remboursements.</li>
        <li><strong>Nos prestataires techniques</strong> : hébergement des serveurs et de la base de données (Render), stockage des fichiers (Cloudflare R2), envoi des e-mails (Brevo).</li>
        <li>Les autorités habilitées, lorsque la loi nous y oblige.</li>
      </ul>
      <p>Nous ne vendons pas vos données. Certains prestataires peuvent héberger les données hors de la République démocratique du Congo ; nous les choisissons pour leurs garanties de sécurité et de confidentialité et ne leur transmettons que ce qui est nécessaire au service.</p>
    </>
  },
  {
    id: "conservation",
    title: "Durée de conservation",
    body: <ul>
      <li><strong>Compte et box</strong> : tant que le compte est actif, puis jusqu’à 3 ans après la dernière activité, sauf demande de suppression.</li>
      <li><strong>Photo du titulaire</strong> : jusqu’à la fin de l’événement, puis au plus 6 mois, sauf suppression anticipée par l’organisateur ou à votre demande.</li>
      <li><strong>Historique des scans</strong> : jusqu’à 1 an après l’événement.</li>
      <li><strong>Paiements, reversements, remboursements</strong> : pendant la durée exigée par les obligations comptables et fiscales (en principe 10 ans).</li>
      <li><strong>Codes de connexion</strong> : valables 10 minutes, puis inutilisables.</li>
      <li><strong>Journaux techniques</strong> : au plus 12 mois.</li>
    </ul>
  },
  {
    id: "securite",
    title: "Sécurité",
    body: <p>Les échanges sont chiffrés (HTTPS), les mots de passe et codes sont stockés sous forme d’empreinte, les sessions sont limitées dans le temps et révocables, et l’accès aux données d’une organisation est réservé à ses membres. Aucune mesure n’étant infaillible, nous vous prévenons dans les meilleurs délais si une violation de données vous concerne.</p>
  },
  {
    id: "cookies",
    title: "Cookies",
    body: <p>{COMPANY.brand} utilise uniquement des cookies nécessaires au fonctionnement : maintien de votre session de connexion et protection contre les requêtes frauduleuses. Nous n’utilisons pas de cookies publicitaires. Certaines préférences d’affichage (par exemple un message que vous avez masqué) sont gardées dans votre navigateur.</p>
  },
  {
    id: "droits",
    title: "Vos droits",
    body: <>
      <p>Conformément à la législation congolaise sur la protection des données à caractère personnel, vous pouvez demander l’accès à vos données, leur rectification, leur suppression, vous opposer à un traitement fondé sur notre intérêt légitime, et retirer votre consentement pour la photo.</p>
      <p>Écrivez à <a href={`mailto:${COMPANY.privacyEmail}`} className={link}>{COMPANY.privacyEmail}</a> depuis l’adresse liée à votre compte. Nous répondons dans un délai d’un mois. Les données que nous devons garder pour une obligation légale (paiements notamment) ne peuvent pas être supprimées avant la fin de leur durée de conservation. Pour les données d’un événement, nous pouvons transmettre votre demande à l’organisateur concerné.</p>
      <p>Si notre réponse ne vous satisfait pas, vous pouvez saisir l’autorité congolaise compétente en matière de protection des données personnelles.</p>
    </>
  },
  {
    id: "mineurs",
    title: "Mineurs",
    body: <p>La création d’une box est réservée aux personnes de 16 ans ou plus. Un billet pour un mineur plus jeune doit être obtenu par un parent ou un représentant légal, depuis sa propre box.</p>
  },
  {
    id: "modifications",
    title: "Modifications",
    body: <p>Cette politique peut évoluer. La version en vigueur et sa date sont toujours publiées sur cette page ; en cas de changement important, nous vous en informons et vous demandons de l’accepter à votre prochaine connexion.</p>
  }
];

export default function PrivacyPolicyPage() {
  return <LegalDocument
    current="/confidentialite"
    title="Politique de confidentialité"
    intro={<p>Cette politique explique quelles données personnelles {COMPANY.brand} traite, pourquoi, pendant combien de temps et comment exercer vos droits.</p>}
    sections={sections}
  />;
}
