const axios = require("axios");

const BREVO_API_URL = "https://api.brevo.com/v3/smtp/email";
const escapeHtml = (value) => String(value || "").replace(/[&<>"']/g, character => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;", "'": "&#039;" }[character]));

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

        console.log("=========================================");
        console.log("📨 EMAIL ENVOYÉ POUR VÉRIFICATION (API Brevo)");
        console.log(`Destinataire : ${toEmail}`);
        if (data.messageId) console.log("ID du message : %s", data.messageId);
        console.log("=========================================");

        return true;
    } catch (error) {
        console.error("Erreur lors de l'envoi de l'e-mail de vérification :", error?.response?.data || error.message);
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
        console.error("Erreur lors de l'envoi de l'e-mail de réinitialisation :", error?.response?.data || error.message);
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

        console.log("=========================================");
        console.log("📨 EMAIL D'INVITATION ENVOYÉ (API Brevo)");
        console.log(`Destinataire : ${toEmail}`);
        if (data.messageId) console.log("ID du message : %s", data.messageId);
        console.log("=========================================");

        return true;
    } catch (error) {
        console.error("Erreur lors de l'envoi de l'e-mail d'invitation :", error?.response?.data || error.message);
        return false;
    }
};
