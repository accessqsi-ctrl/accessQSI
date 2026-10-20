const axios = require("axios");
const logger = require("../utils/logger");

const BREVO_API_URL = "https://api.brevo.com/v3/smtp/email";
const escapeHtml = (value) => String(value || "").replace(/[&<>"']/g, character => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;", "'": "&#039;" }[character]));
const providerErrorMeta = (operation, error) => ({
    operation,
    provider: "brevo",
    provider_status: error?.response?.status,
    provider_code: error?.response?.data?.code,
    error
});

// Expéditeur par défaut chargé depuis les variables d'environnement
const defaultSender = {
    name: process.env.BREVO_SENDER_NAME || "AccessQ",
    email: process.env.BREVO_SENDER_EMAIL || "access.supportclient@gmail.com",
};

/**
 * Envoyer un email transactionnel via l'API Brevo v3
 */
const sendEmail = async ({ to, subject, textContent, htmlContent }) => {
    const response = await axios.post(
        BREVO_API_URL,
        {
            sender: defaultSender,
            to,
            subject,
            textContent,
            htmlContent,
        },
        {
            headers: {
                "api-key": process.env.BREVO_API_KEY,
                "Content-Type": "application/json",
                Accept: "application/json",
            },
        }
    );
    return response.data;
};

exports.sendPassAccessEmail = async ({ toEmail, fullName, eventTitle, offerName, accessUrl }) => {
    const safeName = escapeHtml(fullName);
    const safeEvent = escapeHtml(eventTitle);
    const safeOffer = escapeHtml(offerName);
    const safeUrl = escapeHtml(accessUrl);
    return sendEmail({
        to: [{ email: toEmail, name: fullName }],
        subject: `Votre pass pour ${eventTitle} - AccessQ`,
        textContent: `Bonjour ${fullName},\n\nVotre pass ${offerName} pour ${eventTitle} est disponible :\n${accessUrl}\n\nCe lien personnel expire. Ne le transférez pas.`,
        htmlContent: `
            <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;color:#0f172a">
                <h2 style="color:#1d4ed8">Votre pass est prêt</h2>
                <p>Bonjour <strong>${safeName}</strong>,</p>
                <p>Votre pass <strong>${safeOffer}</strong> pour <strong>${safeEvent}</strong> est disponible.</p>
                <a href="${safeUrl}" style="display:inline-block;padding:12px 20px;background:#1d4ed8;color:#fff;text-decoration:none;border-radius:8px">Afficher et télécharger mon pass</a>
                <p style="margin-top:24px;font-size:12px;color:#64748b">Ce lien est personnel et expirant. Ne le transférez pas.</p>
            </div>
        `
    });
};

exports.sendVerificationEmail = async (toEmail, fullName, token) => {
    try {
        const baseUrl = process.env.FRONTEND_URL || "http://localhost:3000";
        const verifyUrl = `${baseUrl}/verify-email?token=${token}`;
        const safeName = escapeHtml(fullName);

        const data = await sendEmail({
            to: [{ email: toEmail, name: fullName }],
            subject: "Vérifiez votre adresse e-mail - AccessQ",
            textContent: `Bonjour ${fullName},\n\nVeuillez vérifier votre e-mail en cliquant sur le lien suivant :\n${verifyUrl}\n\nSi vous n'êtes pas à l'origine de cette demande, veuillez ignorer cet e-mail.`,
            htmlContent: `
                <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                    <h2 style="color: #2563eb;">Bienvenue sur AccessQ !</h2>
                    <p>Bonjour <strong>${safeName}</strong>,</p>
                    <p>Merci de vous être inscrit(e). Pour activer votre compte et accéder à votre tableau de bord, veuillez cliquer sur le bouton ci-dessous :</p>
                    <a href="${verifyUrl}" style="display: inline-block; padding: 10px 20px; margin-top: 15px; color: white; background-color: #2563eb; text-decoration: none; border-radius: 5px;">Vérifier mon e-mail</a>
                    <p style="margin-top: 25px; font-size: 12px; color: #6b7280;">Si le bouton ne fonctionne pas, copiez et collez ce lien dans votre navigateur :</p>
                    <p style="font-size: 12px; color: #3b82f6;">${verifyUrl}</p>
                    <p style="margin-top: 20px; font-size: 12px; color: #6b7280;">Ce lien est valable pendant 24 heures. Si vous n’êtes pas à l’origine de cette inscription, ignorez simplement ce message.</p>
                </div>
            `,
        });

        logger.info("email.accepted", { operation: "verification", provider: "brevo", provider_message_id: data.messageId });

        return true;
    } catch (error) {
        logger.error("email.delivery_failed", providerErrorMeta("verification", error));
        return false;
    }
};

exports.sendPasswordResetEmail = async (toEmail, fullName, token) => {
    try {
        const baseUrl = process.env.FRONTEND_URL || "http://localhost:3000";
        const resetUrl = `${baseUrl}/reset-password?token=${encodeURIComponent(token)}`;
        const safeName = escapeHtml(fullName);

        await sendEmail({
            to: [{ email: toEmail, name: fullName }],
            subject: "Réinitialisez votre mot de passe - AccessQ",
            textContent: `Bonjour ${fullName},\n\nPour choisir un nouveau mot de passe, ouvrez ce lien (valable 30 minutes) :\n${resetUrl}\n\nSi vous n’êtes pas à l’origine de cette demande, ignorez cet e-mail.`,
            htmlContent: `
                <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                    <h2 style="color: #2563eb;">Réinitialisation du mot de passe</h2>
                    <p>Bonjour <strong>${safeName}</strong>,</p>
                    <p>Une demande de réinitialisation a été effectuée pour votre compte AccessQ.</p>
                    <a href="${resetUrl}" style="display: inline-block; padding: 12px 20px; margin-top: 15px; color: white; background-color: #2563eb; text-decoration: none; border-radius: 6px;">Choisir un nouveau mot de passe</a>
                    <p style="margin-top: 25px; font-size: 12px; color: #6b7280;">Ce lien est à usage unique et expire dans 30 minutes. Si vous n’êtes pas à l’origine de cette demande, ignorez ce message.</p>
                    <p style="font-size: 12px; color: #3b82f6; word-break: break-all;">${resetUrl}</p>
                </div>
            `,
        });
        return true;
    } catch (error) {
        logger.error("email.delivery_failed", providerErrorMeta("password_reset", error));
        return false;
    }
};

exports.sendAgentInvitation = async (toEmail, fullName, rawPassword) => {
    try {
        const baseUrl = process.env.FRONTEND_URL;
        const loginUrl = `${baseUrl}/login`;

        const data = await sendEmail({
            to: [{ email: toEmail, name: fullName }],
            subject: "Vous avez été invité(e) en tant qu'Agent - AccessQ",
            textContent: `Bonjour ${fullName},\n\nVous avez été ajouté(e) en tant qu'Agent pour votre organisation.\nVotre e-mail : ${toEmail}\nVotre mot de passe : ${rawPassword}\n\nVeuillez vous connecter sur : ${loginUrl}`,
            htmlContent: `
                <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e5e7eb; border-radius: 8px;">
                    <h2 style="color: #2563eb;">Bienvenue sur AccessQ !</h2>
                    <p>Bonjour <strong>${fullName}</strong>,</p>
                    <p>Un administrateur vous a invité(e) à gérer le scan et la billetterie pour les événements de votre organisation.</p>
                    <div style="background-color: #f3f4f6; padding: 15px; border-radius: 6px; margin: 20px 0;">
                        <p style="margin: 0; font-size: 14px;"><strong>E-mail :</strong> ${toEmail}</p>
                        <p style="margin: 8px 0 0 0; font-size: 14px;"><strong>Mot de passe temporaire :</strong> ${rawPassword}</p>
                    </div>
                    <a href="${loginUrl}" style="display: inline-block; padding: 12px 24px; color: white; background-color: #2563eb; text-decoration: none; border-radius: 6px; font-weight: bold;">Se connecter</a>
                    <p style="margin-top: 25px; font-size: 12px; color: #6b7280;">Veuillez garder vos identifiants en sécurité.</p>
                </div>
            `,
        });

        logger.info("email.accepted", { operation: "agent_invitation", provider: "brevo", provider_message_id: data.messageId });

        return true;
    } catch (error) {
        logger.error("email.delivery_failed", providerErrorMeta("agent_invitation", error));
        return false;
    }
};
