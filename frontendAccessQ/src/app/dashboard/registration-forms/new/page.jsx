"use client";

import { Suspense } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { CalendarDays } from "lucide-react";
import RegistrationFormEditor from "../../../components/RegistrationFormEditor";

// Un formulaire se crée depuis la page d'un événement : l'événement est fixé et partage son quota de QR.
export default function NewRegistrationFormPage() {
  return <Suspense fallback={null}><NewRegistrationForm /></Suspense>;
}

function NewRegistrationForm() {
  const router = useRouter();
  const eventId = useSearchParams().get("eventId");
  if (!eventId) return <div className="aq-page"><div className="aq-panel p-10 text-center"><CalendarDays className="mx-auto h-10 w-10 text-blue-600 dark:text-blue-400" /><h1 className="mt-4 text-xl font-bold text-slate-950 dark:text-slate-50">Choisissez d’abord un événement</h1><p className="mt-2 text-slate-600 dark:text-slate-300">Les formulaires d’inscription et la billetterie se créent depuis la page de l’événement concerné.</p><Link href="/dashboard/events" className="aq-button-primary mt-6 inline-flex">Voir mes événements</Link></div></div>;
  return <div className="aq-page space-y-6"><div className="aq-page-header"><div><Link href={`/dashboard/events/${encodeURIComponent(eventId)}`} className="text-sm font-semibold text-blue-700 dark:text-blue-300">← Retour à l’événement</Link><h1 className="aq-page-title mt-2">Nouveau formulaire</h1><p className="aq-page-subtitle">Configurez les informations demandées et les offres, gratuites ou payantes.</p></div></div><RegistrationFormEditor fixedEventId={eventId} onSaved={form => router.push(`/dashboard/registration-forms/${form.id}`)} /></div>;
}
