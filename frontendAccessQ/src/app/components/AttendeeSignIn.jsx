"use client";

import { useState } from "react";
import { KeyRound, Loader2, Mail } from "lucide-react";
import { attendeeJson } from "../lib/attendeeApi";
import TermsCheckbox from "./TermsCheckbox";

// Connexion à la box : un code à 6 chiffres envoyé par email crée ou ouvre le compte participant.
export default function AttendeeSignIn({ onSignedIn, askName = false, allowPassword = false }) {
  const [mode, setMode] = useState("code");
  const [step, setStep] = useState("email");
  const [email, setEmail] = useState("");
  const [fullName, setFullName] = useState("");
  const [needsName, setNeedsName] = useState(askName);
  // Une nouvelle box (askName) doit accepter les conditions ; un compte existant seulement si le serveur le demande.
  const [needsTerms, setNeedsTerms] = useState(askName);
  const [acceptTerms, setAcceptTerms] = useState(false);
  const [code, setCode] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const run = async action => {
    setBusy(true); setError("");
    try { await action(); }
    catch (reason) {
      // Une box à créer demande aussi les conditions : un seul aller-retour au lieu de deux.
      if (reason.code === "NAME_REQUIRED") { setNeedsName(true); setNeedsTerms(true); }
      if (reason.code === "TERMS_REQUIRED") setNeedsTerms(true);
      setError(reason.message);
    }
    finally { setBusy(false); }
  };

  const requestCode = () => run(async () => {
    await attendeeJson("/attendee/code/request", { method: "POST", body: JSON.stringify({ email }) });
    setStep("code"); setCode(""); setNotice(`Code envoyé à ${email}.`);
  });

  const verifyCode = () => run(async () => {
    const data = await attendeeJson("/attendee/code/verify", { method: "POST", body: JSON.stringify({ email, code, fullName: needsName ? fullName : undefined, acceptTerms: needsTerms ? acceptTerms : undefined }) });
    onSignedIn(data.attendee);
  });

  const login = () => run(async () => {
    const data = await attendeeJson("/attendee/login", { method: "POST", body: JSON.stringify({ email, password, acceptTerms: needsTerms ? acceptTerms : undefined }) });
    onSignedIn(data.attendee);
  });

  if (mode === "password") return <form onSubmit={event => { event.preventDefault(); login(); }} className="space-y-4">
    <Field label="Adresse email" type="email" required autoComplete="email" value={email} onChange={setEmail} />
    <Field label="Mot de passe" type="password" required autoComplete="current-password" value={password} onChange={setPassword} />
    {needsTerms && <TermsCheckbox id="accept-terms-password" checked={acceptTerms} onChange={setAcceptTerms} />}
    <ErrorText text={error} />
    <Submit busy={busy} icon={KeyRound}>Se connecter</Submit>
    <button type="button" onClick={() => { setMode("code"); setError(""); }} className="w-full text-sm font-semibold text-blue-700 dark:text-blue-300">Recevoir plutôt un code par email</button>
  </form>;

  if (step === "email") return <form onSubmit={event => { event.preventDefault(); requestCode(); }} className="space-y-4">
    {needsName && <Field label="Nom complet" required autoComplete="name" value={fullName} onChange={setFullName} />}
    <Field label="Adresse email" type="email" required autoComplete="email" value={email} onChange={setEmail} />
    <p className="text-xs text-slate-500 dark:text-slate-400">Nous vous envoyons un code à 6 chiffres. Il ouvre votre box AccessQ, ou la crée si c’est votre premier billet.</p>
    {needsTerms && <TermsCheckbox id="accept-terms-email" checked={acceptTerms} onChange={setAcceptTerms} />}
    <ErrorText text={error} />
    <Submit busy={busy} icon={Mail}>Recevoir mon code</Submit>
    {allowPassword && <button type="button" onClick={() => { setMode("password"); setError(""); }} className="w-full text-sm font-semibold text-blue-700 dark:text-blue-300">J’ai un mot de passe</button>}
  </form>;

  return <form onSubmit={event => { event.preventDefault(); verifyCode(); }} className="space-y-4">
    {notice && <p className="rounded-xl bg-blue-50 p-3 text-sm text-blue-800 dark:bg-blue-950/40 dark:text-blue-200">{notice}</p>}
    {needsName && <Field label="Nom complet" required autoComplete="name" value={fullName} onChange={setFullName} />}
    <Field label="Code reçu par email" required inputMode="numeric" autoComplete="one-time-code" pattern="\d{6}" maxLength={6} value={code} onChange={next => setCode(next.replace(/\D/g, "").slice(0, 6))} />
    {needsTerms && <TermsCheckbox id="accept-terms-code" checked={acceptTerms} onChange={setAcceptTerms} />}
    <ErrorText text={error} />
    <Submit busy={busy} icon={KeyRound}>Valider le code</Submit>
    <div className="flex justify-between text-sm font-semibold text-blue-700 dark:text-blue-300">
      <button type="button" onClick={() => { setStep("email"); setError(""); setNotice(""); }}>Changer d’adresse</button>
      <button type="button" disabled={busy} onClick={requestCode}>Renvoyer le code</button>
    </div>
  </form>;
}

function Field({ label, onChange, ...props }) { return <label className="block text-sm font-semibold text-slate-700 dark:text-slate-200">{label}<input {...props} onChange={event => onChange(event.target.value)} className="mt-2 w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-slate-900 outline-none placeholder:text-slate-400 focus:border-blue-600 focus:ring-2 focus:ring-blue-100 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100 dark:placeholder:text-slate-500 dark:focus:border-blue-400 dark:focus:ring-blue-900/60" /></label>; }
function Submit({ busy, icon: Icon, children }) { return <button disabled={busy} className="flex w-full items-center justify-center gap-2 rounded-xl bg-blue-600 px-5 py-3 font-bold text-white disabled:opacity-60 dark:bg-blue-500 dark:text-slate-950 dark:hover:bg-blue-400">{busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Icon className="h-4 w-4" />} {children}</button>; }
function ErrorText({ text }) { return text ? <p className="rounded-xl bg-red-50 p-3 text-sm font-semibold text-red-700 dark:border dark:border-red-900/60 dark:bg-red-950/40 dark:text-red-300">{text}</p> : null; }
