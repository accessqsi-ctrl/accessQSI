"use client";

import { Suspense, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { CheckCircle, KeyRound, Loader2 } from "lucide-react";
import { apiUrl } from "../lib/api";

function ResetPasswordContent() {
    const token = useSearchParams().get("token") || "";
    const [password, setPassword] = useState("");
    const [confirmation, setConfirmation] = useState("");
    const [message, setMessage] = useState("");
    const [error, setError] = useState(token ? "" : "Ce lien de réinitialisation est invalide ou incomplet.");
    const [loading, setLoading] = useState(false);

    const submit = async (event) => {
        event.preventDefault();
        setError("");
        if (password !== confirmation) {
            setError("Les deux mots de passe ne correspondent pas.");
            return;
        }
        setLoading(true);
        try {
            const response = await fetch(apiUrl("/user/reset-password"), {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ token, password })
            });
            const data = await response.json();
            if (!response.ok) throw new Error(data.message || "La réinitialisation a échoué.");
            setMessage(data.message);
            setPassword("");
            setConfirmation("");
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
                    {message ? <CheckCircle className="h-7 w-7 text-emerald-500" /> : <KeyRound className="h-7 w-7" />}
                </div>
                <h1 className="text-2xl font-bold">Nouveau mot de passe</h1>
                <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">Utilisez au moins 8 caractères avec majuscule, minuscule, chiffre et symbole.</p>

                {message ? (
                    <>
                        <div className="mt-6 rounded-lg border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-200">{message}</div>
                        <Link href="/login" className="mt-5 block w-full rounded-lg bg-gradient-to-r from-blue-600 to-emerald-500 px-4 py-3 text-center font-semibold text-white">Se connecter</Link>
                    </>
                ) : (
                    <form onSubmit={submit} className="mt-6 space-y-4">
                        {error && <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700 dark:border-red-900 dark:bg-red-950/40 dark:text-red-200">{error}</div>}
                        <div>
                            <label htmlFor="password" className="mb-1.5 block text-sm font-semibold">Nouveau mot de passe</label>
                            <input id="password" type="password" required autoComplete="new-password" value={password} onChange={(event) => setPassword(event.target.value)} className="w-full rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 dark:border-slate-800 dark:bg-slate-900" />
                        </div>
                        <div>
                            <label htmlFor="confirmation" className="mb-1.5 block text-sm font-semibold">Confirmer le mot de passe</label>
                            <input id="confirmation" type="password" required autoComplete="new-password" value={confirmation} onChange={(event) => setConfirmation(event.target.value)} className="w-full rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 dark:border-slate-800 dark:bg-slate-900" />
                        </div>
                        <button disabled={loading || !token} className="w-full rounded-lg bg-gradient-to-r from-blue-600 to-emerald-500 px-4 py-3 font-semibold text-white disabled:opacity-60">{loading ? "Mise à jour..." : "Modifier le mot de passe"}</button>
                        <Link href="/forgot-password" className="block text-center text-sm font-semibold text-blue-600 hover:underline dark:text-blue-400">Demander un nouveau lien</Link>
                    </form>
                )}
            </section>
        </main>
    );
}

export default function ResetPasswordPage() {
    return <Suspense fallback={<div className="min-h-screen flex items-center justify-center"><Loader2 className="h-10 w-10 animate-spin text-blue-500" /></div>}><ResetPasswordContent /></Suspense>;
}
