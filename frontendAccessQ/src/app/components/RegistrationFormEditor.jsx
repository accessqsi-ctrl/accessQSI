"use client";

import { useEffect, useState } from "react";
import { Loader2, Plus, Trash2 } from "lucide-react";
import { apiFetch } from "../lib/api";
import { useUserPlan } from "../lib/useUserPlan";
import { fromDateTimeLocal } from "../lib/dateTimeLocal.mjs";

// Les champs datetime-local sont en heure locale : l'API reçoit des instants UTC.
const toApiDates = form => ({ ...form, opensAt: fromDateTimeLocal(form.opensAt), closesAt: fromDateTimeLocal(form.closesAt), offers: form.offers.map(offer => ({ ...offer, validFrom: fromDateTimeLocal(offer.validFrom), validUntil: fromDateTimeLocal(offer.validUntil) })) });
const emptyOffer = () => ({ name: "", description: "", capacity: "", accessType: "single", usageLimit: 1, level: 1, validFrom: "", validUntil: "", cardTemplateId: "event-ticket", cardMessage: "" });
const templates = [
  ["event-ticket", "Billet événement"], ["access-pass", "Pass d’accès"], ["vip-pass", "Pass VIP"], ["staff-badge-horizontal", "Badge horizontal"]
];

export default function RegistrationFormEditor({ initial, onSaved }) {
  const [events, setEvents] = useState([]);
  const [templateOptions, setTemplateOptions] = useState(templates);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [value, setValue] = useState(() => initial || { eventId: "", title: "", description: "", opensAt: "", closesAt: "", askPhone: false, phoneRequired: false, offers: [emptyOffer()] });
  const { profileLoading, hasCapability, planName } = useUserPlan();
  const canUseCustomTemplates = hasCapability("custom_card_templates");
  const canUseMultipleOffers = hasCapability("multiple_registration_offers");

  useEffect(() => { apiFetch("/events").then(response => response.json()).then(data => setEvents(data.events || [])).catch(() => setError("Impossible de charger les événements.")); }, []);
  useEffect(() => {
    if (profileLoading || !canUseCustomTemplates) return;
    apiFetch("/card-templates/custom").then(response => response.json()).then(data => {
    if (data.success) setTemplateOptions([...templates, ...(data.templates || []).filter(item => (item.status || "PUBLISHED") === "PUBLISHED").map(item => [item.templateId, item.name])]);
    }).catch(() => {});
  }, [canUseCustomTemplates, profileLoading]);

  const changeOffer = (index, field, next) => setValue(current => ({ ...current, offers: current.offers.map((offer, offerIndex) => offerIndex === index ? { ...offer, [field]: next } : offer) }));
  const submit = async event => {
    event.preventDefault(); setSaving(true); setError("");
    try {
      const response = await apiFetch(initial?.id ? `/registration-forms/${initial.id}` : "/registration-forms", { method: initial?.id ? "PUT" : "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(toApiDates(value)) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || "Enregistrement impossible.");
      onSaved(data.form);
    } catch (reason) { setError(reason.message); }
    finally { setSaving(false); }
  };

  return <form onSubmit={submit} className="space-y-6">
    <section className="aq-panel p-6"><h2 className="text-lg font-bold text-slate-950 dark:text-slate-50">Informations du formulaire</h2><div className="mt-5 grid gap-4 md:grid-cols-2">
      <Select label="Événement" required value={value.eventId} disabled={Boolean(initial?.id)} onChange={eventId => setValue(current => ({ ...current, eventId }))} options={events.map(event => [event.id, event.name])} />
      <Field label="Titre public" required value={value.title} onChange={title => setValue(current => ({ ...current, title }))} />
      <label className="md:col-span-2 text-sm font-semibold">Description<textarea value={value.description} onChange={event => setValue(current => ({ ...current, description: event.target.value }))} rows={3} className="mt-2 w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-slate-900 outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-100 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100 dark:focus:border-blue-400 dark:focus:ring-blue-900/60" /></label>
      <Field label="Ouverture (facultative)" type="datetime-local" value={value.opensAt} onChange={opensAt => setValue(current => ({ ...current, opensAt }))} />
      <Field label="Fermeture (facultative)" type="datetime-local" value={value.closesAt} onChange={closesAt => setValue(current => ({ ...current, closesAt }))} />
      <label className="flex items-center gap-2 text-sm font-semibold"><input type="checkbox" checked={value.askPhone} onChange={event => setValue(current => ({ ...current, askPhone: event.target.checked, phoneRequired: event.target.checked ? current.phoneRequired : false }))} /> Demander le téléphone</label>
      <label className="flex items-center gap-2 text-sm font-semibold"><input type="checkbox" disabled={!value.askPhone} checked={value.phoneRequired} onChange={event => setValue(current => ({ ...current, phoneRequired: event.target.checked }))} /> Téléphone obligatoire</label>
    </div></section>

    <section className="aq-panel p-6"><div className="flex items-center justify-between gap-4"><div><h2 className="text-lg font-bold text-slate-950 dark:text-slate-50">Offres gratuites</h2><p className="mt-1 text-sm text-slate-500 dark:text-slate-400">{initial?.registrationCount > 0 ? "Les changements concerneront seulement les futures inscriptions ; les inscriptions acceptées conservent leur snapshot." : "Les droits et le modèle sont toujours appliqués par le serveur."}</p></div><button type="button" disabled={profileLoading || !canUseMultipleOffers} title={!canUseMultipleOffers ? "Disponible à partir du plan Essential" : "Ajouter une offre"} onClick={() => setValue(current => ({ ...current, offers: [...current.offers, emptyOffer()] }))} className="aq-button-primary disabled:cursor-not-allowed disabled:opacity-45"><Plus className="h-4 w-4" /> Offre</button></div>
      {!profileLoading && (!canUseMultipleOffers || !canUseCustomTemplates) && <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900 dark:border-amber-900/60 dark:bg-amber-950/20 dark:text-amber-200"><strong>Plan {planName}.</strong> {!canUseMultipleOffers && "Ce forfait permet une offre par formulaire. Essential débloque les formulaires multi-offres. "}{!canUseCustomTemplates && "Pro débloque les modèles graphiques personnalisés."}</div>}
      <div className="mt-5 space-y-5">{value.offers.map((offer, index) => <div key={index} className="rounded-2xl border border-slate-200 p-5 dark:border-slate-800 dark:bg-slate-950/40"><div className="mb-4 flex justify-between"><strong>Offre {index + 1}</strong>{value.offers.length > 1 && <button type="button" onClick={() => setValue(current => ({ ...current, offers: current.offers.filter((_, i) => i !== index) }))} className="text-red-600 dark:text-red-400"><Trash2 className="h-4 w-4" /></button>}</div><div className="grid gap-4 md:grid-cols-2">
        <Field label="Nom" required value={offer.name} onChange={next => changeOffer(index, "name", next)} /><Field label="Capacité (vide = illimitée)" type="number" min="1" value={offer.capacity} onChange={next => changeOffer(index, "capacity", next)} />
        <Select label="Type d’accès" value={offer.accessType} onChange={next => changeOffer(index, "accessType", next)} options={[["single", "Un passage"], ["multi", "Plusieurs passages"], ["unlimited", "Illimité"]]} />
        <Field label="Nombre de passages" type="number" min="1" disabled={offer.accessType !== "multi"} value={offer.usageLimit} onChange={next => changeOffer(index, "usageLimit", next)} />
        <Field label="Niveau d’accès" type="number" min="1" value={offer.level} onChange={next => changeOffer(index, "level", next)} />
        <Select label="Modèle du pass" value={offer.cardTemplateId} onChange={next => changeOffer(index, "cardTemplateId", next)} options={templateOptions} />
        <Field label="Valide à partir de" type="datetime-local" value={offer.validFrom} onChange={next => changeOffer(index, "validFrom", next)} />
        <Field label="Valide jusqu’au" type="datetime-local" value={offer.validUntil} onChange={next => changeOffer(index, "validUntil", next)} />
        <div className="md:col-span-2"><Field label="Message sur le pass" value={offer.cardMessage} onChange={next => changeOffer(index, "cardMessage", next)} /></div>
      </div></div>)}</div>
    </section>
    {error && <p className="rounded-xl bg-red-50 p-4 text-sm font-semibold text-red-700 dark:border dark:border-red-900/60 dark:bg-red-950/40 dark:text-red-300">{error}</p>}
    <button disabled={saving} className="aq-button-primary min-w-48">{saving && <Loader2 className="h-4 w-4 animate-spin" />} {initial?.id ? "Enregistrer" : "Créer le formulaire"}</button>
  </form>;
}

function Field({ label, onChange, ...props }) { return <label className="block text-sm font-semibold">{label}<input {...props} onChange={event => onChange(event.target.value)} className="mt-2 w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-slate-900 outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-100 disabled:bg-slate-100 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100 dark:focus:border-blue-400 dark:focus:ring-blue-900/60 dark:disabled:bg-slate-800 dark:disabled:text-slate-500" /></label>; }
function Select({ label, options, onChange, ...props }) { return <label className="block text-sm font-semibold">{label}<select {...props} onChange={event => onChange(event.target.value)} className="mt-2 w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-slate-900 outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-100 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100 dark:focus:border-blue-400 dark:focus:ring-blue-900/60"><option value="">Sélectionner</option>{options.map(([id, text]) => <option key={id} value={id}>{text}</option>)}</select></label>; }
