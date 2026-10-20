"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { CalendarDays, CheckCircle2, Loader2, Mail, ShieldCheck, Ticket } from "lucide-react";

const api = path => `/api${path}`;

export default function PublicRegistrationPage() {
  const { slug } = useParams();
  const router = useRouter();
  const [form, setForm] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [step, setStep] = useState(1);
  const [offerId, setOfferId] = useState("");
  const [participant, setParticipant] = useState({ fullName: "", email: "", phone: "" });
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    fetch(api(`/public/registrations/forms/${encodeURIComponent(slug)}`), { credentials: "omit" })
      .then(async response => {
        const data = await response.json();
        if (!response.ok) throw new Error(data.message || "Formulaire introuvable.");
        setForm(data.form);
        setOfferId(data.form.offers?.[0]?.id || "");
      })
      .catch(reason => setError(reason.message))
      .finally(() => setLoading(false));
  }, [slug]);

  const offer = useMemo(() => form?.offers?.find(item => item.id === offerId), [form, offerId]);

  const submit = async () => {
    setSubmitting(true);
    setError("");
    try {
      const storageKey = `accessq-registration-key:${slug}`;
      let key = sessionStorage.getItem(storageKey);
      if (!key) {
        key = crypto.randomUUID();
        sessionStorage.setItem(storageKey, key);
      }
      const response = await fetch(api(`/public/registrations/forms/${encodeURIComponent(slug)}/submit`), {
        method: "POST",
        credentials: "omit",
        headers: { "Content-Type": "application/json", "Idempotency-Key": key },
        body: JSON.stringify({ ...participant, offerId })
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || "Inscription impossible.");
      sessionStorage.removeItem(storageKey);
      sessionStorage.setItem("accessq-pass-token", data.accessToken);
      router.push("/register/access");
    } catch (reason) {
      setError(reason.message);
      setSubmitting(false);
    }
  };

  if (loading) return <Shell><Loader2 className="h-8 w-8 animate-spin text-blue-600" /></Shell>;
  if (error && !form) return <Shell><Message title="Formulaire indisponible" text={error} /></Shell>;

  return (
    <Shell>
      <div className="mb-8">
        <div className="mb-4 inline-flex items-center gap-2 rounded-full bg-blue-50 px-3 py-1 text-xs font-bold text-blue-700 dark:bg-blue-950/60 dark:text-blue-300"><ShieldCheck className="h-4 w-4" /> Inscription sécurisée AccessQ</div>
        <h1 className="text-3xl font-black tracking-tight text-slate-950 dark:text-slate-50">{form.title}</h1>
        <p className="mt-3 text-slate-600 dark:text-slate-300">{form.description || form.event?.title}</p>
      </div>

      {!form.open ? <Message title="Inscriptions fermées" text="Ce formulaire n’accepte plus de nouvelles inscriptions." /> : (
        <>
          <div className="mb-8 flex gap-2 text-xs font-bold text-slate-500 dark:text-slate-400">
            {["Offre", "Informations", "Récapitulatif"].map((label, index) => <span key={label} className={`flex-1 rounded-full px-3 py-2 text-center ${step === index + 1 ? "bg-blue-600 text-white dark:bg-blue-500 dark:text-slate-950" : "bg-slate-100 dark:bg-slate-800"}`}>{index + 1}. {label}</span>)}
          </div>

          {step === 1 && <div className="space-y-3">
            {form.offers.map(item => <button type="button" key={item.id} onClick={() => setOfferId(item.id)} className={`w-full rounded-2xl border p-5 text-left transition ${offerId === item.id ? "border-blue-600 bg-blue-50 ring-2 ring-blue-100 dark:border-blue-400 dark:bg-blue-950/40 dark:ring-blue-900/70" : "border-slate-200 hover:border-blue-300 dark:border-slate-700 dark:bg-slate-900/50 dark:hover:border-blue-500"}`}>
              <div className="flex items-start justify-between gap-3"><div><h2 className="font-bold text-slate-950 dark:text-slate-50">{item.name}</h2><p className="mt-1 text-sm text-slate-600 dark:text-slate-300">{item.description || "Pass gratuit"}</p></div><Ticket className="h-5 w-5 text-blue-600 dark:text-blue-400" /></div>
              <p className="mt-3 text-xs font-semibold text-emerald-700 dark:text-emerald-400">Gratuit · {item.accessType === "unlimited" ? "Accès illimité" : `${item.usageLimit} passage(s)`}</p>
            </button>)}
            <button disabled={!offerId} onClick={() => setStep(2)} className="mt-4 w-full rounded-xl bg-blue-600 px-5 py-3 font-bold text-white disabled:opacity-50">Continuer</button>
          </div>}

          {step === 2 && <form onSubmit={event => { event.preventDefault(); setStep(3); }} className="space-y-4">
            <Field label="Nom complet" required value={participant.fullName} onChange={fullName => setParticipant(current => ({ ...current, fullName }))} />
            <Field label="Adresse email" type="email" required value={participant.email} onChange={email => setParticipant(current => ({ ...current, email }))} />
            {form.askPhone && <Field label="Téléphone" type="tel" required={form.phoneRequired} value={participant.phone} onChange={phone => setParticipant(current => ({ ...current, phone }))} />}
            <div className="flex gap-3"><button type="button" onClick={() => setStep(1)} className="flex-1 rounded-xl border border-slate-300 px-5 py-3 font-bold dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800">Retour</button><button className="flex-1 rounded-xl bg-blue-600 px-5 py-3 font-bold text-white dark:bg-blue-500 dark:text-slate-950 dark:hover:bg-blue-400">Vérifier</button></div>
          </form>}

          {step === 3 && <div className="space-y-5">
            <div className="rounded-2xl bg-slate-50 p-5 text-sm dark:bg-slate-950/70"><Summary icon={Ticket} label="Offre" value={offer?.name} /><Summary icon={Mail} label="Email" value={participant.email} /><Summary icon={CalendarDays} label="Événement" value={form.event?.title} /></div>
            <p className="text-xs text-slate-500 dark:text-slate-400">Le serveur appliquera les droits, la validité et le modèle définis par l’organisateur. Aucun paiement n’est demandé.</p>
            {error && <p className="rounded-xl bg-red-50 p-3 text-sm font-semibold text-red-700 dark:border dark:border-red-900/60 dark:bg-red-950/40 dark:text-red-300">{error}</p>}
            <div className="flex gap-3"><button type="button" disabled={submitting} onClick={() => setStep(2)} className="flex-1 rounded-xl border border-slate-300 px-5 py-3 font-bold dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800">Modifier</button><button type="button" disabled={submitting} onClick={submit} className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-blue-600 px-5 py-3 font-bold text-white disabled:opacity-60 dark:bg-blue-500 dark:text-slate-950 dark:hover:bg-blue-400">{submitting && <Loader2 className="h-4 w-4 animate-spin" />} Confirmer</button></div>
          </div>}
        </>
      )}
      <a href={`/register/recover?form=${encodeURIComponent(slug)}`} className="mt-8 block text-center text-sm font-semibold text-blue-700 dark:text-blue-300">J’ai perdu mon lien</a>
    </Shell>
  );
}

function Shell({ children }) { return <main className="min-h-screen bg-slate-50 bg-[radial-gradient(circle_at_top,_rgba(59,130,246,0.08),_transparent_38%)] px-4 py-10 dark:bg-slate-950 dark:bg-[radial-gradient(circle_at_top,_rgba(37,99,235,0.16),_transparent_42%)]"><div className="mx-auto max-w-xl rounded-3xl border border-slate-200 bg-white p-6 shadow-xl shadow-slate-200/50 sm:p-10 dark:border-slate-800 dark:bg-slate-900 dark:shadow-black/30">{children}</div></main>; }
function Field({ label, onChange, ...props }) { return <label className="block text-sm font-semibold text-slate-700 dark:text-slate-200">{label}<input {...props} onChange={event => onChange(event.target.value)} className="mt-2 w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-slate-900 outline-none placeholder:text-slate-400 focus:border-blue-600 focus:ring-2 focus:ring-blue-100 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100 dark:placeholder:text-slate-500 dark:focus:border-blue-400 dark:focus:ring-blue-900/60" /></label>; }
function Summary({ icon: Icon, label, value }) { return <div className="flex items-center gap-3 border-b border-slate-200 py-3 last:border-0 dark:border-slate-800"><Icon className="h-5 w-5 text-blue-600 dark:text-blue-400" /><div><p className="text-xs font-bold uppercase tracking-wide text-slate-400 dark:text-slate-500">{label}</p><p className="font-semibold text-slate-900 dark:text-slate-100">{value}</p></div></div>; }
function Message({ title, text }) { return <div className="py-10 text-center"><CheckCircle2 className="mx-auto mb-4 h-10 w-10 text-slate-400 dark:text-slate-500" /><h2 className="text-xl font-bold text-slate-900 dark:text-slate-50">{title}</h2><p className="mt-2 text-slate-600 dark:text-slate-300">{text}</p></div>; }
