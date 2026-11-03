// Box du participant : billets dont il est propriétaire, affichage du QR et PDF quand l'offre l'autorise.
const QRCode = require("qrcode");
const prisma = require("../prisma/client");
const { buildQrPayload, generateRegistrationPassPdf } = require("./registration_card.service");
const { buildDynamicPayload } = require("./box_qr.service");

class BoxError extends Error {
    constructor(message, code, statusCode = 400) {
        super(message);
        this.name = "BoxError";
        this.code = code;
        this.statusCode = statusCode;
    }
}

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const ticketInclude = {
    event: { include: { EventSchedules: { include: { area: true }, orderBy: { start_date: "asc" } } } },
    offer: { select: { name: true } },
    qr_code: true
};

// L'option est figée dans l'instantané de l'offre au moment de l'inscription.
const isBoxOnly = registration => Boolean(registration.offer_snapshot?.boxOnlyQr);
const isIssued = registration => Boolean(registration.qr_code && registration.issuance_status === "SUCCEEDED");

const serializeTicket = registration => {
    const qr = registration.qr_code;
    const schedules = registration.event?.EventSchedules || [];
    return {
        id: registration.registration_id,
        status: registration.status,
        issuanceStatus: registration.issuance_status,
        failureMessage: registration.failure_message,
        holderName: registration.holder_name,
        offerName: registration.offer_snapshot?.name || registration.offer?.name,
        event: {
            title: registration.event?.title,
            startsAt: schedules[0]?.start_date || null,
            endsAt: schedules.reduce((latest, schedule) => (!latest || schedule.end_date > latest ? schedule.end_date : latest), null),
            venue: schedules[0]?.area?.area_name || null
        },
        accessType: registration.offer_snapshot?.accessType,
        usageLimit: qr?.usage_limit ?? registration.offer_snapshot?.usageLimit,
        scansCount: qr?.scans_count ?? 0,
        qrStatus: qr?.status || null,
        validFrom: qr?.valid_from || registration.offer_snapshot?.validFrom || null,
        validUntil: qr?.valid_until || registration.offer_snapshot?.validUntil || null,
        boxOnlyQr: isBoxOnly(registration),
        qrAvailable: isIssued(registration) && !qr.deleted_at,
        pdfAvailable: isIssued(registration) && !qr.deleted_at && !isBoxOnly(registration),
        createdAt: registration.created_at
    };
};

const listTickets = async attendeeId => {
    const tickets = await prisma.registration.findMany({
        where: { owner_attendee_id: attendeeId },
        include: ticketInclude,
        orderBy: { created_at: "desc" }
    });
    return tickets.map(serializeTicket);
};

const findOwnedTicket = async (attendeeId, ticketId) => {
    // Un billet d'un autre participant répond comme un billet inexistant.
    if (!uuidPattern.test(String(ticketId || ""))) throw new BoxError("Billet introuvable.", "TICKET_NOT_FOUND", 404);
    const registration = await prisma.registration.findFirst({
        where: { registration_id: ticketId, owner_attendee_id: attendeeId },
        include: ticketInclude
    });
    if (!registration) throw new BoxError("Billet introuvable.", "TICKET_NOT_FOUND", 404);
    return registration;
};

const getTicket = async (attendeeId, ticketId) => serializeTicket(await findOwnedTicket(attendeeId, ticketId));

// Billet « box uniquement » : QR tournant avec son échéance. Sinon : QR statique, identique au PDF.
const renderTicketQr = async (attendeeId, ticketId, now = new Date()) => {
    const registration = await findOwnedTicket(attendeeId, ticketId);
    if (!isIssued(registration) || registration.qr_code.deleted_at) throw new BoxError("Le billet n’est pas encore disponible.", "PASS_NOT_AVAILABLE", 409);
    const dynamic = isBoxOnly(registration) ? buildDynamicPayload(registration.qr_code, now) : null;
    const image = await QRCode.toBuffer(dynamic ? dynamic.payload : buildQrPayload(registration.qr_code), { errorCorrectionLevel: "M", margin: 2, width: 400 });
    return { image, expiresAt: dynamic?.expiresAt || null };
};

const renderTicketPdf = async (attendeeId, ticketId) => {
    const registration = await findOwnedTicket(attendeeId, ticketId);
    if (isBoxOnly(registration)) throw new BoxError("Ce billet s’affiche uniquement dans votre box.", "BOX_ONLY_QR", 403);
    if (!isIssued(registration) || registration.qr_code.deleted_at) throw new BoxError("Le billet n’est pas encore disponible.", "PASS_NOT_AVAILABLE", 409);
    return generateRegistrationPassPdf(registration);
};

module.exports = { BoxError, getTicket, isBoxOnly, listTickets, renderTicketPdf, renderTicketQr, serializeTicket };
