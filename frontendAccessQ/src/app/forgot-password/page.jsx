"use client";

import { useState } from "react";
import Link from "next/link";
import { Mail, CheckCircle } from "lucide-react";
import { apiUrl } from "../lib/api";

export default function ForgotPasswordPage() {
    const [email, setEmail] = useState("");
    const [message, setMessage] = useState("");
    const [error, setError] = useState("");
    const [loading, setLoading] = useState(false);

    const submit = async (event) => {
        event.preventDefault();
        setLoading(true);
        setError("");
        try {
            const response = await fetch(apiUrl("/user/forgot-password"), {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ email })
            });
            const data = await response.json();
            if (!response.ok) throw new Error(data.message || "La demande n’a pas pu être traitée.");
            setMessage(data.message);
        } catch (requestError) {
            setError(requestError.message || "Service momentanément indisponible.");
        } finally {
            setLoading(false);
        }
    };

    return (
        <main className="min-h-screen bg-slate-50 dark:bg-slate-900 flex items-center justify-center p-4 text-slate-900 dark:text-white">
            <section className="w-full max-w-md rounded-2xl bg-white dark:bg-slate-950 p-8 shadow-xl">
                <div className="mb-6 flex h-14 w-14 items-center justify-center rounded-full bg-blue-50 text-blue-600 dark:bg-blue-950/50">
                    {message ? <CheckCircle className="h-7 w-7 text-emerald-500" /> : <Mail className="h-7 w-7" />}
                </div>
                <h1 className="text-2xl font-bold">Mot de passe oublié</h1>
                <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
                    Indiquez l’adresse e-mail de votre compte. Nous vous enverrons un lien valable 30 minutes.
                </p>

                {message ? (
                    <div className="mt-6 rounded-lg border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-200">{message}</div>
                ) : (
                    <form onSubmit={submit} className="mt-6 space-y-4">
                        {error && <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div>}
                        <div>
                            <label htmlFor="email" className="mb-1.5 block text-sm font-semibold">Adresse e-mail</label>
                            <input id="email" type="email" required autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="nom@domaine.com" className="w-full rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 dark:border-slate-800 dark:bg-slate-900" />
                        </div>
                        <button disabled={loading} className="w-full rounded-lg bg-gradient-to-r from-blue-600 to-emerald-500 px-4 py-3 font-semibold text-white disabled:opacity-60">
                            {loading ? "Envoi en cours..." : "Envoyer le lien"}
                        </button>
                    </form>
                )}

                <Link href="/login" className="mt-6 block text-center text-sm font-semibold text-blue-600 hover:underline dark:text-blue-400">Retour à la connexion</Link>
            </section>
        </main>
    );
}
