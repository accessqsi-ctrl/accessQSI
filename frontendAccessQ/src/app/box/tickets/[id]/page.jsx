"use client";

import { Suspense, useEffect, useState } from "react";
import { useParams, useSearchParams } from "next/navigation";
import { ArrowLeft, CalendarDays, CheckCircle2, Download, EyeOff, Loader2, MapPin, RotateCw, ShieldCheck } from "lucide-react";
import BoxShell, { Card, SecureBoxCard } from "../../../components/BoxShell";
import { attendeeFetch, attendeeJson } from "../../../lib/attendeeApi";
import { formatDate, ticketBadge } from "../../../lib/boxTickets";

export default function TicketPage() {
  return <Suspense fallback={<main className="min-h-screen bg-slate-50 p-12 text-center text-slate-700 dark:bg-slate-950 dark:text-slate-300">Chargement…</main>}>
    <BoxShell>{({ attendee, setAttendee }) => <TicketDetail attendee={attendee} setAttendee={setAttendee} />}</BoxShell>
  </Suspense>;
}

function TicketDetail({ attendee, setAttendee }) {
  const { id } = useParams();
  const isNew = useSearchParams().get("new") === "1";
  const [ticket, setTicket] = useState(null);
  const [qrUrl, setQrUrl] = useState("");
  const [qrExpiresAt, setQrExpiresAt] = useState(null);
  const [now, setNow] = useState(() => Date.now());
  const concealed = usePageConcealed();
  const [error, setError] = useState("");
  const [downloading, setDownloading] = useState(false);

  useEffect(() => {
    let timer;
    const load = async () => {
      try {
        const data = await attendeeJson(`/box/tickets/${encodeURIComponent(id)}`);
        setTicket(data.ticket);
        if (data.ticket.status === "PROCESSING") timer = window.setTimeout(load, 2000);
      } catch (reason) { setError(reason.message); }
    };
    load();
    return () => window.clearTimeout(timer);
  }, [id]);

  // Le QR est servi comme image privée : jamais mis en cache ni exposé dans une URL partageable.
  // Billet « box uniquement » : le QR tourne, il est rechargé à chaque échéance tant que la page est visible.
  useEffect(() => {
    if (!ticket?.qrAvailable || concealed) return;
    let objectUrl = "";
    let timer;
    let cancelled = false;
    const load = async () => {
      try {
        const response = await attendeeFetch(`/box/tickets/${encodeURIComponent(id)}/qr`);
        if (!response.ok) throw new Error((await response.json().catch(() => ({}))).message || "QR indisponible.");
        const expiresAt = response.headers.get("X-Qr-Expires-At");
        const nextUrl = URL.createObjectURL(await response.blob());
        if (cancelled) return URL.revokeObjectURL(nextUrl);
        if (objectUrl) URL.revokeObjectURL(objectUrl);
        objectUrl = nextUrl;
        setQrUrl(nextUrl);
        setQrExpiresAt(expiresAt ? Date.parse(expiresAt) : null);
        if (expiresAt) timer = window.setTimeout(load, Math.max(1000, Date.parse(expiresAt) - Date.now() + 300));
      } catch (reason) { if (!cancelled) setError(reason.message); }
    };
    load();
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
      if (objectUrl) URL.revokeObjectURL(objectUrl);
      setQrUrl("");
    };
  }, [id, ticket?.qrAvailable, concealed]);

  useEffect(() => {
    if (!qrExpiresAt) return;
    const interval = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(interval);
  }, [qrExpiresAt]);

  const download = async () => {
    setDownloading(true); setError("");
    try {
      const response = await attendeeFetch(`/box/tickets/${encodeURIComponent(id)}/pdf`);
      if (!response.ok) throw new Error((await response.json().catch(() => ({}))).message || "Téléchargement impossible.");
      const url = URL.createObjectURL(await response.blob());
      const anchor = document.createElement("a");
      anchor.href = url; anchor.download = "billet-accessq.pdf"; anchor.click();
      URL.revokeObjectURL(url);
    } catch (reason) { setError(reason.message); }
    finally { setDownloading(false); }
  };

  if (error && !ticket) return <Card><State icon={RotateCw} title="Billet indisponible" text={error} /><BackLink /></Card>;
  if (!ticket) return <div className="py-20 text-center"><Loader2 className="mx-auto h-8 w-8 animate-spin text-blue-600" /></div>;

  const badge = ticketBadge(ticket);
  return <div className="space-y-5">
    {isNew && ticket.status !== "FAILED" && <div className="flex items-center gap-3 rounded-2xl bg-emerald-50 p-4 text-sm font-semibold text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300"><CheckCircle2 className="h-5 w-5 shrink-0" /> Votre billet a été ajouté à votre box.</div>}
    {isNew && <SecureBoxCard attendee={attendee} onSecured={setAttendee} />}
    <Card>
      <BackLink />
      <div className="mt-4 flex items-start justify-between gap-3">
        <div className="min-w-0"><h1 className="text-2xl font-black text-slate-950 dark:text-slate-50">{ticket.event.title}</h1><p className="mt-1 text-slate-600 dark:text-slate-300">{ticket.offerName} · {ticket.holderName}</p></div>
        <span className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-bold ${badge.className}`}>{badge.label}</span>
      </div>
      <div className="mt-4 space-y-1 text-sm text-slate-600 dark:text-slate-300">
        {ticket.event.startsAt && <p className="flex items-center gap-2"><CalendarDays className="h-4 w-4" /> {formatDate(ticket.event.startsAt)}</p>}
        {ticket.event.venue && <p className="flex items-center gap-2"><MapPin className="h-4 w-4" /> {ticket.event.venue}</p>}
        <p>{ticket.accessType === "unlimited" ? "Accès illimité" : `${ticket.scansCount} / ${ticket.usageLimit} passage(s) utilisé(s)`}</p>
      </div>

      {ticket.status === "PROCESSING" ? <State spin title="Création de votre billet" text="Cette page se met à jour automatiquement." />
        : ticket.status === "FAILED" ? <State icon={RotateCw} title="Traitement interrompu" text={ticket.failureMessage || "L’organisateur peut relancer la création de votre billet."} />
        : ticket.qrAvailable && <div className="mt-6 text-center">
          <div className="relative mx-auto w-full max-w-xs select-none rounded-2xl bg-white p-4 ring-1 ring-slate-200" onContextMenu={event => event.preventDefault()}>
            {concealed ? <div className="flex aspect-square items-center justify-center text-sm font-semibold text-slate-500"><EyeOff className="mr-2 h-5 w-5" /> QR masqué</div>
              : qrUrl ? <img src={qrUrl} alt="QR du billet" draggable={false} className="pointer-events-none h-auto w-full" />
              : <Loader2 className="mx-auto my-24 h-8 w-8 animate-spin text-blue-600" />}
            {ticket.boxOnlyQr && qrUrl && !concealed && <div className="mt-2 text-xs font-semibold text-slate-700"><p className="truncate">{ticket.holderName} · {new Date(now).toLocaleTimeString("fr-FR")}</p>{qrExpiresAt && <div className="mt-1 h-1 overflow-hidden rounded-full bg-slate-200"><div className="h-full bg-blue-600 transition-[width] duration-1000 ease-linear" style={{ width: `${Math.max(0, Math.min(100, ((qrExpiresAt - now) / 30000) * 100))}%` }} /></div>}</div>}
          </div>
          <p className="mt-3 text-sm text-slate-600 dark:text-slate-300">Présentez ce QR à l’entrée.</p>
          {ticket.boxOnlyQr
            ? <p className="mt-4 inline-flex items-center gap-2 text-xs font-semibold text-slate-500 dark:text-slate-400"><ShieldCheck className="h-4 w-4 shrink-0" /> Ce QR change toutes les 30 secondes : une capture d’écran sera refusée à l’entrée.</p>
            : ticket.pdfAvailable && <button onClick={download} disabled={downloading} className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-xl border border-slate-300 px-5 py-3 font-bold text-slate-800 disabled:opacity-60 dark:border-slate-700 dark:text-slate-100">{downloading ? <Loader2 className="h-5 w-5 animate-spin" /> : <Download className="h-5 w-5" />} Télécharger le PDF</button>}
        </div>}
      {error && <p className="mt-4 rounded-xl bg-red-50 p-3 text-sm font-semibold text-red-700 dark:bg-red-950/40 dark:text-red-300">{error}</p>}
    </Card>
  </div>;
}

// Masque le QR quand la page n'est plus au premier plan (sélecteur d'applications, enregistreur d'écran, autre fenêtre).
function usePageConcealed() {
  const [concealed, setConcealed] = useState(false);
  useEffect(() => {
    const update = () => setConcealed(document.visibilityState !== "visible" || !document.hasFocus());
    update();
    window.addEventListener("blur", update);
    window.addEventListener("focus", update);
    document.addEventListener("visibilitychange", update);
    return () => {
      window.removeEventListener("blur", update);
      window.removeEventListener("focus", update);
      document.removeEventListener("visibilitychange", update);
    };
  }, []);
  return concealed;
}

function BackLink() { return <a href="/box" className="inline-flex items-center gap-1 text-sm font-semibold text-blue-700 dark:text-blue-300"><ArrowLeft className="h-4 w-4" /> Mes billets</a>; }
function State({ icon: Icon, spin, title, text }) { return <div className="py-8 text-center">{spin ? <Loader2 className="mx-auto h-10 w-10 animate-spin text-blue-600 dark:text-blue-400" /> : <Icon className="mx-auto h-10 w-10 text-blue-600 dark:text-blue-400" />}<h2 className="mt-4 text-xl font-bold text-slate-950 dark:text-slate-50">{title}</h2><p className="mt-2 text-slate-600 dark:text-slate-300">{text}</p></div>; }
