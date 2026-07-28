"use client";

import {
    CheckCircle2,
    Clock3,
    Crown,
    Gift,
    LoaderCircle,
    RefreshCw,
    ShieldCheck,
    Smartphone,
    Sparkles,
    XCircle,
    Zap
} from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { apiFetch } from "../../lib/api";
import { useUserPlan } from "../../lib/useUserPlan";

const statusPresentation = {
    PENDING: { label: "En attente", className: "bg-amber-50 text-amber-700", icon: Clock3 },
    PROCESSING: { label: "En traitement", className: "bg-blue-50 text-blue-700", icon: LoaderCircle },
    COMPLETED: { label: "Payé", className: "bg-emerald-50 text-emerald-700", icon: CheckCircle2 },
    FAILED: { label: "Échoué", className: "bg-red-50 text-red-700", icon: XCircle }
};

const formatMoney = (amount, currency = "CDF") => {
    const numericAmount = Number(amount || 0);
    return new Intl.NumberFormat("fr-CD", {
        style: "currency",
        currency,
        maximumFractionDigits: 0
    }).format(numericAmount);
};

const formatDate = (value) => {
    if (!value) return "—";
    return new Intl.DateTimeFormat("fr-CD", {
        dateStyle: "medium",
        timeStyle: "short"
    }).format(new Date(value));
};

export default function UpgradePage() {
    const { isFreePlan, planName, refreshPlan } = useUserPlan();
    const [plans, setPlans] = useState([]);
    const [providers, setProviders] = useState([]);
    const [billing, setBilling] = useState({ subscription: null, payments: [] });
    const [form, setForm] = useState({ country: "", provider: "", phoneNumber: "" });
    const [loading, setLoading] = useState(true);
    const [submitting, setSubmitting] = useState(false);
    const [startingTrial, setStartingTrial] = useState(false);
    const [refreshingId, setRefreshingId] = useState(null);
    const [activeDepositId, setActiveDepositId] = useState(null);
    const [notice, setNotice] = useState(null);

    const proPlan = useMemo(
        () => plans.find((plan) => plan.key === "PRO"),
        [plans]
    );
    const countries = useMemo(() => {
        const entries = new Map();
        providers.forEach((provider) => {
            if (!provider.country || entries.has(provider.country)) return;
            const displayName = typeof provider.countryDisplayName === "object"
                ? provider.countryDisplayName.fr || provider.countryDisplayName.en
                : provider.countryDisplayName;
            entries.set(provider.country, displayName || provider.country);
        });
        return Array.from(entries, ([code, name]) => ({ code, name }))
            .sort((a, b) => a.name.localeCompare(b.name, "fr"));
    }, [providers]);
    const countryProviders = useMemo(
        () => providers.filter((provider) => provider.country === form.country),
        [form.country, providers]
    );
    const selectedProvider = useMemo(
        () => providers.find((provider) => (
            provider.country === form.country && provider.provider === form.provider
        )),
        [form.country, form.provider, providers]
    );

    const loadBilling = useCallback(async ({ silent = false } = {}) => {
        if (!silent) setLoading(true);
        try {
            const [plansResponse, providersResponse, billingResponse] = await Promise.all([
                apiFetch("/billing/plans"),
                apiFetch("/billing/providers"),
                apiFetch("/billing")
            ]);
            const [plansData, providersData, billingData] = await Promise.all([
                plansResponse.json(),
                providersResponse.json(),
                billingResponse.json()
            ]);

            if (!plansResponse.ok) throw new Error(plansData.message || "Impossible de charger les plans.");
            if (!billingResponse.ok) throw new Error(billingData.message || "Impossible de charger la facturation.");

            setPlans(plansData.plans || []);
            setBilling({
                subscription: billingData.subscription || null,
                payments: billingData.payments || []
            });

            if (providersResponse.ok) {
                const availableProviders = providersData.providers || [];
                setProviders(availableProviders);
                setForm((current) => ({
                    ...current,
                    country: current.country || availableProviders[0]?.country || "",
                    provider: current.provider || availableProviders[0]?.provider || ""
                }));
            } else {
                setProviders([]);
                setNotice({
                    type: "error",
                    text: providersData.message || "Les opérateurs Mobile Money ne sont pas encore configurés."
                });
            }
        } catch (error) {
            setNotice({ type: "error", text: error.message });
        } finally {
            if (!silent) setLoading(false);
        }
    }, []);

    useEffect(() => {
        loadBilling();
    }, [loadBilling]);

    const refreshPayment = useCallback(async (depositId, { automatic = false } = {}) => {
        if (!automatic) setRefreshingId(depositId);
        try {
            const response = await apiFetch(`/billing/payments/${depositId}/refresh`, {
                method: "POST"
            });
            const data = await response.json();
            if (!response.ok) throw new Error(data.message || "Impossible de vérifier le paiement.");

            const payment = data.payment;
            setBilling((current) => ({
                ...current,
                payments: current.payments.map((item) => (
                    item.depositId === depositId ? payment : item
                ))
            }));

            if (payment.status === "COMPLETED") {
                setActiveDepositId(null);
                setNotice({ type: "success", text: "Paiement confirmé. Votre abonnement Pro est actif." });
                await Promise.all([loadBilling({ silent: true }), refreshPlan()]);
            } else if (payment.status === "FAILED") {
                setActiveDepositId(null);
                setNotice({
                    type: "error",
                    text: payment.failureMessage || "Le paiement a échoué. Vous pouvez réessayer."
                });
            } else if (!automatic) {
                setNotice({
                    type: "info",
                    text: "Le paiement est toujours en attente de confirmation sur votre téléphone."
                });
            }
        } catch (error) {
            if (!automatic) setNotice({ type: "error", text: error.message });
        } finally {
            if (!automatic) setRefreshingId(null);
        }
    }, [loadBilling, refreshPlan]);

    useEffect(() => {
        if (!activeDepositId) return undefined;
        const timer = window.setInterval(() => {
            refreshPayment(activeDepositId, { automatic: true });
        }, 5000);
        return () => window.clearInterval(timer);
    }, [activeDepositId, refreshPayment]);

    const submitPayment = async (event) => {
        event.preventDefault();
        setNotice(null);
        setSubmitting(true);
        try {
            const response = await apiFetch("/billing/payments", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    plan: "PRO",
                    country: form.country,
                    provider: form.provider,
                    phoneNumber: form.phoneNumber
                })
            });
            const data = await response.json();
            if (!response.ok) {
                throw new Error(
                    data.payment
                        ? `${data.message} La tentative reste consultable dans l'historique.`
                        : data.message || "Impossible de démarrer le paiement."
                );
            }

            setBilling((current) => ({
                ...current,
                payments: [data.payment, ...current.payments]
            }));
            setActiveDepositId(data.payment.depositId);
            setNotice({
                type: "info",
                text: "Demande envoyée. Confirmez maintenant le paiement sur votre téléphone Mobile Money."
            });
        } catch (error) {
            setNotice({ type: "error", text: error.message });
            await loadBilling({ silent: true });
        } finally {
            setSubmitting(false);
        }
    };

    const startTrial = async () => {
        setNotice(null);
        setStartingTrial(true);
        try {
            const response = await apiFetch("/billing/trial/start", {
                method: "POST"
            });
            const data = await response.json();
            if (!response.ok) {
                throw new Error(data.message || "Impossible d’activer l’essai Pro.");
            }

            setNotice({
                type: "success",
                text: data.message || "Votre essai Pro est maintenant actif."
            });
            await Promise.all([loadBilling({ silent: true }), refreshPlan()]);
        } catch (error) {
            setNotice({ type: "error", text: error.message });
            await loadBilling({ silent: true });
        } finally {
            setStartingTrial(false);
        }
    };

    if (loading) {
        return (
            <div className="flex min-h-[60vh] items-center justify-center">
                <LoaderCircle className="h-8 w-8 animate-spin text-blue-600" aria-label="Chargement" />
            </div>
        );
    }

    const expiresAt = billing.subscription?.expiresAt;
    const trialAvailable = Boolean(billing.subscription?.trialAvailable);
    const isTrial = Boolean(billing.subscription?.isTrial);
    const trialWasUsed = Boolean(billing.subscription?.trialStartedAt);
    const trialDurationDays = billing.subscription?.trialDurationDays || 14;
    const canPay = Boolean(
        proPlan && providers.length > 0 && form.country && form.provider && form.phoneNumber
    );

    return (
        <div className="mx-auto flex max-w-6xl flex-col gap-6">
            <section className="overflow-hidden rounded-3xl bg-gradient-to-br from-slate-950 via-blue-950 to-blue-700 text-white shadow-xl">
                <div className="grid gap-8 p-7 lg:grid-cols-[1.2fr_0.8fr] lg:p-10">
                    <div>
                        <div className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-3 py-1 text-sm font-semibold">
                            <Crown className="h-4 w-4 text-amber-300" />
                            AccessQ Pro
                        </div>
                        <h1 className="mt-5 max-w-2xl text-3xl font-black tracking-tight sm:text-4xl">
                            Gérez vos accès sans limites
                        </h1>
                        <p className="mt-3 max-w-2xl text-blue-100">
                            Activez Pro par Mobile Money. Votre abonnement est appliqué automatiquement dès la confirmation du paiement.
                        </p>
                        <div className="mt-6 grid gap-3 sm:grid-cols-3">
                            {[
                                [Zap, "QR et événements illimités"],
                                [Sparkles, "Modèles personnalisés"],
                                [ShieldCheck, "Exports et analyses"]
                            ].map(([Icon, label]) => (
                                <div key={label} className="flex items-center gap-2 rounded-xl bg-white/10 p-3 text-sm">
                                    <Icon className="h-4 w-4 text-emerald-300" />
                                    {label}
                                </div>
                            ))}
                        </div>
                    </div>

                    <div className="rounded-2xl border border-white/20 bg-white/10 p-6 backdrop-blur">
                        <p className="text-xs font-bold uppercase tracking-[0.2em] text-blue-200">Plan actuel</p>
                        <p className="mt-3 text-3xl font-black">{planName || "Free"}</p>
                        <p className="mt-2 text-sm text-blue-100">
                            {isFreePlan
                                ? "Passez en Pro en quelques instants."
                                : expiresAt
                                    ? `Valide jusqu'au ${formatDate(expiresAt)}`
                                    : "Votre organisation bénéficie de Pro."}
                        </p>
                        {proPlan && (
                            <div className="mt-5 border-t border-white/20 pt-5">
                                <span className="text-3xl font-black">
                                    {formatMoney(proPlan.price, proPlan.currency || "USD")}
                                </span>
                                <span className="ml-2 text-blue-200">/ {proPlan.durationDays} jours</span>
                            </div>
                        )}
                    </div>
                </div>
            </section>

            {notice && (
                <div
                    role="status"
                    className={`rounded-2xl border px-4 py-3 text-sm ${
                        notice.type === "success"
                            ? "border-emerald-200 bg-emerald-50 text-emerald-800"
                            : notice.type === "error"
                                ? "border-red-200 bg-red-50 text-red-800"
                                : "border-blue-200 bg-blue-50 text-blue-800"
                    }`}
                >
                    {notice.text}
                </div>
            )}

            {(trialAvailable || isTrial || (isFreePlan && trialWasUsed)) && (
                <section className={`rounded-3xl border p-6 shadow-sm ${
                    isTrial
                        ? "border-emerald-200 bg-emerald-50 dark:border-emerald-900/60 dark:bg-emerald-950/20"
                        : "border-blue-200 bg-white dark:border-blue-900/60 dark:bg-slate-950"
                }`}>
                    <div className="flex flex-col justify-between gap-5 sm:flex-row sm:items-center">
                        <div className="flex items-start gap-4">
                            <div className={`rounded-2xl p-3 ${
                                isTrial
                                    ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/50 dark:text-emerald-300"
                                    : "bg-blue-50 text-blue-600 dark:bg-blue-950/50 dark:text-blue-300"
                            }`}>
                                <Gift className="h-6 w-6" />
                            </div>
                            <div>
                                <h2 className="text-lg font-black text-slate-900 dark:text-white">
                                    {isTrial
                                        ? "Votre essai Pro est actif"
                                        : trialAvailable
                                            ? `Essayez toutes les options Pro pendant ${trialDurationDays} jours`
                                            : "Essai Pro déjà utilisé"}
                                </h2>
                                <p className="mt-1 max-w-2xl text-sm text-slate-600 dark:text-slate-300">
                                    {isTrial
                                        ? `Toutes les fonctionnalités Pro sont disponibles jusqu’au ${formatDate(billing.subscription?.trialExpiresAt)}.`
                                        : trialAvailable
                                            ? "Aucune carte bancaire n’est nécessaire. À la fin de l’essai, votre organisation repassera automatiquement au plan Free."
                                            : "Cette organisation a déjà bénéficié de son essai gratuit. Vous pouvez activer Pro par Mobile Money."}
                                </p>
                            </div>
                        </div>
                        {trialAvailable && (
                            <button
                                type="button"
                                onClick={startTrial}
                                disabled={startingTrial}
                                className="inline-flex shrink-0 items-center justify-center gap-2 rounded-xl bg-emerald-600 px-5 py-3 font-semibold text-white transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-50"
                            >
                                {startingTrial ? (
                                    <LoaderCircle className="h-4 w-4 animate-spin" />
                                ) : (
                                    <Sparkles className="h-4 w-4" />
                                )}
                                {startingTrial ? "Activation…" : "Démarrer mon essai Pro"}
                            </button>
                        )}
                    </div>
                </section>
            )}

            <section className="grid gap-6 lg:grid-cols-[0.9fr_1.1fr]">
                <form
                    onSubmit={submitPayment}
                    className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-950"
                >
                    <div className="flex items-center gap-3">
                        <div className="rounded-2xl bg-blue-50 p-3 text-blue-600 dark:bg-blue-950/40">
                            <Smartphone className="h-5 w-5" />
                        </div>
                        <div>
                            <h2 className="font-bold text-slate-900 dark:text-white">Payer par Mobile Money</h2>
                            <p className="text-sm text-slate-500">Le code PIN reste saisi sur votre téléphone.</p>
                        </div>
                    </div>

                    <label className="mt-6 block text-sm font-semibold text-slate-700 dark:text-slate-200">
                        Pays
                        <select
                            value={form.country}
                            onChange={(event) => {
                                const country = event.target.value;
                                const firstProvider = providers.find((provider) => provider.country === country);
                                setForm((current) => ({
                                    ...current,
                                    country,
                                    provider: firstProvider?.provider || ""
                                }));
                            }}
                            className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-4 py-3 outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 dark:border-slate-700 dark:bg-slate-900"
                            required
                        >
                            <option value="">Choisir un pays</option>
                            {countries.map((country) => (
                                <option key={country.code} value={country.code}>
                                    {country.name}
                                </option>
                            ))}
                        </select>
                    </label>

                    <label className="mt-4 block text-sm font-semibold text-slate-700 dark:text-slate-200">
                        Opérateur
                        <select
                            value={form.provider}
                            onChange={(event) => setForm((current) => ({ ...current, provider: event.target.value }))}
                            className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-4 py-3 outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 dark:border-slate-700 dark:bg-slate-900"
                            required
                        >
                            <option value="">Choisir un opérateur</option>
                            {countryProviders.map((provider) => (
                                <option key={provider.provider} value={provider.provider}>
                                    {provider.displayName} — {formatMoney(provider.price, provider.currency)}
                                </option>
                            ))}
                        </select>
                    </label>

                    <label className="mt-4 block text-sm font-semibold text-slate-700 dark:text-slate-200">
                        Numéro Mobile Money
                        <input
                            type="tel"
                            inputMode="tel"
                            autoComplete="tel"
                            placeholder="Numéro avec ou sans indicatif"
                            value={form.phoneNumber}
                            onChange={(event) => setForm((current) => ({ ...current, phoneNumber: event.target.value }))}
                            className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-4 py-3 outline-none transition placeholder:text-slate-400 focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 dark:border-slate-700 dark:bg-slate-900"
                            required
                        />
                    </label>

                    {selectedProvider && (
                        <div className="mt-5 rounded-xl border border-blue-100 bg-blue-50 p-4 text-sm text-blue-900 dark:border-blue-900/50 dark:bg-blue-950/20 dark:text-blue-100">
                            <div className="flex items-center justify-between gap-3">
                                <span>Montant débité</span>
                                <strong>{formatMoney(selectedProvider.price, selectedProvider.currency)}</strong>
                            </div>
                            <div className="mt-2 flex items-center justify-between gap-3 text-xs text-blue-700 dark:text-blue-300">
                                <span>Prix de référence</span>
                                <span>{formatMoney(proPlan?.price, proPlan?.currency || "USD")}</span>
                            </div>
                        </div>
                    )}

                    <button
                        type="submit"
                        disabled={!canPay || submitting || Boolean(activeDepositId)}
                        className="mt-6 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-blue-600 px-5 py-3 font-semibold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                        {submitting || activeDepositId ? (
                            <LoaderCircle className="h-4 w-4 animate-spin" />
                        ) : (
                            <ShieldCheck className="h-4 w-4" />
                        )}
                        {activeDepositId ? "Confirmation en attente…" : "Payer et activer Pro"}
                    </button>
                    <p className="mt-3 text-center text-xs text-slate-500">
                        Le plan est activé uniquement après vérification auprès de pawaPay.
                    </p>
                </form>

                <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-950">
                    <div className="flex items-center justify-between gap-3">
                        <div>
                            <h2 className="font-bold text-slate-900 dark:text-white">Historique des paiements</h2>
                            <p className="text-sm text-slate-500">Les 20 dernières tentatives de l’organisation.</p>
                        </div>
                        <button
                            type="button"
                            onClick={() => loadBilling()}
                            className="rounded-xl border border-slate-200 p-2 text-slate-500 transition hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-900"
                            title="Actualiser"
                        >
                            <RefreshCw className="h-4 w-4" />
                        </button>
                    </div>

                    <div className="mt-5 space-y-3">
                        {billing.payments.length === 0 ? (
                            <div className="rounded-2xl border border-dashed border-slate-200 p-8 text-center text-sm text-slate-500 dark:border-slate-700">
                                Aucun paiement pour le moment.
                            </div>
                        ) : billing.payments.map((payment) => {
                            const presentation = statusPresentation[payment.status] || statusPresentation.PENDING;
                            const StatusIcon = presentation.icon;
                            const pending = ["PENDING", "PROCESSING"].includes(payment.status);
                            return (
                                <div key={payment.depositId} className="rounded-2xl border border-slate-100 p-4 dark:border-slate-800">
                                    <div className="flex flex-wrap items-start justify-between gap-3">
                                        <div>
                                            <p className="font-bold text-slate-900 dark:text-white">
                                                {formatMoney(payment.amount, payment.currency)}
                                            </p>
                                            {payment.referenceAmount && (
                                                <p className="mt-1 text-xs text-slate-500">
                                                    Référence : {formatMoney(
                                                        payment.referenceAmount,
                                                        payment.referenceCurrency || "USD"
                                                    )}
                                                </p>
                                            )}
                                            <p className="mt-1 text-xs text-slate-500">
                                                {payment.provider.replace(/_/g, " ")} · {payment.phoneNumber}
                                            </p>
                                            <p className="mt-1 text-xs text-slate-400">{formatDate(payment.createdAt)}</p>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ${presentation.className}`}>
                                                <StatusIcon className={`h-3.5 w-3.5 ${payment.status === "PROCESSING" ? "animate-spin" : ""}`} />
                                                {presentation.label}
                                            </span>
                                            {pending && (
                                                <button
                                                    type="button"
                                                    onClick={() => refreshPayment(payment.depositId)}
                                                    disabled={refreshingId === payment.depositId}
                                                    className="rounded-lg border border-slate-200 p-1.5 text-slate-500 hover:bg-slate-50 disabled:opacity-50 dark:border-slate-700"
                                                    title="Vérifier le paiement"
                                                >
                                                    <RefreshCw className={`h-3.5 w-3.5 ${refreshingId === payment.depositId ? "animate-spin" : ""}`} />
                                                </button>
                                            )}
                                        </div>
                                    </div>
                                    {payment.failureMessage && (
                                        <p className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-xs text-red-700">
                                            {payment.failureMessage}
                                        </p>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                </div>
            </section>
        </div>
    );
}
