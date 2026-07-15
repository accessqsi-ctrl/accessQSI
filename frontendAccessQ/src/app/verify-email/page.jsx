"use client";

import { useEffect, useState, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { CheckCircle, XCircle, Loader2 } from "lucide-react";

function VerifyEmailContent() {
    const searchParams = useSearchParams();
    const token = searchParams.get("token");
    const requestedEmail = searchParams.get("email") || "";
    const hasToken = Boolean(token);

    const [status, setStatus] = useState(hasToken ? "loading" : "error"); // loading, success, error
    const [message, setMessage] = useState(
        hasToken
            ? "Vérification de votre adresse e-mail en cours..."
            : "Lien de vérification invalide ou manquant."
    );
    const [email, setEmail] = useState(requestedEmail);
    const [resending, setResending] = useState(false);

    const resend = async (event) => {
        event.preventDefault(); setResending(true);
        try {
            const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/user/resend-verification`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email }) });
            const data = await res.json();
            setMessage(data.message || "Demande traitée.");
            if (data.success) setStatus("success");
        } catch { setMessage("Service momentanément indisponible."); }
        finally { setResending(false); }
    };

    useEffect(() => {
        if (!token) {
            return;
        }

        const verifyToken = async () => {
            try {
                const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/user/verify-email`, {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                    },
                    body: JSON.stringify({ token }),
                });

                const data = await res.json();

                if (data.success) {
                    setStatus("success");
                    setMessage(data.message);
                } else {
                    setStatus("error");
                    setMessage(data.message || "La vérification de l'e-mail a échoué.");
                }
            } catch (err) {
                console.error("Verification connection error:", err);
                setStatus("error");
                setMessage("Erreur de connexion au serveur. Veuillez réessayer plus tard.");
            }
        };

        verifyToken();
    }, [token]);

    return (
        <div className="min-h-screen bg-slate-50 dark:bg-slate-900 flex flex-col items-center justify-center p-4">
            <div className="max-w-md w-full bg-white dark:bg-slate-950 rounded-2xl shadow-xl overflow-hidden text-center">
                <div className="p-8">
                    <div className="mb-6 flex justify-center">
                        {status === "loading" && (
                            <Loader2 className="w-16 h-16 text-blue-500 animate-spin" />
                        )}
                        {status === "success" && (
                            <CheckCircle className="w-16 h-16 text-emerald-500" />
                        )}
                        {status === "error" && (
                            <XCircle className="w-16 h-16 text-red-500" />
                        )}
                    </div>

                    <h2 className="text-2xl font-bold text-slate-900 dark:text-white mb-4">
                        {status === "loading" && "Vérification..."}
                        {status === "success" && "E-mail Vérifié !"}
                        {status === "error" && "Échec de la Vérification"}
                    </h2>

                    <p className="text-slate-600 dark:text-slate-300 mb-8 max-w-sm mx-auto">
                        {message}
                    </p>

                    {status === "error" && (
                        <form onSubmit={resend} className="mb-4 space-y-3 text-left">
                            <label className="block text-sm font-semibold text-slate-700 dark:text-slate-200">Adresse e-mail</label>
                            <input type="email" required value={email} onChange={event => setEmail(event.target.value)} placeholder="nom@domaine.com" className="w-full rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none focus:border-blue-500 dark:border-slate-700 dark:bg-slate-900" />
                            <button disabled={resending} className="w-full rounded-lg bg-blue-600 px-4 py-3 text-sm font-bold text-white disabled:opacity-60">{resending ? "Envoi en cours..." : "Renvoyer le lien"}</button>
                        </form>
                    )}

                    {(status === "success" || status === "error") && (
                        <Link
                            href="/login"
                            className="inline-flex justify-center w-full py-3 px-4 bg-gradient-to-r from-blue-600 to-emerald-500 hover:from-blue-700 hover:to-emerald-600 text-white font-medium rounded-lg transition-all shadow-md active:scale-[0.98]"
                        >
                            Aller à la page de Connexion
                        </Link>
                    )}
                </div>
            </div>
        </div>
    );
}

export default function VerifyEmailPage() {
    return (
        <Suspense fallback={<div className="min-h-screen bg-slate-50 dark:bg-slate-900 flex items-center justify-center"><Loader2 className="w-10 h-10 text-blue-500 animate-spin" /></div>}>
            <VerifyEmailContent />
        </Suspense>
    );
}
