import { CalendarPlus, ClipboardList, MapPinned, Palette, QrCode, UserPlus } from "lucide-react";

const REGISTRATION_FORMS_ENABLED = process.env.NEXT_PUBLIC_REGISTRATION_FORMS_ENABLED === "true";

// Les clés correspondent à celles renvoyées par GET /dashboard/onboarding.
export const onboardingSteps = [
    {
        key: "areas",
        title: "Préparer les zones",
        summary: "Définissez vos points de contrôle et leur niveau d’accès.",
        description: "Transformez vos lieux physiques en points de contrôle clairement identifiés : entrée principale, salle VIP, parking, coulisses, bureaux ou toute autre zone sensible.",
        details: [
            "Chaque zone possède un niveau d’accréditation requis. Par exemple : niveau 1 pour l’accès général, niveau 2 pour un espace réservé et niveau 3 pour une zone sensible.",
            "La règle est simple : le niveau du QR doit être supérieur ou égal au niveau demandé par la zone. Un QR de niveau 3 peut donc ouvrir une zone de niveau 1, mais pas l’inverse.",
            "Lors du scan, accessQ vérifie aussi que la zone appartient bien à l’événement et qu’elle est ouverte à l’heure du contrôle."
        ],
        outcome: "Vous obtenez une circulation organisée, des responsabilités claires et moins de décisions improvisées à l’entrée.",
        href: "/dashboard/areas",
        action: "Configurer les zones",
        duration: "2 min",
        icon: MapPinned
    },
    {
        key: "events",
        title: "Créer un événement",
        summary: "Regroupez dates, horaires et zones autorisées.",
        description: "Centralisez dans un même espace les dates, les horaires et les zones autorisées pour une cérémonie, une conférence, un concert ou une opération interne.",
        details: [
            "Associez uniquement les zones réellement utilisées afin que les agents voient immédiatement où ils peuvent contrôler les accès.",
            "Définissez une période de validité pour chaque zone : avant l’ouverture ou après la fermeture, le QR est automatiquement refusé.",
            "L’événement devient votre centre de pilotage pour générer les QR, suivre leur utilisation et consulter les décisions de contrôle."
        ],
        outcome: "Toute votre opération est structurée avant l’arrivée du premier invité, avec moins d’erreurs et une meilleure visibilité pour l’équipe.",
        href: "/dashboard/events/new",
        action: "Créer l’événement",
        duration: "3 min",
        icon: CalendarPlus
    },
    {
        key: "registrations",
        title: "Publier un formulaire d’inscription",
        summary: "Laissez les participants s’inscrire et recevoir leur pass.",
        description: "Permettez aux participants de renseigner eux-mêmes leurs informations et de recevoir automatiquement leur pass.",
        details: [
            "Reliez le formulaire à un événement, choisissez les informations demandées et configurez les offres autorisées.",
            "Votre abonnement détermine les options disponibles : une offre en Découverte, plusieurs offres dès Essential et des modèles personnalisés avec Pro.",
            "Publiez ensuite le lien public. Les droits, la capacité et le modèle sont toujours vérifiés par le serveur."
        ],
        outcome: "Vous réduisez la saisie manuelle tout en conservant les mêmes contrôles d’accès et quotas AccessQ.",
        href: "/dashboard/registration-forms/new",
        action: "Créer un formulaire",
        duration: "4 min",
        icon: ClipboardList
    },
    {
        key: "qrs",
        title: "Générer un QR",
        summary: "Créez un accès nominatif avec ses règles de passage.",
        description: "Créez un accès unique pour chaque invité, collaborateur ou prestataire, avec les règles adaptées à son profil.",
        details: [
            "Renseignez le titulaire, son niveau d’accès, sa période de validité et son nombre de passages autorisés — unique, limité ou illimité selon le besoin.",
            "Ajoutez si besoin une limite par période (par exemple 1 passage par jour) et la photo du titulaire, affichée à l’agent au moment du scan pour éviter les prêts de QR.",
            "accessQ utilise quatre statuts lisibles : Actif peut être scanné, Épuisé a consommé tous ses passages, Expiré a dépassé sa date de validité et Révoqué a été désactivé manuellement."
        ],
        outcome: "Chaque accès devient traçable, contrôlable et révocable sans refaire vos listes ni réimprimer toute votre organisation.",
        href: "/dashboard/events",
        action: "Générer les premiers QR",
        duration: "1 min",
        icon: QrCode
    },
    {
        key: "agents",
        title: "Inviter un agent",
        summary: "Donnez à l’équipe terrain un accès limité au scanner.",
        description: "Donnez à chaque membre de l’équipe exactement les outils dont il a besoin, sans lui ouvrir inutilement toute l’administration.",
        details: [
            "Administrateur : pilote l’organisation, les événements, les zones, les agents et les paramètres. C’est le rôle de supervision complète.",
            "Agent : scanne les accès, consulte les QR et peut en générer pour les événements auxquels il travaille. Il accompagne les opérations sans gérer les comptes de l’équipe.",
            "Opérateur : se concentre sur le contrôle terrain. Son espace est volontairement limité au scanner et à la sécurité de son propre compte."
        ],
        outcome: "Vous accélérez les contrôles tout en gardant une séparation nette des responsabilités et un meilleur niveau de sécurité.",
        href: "/dashboard/agents",
        action: "Composer l’équipe",
        duration: "2 min",
        icon: UserPlus
    },
    {
        key: "models",
        title: "Publier un modèle",
        summary: "Habillez vos billets et badges aux couleurs de votre organisation.",
        description: "Finalisez l’expérience avec un billet, un badge ou une invitation qui porte réellement l’identité de votre organisation.",
        details: [
            "Créez d’abord le modèle en brouillon dans l’éditeur visuel : format, recto-verso, couleurs, textes, images de votre bibliothèque et position du QR.",
            "Contrôlez l’aperçu, puis publiez le modèle lorsqu’il est prêt. Seuls les modèles publiés peuvent être sélectionnés pour les nouveaux QR.",
            "Définissez votre meilleur modèle par défaut pour accélérer les prochaines générations. Les QR déjà créés conservent leur apparence enregistrée."
        ],
        outcome: "Votre contrôle d’accès devient aussi un support de marque professionnel, cohérent et immédiatement reconnaissable.",
        href: "/dashboard/card-templates",
        action: "Créer et publier",
        duration: "5 min",
        icon: Palette
    }
];

// Étapes réellement proposées à l’organisation selon son abonnement et les modules activés.
export const getVisibleOnboardingSteps = (progress) => onboardingSteps.filter(step => (
    progress?.available?.[step.key] !== false
    && (step.key !== "registrations" || REGISTRATION_FORMS_ENABLED)
));

export const getNextOnboardingStep = (progress) => (
    getVisibleOnboardingSteps(progress).find(step => !progress?.steps?.[step.key]) || null
);
