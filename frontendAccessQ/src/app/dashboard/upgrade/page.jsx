"use client";

import {
    Check,
    CheckCircle2,
    Clock3,
    LoaderCircle,
    RefreshCw,
    ShieldCheck,
    Smartphone,
    TicketCheck,
    XCircle
} from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { apiFetch } from "../../lib/api";
import { useUserPlan } from "../../lib/useUserPlan";

const PAYMENTS_ENABLED = process.env.NEXT_PUBLIC_PRO_PAYMENTS_ENABLED === "true";
const PURCHASABLE = ["ESSENTIAL", "PRO", "EVENT_PASS"];
const statusPresentation = {
    PENDING: { label: "En attente", className: "bg-amber-50 text-amber-700", icon: Clock3 },
    PROCESSING: { label: "En traitement", className: "bg-blue-50 text-blue-700", icon: LoaderCircle },
    COMPLETED: { label: "Payé", className: "bg-emerald-50 text-emerald-700", icon: CheckCircle2 },
    FAILED: { label: "Échoué", className: "bg-red-50 text-red-700", icon: XCircle },
    EXPIRED: { label: "Expiré", className: "bg-slate-100 text-slate-700", icon: XCircle },
    REFUND_PENDING: { label: "Remboursement", className: "bg-purple-50 text-purple-700", icon: LoaderCircle },
    REFUNDED: { label: "Remboursé", className: "bg-slate-100 text-slate-700", icon: CheckCircle2 },
    REVIEW_REQUIRED: { label: "À vérifier", className: "bg-orange-50 text-orange-700", icon: ShieldCheck }
};

const formatMoney = (amount, currency = "USD") => new Intl.NumberFormat("fr-CD", {
    style: "currency",
    currency,
    maximumFractionDigits: 0
}).format(Number(amount || 0));

const formatDate = (value) => value
    ? new Intl.DateTimeFormat("fr-CD", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value))
    : "—";

const intervalForPlan = (planKey, annualBilling) => {
    if (planKey === "EVENT_PASS") return "ONE_TIME";
    if (["ESSENTIAL", "PRO"].includes(planKey) && annualBilling) return "ANNUAL";
    return "MONTHLY";
};

const providerPriceKey = (planKey, interval) => {
    if (planKey === "EVENT_PASS") return "EVENT_PASS";
    return `${planKey}_${interval}`;
};

export default function UpgradePage() {
    const { plan, planName, refreshPlan } = useUserPlan();
    const [plans, setPlans] = useState([]);
    const [providers, setProviders] = useState([]);
    const [billing, setBilling] = useState({ subscription: null, payments: [], eventPasses: [] });
    const [selectedPlan, setSelectedPlan] = useState("ESSENTIAL");
    const [annualPlans, setAnnualPlans] = useState({ ESSENTIAL: false, PRO: false });
    const [form, setForm] = useState({ country: "", provider: "", phoneNumber: "" });
    const [loading, setLoading] = useState(true);
    const [submitting, setSubmitting] = useState(false);
    const [refreshingId, setRefreshingId] = useState(null);
    const [activeDepositId, setActiveDepositId] = useState(null);
    const [notice, setNotice] = useState(null);
    const [changingSubscription, setChangingSubscription] = useState(false);
    const [resourceOptions, setResourceOptions] = useState({ agents: [], areas: [] });
    const [retainedResources, setRetainedResources] = useState({ agentIds: [], areaIds: [] });
    const [quote, setQuote] = useState(null);

    const availablePlans = useMemo(
        () => plans.filter((item) => ["DISCOVERY", ...PURCHASABLE, "ENTERPRISE"].includes(item.key)),
        [plans]
    );
    const chosenPlan = useMemo(
        () => plans.find((item) => item.key === selectedPlan),
        [plans, selectedPlan]
    );
    const interval = intervalForPlan(selectedPlan, Boolean(annualPlans[selectedPlan]));
    const countries = useMemo(() => {
        const entries = new Map();
        providers.forEach((provider) => {
            if (!provider.country || entries.has(provider.country)) return;
            const localized = typeof provider.countryDisplayName === "object"
                ? provider.countryDisplayName.fr || provider.countryDisplayName.en
                : provider.countryDisplayName;
            entries.set(provider.country, localized || provider.country);
        });
        return Array.from(entries, ([code, name]) => ({ code, name })).sort((a, b) => a.name.localeCompare(b.name, "fr"));
    }, [providers]);
    const countryProviders = useMemo(
        () => providers.filter((provider) => provider.country === form.country),
        [providers, form.country]
    );
    const selectedProvider = useMemo(
        () => providers.find((provider) => provider.country === form.country && provider.provider === form.provider),
        [providers, form.country, form.provider]
    );
    const localPrice = selectedProvider?.prices?.[providerPriceKey(selectedPlan, interval)] ?? null;
    const referencePrice = interval === "ANNUAL" ? chosenPlan?.annualPrice : chosenPlan?.price;

    const loadBilling = useCallback(async ({ silent = false } = {}) => {
        if (!silent) setLoading(true);
        try {
            const requests = [apiFetch("/billing/plans"), apiFetch("/billing")];
            if (PAYMENTS_ENABLED) requests.push(apiFetch("/billing/providers"));
            const responses = await Promise.all(requests);
            const payloads = await Promise.all(responses.map((response) => response.json()));
            if (!responses[0].ok) throw new Error(payloads[0].message || "Impossible de charger les offres.");
            if (!responses[1].ok) throw new Error(payloads[1].message || "Impossible de charger la facturation.");
            setPlans(payloads[0].plans || []);
            setBilling({
                subscription: payloads[1].subscription || null,
                payments: payloads[1].payments || [],
                eventPasses: payloads[1].eventPasses || []
            });
            const availableProviders = responses[2]?.ok ? payloads[2].providers || [] : [];
            setProviders(availableProviders);
            setForm((current) => ({
                ...current,
                country: current.country || availableProviders[0]?.country || "",
                provider: current.provider || availableProviders[0]?.provider || ""
            }));
        } catch (error) {
            setNotice({ type: "error", text: error.message });
        } finally {
            if (!silent) setLoading(false);
        }
    }, []);

    useEffect(() => { loadBilling(); }, [loadBilling]);

    useEffect(() => {
        if (!PAYMENTS_ENABLED || !form.country || !form.provider || !selectedPlan) {
            setQuote(null);
            return;
        }
        let active = true;
        apiFetch("/billing/quote", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ plan: selectedPlan, billingInterval: interval, country: form.country, provider: form.provider })
        }).then(async (response) => {
            const data = await response.json();
            if (active) setQuote(response.ok ? data.quote : null);
        }).catch(() => { if (active) setQuote(null); });
        return () => { active = false; };
    }, [form.country, form.provider, selectedPlan, interval]);

    useEffect(() => {
        const change = billing.subscription?.pendingChange;
        if (!change || !["DOWNGRADE", "INTERVAL_CHANGE"].includes(change.type)) return;
        let active = true;
        Promise.all([apiFetch("/agents"), apiFetch("/areas")])
            .then(async (responses) => Promise.all(responses.map((response) => response.json())))
            .then(([agentsPayload, areasPayload]) => {
                if (!active) return;
                const agents = (agentsPayload.agents || []).filter((agent) => agent.status === "Actif");
                const areas = (areasPayload.areas || []).filter((area) => !area.suspended_by_plan);
                setResourceOptions({ agents, areas });
                const saved = change.resourceSelection;
                const target = plans.find((item) => item.key === (change.toPlan || "DISCOVERY"));
                setRetainedResources({
                    agentIds: saved?.agentIds || agents.slice(0, target?.limits?.agents ?? agents.length).map((agent) => agent.id),
                    areaIds: saved?.areaIds || areas.slice(0, target?.limits?.areas ?? areas.length).map((area) => area.area_id)
                });
            })
            .catch(() => {});
        return () => { active = false; };
    }, [billing.subscription?.pendingChange, plans]);

    const refreshPayment = useCallback(async (depositId, { automatic = false } = {}) => {
        if (!automatic) setRefreshingId(depositId);
        try {
            const response = await apiFetch(`/billing/payments/${depositId}/refresh`, { method: "POST" });
            const data = await response.json();
            if (!response.ok) throw new Error(data.message || "Impossible de vérifier le paiement.");
            setBilling((current) => ({
                ...current,
                payments: current.payments.map((item) => item.depositId === depositId ? data.payment : item)
            }));
            if (data.payment.status === "COMPLETED") {
                setActiveDepositId(null);
                setNotice({ type: "success", text: data.payment.plan === "EVENT_PASS" ? "Pass acheté. Vous pouvez maintenant l’attribuer à un événement." : "Paiement confirmé. Votre abonnement est actif." });
                await Promise.all([loadBilling({ silent: true }), refreshPlan()]);
            } else if (data.payment.status === "FAILED") {
                setActiveDepositId(null);
                setNotice({ type: "error", text: data.payment.failureMessage || "Le paiement a échoué." });
            }
        } catch (error) {
            if (!automatic) setNotice({ type: "error", text: error.message });
        } finally {
            if (!automatic) setRefreshingId(null);
        }
    }, [loadBilling, refreshPlan]);

    useEffect(() => {
        if (!activeDepositId) return undefined;
        const timer = window.setInterval(() => refreshPayment(activeDepositId, { automatic: true }), 5000);
        return () => window.clearInterval(timer);
    }, [activeDepositId, refreshPayment]);

    const submitPayment = async (event) => {
        event.preventDefault();
        setSubmitting(true);
        setNotice(null);
        try {
            const response = await apiFetch("/billing/payments", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    plan: selectedPlan,
                    billingInterval: interval,
                    country: form.country,
                    provider: form.provider,
                    phoneNumber: form.phoneNumber
                })
            });
            const data = await response.json();
            if (!response.ok) throw new Error(data.message || "Impossible de démarrer le paiement.");
            setBilling((current) => ({ ...current, payments: [data.payment, ...current.payments] }));
            setActiveDepositId(data.payment.depositId);
            setNotice({ type: "info", text: "Demande envoyée. Confirmez le paiement sur votre téléphone." });
        } catch (error) {
            setNotice({ type: "error", text: error.message });
        } finally {
            setSubmitting(false);
        }
    };

    const updateSubscription = async (action) => {
        setChangingSubscription(true);
        setNotice(null);
        try {
            const response = await apiFetch(
                action === "cancel" ? "/billing/subscription/cancel" : "/billing/subscription/change",
                { method: action === "cancel" ? "POST" : "DELETE" }
            );
            const data = await response.json();
            if (!response.ok) throw new Error(data.message || "Impossible de modifier l’abonnement.");
            setNotice({ type: "success", text: data.message });
            await loadBilling({ silent: true });
        } catch (error) {
            setNotice({ type: "error", text: error.message });
        } finally {
            setChangingSubscription(false);
        }
    };

    const saveRetainedResources = async () => {
        setChangingSubscription(true);
        try {
            const response = await apiFetch("/billing/subscription/change/resources", {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(retainedResources)
            });
            const data = await response.json();
            if (!response.ok) throw new Error(data.message || "Impossible d’enregistrer la sélection.");
            setNotice({ type: "success", text: data.message });
            await loadBilling({ silent: true });
        } catch (error) {
            setNotice({ type: "error", text: error.message });
        } finally {
            setChangingSubscription(false);
        }
    };

    const toggleRetained = (key, id, limit) => {
        setRetainedResources((current) => {
            const selected = current[key];
            if (selected.includes(id)) return { ...current, [key]: selected.filter((item) => item !== id) };
            if (limit != null && selected.length >= limit) return current;
            return { ...current, [key]: [...selected, id] };
        });
    };

    if (loading) return <div className="flex min-h-[60vh] items-center justify-center"><LoaderCircle className="h-8 w-8 animate-spin text-blue-600" /></div>;

    const payableAmount = quote?.amount ?? localPrice;
    const canPay = Boolean(PAYMENTS_ENABLED && selectedProvider && payableAmount != null && form.phoneNumber && !activeDepositId);
    const activePasses = billing.eventPasses.filter((item) => item.status === "AVAILABLE");

    return (
        <div className="aq-page flex flex-col gap-6">
            <section className="rounded-3xl bg-slate-950 p-7 text-white shadow-xl dark:bg-gradient-to-br dark:from-slate-950 dark:via-blue-950 dark:to-blue-700 lg:p-10">
                <div className="flex flex-col justify-between gap-6 md:flex-row md:items-end">
                    <div>
                        <p className="text-sm font-bold uppercase tracking-[0.2em] text-blue-200">Offres AccessQ</p>
                        <h1 className="mt-3 text-3xl font-black sm:text-4xl">Un tarif adapté à chaque événement</h1>
                        <p className="mt-3 max-w-2xl text-blue-100">Les événements se renouvellent chaque mois. Les QR restent rattachés à leur événement et les agents/zones sont comptés lorsqu’ils sont actifs.</p>
                    </div>
                    <div className="rounded-2xl border border-white/20 bg-white/10 px-5 py-4 backdrop-blur">
                        <p className="text-xs uppercase tracking-wider text-blue-200">Plan actuel</p>
                        <p className="mt-1 text-2xl font-black">{planName || "Découverte"}</p>
                        {billing.subscription?.expiresAt && <p className="mt-1 text-xs text-blue-100">Valide jusqu’au {formatDate(billing.subscription.expiresAt)}</p>}
                    </div>
                </div>
            </section>

            {notice && <div role="status" className={`rounded-2xl border px-4 py-3 text-sm ${notice.type === "success" ? "border-emerald-200 bg-emerald-50 text-emerald-800" : notice.type === "error" ? "border-red-200 bg-red-50 text-red-800" : "border-blue-200 bg-blue-50 text-blue-800"}`}>{notice.text}</div>}

            {billing.subscription?.pendingChange ? (
                <section className="rounded-2xl border border-amber-200 bg-amber-50 p-5 text-amber-950">
                    <div className="flex flex-col justify-between gap-4 md:flex-row md:items-center">
                      <div>
                        <p className="font-bold">{billing.subscription.pendingChange.type === "CANCEL" ? "Non-renouvellement programmé" : `Changement programmé : ${billing.subscription.pendingChange.toPlan || "Découverte"}`}</p>
                        <p className="mt-1 text-sm">Prise d’effet le {formatDate(billing.subscription.pendingChange.effectiveAt)} · statut {billing.subscription.pendingChange.status}.</p>
                        {billing.subscription.pendingChange.type === "CANCEL" && <p className="mt-2 text-sm">Toutes vos données resteront conservées. À l’échéance, les ressources dépassant les limites du plan Découverte seront suspendues, jamais supprimées.</p>}
                      </div>
                      <button type="button" onClick={() => updateSubscription("undo")} disabled={changingSubscription} className="rounded-xl border border-amber-300 bg-white px-4 py-2 text-sm font-semibold disabled:opacity-50">Annuler ce changement</button>
                    </div>
                    {["DOWNGRADE", "INTERVAL_CHANGE"].includes(billing.subscription.pendingChange.type) && (() => {
                        const target = plans.find((item) => item.key === (billing.subscription.pendingChange.toPlan || "DISCOVERY"));
                        const agentLimit = target?.limits?.agents;
                        const areaLimit = target?.limits?.areas;
                        return <div className="mt-5 grid gap-4 border-t border-amber-200 pt-4 md:grid-cols-2">
                            <div><p className="text-sm font-bold">Agents conservés ({retainedResources.agentIds.length}/{agentLimit ?? "∞"})</p><div className="mt-2 flex flex-wrap gap-2">{resourceOptions.agents.map((agent) => <label key={agent.id} className="rounded-lg border border-amber-200 bg-white px-3 py-2 text-xs"><input className="mr-2" type="checkbox" checked={retainedResources.agentIds.includes(agent.id)} onChange={() => toggleRetained("agentIds", agent.id, agentLimit)} />{agent.name}</label>)}</div></div>
                            <div><p className="text-sm font-bold">Zones conservées ({retainedResources.areaIds.length}/{areaLimit ?? "∞"})</p><div className="mt-2 flex flex-wrap gap-2">{resourceOptions.areas.map((area) => <label key={area.area_id} className="rounded-lg border border-amber-200 bg-white px-3 py-2 text-xs"><input className="mr-2" type="checkbox" checked={retainedResources.areaIds.includes(area.area_id)} onChange={() => toggleRetained("areaIds", area.area_id, areaLimit)} />{area.area_name}</label>)}</div></div>
                            <button type="button" onClick={saveRetainedResources} disabled={changingSubscription} className="rounded-xl bg-amber-900 px-4 py-2 text-sm font-semibold text-white md:col-span-2">Enregistrer les ressources à conserver</button>
                        </div>;
                    })()}
                </section>
            ) : billing.subscription?.isPaid && billing.subscription?.expiresAt ? (
                <section className="flex flex-col justify-between gap-4 rounded-2xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-950 md:flex-row md:items-center">
                    <div><p className="font-bold">Gestion de l’abonnement</p><p className="mt-1 text-sm text-slate-500">Une annulation conserve tous les avantages jusqu’à l’échéance.</p></div>
                    <button type="button" onClick={() => updateSubscription("cancel")} disabled={changingSubscription} className="rounded-xl border border-red-200 px-4 py-2 text-sm font-semibold text-red-700 disabled:opacity-50">Ne pas renouveler</button>
                </section>
            ) : null}

            <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
                {availablePlans.map((item) => {
                    const selected = item.key === selectedPlan;
                    const current = item.key === plan;
                    const isPass = item.key === "EVENT_PASS";
                    const supportsAnnual = ["ESSENTIAL", "PRO"].includes(item.key) && item.annualPrice != null;
                    const itemAnnual = Boolean(annualPlans[item.key]);
                    const displayPrice = supportsAnnual && itemAnnual ? item.annualPrice : item.price;
                    return (
                        <article key={item.key} className={`flex flex-col rounded-3xl border bg-white p-5 shadow-sm dark:bg-slate-950 ${selected ? "border-blue-500 ring-2 ring-blue-500/15" : "border-slate-200 dark:border-slate-800"}`}>
                            <div className="flex items-start justify-between gap-3">
                                <div><h2 className="text-xl font-black text-slate-900 dark:text-white">{item.name}</h2>{current && !isPass && <span className="mt-1 inline-block rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-semibold text-emerald-700">Actuel</span>}</div>
                                {isPass && <TicketCheck className="h-6 w-6 text-emerald-600" />}
                            </div>
                            <p className="mt-4 text-3xl font-black text-slate-950 dark:text-white">{item.key === "ENTERPRISE" ? "Sur devis" : formatMoney(displayPrice, item.currency)}</p>
                            <p className="text-xs text-slate-500">{item.key === "ENTERPRISE" ? "offre personnalisée" : isPass ? "paiement unique" : supportsAnnual && itemAnnual ? `par an (${formatMoney(item.annualPrice / 12, item.currency)}/mois)` : "par mois"}</p>
                            <ul className="mt-5 flex-1 space-y-2 text-sm text-slate-600 dark:text-slate-300">
                                {(item.features || []).map((feature) => <li key={feature} className="flex gap-2"><Check className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />{feature}</li>)}
                            </ul>
                            {supportsAnnual && (
                                <label className="mt-4 flex items-center gap-2 text-xs font-semibold text-slate-600 dark:text-slate-300">
                                    <input type="checkbox" checked={itemAnnual} onChange={(event) => { setAnnualPlans((current) => ({ ...current, [item.key]: event.target.checked })); setSelectedPlan(item.key); }} /> Facturation annuelle ({formatMoney(item.annualPrice, item.currency)})
                                </label>
                            )}
                            {PURCHASABLE.includes(item.key) && <button type="button" onClick={() => setSelectedPlan(item.key)} className={`mt-5 rounded-xl px-4 py-2.5 text-sm font-semibold ${selected ? "bg-blue-600 text-white" : "bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-white"}`}>{selected ? "Offre sélectionnée" : "Choisir"}</button>}
                            {item.key === "ENTERPRISE" && <a href="mailto:access.supportclient@gmail.com?subject=Offre%20Entreprise%20AccessQ" className="mt-5 rounded-xl bg-slate-900 px-4 py-2.5 text-center text-sm font-semibold text-white dark:bg-slate-100 dark:text-slate-900">Nous contacter</a>}
                        </article>
                    );
                })}
            </section>

            {activePasses.length > 0 && <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-900 dark:border-emerald-900/60 dark:bg-emerald-950/20 dark:text-emerald-100"><strong>{activePasses.length} Pass disponible{activePasses.length > 1 ? "s" : ""}.</strong> Attribuez-en un depuis la page « Créer un événement ». Le délai de 30 jours commencera à ce moment-là.</div>}

            {PAYMENTS_ENABLED ? (
                <section className="grid gap-6 lg:grid-cols-[0.9fr_1.1fr]">
                    <form onSubmit={submitPayment} className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-950">
                        <div className="flex items-center gap-3"><Smartphone className="h-6 w-6 text-blue-600" /><div><h2 className="font-bold text-slate-900 dark:text-white">Payer {chosenPlan?.name}</h2><p className="text-sm text-slate-500">Le PIN reste saisi sur votre téléphone.</p></div></div>
                        <label className="mt-6 block text-sm font-semibold">Pays<select value={form.country} onChange={(event) => { const country = event.target.value; const first = providers.find((provider) => provider.country === country); setForm((current) => ({ ...current, country, provider: first?.provider || "" })); }} className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-4 py-3 dark:border-slate-700 dark:bg-slate-900" required><option value="">Choisir</option>{countries.map((country) => <option key={country.code} value={country.code}>{country.name}</option>)}</select></label>
                        <label className="mt-4 block text-sm font-semibold">Opérateur<select value={form.provider} onChange={(event) => setForm((current) => ({ ...current, provider: event.target.value }))} className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-4 py-3 dark:border-slate-700 dark:bg-slate-900" required><option value="">Choisir</option>{countryProviders.map((provider) => <option key={provider.provider} value={provider.provider}>{provider.displayName}</option>)}</select></label>
                        <label className="mt-4 block text-sm font-semibold">Numéro Mobile Money<input type="tel" value={form.phoneNumber} onChange={(event) => setForm((current) => ({ ...current, phoneNumber: event.target.value }))} className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-4 py-3 dark:border-slate-700 dark:bg-slate-900" required /></label>
                        {selectedProvider && <div className="mt-5 rounded-xl bg-blue-50 p-4 text-sm text-blue-900 dark:bg-blue-950/30 dark:text-blue-100"><div className="flex justify-between"><span>Montant débité</span><strong>{payableAmount == null ? "Tarif indisponible" : formatMoney(payableAmount, quote?.currency || selectedProvider.currency)}</strong></div><div className="mt-2 flex justify-between text-xs"><span>Prix de référence</span><span>{formatMoney(quote?.referenceAmount ?? referencePrice, quote?.referenceCurrency || chosenPlan?.currency)}</span></div>{Number(quote?.creditAmount || 0) > 0 && <div className="mt-2 flex justify-between text-xs text-emerald-700"><span>Crédit de la période restante</span><span>− {formatMoney(quote.creditAmount, quote.currency)}</span></div>}{quote?.transition && <p className="mt-3 border-t border-blue-100 pt-2 text-xs">{quote.transition.type === "UPGRADE" ? "Upgrade immédiat après confirmation, sans changer la date de renouvellement." : ["DOWNGRADE", "INTERVAL_CHANGE"].includes(quote.transition.type) ? `Changement programmé pour le ${formatDate(quote.transition.effectiveAt)}.` : quote.transition.type === "RENEWAL" ? "La nouvelle période sera ajoutée après l’échéance actuelle." : "Activation immédiate après confirmation."}</p>}</div>}
                        <button type="submit" disabled={!canPay || submitting} className="mt-6 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-blue-600 px-5 py-3 font-semibold text-white disabled:opacity-50">{submitting || activeDepositId ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <ShieldCheck className="h-4 w-4" />}{activeDepositId ? "Confirmation en attente…" : `Payer ${chosenPlan?.name || "l’offre"}`}</button>
                    </form>

                    <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-950">
                        <div className="flex justify-between"><div><h2 className="font-bold text-slate-900 dark:text-white">Historique des paiements</h2><p className="text-sm text-slate-500">20 dernières tentatives.</p></div><button type="button" onClick={() => loadBilling()} className="rounded-xl border p-2"><RefreshCw className="h-4 w-4" /></button></div>
                        <div className="mt-5 space-y-3">{billing.payments.length === 0 ? <p className="rounded-xl border border-dashed p-8 text-center text-sm text-slate-500">Aucun paiement.</p> : billing.payments.map((payment) => { const presentation = statusPresentation[payment.status] || statusPresentation.PENDING; const StatusIcon = presentation.icon; const pending = ["PENDING", "PROCESSING"].includes(payment.status); return <div key={payment.depositId} className="rounded-2xl border border-slate-100 p-4 dark:border-slate-800"><div className="flex justify-between gap-3"><div><p className="font-bold">{payment.plan} · {formatMoney(payment.amount, payment.currency)}</p><p className="mt-1 text-xs text-slate-500">{payment.billingInterval} · {formatDate(payment.createdAt)}</p></div><div className="flex items-center gap-2"><span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold ${presentation.className}`}><StatusIcon className={`h-3.5 w-3.5 ${payment.status === "PROCESSING" ? "animate-spin" : ""}`} />{presentation.label}</span>{pending && <button type="button" onClick={() => refreshPayment(payment.depositId)} disabled={refreshingId === payment.depositId} className="rounded-lg border p-1.5"><RefreshCw className={`h-3.5 w-3.5 ${refreshingId === payment.depositId ? "animate-spin" : ""}`} /></button>}</div></div>{payment.failureMessage && <p className="mt-3 rounded-lg bg-red-50 p-2 text-xs text-red-700">{payment.failureMessage}</p>}</div>; })}</div>
                    </div>
                </section>
            ) : <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">Les tarifs sont configurés. Activez <code>NEXT_PUBLIC_PRO_PAYMENTS_ENABLED=true</code> et la configuration pawaPay pour permettre les achats.</div>}
        </div>
    );
}
