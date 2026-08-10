const fs = require("fs");
const path = require("path");
const PDFDocument = require("pdfkit");

const outputPath = process.argv[2]
    ? path.resolve(process.argv[2])
    : path.resolve(__dirname, "../../documentation/guide-abonnements-accessq.pdf");

fs.mkdirSync(path.dirname(outputPath), { recursive: true });

const doc = new PDFDocument({
    size: "A4",
    margins: { top: 58, right: 48, bottom: 56, left: 48 },
    bufferPages: true,
    info: {
        Title: "AccessQ — Guide de tarification et gestion des abonnements",
        Author: "AccessQ",
        Subject: "Mécanisme commercial, paiements, quotas et changements d'abonnement",
        Keywords: "AccessQ, abonnement, QR, pawaPay, événement, tarification"
    }
});

const stream = fs.createWriteStream(outputPath);
doc.pipe(stream);

const COLORS = {
    navy: "#0f172a",
    blue: "#2563eb",
    blueSoft: "#dbeafe",
    cyan: "#0891b2",
    green: "#059669",
    greenSoft: "#d1fae5",
    amber: "#d97706",
    amberSoft: "#fef3c7",
    red: "#dc2626",
    redSoft: "#fee2e2",
    slate: "#475569",
    light: "#f8fafc",
    border: "#cbd5e1",
    white: "#ffffff"
};

const pageWidth = doc.page.width;
const contentWidth = pageWidth - doc.page.margins.left - doc.page.margins.right;
let isCover = true;

const drawHeader = () => {
    if (isCover) return;
    doc.save();
    doc.font("Helvetica-Bold").fontSize(9).fillColor(COLORS.blue)
        .text("ACCESSQ", doc.page.margins.left, 25, { continued: true });
    doc.font("Helvetica").fillColor(COLORS.slate)
        .text("  Guide des abonnements", { continued: false });
    doc.moveTo(doc.page.margins.left, 43)
        .lineTo(doc.page.width - doc.page.margins.right, 43)
        .strokeColor(COLORS.border).lineWidth(0.7).stroke();
    doc.restore();
};

doc.on("pageAdded", drawHeader);

const ensureSpace = (height = 80) => {
    if (doc.y + height > doc.page.height - doc.page.margins.bottom) doc.addPage();
};

const sectionTitle = (number, title, subtitle = null) => {
    ensureSpace(subtitle ? 88 : 62);
    doc.moveDown(0.35);
    doc.roundedRect(doc.page.margins.left, doc.y, 34, 26, 7).fill(COLORS.blue);
    doc.font("Helvetica-Bold").fontSize(12).fillColor(COLORS.white)
        .text(String(number), doc.page.margins.left, doc.y + 7, { width: 34, align: "center" });
    const titleY = doc.y - 19;
    doc.font("Helvetica-Bold").fontSize(18).fillColor(COLORS.navy)
        .text(title, doc.page.margins.left + 45, titleY, { width: contentWidth - 45 });
    doc.y = Math.max(doc.y, titleY + 27);
    if (subtitle) {
        doc.font("Helvetica").fontSize(9.5).fillColor(COLORS.slate)
            .text(subtitle, doc.page.margins.left + 45, doc.y, { width: contentWidth - 45, lineGap: 2 });
    }
    doc.moveDown(0.7);
};

const subTitle = (title) => {
    ensureSpace(42);
    doc.moveDown(0.35);
    doc.font("Helvetica-Bold").fontSize(12.5).fillColor(COLORS.blue)
        .text(title, doc.page.margins.left, doc.y, { width: contentWidth });
    doc.moveDown(0.35);
};

const paragraph = (text, options = {}) => {
    ensureSpace(40);
    doc.font(options.bold ? "Helvetica-Bold" : "Helvetica")
        .fontSize(options.size || 10)
        .fillColor(options.color || COLORS.navy)
        .text(text, doc.page.margins.left, doc.y, { width: contentWidth, lineGap: 3, align: options.align || "left" });
    doc.moveDown(options.gap ?? 0.55);
};

const bullet = (text, color = COLORS.blue) => {
    ensureSpace(30);
    const y = doc.y + 4;
    doc.circle(doc.page.margins.left + 4, y, 2.5).fill(color);
    doc.font("Helvetica").fontSize(9.7).fillColor(COLORS.navy)
        .text(text, doc.page.margins.left + 15, doc.y, { width: contentWidth - 15, lineGap: 2.5 });
    doc.moveDown(0.35);
};

const callout = (title, text, tone = "blue") => {
    const tones = {
        blue: [COLORS.blueSoft, COLORS.blue],
        green: [COLORS.greenSoft, COLORS.green],
        amber: [COLORS.amberSoft, COLORS.amber],
        red: [COLORS.redSoft, COLORS.red]
    };
    const [background, accent] = tones[tone];
    const textHeight = doc.heightOfString(text, { width: contentWidth - 32, lineGap: 2.5 });
    const height = Math.max(58, textHeight + 34);
    ensureSpace(height + 10);
    const x = doc.page.margins.left;
    const y = doc.y;
    doc.roundedRect(x, y, contentWidth, height, 8).fill(background);
    doc.rect(x, y, 5, height).fill(accent);
    doc.font("Helvetica-Bold").fontSize(10.5).fillColor(accent)
        .text(title, x + 17, y + 11, { width: contentWidth - 29 });
    doc.font("Helvetica").fontSize(9.5).fillColor(COLORS.navy)
        .text(text, x + 17, y + 28, { width: contentWidth - 29, lineGap: 2.5 });
    doc.y = y + height + 8;
    doc.x = doc.page.margins.left;
};

const table = (headers, rows, widths, options = {}) => {
    const x = doc.page.margins.left;
    const padding = 7;
    const headerHeight = 30;
    const drawHeaderRow = () => {
        ensureSpace(headerHeight + 32);
        const y = doc.y;
        doc.rect(x, y, contentWidth, headerHeight).fill(options.headerColor || COLORS.navy);
        let cursor = x;
        headers.forEach((header, index) => {
            doc.font("Helvetica-Bold").fontSize(8.5).fillColor(COLORS.white)
                .text(header, cursor + padding, y + 9, { width: widths[index] - padding * 2 });
            cursor += widths[index];
        });
        doc.y = y + headerHeight;
    };
    drawHeaderRow();
    rows.forEach((row, rowIndex) => {
        const heights = row.map((cell, index) => doc.heightOfString(String(cell), {
            width: widths[index] - padding * 2,
            lineGap: 2
        }));
        const rowHeight = Math.max(options.minRowHeight || 31, ...heights) + padding * 2;
        if (doc.y + rowHeight > doc.page.height - doc.page.margins.bottom) {
            doc.addPage();
            drawHeaderRow();
        }
        const y = doc.y;
        doc.rect(x, y, contentWidth, rowHeight)
            .fill(rowIndex % 2 === 0 ? COLORS.light : COLORS.white)
            .strokeColor(COLORS.border).lineWidth(0.35).stroke();
        let cursor = x;
        row.forEach((cell, index) => {
            if (index > 0) doc.moveTo(cursor, y).lineTo(cursor, y + rowHeight).strokeColor(COLORS.border).lineWidth(0.35).stroke();
            doc.font(index === 0 && options.boldFirst !== false ? "Helvetica-Bold" : "Helvetica")
                .fontSize(options.fontSize || 8.7)
                .fillColor(COLORS.navy)
                .text(String(cell), cursor + padding, y + padding, { width: widths[index] - padding * 2, lineGap: 2 });
            cursor += widths[index];
        });
        doc.y = y + rowHeight;
    });
    doc.moveDown(0.8);
    doc.x = doc.page.margins.left;
};

const flow = (steps) => {
    ensureSpace(88);
    const gap = 9;
    const boxWidth = (contentWidth - gap * (steps.length - 1)) / steps.length;
    const y = doc.y;
    steps.forEach((step, index) => {
        const x = doc.page.margins.left + index * (boxWidth + gap);
        doc.roundedRect(x, y, boxWidth, 62, 7).fill(index === steps.length - 1 ? COLORS.greenSoft : COLORS.blueSoft);
        doc.font("Helvetica-Bold").fontSize(8.7).fillColor(index === steps.length - 1 ? COLORS.green : COLORS.blue)
            .text(`${index + 1}. ${step.title}`, x + 8, y + 9, { width: boxWidth - 16, align: "center" });
        doc.font("Helvetica").fontSize(7.7).fillColor(COLORS.navy)
            .text(step.text, x + 7, y + 28, { width: boxWidth - 14, align: "center", lineGap: 1.5 });
    });
    doc.y = y + 72;
    doc.x = doc.page.margins.left;
};

// Couverture
doc.rect(0, 0, pageWidth, doc.page.height).fill(COLORS.navy);
doc.circle(pageWidth - 65, 80, 150).fillOpacity(0.16).fill(COLORS.blue);
doc.circle(45, doc.page.height - 65, 120).fillOpacity(0.12).fill(COLORS.cyan);
doc.fillOpacity(1);
doc.font("Helvetica-Bold").fontSize(15).fillColor("#93c5fd").text("ACCESSQ", 54, 75);
doc.font("Helvetica-Bold").fontSize(31).fillColor(COLORS.white)
    .text("Guide de tarification\net de gestion des abonnements", 54, 145, { width: pageWidth - 108, lineGap: 6 });
doc.font("Helvetica").fontSize(13).fillColor("#cbd5e1")
    .text("Cycles de facturation, quotas, changements de plan, paiements Mobile Money, Pass événement et offre Entreprise", 54, 255, { width: pageWidth - 108, lineGap: 5 });
doc.roundedRect(54, 350, pageWidth - 108, 116, 12).fillOpacity(0.09).fill(COLORS.white);
doc.fillOpacity(1).font("Helvetica").fontSize(10.5).fillColor("#e2e8f0")
    .text("Ce document décrit le mécanisme commercial et technique effectivement mis en place dans AccessQ. Il sert de référence pour l'équipe produit, le support, l'administration et les futurs développements.", 74, 375, { width: pageWidth - 148, lineGap: 5 });
doc.font("Helvetica-Bold").fontSize(10).fillColor("#93c5fd")
    .text("Version du 10 août 2026", 54, doc.page.height - 95);

isCover = false;
doc.addPage();

sectionTitle(1, "Résumé du modèle commercial", "Une offre simple pour démarrer, puis des capacités croissantes selon le volume d'événements.");
paragraph("AccessQ commercialise l'accès à la plateforme par abonnement mensuel ou annuel, complété par un Pass événement à paiement unique. Un abonnement définit les droits de création et de gestion ; les données déjà créées restent conservées même lorsqu'un plan expire ou diminue.");
table(
    ["Plan", "Prix", "Événements", "QR / événement", "Agents", "Zones"],
    [
        ["Découverte", "Gratuit", "1 / mois", "50", "2 actifs", "2 actives"],
        ["Essential", "15 $ / mois\nou 144 $ / an", "5 / mois", "200", "5 actifs", "6 actives"],
        ["Pass événement", "7 $ / événement", "1 crédit", "200", "Selon le compte", "Selon le compte"],
        ["Pro", "25 $ / mois\nou 240 $ / an", "10 / mois", "700", "15 actifs", "20 actives"],
        ["Entreprise", "Sur devis", "Personnalisé", "Personnalisé", "Personnalisé", "Personnalisé"]
    ],
    [88, 83, 84, 88, 76, 76],
    { fontSize: 8.3 }
);
callout("Offres annuelles", "Essential annuel coûte 144 $, soit 12 $ par mois. Pro annuel coûte 240 $, soit 20 $ par mois. Chaque formule applique une remise de 20 % et se paie en une fois. Les quotas d'événements continuent à se renouveler par cycle mensuel.", "green");
paragraph("Les prix affichés en dollars servent de référence commerciale. Le montant réellement débité est un tarif local fixe configuré pour la devise de l'opérateur Mobile Money : CDF, XOF, XAF, RWF, ZMW, KES, UGX, TZS, NGN ou GHS.");

sectionTitle(2, "Notions fondamentales", "La séparation entre période payée, cycle de quota et événement évite les remises à zéro frauduleuses.");
subTitle("Période d'abonnement");
paragraph("La période d'abonnement est l'intervalle déjà payé. Un abonnement mensuel ajoute un mois ; Essential annuel ajoute douze mois. La date de fin est conservée lors d'un upgrade afin que le changement de plan ne crée pas un nouveau cycle artificiel.");
subTitle("Cycle mensuel de quota");
paragraph("Les événements sont comptés par cycle mensuel ancré sur la date de début de l'abonnement. Même avec Essential annuel, le quota de 5 événements se renouvelle chaque mois. Un événement supprimé reste compté dans le cycle pendant lequel il a été créé.");
subTitle("Quota propre à l'événement");
paragraph("Chaque événement possède son propre quota QR. Essential autorise jusqu'à 200 QR pour chacun de ses événements ; Pro en autorise 700. Supprimer un QR ne rend pas son unité au quota, ce qui empêche la génération et la suppression répétées.");
subTitle("Ressources actives");
paragraph("Les limites d'agents et de zones portent sur les ressources actives. Les ressources suspendues ou archivées restent dans l'historique, mais ne consomment pas le quota actif.");
callout("Règle de conservation", "Un renouvellement ou un changement de plan ne supprime jamais les événements, QR, scans, agents ou zones. Les restrictions portent sur les nouvelles créations et sur le statut actif des ressources.", "blue");

sectionTitle(3, "Cycle de vie d'un abonnement", "Chaque décision est enregistrée comme une transition indépendante, liée à son paiement et à une version précise de l'abonnement.");
flow([
    { title: "Devis", text: "Plan, devise, crédit et date d'effet" },
    { title: "Paiement", text: "Dépôt pawaPay autorisé par PIN" },
    { title: "Vérification", text: "Montant, devise, opérateur et version" },
    { title: "Application", text: "Immédiate ou programmée" }
]);
paragraph("La plateforme maintient un abonnement courant, des périodes historiques immuables, des demandes de changement et un journal d'audit. Une seule demande ouverte peut modifier un abonnement à la fois. Le Pass événement reste exclu de ce verrou, car il ne remplace pas le plan principal.");
table(
    ["État du changement", "Signification"],
    [
        ["AWAITING_PAYMENT", "Devis accepté ; confirmation Mobile Money attendue."],
        ["SCHEDULED", "Paiement confirmé ; changement programmé à la prochaine échéance."],
        ["APPLIED", "Transition appliquée et période historique créée."],
        ["CANCELED", "Demande annulée avant son application."],
        ["FAILED / EXPIRED", "Paiement échoué ou demande arrivée à expiration."],
        ["REFUND_PENDING", "Annulation demandée après paiement ; remboursement en cours."],
        ["REVIEW_REQUIRED", "Callback tardif ou version incohérente ; intervention nécessaire."]
    ],
    [135, 360]
);

sectionTitle(4, "Règles de changement de plan", "Les upgrades peuvent être immédiats ; les réductions de droits et changements de périodicité prennent effet à l'échéance.");
table(
    ["Situation", "Date d'effet", "Traitement"],
    [
        ["Découverte → Essential / Pro", "Immédiate", "Nouvelle période après confirmation du paiement."],
        ["Abonnement expiré → payant", "Immédiate", "Nouveau point d'ancrage et nouveau cycle."],
        ["Essential mensuel → Pro", "Immédiate", "Prorata de la différence ; échéance conservée."],
        ["Essential annuel → Pro annuel", "Immédiate", "Prorata des tarifs annuels ; échéance conservée."],
        ["Essential annuel → Pro mensuel", "À l'échéance", "Changement de périodicité, prépayé puis programmé."],
        ["Pro → Essential", "À l'échéance", "Essential est prépayé ; Pro reste actif jusque-là."],
        ["Mensuel ↔ annuel", "À l'échéance", "La nouvelle périodicité commence après la période courante."],
        ["Même plan", "Après l'échéance", "La nouvelle durée s'ajoute au temps déjà payé."],
        ["Annulation", "À l'échéance", "Passage au plan Découverte sans remboursement de la période utilisée."],
        ["Réactivation", "Avant l'échéance", "La demande d'annulation est retirée."]
    ],
    [140, 92, 263],
    { fontSize: 8.1 }
);
callout("Protection contre les callbacks dans le désordre", "Un paiement ne peut appliquer que la demande et la version d'abonnement auxquelles il est lié. Un ancien callback ne peut donc pas écraser un plan plus récent. Il passe en REVIEW_REQUIRED.", "amber");

sectionTitle(5, "Calcul du prorata", "Le client paie uniquement la différence de valeur correspondant au temps restant.");
paragraph("Le prorata est utilisé pour les upgrades Essential vers Pro lorsque la périodicité reste identique : mensuel vers mensuel ou annuel vers annuel. La plateforme calcule les unités de période restantes, y compris les périodes déjà prépayées, puis applique la différence entre les deux tarifs.");
callout("Formule", "Unités restantes = temps restant / durée du cycle\nCrédit = prix de l'ancien plan × unités restantes\nCoût Pro restant = prix du nouveau plan × unités restantes\nMontant dû = coût Pro restant − crédit", "blue");
subTitle("Exemple");
paragraph("Essential coûte 15 $ et Pro 25 $. Si exactement la moitié du cycle reste, le crédit Essential vaut 7,50 $, le coût Pro restant vaut 12,50 $ et le client paie 5 $. La date de renouvellement ne change pas.");
paragraph("Le montant local est arrondi selon le nombre de décimales accepté par l'opérateur Mobile Money. Le devis affiché avant paiement contient le montant débité, le crédit appliqué, le prix de référence, le type de transition et la date d'effet.");

sectionTitle(6, "Paiements Mobile Money avec pawaPay", "Le paiement reste explicitement autorisé par le client ; AccessQ ne prétend pas effectuer un prélèvement automatique.");
flow([
    { title: "Création", text: "UUID et demande locale enregistrés" },
    { title: "Autorisation", text: "Le client saisit son PIN" },
    { title: "Callback", text: "pawaPay indique l'état final" },
    { title: "Réconciliation", text: "AccessQ revérifie chez pawaPay" }
]);
bullet("Les montants, devises, pays, opérateurs et numéros sont comparés à la transaction attendue.");
bullet("Les identifiants de dépôt sont uniques et idempotents.");
bullet("Les paiements PENDING ou PROCESSING sont revérifiés en arrière-plan.");
bullet("Une demande toujours non finalisée après 24 heures passe à EXPIRED.");
bullet("Un callback reçu après expiration ou annulation n'active rien automatiquement : il exige une revue.");
callout("Renouvellement", "Le renouvellement est manuel ou prépayé : le client autorise chaque dépôt Mobile Money. Aucun prélèvement récurrent n'est annoncé tant qu'un mécanisme de mandat n'est pas disponible.", "amber");

sectionTitle(7, "Quotas lors d'un upgrade ou downgrade", "Le changement de plan modifie le plafond total, pas la consommation déjà enregistrée.");
subTitle("Upgrade sans remise à zéro");
paragraph("Si un client Essential a déjà créé 5 événements puis passe à Pro, son plafond devient 10 pour le même cycle. Il lui reste donc 5 événements, et non 10 supplémentaires. La date d'ancrage et les consommations existantes sont préservées.");
subTitle("Downgrade avec dépassement");
paragraph("Les événements et QR existants restent consultables. Les nouvelles créations sont bloquées lorsqu'elles dépassent les limites du nouveau plan. Les agents et zones excédentaires sont suspendus sans être supprimés.");
paragraph("Avant l'échéance, l'administrateur de l'organisation peut sélectionner les agents et zones qu'il souhaite conserver. Si aucune sélection n'est enregistrée, AccessQ applique un choix déterministe parmi les ressources actives les plus anciennes.");
callout("Zones historiques", "Une zone suspendue ne peut plus être utilisée pour créer ou modifier un nouvel événement. Elle reste toutefois disponible comme référence des anciens horaires et scans, ce qui préserve la validité des QR existants.", "green");

sectionTitle(8, "Expiration et plan Découverte", "À la fin d'une période non renouvelée, le compte conserve ses données mais retrouve les limites gratuites.");
bullet("Le plan effectif devient Découverte : 1 événement mensuel, 50 QR par événement, 2 agents et 2 zones.");
bullet("Les événements créés précédemment restent consultables.");
bullet("Les QR déjà générés restent valides jusqu'à la fin de leur événement, sous réserve de leurs propres dates et règles d'usage.");
bullet("Les QR expirés, révoqués ou ayant atteint leur limite restent refusés normalement.");
bullet("Les agents et zones au-delà du quota Découverte sont marqués comme suspendus par le plan.");
bullet("Une ressource suspendue peut être réactivée après upgrade, dans la limite du nouveau quota.");
paragraph("Un worker de cycle de vie s'exécute périodiquement sur le backend. Il applique les changements arrivés à échéance, marque les abonnements expirés et impose les limites de ressources correspondantes.");

sectionTitle(9, "Pass événement à 7 $", "Le Pass est un crédit autonome et ne modifie jamais l'abonnement principal.");
flow([
    { title: "Achat", text: "Paiement unique de 7 $" },
    { title: "Crédit", text: "Statut AVAILABLE" },
    { title: "Attribution", text: "Choix explicite d'un événement" },
    { title: "Validité", text: "200 QR, fenêtre de 30 jours" }
]);
paragraph("L'attribution explicite évite toute ambiguïté entre le quota mensuel d'un abonnement et le crédit du Pass. Le Pass ne réinitialise aucun compteur et ne se cumule pas automatiquement avec Essential ou Pro.");
paragraph("Le délai de 30 jours commence lors de l'attribution à l'événement. L'événement doit être planifié dans cette fenêtre. Après expiration, les données restent conservées mais aucun nouveau QR ne peut être créé avec ce Pass.");

sectionTitle(10, "Essai Pro", "L'essai est facultatif, contrôlé par configuration et utilisable une seule fois.");
table(
    ["Situation", "Résultat"],
    [
        ["Compte Découverte jamais essayé", "Essai Pro autorisé si l'option serveur est active."],
        ["Essential ou Pro actif", "Essai refusé afin de ne pas écraser une période payée."],
        ["Changement ou remboursement en cours", "Essai refusé jusqu'à résolution."],
        ["Achat Pro pendant l'essai", "La période payée est ajoutée après la fin de l'essai."],
        ["Achat Essential pendant l'essai", "Essential est programmé pour la fin de l'essai."],
        ["Fin d'essai sans paiement", "Retour aux droits Découverte."]
    ],
    [180, 315]
);

sectionTitle(11, "Annulations et remboursements", "Une annulation simple conserve la période payée ; un changement futur déjà payé peut être remboursé.");
subTitle("Annulation de l'abonnement courant");
paragraph("Le client choisit « Ne pas renouveler ». Son plan reste actif jusqu'à l'échéance, puis AccessQ applique Découverte. Il peut retirer cette annulation avant la date d'effet.");
subTitle("Annulation d'un changement prépayé");
paragraph("Si un downgrade ou changement de périodicité a déjà été payé mais n'est pas encore actif, AccessQ crée une demande de remboursement pawaPay. Pendant le traitement, le changement passe à REFUND_PENDING et ne peut pas être remplacé par une nouvelle demande.");
table(
    ["Résultat du remboursement", "Conséquence"],
    [
        ["COMPLETED", "Paiement marqué REFUNDED ; changement marqué CANCELED."],
        ["FAILED", "Paiement reste COMPLETED ; changement futur reste SCHEDULED."],
        ["Statut incertain", "Réconciliation automatique jusqu'à obtention d'un état final."],
        ["Callback tardif incohérent", "Statut REVIEW_REQUIRED et traitement humain."]
    ],
    [165, 330]
);

sectionTitle(12, "Offre Entreprise", "Le plan Entreprise est un contrat administré, et non un simple bouton illimité.");
paragraph("Le back-office super-administrateur permet d'activer un contrat Entreprise avec une référence, une date de début, une date de fin et des limites négociées. Une valeur laissée vide représente un volume illimité.");
bullet("Événements par cycle mensuel personnalisables.");
bullet("QR par événement, agents et zones personnalisables.");
bullet("Capacités avancées : imports, modèles personnalisés, exports et analytics.");
bullet("Historique de période et journal d'audit avec l'administrateur ayant effectué l'action.");
bullet("Activation refusée si un paiement, changement ou remboursement est déjà ouvert.");
paragraph("À la fin du contrat, le fonctionnement d'expiration est identique : les données sont conservées et les droits reviennent à Découverte, avec suspension des ressources excédentaires.");

sectionTitle(13, "Architecture et données persistées", "Les informations courantes sont séparées de l'historique afin de rendre chaque décision traçable.");
table(
    ["Élément", "Responsabilité"],
    [
        ["Organization", "Cache du plan effectif, dates, périodicité et configuration Entreprise."],
        ["Subscription", "État courant, période, annulation à l'échéance et numéro de version."],
        ["SubscriptionChange", "Transition demandée, devis, date d'effet, sélection de ressources et état."],
        ["SubscriptionPeriod", "Historique immuable des périodes et photographie des droits accordés."],
        ["Payment", "Dépôt pawaPay, montant, devise, statut et lien vers la transition."],
        ["Refund", "Remboursement pawaPay et résultat indépendant du paiement initial."],
        ["SubscriptionAuditLog", "Avant/après des actions importantes et acteur administratif."]
    ],
    [145, 350]
);
subTitle("Endpoints principaux");
bullet("POST /billing/quote — calcul du prix réel et de la date d'effet.");
bullet("POST /billing/payments — création du paiement et de la transition.");
bullet("POST /billing/payments/:depositId/refresh — réconciliation manuelle.");
bullet("POST /billing/subscription/cancel — annulation à l'échéance.");
bullet("DELETE /billing/subscription/change — retrait ou remboursement d'un changement futur.");
bullet("PATCH /billing/subscription/change/resources — choix des agents et zones à conserver.");
bullet("POST /billing/callbacks/pawapay et /refunds — callbacks vérifiés côté serveur.");

sectionTitle(14, "Scénarios de référence", "Ces exemples résument le comportement attendu dans les cas les plus fréquents.");
subTitle("Scénario A — Essential vers Pro au milieu du mois");
paragraph("Le devis calcule la différence proratisée. Après confirmation pawaPay, Pro est actif immédiatement. Le cycle mensuel, les événements déjà consommés et la date de renouvellement restent inchangés.");
subTitle("Scénario B — Pro vers Essential");
paragraph("Essential est payé maintenant mais programmé à l'échéance de Pro. Le client conserve Pro jusque-là et choisit les 5 agents et 6 zones à garder actifs. À l'échéance, les excédents sont suspendus.");
subTitle("Scénario C — Deux paiements lancés presque simultanément");
paragraph("Le verrou organisationnel et l'index unique empêchent une deuxième transition ouverte. Si un ancien callback arrive après une autre modification, la version ne correspond plus et aucune activation aveugle n'a lieu.");
subTitle("Scénario D — Abonnement non renouvelé");
paragraph("À l'échéance, le plan effectif devient Découverte. Les anciennes données et les QR des événements encore valides restent présents ; seules les nouvelles actions et ressources actives sont limitées.");
subTitle("Scénario E — Pass acheté par un client Pro");
paragraph("Le Pass devient un crédit AVAILABLE indépendant. Le client choisit explicitement l'événement auquel l'appliquer ; aucun quota Pro n'est automatiquement modifié.");

sectionTitle(15, "Exploitation et déploiement", "Les migrations et les traitements de fond garantissent que le comportement reste cohérent en production.");
bullet("Le démarrage du backend exécute Prisma Generate puis Prisma Migrate Deploy.");
bullet("Le worker d'abonnement applique les échéances et réconcilie périodiquement paiements et remboursements.");
bullet("La fréquence du worker peut être configurée avec SUBSCRIPTION_WORKER_INTERVAL_MS, avec un minimum de 15 secondes.");
bullet("Le frontend Vercel affiche le devis, le changement programmé, les statuts et la sélection des ressources.");
bullet("Le back-office d'administration doit également générer son client Prisma lors du déploiement.");
callout("Point de contrôle production", "Avant d'activer les paiements réels, vérifier les tarifs locaux, le jeton pawaPay, les callbacks dépôt/remboursement, la devise de chaque opérateur et les variables d'environnement du backend et du frontend.", "red");

paragraph("Fin du guide — Ce document reflète le mécanisme AccessQ implémenté au 10 août 2026.", { bold: true, align: "center", color: COLORS.slate, gap: 0 });

// Pieds de page et numérotation
const range = doc.bufferedPageRange();
for (let index = 0; index < range.count; index += 1) {
    doc.switchToPage(index);
    if (index === 0) continue;
    const footerY = doc.page.height - 33;
    const originalBottomMargin = doc.page.margins.bottom;
    doc.page.margins.bottom = 0;
    doc.moveTo(doc.page.margins.left, footerY - 8)
        .lineTo(doc.page.width - doc.page.margins.right, footerY - 8)
        .strokeColor(COLORS.border).lineWidth(0.5).stroke();
    doc.font("Helvetica").fontSize(8).fillColor(COLORS.slate)
        .text("AccessQ — Guide des abonnements", doc.page.margins.left, footerY, {
            width: contentWidth / 2,
            lineBreak: false
        });
    doc.text(`${index} / ${range.count - 1}`, doc.page.margins.left + contentWidth / 2, footerY, {
        width: contentWidth / 2,
        align: "right",
        lineBreak: false
    });
    doc.page.margins.bottom = originalBottomMargin;
}

doc.end();

stream.on("finish", () => {
    process.stdout.write(`${outputPath}\n`);
});
