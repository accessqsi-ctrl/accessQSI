const axios = require("axios");

const BREVO_API_URL = "https://api.brevo.com/v3/smtp/email";

// Default sender loaded from env
const defaultSender = {
    name: process.env.BREVO_SENDER_NAME || "QR Access",
    email: process.env.BREVO_SENDER_EMAIL || "access.qsi@gmail.com",
};

/**
 * Send a transactional email via Brevo API v3
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

        const data = await sendEmail({
            to: [{ email: toEmail, name: fullName }],
            subject: "Verify Your Email Address - QR Access",
            textContent: `Hello ${fullName},\n\nPlease verify your email by clicking the following link:\n${verifyUrl}\n\nIf you did not request this, please ignore this email.`,
            htmlContent: `
                <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                    <h2 style="color: #2563eb;">Welcome to QR Access!</h2>
                    <p>Hello <strong>${fullName}</strong>,</p>
                    <p>Thank you for registering. To activate your account and access your dashboard, please click the button below:</p>
                    <a href="${verifyUrl}" style="display: inline-block; padding: 10px 20px; margin-top: 15px; color: white; background-color: #2563eb; text-decoration: none; border-radius: 5px;">Verify My Email</a>
                    <p style="margin-top: 25px; font-size: 12px; color: #6b7280;">If the button doesn't work, copy and paste this link into your browser:</p>
                    <p style="font-size: 12px; color: #3b82f6;">${verifyUrl}</p>
                </div>
            `,
        });

        console.log("=========================================");
        console.log("📨 EMAIL SENT FOR VERIFICATION (Brevo API)");
        console.log(`To: ${toEmail}`);
        if (data.messageId) console.log("Message ID: %s", data.messageId);
        console.log("=========================================");

        return true;
    } catch (error) {
        console.error("Error sending verification email:", error?.response?.data || error.message);
        return false;
    }
};

exports.sendAgentInvitation = async (toEmail, fullName, rawPassword) => {
    try {
        const baseUrl = process.env.FRONTEND_URL;
        const loginUrl = `${baseUrl}/login`;

        const data = await sendEmail({
            to: [{ email: toEmail, name: fullName }],
            subject: "You've been invited as an Agent - QR Access",
            textContent: `Hello ${fullName},\n\nYou have been added as an Agent for your organization.\nYour email: ${toEmail}\nYour password: ${rawPassword}\n\nPlease login at: ${loginUrl}`,
            htmlContent: `
                <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e5e7eb; border-radius: 8px;">
                    <h2 style="color: #2563eb;">Welcome to QR Access!</h2>
                    <p>Hello <strong>${fullName}</strong>,</p>
                    <p>An administrator has invited you to manage scanning and ticketing for your organization's events.</p>
                    <div style="background-color: #f3f4f6; padding: 15px; border-radius: 6px; margin: 20px 0;">
                        <p style="margin: 0; font-size: 14px;"><strong>Email:</strong> ${toEmail}</p>
                        <p style="margin: 8px 0 0 0; font-size: 14px;"><strong>Temporary Password:</strong> ${rawPassword}</p>
                    </div>
                    <a href="${loginUrl}" style="display: inline-block; padding: 12px 24px; color: white; background-color: #2563eb; text-decoration: none; border-radius: 6px; font-weight: bold;">Login Now</a>
                    <p style="margin-top: 25px; font-size: 12px; color: #6b7280;">Please keep your credentials secure.</p>
                </div>
            `,
        });

        console.log("=========================================");
        console.log("📨 INVITATION EMAIL SENT (Brevo API)");
        console.log(`To: ${toEmail}`);
        if (data.messageId) console.log("Message ID: %s", data.messageId);
        console.log("=========================================");

        return true;
    } catch (error) {
        console.error("Error sending agent invitation email:", error?.response?.data || error.message);
        return false;
    }
};
