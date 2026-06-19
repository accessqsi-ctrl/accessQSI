"use client";

import { useEffect, useState, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { CheckCircle, XCircle, Loader2 } from "lucide-react";

function VerifyEmailContent() {
    const searchParams = useSearchParams();
    const token = searchParams.get("token");
    const hasToken = Boolean(token);

    const [status, setStatus] = useState(hasToken ? "loading" : "error"); // loading, success, error
    const [message, setMessage] = useState(
        hasToken
            ? "Vérification de votre adresse e-mail en cours..."
            : "Lien de vérification invalide ou manquant."
    );

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
