"use client";

import { useEffect, useState } from "react";
import { Loader2, LogOut, ShieldCheck, Wallet } from "lucide-react";
import AttendeeSignIn from "./AttendeeSignIn";
import { attendeeFetch, attendeeJson, isValidPassword, loadAttendee, passwordRules } from "../lib/attendeeApi";

// Cadre commun des pages de la box : connexion si besoin, puis contenu du participant connecté.
export default function BoxShell({ children }) {
  const [attendee, setAttendee] = useState(undefined);
  const [error, setError] = useState("");

  useEffect(() => { loadAttendee().then(setAttendee).catch(() => { setAttendee(null); setError("Impossible de vérifier votre session."); }); }, []);

  const signOut = async () => {
    await attendeeFetch("/attendee/logout", { method: "POST" }).catch(() => {});
    setAttendee(null);
  };

  return <main className="min-h-screen bg-slate-50 px-4 py-8 dark:bg-slate-950"><div className="mx-auto max-w-2xl">
    <header className="mb-6 flex items-center justify-between gap-3">
      <a href="/box" className="inline-flex items-center gap-2 text-lg font-black text-slate-950 dark:text-slate-50"><Wallet className="h-6 w-6 text-blue-600 dark:text-blue-400" /> Ma box</a>
      {attendee && <button onClick={signOut} className="inline-flex items-center gap-2 text-sm font-semibold text-slate-600 hover:text-slate-900 dark:text-slate-300 dark:hover:text-slate-50"><LogOut className="h-4 w-4" /> Déconnexion</button>}
    </header>
    {attendee === undefined ? <div className="py-20 text-center"><Loader2 className="mx-auto h-8 w-8 animate-spin text-blue-600" /></div>
      : !attendee ? <Card>
        <h1 className="text-2xl font-black text-slate-950 dark:text-slate-50">Ouvrir ma box</h1>
        <p className="mb-6 mt-2 text-sm text-slate-600 dark:text-slate-300">Retrouvez tous vos billets avec votre adresse email.</p>
        {error && <p className="mb-4 text-sm text-red-700 dark:text-red-300">{error}</p>}
        <AttendeeSignIn allowPassword onSignedIn={setAttendee} />
      </Card>
      : children({ attendee, setAttendee })}
  </div></main>;
}

export function Card({ children, className = "" }) { return <section className={`rounded-3xl border border-slate-200 bg-white p-6 shadow-xl shadow-slate-200/50 sm:p-8 dark:border-slate-800 dark:bg-slate-900 dark:shadow-black/30 ${className}`}>{children}</section>; }

// Proposée juste après le premier billet : le mot de passe protégera aussi les futurs transferts.
export function SecureBoxCard({ attendee, onSecured }) {
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  if (attendee.hasPassword) return null;

  const submit = async event => {
    event.preventDefault(); setError("");
    if (!isValidPassword(password)) return setError(`Mot de passe trop faible : ${passwordRules}`);
    if (password !== confirm) return setError("Les deux mots de passe ne correspondent pas.");
    setBusy(true);
    try {
      const data = await attendeeJson("/attendee/password", { method: "PUT", body: JSON.stringify({ newPassword: password }) });
      onSecured(data.attendee);
    } catch (reason) { setError(reason.message); }
    finally { setBusy(false); }
  };

  return <Card className="border-amber-200 dark:border-amber-900/60">
    <div className="flex items-start gap-3"><ShieldCheck className="mt-1 h-6 w-6 shrink-0 text-amber-600 dark:text-amber-400" /><div><h2 className="text-lg font-bold text-slate-950 dark:text-slate-50">Sécurisez votre box</h2><p className="mt-1 text-sm text-slate-600 dark:text-slate-300">Choisissez un mot de passe. Il vous sera demandé pour confirmer les opérations sensibles sur vos billets.</p></div></div>
    <form onSubmit={submit} className="mt-5 space-y-3">
      <PasswordField label="Mot de passe" value={password} onChange={setPassword} />
      <PasswordField label="Confirmation" value={confirm} onChange={setConfirm} />
      <p className="text-xs text-slate-500 dark:text-slate-400">{passwordRules}</p>
      {error && <p className="rounded-xl bg-red-50 p-3 text-sm font-semibold text-red-700 dark:bg-red-950/40 dark:text-red-300">{error}</p>}
      <button disabled={busy} className="flex w-full items-center justify-center gap-2 rounded-xl bg-blue-600 px-5 py-3 font-bold text-white disabled:opacity-60 dark:bg-blue-500 dark:text-slate-950">{busy && <Loader2 className="h-4 w-4 animate-spin" />} Sécuriser ma box</button>
    </form>
  </Card>;
}

function PasswordField({ label, value, onChange }) { return <label className="block text-sm font-semibold text-slate-700 dark:text-slate-200">{label}<input type="password" required autoComplete="new-password" value={value} onChange={event => onChange(event.target.value)} className="mt-2 w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-slate-900 outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-100 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100 dark:focus:border-blue-400 dark:focus:ring-blue-900/60" /></label>; }
