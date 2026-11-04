"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { Banknote, CalendarDays, CheckCircle2, Loader2, Mail, ShieldCheck, Smartphone, Ticket, UserRound } from "lucide-react";
import AttendeeSignIn from "../../components/AttendeeSignIn";
import { attendeeFetch, attendeeJson, loadAttendee } from "../../lib/attendeeApi";
import { formatMoney } from "../../lib/boxTickets";

const api = path => `/api${path}`;
const isPaid = offer => Number(offer?.price) > 0;
const priceLabel = offer => isPaid(offer) ? formatMoney(offer.price, offer.currency) : "Gratuit";
// Clé d'idempotence conservée le temps d'une tentative : un double clic ou un rechargement ne crée pas un second achat.
const attemptKey = storageKey => {
  let key = sessionStorage.getItem(storageKey);
  if (!key) { key = crypto.randomUUID(); sessionStorage.setItem(storageKey, key); }
  return key;
};

export default function PublicRegistrationPage() {
  const { slug } = useParams();
  const router = useRouter();
  const [form, setForm] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [step, setStep] = useState(1);
  const [offerId, setOfferId] = useState("");
  const [attendee, setAttendee] = useState(null);
  const [phone, setPhone] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [providers, setProviders] = useState(null);
  const [providerKey, setProviderKey] = useState("");
  const [payerPhone, setPayerPhone] = useState("");
  const [payment, setPayment] = useState(null);

  useEffect(() => { loadAttendee().then(setAttendee).catch(() => {}); }, []);

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
  const paid = isPaid(offer);
  const pendingKey = `accessq-ticket-payment:${slug}`;

  // Opérateurs Mobile Money qui acceptent la devise de l'offre.
  useEffect(() => {
    if (step !== 3 || !paid || !form?.ticketPaymentsEnabled) return;
    setProviders(null);
    fetch(api(`/public/registrations/forms/${encodeURIComponent(slug)}/offers/${encodeURIComponent(offerId)}/providers`), { credentials: "omit" })
      .then(async response => {
        const data = await response.json();
        if (!response.ok) throw new Error(data.message || "Paiement indisponible.");
        setProviders(data.providers);
        setProviderKey(current => current || (data.providers.length === 1 ? `${data.providers[0].provider}|${data.providers[0].country}` : ""));
      })
      .catch(reason => { setProviders([]); setError(reason.message); });
  }, [step, paid, form?.ticketPaymentsEnabled, slug, offerId]);

  // Paiement en cours (y compris après un rechargement de la page) : suivi jusqu'à l'émission du billet.
  useEffect(() => {
    if (!attendee) return;
    const stored = sessionStorage.getItem(pendingKey);
    if (stored && !payment) { setPayment({ id: stored, status: "PENDING" }); setStep(3); }
  }, [attendee, pendingKey, payment]);

  useEffect(() => {
    if (!payment || !["PENDING", "PROCESSING"].includes(payment.status)) return;
    const timer = window.setTimeout(async () => {
      try {
        const next = (await attendeeJson(`/box/payments/${encodeURIComponent(payment.id)}`)).payment;
        if (next.status === "COMPLETED" && next.ticketId) {
          sessionStorage.removeItem(pendingKey);
          router.push(`/box/tickets/${encodeURIComponent(next.ticketId)}?new=1`);
          return;
        }
        if (!["PENDING", "PROCESSING"].includes(next.status)) sessionStorage.removeItem(pendingKey);
        setPayment(next);
      } catch (reason) {
        if (reason.status === 404) { sessionStorage.removeItem(pendingKey); setPayment(null); }
        else setPayment(current => ({ ...current }));
      }
    }, 3000);
    return () => window.clearTimeout(timer);
  }, [payment, pendingKey, router]);

  const signOut = async () => {
    await attendeeFetch("/attendee/logout", { method: "POST" }).catch(() => {});
    setAttendee(null);
  };

  const pay = async () => {
    const [provider, country] = providerKey.split("|");
    if (!provider) { setError("Choisissez votre opérateur Mobile Money."); return; }
    setSubmitting(true);
    setError("");
    const storageKey = `accessq-checkout-key:${slug}`;
    try {
      const response = await attendeeFetch(`/public/registrations/forms/${encodeURIComponent(slug)}/checkout`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "Idempotency-Key": attemptKey(storageKey) },
        body: JSON.stringify({ phone, offerId, provider, country, payerPhone })
      });
      const data = await response.json();
      if (response.status === 401) { setAttendee(null); setStep(2); throw new Error("Votre session a expiré. Reconnectez-vous à votre box."); }
      // Une réponse définitive (acceptée ou refusée) clôt la tentative ; une erreur de validation permet de corriger et réessayer.
      if (response.ok || response.status === 422 || response.status === 409) sessionStorage.removeItem(storageKey);
      if (!response.ok) throw new Error(data.message || "Paiement impossible.");
      sessionStorage.setItem(pendingKey, data.payment.id);
      setPayment(data.payment);
    } catch (reason) {
      setError(reason.message);
    } finally {
      setSubmitting(false);
    }
  };

  const retryPayment = () => { sessionStorage.removeItem(pendingKey); setPayment(null); setError(""); };

  const submit = async () => {
    setSubmitting(true);
    setError("");
    try {
      const storageKey = `accessq-registration-key:${slug}`;
      const key = attemptKey(storageKey);
      const response = await attendeeFetch(`/public/registrations/forms/${encodeURIComponent(slug)}/submit`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "Idempotency-Key": key },
        body: JSON.stringify({ phone, offerId })
      });
      const data = await response.json();
      if (response.status === 401) { setAttendee(null); setStep(2); throw new Error("Votre session a expiré. Reconnectez-vous à votre box."); }
      if (!response.ok) throw new Error(data.message || "Inscription impossible.");
      sessionStorage.removeItem(storageKey);
      router.push(`/box/tickets/${encodeURIComponent(data.ticketId)}?new=1`);
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
            {["Offre", "Votre box", "Récapitulatif"].map((label, index) => <span key={label} className={`flex-1 rounded-full px-3 py-2 text-center ${step === index + 1 ? "bg-blue-600 text-white dark:bg-blue-500 dark:text-slate-950" : "bg-slate-100 dark:bg-slate-800"}`}>{index + 1}. {label}</span>)}
          </div>

          {step === 1 && <div className="space-y-3">
            {form.offers.map(item => <button type="button" key={item.id} onClick={() => setOfferId(item.id)} className={`w-full rounded-2xl border p-5 text-left transition ${offerId === item.id ? "border-blue-600 bg-blue-50 ring-2 ring-blue-100 dark:border-blue-400 dark:bg-blue-950/40 dark:ring-blue-900/70" : "border-slate-200 hover:border-blue-300 dark:border-slate-700 dark:bg-slate-900/50 dark:hover:border-blue-500"}`}>
              <div className="flex items-start justify-between gap-3"><div><h2 className="font-bold text-slate-950 dark:text-slate-50">{item.name}</h2><p className="mt-1 text-sm text-slate-600 dark:text-slate-300">{item.description || (isPaid(item) ? "Billet" : "Pass gratuit")}</p></div><span className="shrink-0 text-right">{isPaid(item) ? <span className="text-lg font-black text-slate-950 dark:text-slate-50">{priceLabel(item)}</span> : <Ticket className="h-5 w-5 text-blue-600 dark:text-blue-400" />}</span></div>
              <p className="mt-3 text-xs font-semibold text-emerald-700 dark:text-emerald-400">{isPaid(item) ? "Paiement Mobile Money" : "Gratuit"} · {item.accessType === "unlimited" ? "Accès illimité" : `${item.usageLimit} passage(s)`}{item.boxOnlyQr ? " · QR visible uniquement dans votre box" : ""}</p>
            </button>)}
            <button disabled={!offerId} onClick={() => setStep(2)} className="mt-4 w-full rounded-xl bg-blue-600 px-5 py-3 font-bold text-white disabled:opacity-50">Continuer</button>
          </div>}

          {step === 2 && !attendee && <div className="space-y-4">
            <p className="text-sm text-slate-600 dark:text-slate-300">Votre billet sera déposé dans votre box AccessQ, accessible avec votre adresse email.</p>
            <AttendeeSignIn askName onSignedIn={setAttendee} />
            <button type="button" onClick={() => setStep(1)} className="w-full rounded-xl border border-slate-300 px-5 py-3 font-bold dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800">Retour</button>
          </div>}

          {step === 2 && attendee && <form onSubmit={event => { event.preventDefault(); setStep(3); }} className="space-y-4">
            <div className="flex items-center gap-3 rounded-2xl bg-slate-50 p-4 dark:bg-slate-950/70"><UserRound className="h-6 w-6 text-blue-600 dark:text-blue-400" /><div className="min-w-0 flex-1"><p className="font-bold text-slate-900 dark:text-slate-100">{attendee.fullName}</p><p className="truncate text-sm text-slate-600 dark:text-slate-300">{attendee.email}</p></div><button type="button" onClick={signOut} className="text-sm font-semibold text-blue-700 dark:text-blue-300">Changer</button></div>
            {form.askPhone && <Field label="Téléphone" type="tel" required={form.phoneRequired} value={phone} onChange={setPhone} />}
            <div className="flex gap-3"><button type="button" onClick={() => setStep(1)} className="flex-1 rounded-xl border border-slate-300 px-5 py-3 font-bold dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800">Retour</button><button className="flex-1 rounded-xl bg-blue-600 px-5 py-3 font-bold text-white dark:bg-blue-500 dark:text-slate-950 dark:hover:bg-blue-400">Continuer</button></div>
          </form>}

          {step === 3 && payment && <PaymentProgress payment={payment} onRetry={retryPayment} />}

          {step === 3 && !payment && <div className="space-y-5">
            <div className="rounded-2xl bg-slate-50 p-5 text-sm dark:bg-slate-950/70"><Summary icon={Ticket} label="Offre" value={offer?.name} /><Summary icon={UserRound} label="Titulaire" value={attendee?.fullName} /><Summary icon={Mail} label="Box" value={attendee?.email} /><Summary icon={CalendarDays} label="Événement" value={form.event?.title} />{paid && <Summary icon={Banknote} label="Total à payer" value={priceLabel(offer)} />}</div>
            {paid ? !form.ticketPaymentsEnabled
              ? <p className="rounded-xl bg-amber-50 p-3 text-sm font-semibold text-amber-800 dark:bg-amber-950/40 dark:text-amber-300">Le paiement en ligne est momentanément indisponible. Réessayez plus tard.</p>
              : <div className="space-y-4">
                {providers === null ? <Loader2 className="mx-auto h-6 w-6 animate-spin text-blue-600" />
                  : providers.length === 0 ? <p className="text-sm text-slate-600 dark:text-slate-300">Aucun opérateur Mobile Money n’accepte encore cette devise.</p>
                  : <label className="block text-sm font-semibold text-slate-700 dark:text-slate-200">Opérateur Mobile Money
                    <select value={providerKey} onChange={event => setProviderKey(event.target.value)} className="mt-2 w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-slate-900 outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-100 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100 dark:focus:border-blue-400 dark:focus:ring-blue-900/60">
                      <option value="">Sélectionner</option>
                      {providers.map(item => <option key={`${item.provider}|${item.country}`} value={`${item.provider}|${item.country}`}>{item.displayName}{item.countryDisplayName ? ` · ${item.countryDisplayName}` : ""}</option>)}
                    </select></label>}
                <Field label="Numéro Mobile Money qui paie" type="tel" required placeholder="0991234567" value={payerPhone} onChange={setPayerPhone} />
                <p className="text-xs text-slate-500 dark:text-slate-400">Vous recevrez une demande de confirmation sur ce téléphone. Le billet est ajouté à votre box dès que l’opérateur confirme le paiement. Votre place est réservée pendant quelques minutes. En payant, vous acceptez les <a href="/conditions-vente" target="_blank" rel="noopener" className="font-semibold text-blue-700 underline dark:text-blue-300">conditions de vente des billets</a>.</p>
              </div>
              : <p className="text-xs text-slate-500 dark:text-slate-400">Les droits d’accès, la validité et le modèle du billet sont ceux définis par l’organisateur. Aucun paiement n’est demandé : le billet sera ajouté à votre box.</p>}
            {error && <p className="rounded-xl bg-red-50 p-3 text-sm font-semibold text-red-700 dark:border dark:border-red-900/60 dark:bg-red-950/40 dark:text-red-300">{error}</p>}
            <div className="flex gap-3"><button type="button" disabled={submitting} onClick={() => setStep(2)} className="flex-1 rounded-xl border border-slate-300 px-5 py-3 font-bold dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800">Modifier</button><button type="button" disabled={submitting || (paid && (!form.ticketPaymentsEnabled || !providers?.length || !payerPhone))} onClick={paid ? pay : submit} className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-blue-600 px-5 py-3 font-bold text-white disabled:opacity-60 dark:bg-blue-500 dark:text-slate-950 dark:hover:bg-blue-400">{submitting && <Loader2 className="h-4 w-4 animate-spin" />} {paid ? `Payer ${priceLabel(offer)}` : "Confirmer"}</button></div>
          </div>}
        </>
      )}
      <a href="/box" className="mt-8 block text-center text-sm font-semibold text-blue-700 dark:text-blue-300">Ouvrir ma box</a>
    </Shell>
  );
}

function PaymentProgress({ payment, onRetry }) {
  if (["PENDING", "PROCESSING"].includes(payment.status)) return <div className="py-8 text-center">
    <Smartphone className="mx-auto h-10 w-10 text-blue-600 dark:text-blue-400" />
    <h2 className="mt-4 text-xl font-bold text-slate-950 dark:text-slate-50">Confirmez le paiement sur votre téléphone</h2>
    <p className="mt-2 text-slate-600 dark:text-slate-300">{payment.amount ? `${formatMoney(payment.amount, payment.currency)} · ` : ""}{payment.phoneNumber || "Mobile Money"}</p>
    <p className="mt-4 inline-flex items-center gap-2 text-sm text-slate-500 dark:text-slate-400"><Loader2 className="h-4 w-4 animate-spin" /> En attente de l’opérateur. Ne fermez pas cette page.</p>
  </div>;
  return <div className="space-y-4 py-6 text-center">
    <h2 className="text-xl font-bold text-slate-950 dark:text-slate-50">{payment.status === "REVIEW_REQUIRED" ? "Paiement en vérification" : "Paiement non abouti"}</h2>
    <p className="text-slate-600 dark:text-slate-300">{payment.failureMessage || "Le paiement n’a pas été confirmé."}</p>
    {payment.status !== "REVIEW_REQUIRED" && <button type="button" onClick={onRetry} className="w-full rounded-xl bg-blue-600 px-5 py-3 font-bold text-white dark:bg-blue-500 dark:text-slate-950">Réessayer</button>}
  </div>;
}

function Shell({ children }) { return <main className="min-h-screen bg-slate-50 px-4 py-10 dark:bg-slate-950"><div className="mx-auto max-w-xl rounded-3xl border border-slate-200 bg-white p-6 shadow-xl shadow-slate-200/50 sm:p-10 dark:border-slate-800 dark:bg-slate-900 dark:shadow-black/30">{children}</div></main>; }
function Field({ label, onChange, ...props }) { return <label className="block text-sm font-semibold text-slate-700 dark:text-slate-200">{label}<input {...props} onChange={event => onChange(event.target.value)} className="mt-2 w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-slate-900 outline-none placeholder:text-slate-400 focus:border-blue-600 focus:ring-2 focus:ring-blue-100 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100 dark:placeholder:text-slate-500 dark:focus:border-blue-400 dark:focus:ring-blue-900/60" /></label>; }
function Summary({ icon: Icon, label, value }) { return <div className="flex items-center gap-3 border-b border-slate-200 py-3 last:border-0 dark:border-slate-800"><Icon className="h-5 w-5 text-blue-600 dark:text-blue-400" /><div><p className="text-xs font-bold uppercase tracking-wide text-slate-400 dark:text-slate-500">{label}</p><p className="font-semibold text-slate-900 dark:text-slate-100">{value}</p></div></div>; }
function Message({ title, text }) { return <div className="py-10 text-center"><CheckCircle2 className="mx-auto mb-4 h-10 w-10 text-slate-400 dark:text-slate-500" /><h2 className="text-xl font-bold text-slate-900 dark:text-slate-50">{title}</h2><p className="mt-2 text-slate-600 dark:text-slate-300">{text}</p></div>; }
