"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ClipboardList, Loader2, Plus, Wallet } from "lucide-react";
import { apiFetch } from "../../lib/api";

export default function RegistrationFormsPage() {
  const [forms, setForms] = useState([]); const [loading, setLoading] = useState(true); const [error, setError] = useState("");
  useEffect(() => { apiFetch("/registration-forms").then(async response => { const data = await response.json(); if (!response.ok) throw new Error(data.message); setForms(data.forms || []); }).catch(reason => setError(reason.message || "Chargement impossible." )).finally(() => setLoading(false)); }, []);
  return <div className="aq-page space-y-6"><div className="aq-page-header"><div><p className="mb-2 text-xs font-bold uppercase tracking-[0.18em] text-blue-700 dark:text-blue-300">Inscription autonome</p><h1 className="aq-page-title">Formulaires d’inscription</h1><p className="aq-page-subtitle">Publiez des offres gratuites ou payantes et suivez l’émission des billets.</p></div><Link href="/dashboard/registration-forms/new" className="aq-button-primary"><Plus className="h-5 w-5" /> Nouveau</Link></div>
    <div className="aq-panel overflow-x-auto"><table className="w-full min-w-[700px] text-left text-sm"><thead><tr className="aq-table-head"><th className="px-6 py-4">Formulaire</th><th>Événement</th><th>Statut</th><th>Inscriptions</th><th></th></tr></thead><tbody className="divide-y divide-slate-100 dark:divide-slate-800">{loading ? <tr><td colSpan="5" className="p-10 text-center"><Loader2 className="mx-auto h-7 w-7 animate-spin text-blue-600 dark:text-blue-400" /></td></tr> : forms.length ? forms.map(form => <tr key={form.id}><td className="px-6 py-4 font-bold text-slate-950 dark:text-slate-50">{form.title}</td><td>{form.event?.title}</td><td><span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-bold dark:bg-slate-800 dark:text-slate-200">{form.status}</span></td><td>{form.registrationCount || 0}</td><td><Link className="font-bold text-blue-700 dark:text-blue-300" href={`/dashboard/registration-forms/${form.id}`}>Gérer</Link></td></tr>) : <tr><td colSpan="5" className="p-10 text-center text-slate-500 dark:text-slate-400"><ClipboardList className="mx-auto mb-3 h-10 w-10" />Aucun formulaire.</td></tr>}</tbody></table></div>{error && <p className="text-red-600 dark:text-red-400">{error}</p>}
    <SalesBalance />
  </div>;
}

const money = (amount, currency) => { try { return new Intl.NumberFormat("fr-FR", { style: "currency", currency }).format(Number(amount)); } catch { return `${amount} ${currency}`; } };

const saleBadges = {
  REVIEW_REQUIRED: ["À vérifier", "bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300"],
  REFUND_PENDING: ["Remboursement en cours", "bg-blue-50 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300"],
  REFUNDED: ["Remboursé", "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300"]
};
const payoutLabels = { REQUESTED: "En attente de validation", APPROVED: "Validé, envoi en cours", SUBMITTING: "Envoi en cours", PROCESSING: "Chez l’opérateur", COMPLETED: "Versé", FAILED: "Échoué, montant recrédité", REJECTED: "Refusé, montant recrédité", CANCELED: "Annulé" };
const openPayout = status => ["REQUESTED", "APPROVED", "SUBMITTING", "PROCESSING"].includes(status);
const inputClass = "mt-1 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-blue-600 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100";

const jsonOrThrow = async response => {
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.message || "Opération impossible.");
  return data;
};

// Ventes encaissées par AccessQ : le solde est ce qui reste dû à l'organisation après commission et reversements.
function SalesBalance() {
  const [sales, setSales] = useState(null);
  const [payouts, setPayouts] = useState({ accounts: [], payouts: [] });
  const [notice, setNotice] = useState(null);
  const reload = () => Promise.all([
    apiFetch("/registration-forms/balance").then(async response => { if (response.ok) setSales(await response.json()); }),
    apiFetch("/registration-forms/payouts").then(async response => { if (response.ok) setPayouts(await response.json()); })
  ]).catch(() => {});
  useEffect(() => { reload(); }, []);
  if (!sales?.balances?.length) return null;
  const done = message => { setNotice({ ok: true, message }); return reload(); };
  const cancel = async payout => {
    try { done((await jsonOrThrow(await apiFetch(`/registration-forms/payouts/${payout.id}/cancel`, { method: "POST" }))).message); }
    catch (reason) { setNotice({ ok: false, message: reason.message }); }
  };
  return <section className="aq-panel p-6">
    <div className="flex items-center gap-3"><Wallet className="h-6 w-6 text-blue-600 dark:text-blue-400" /><div><h2 className="text-lg font-bold text-slate-950 dark:text-slate-50">Ventes de billets</h2><p className="text-sm text-slate-500 dark:text-slate-400">Encaissées par AccessQ. Le solde, déduction faite de la commission, vous est reversé sur votre compte Mobile Money après validation par AccessQ.</p></div></div>
    {notice && <p className={`mt-4 rounded-xl p-3 text-sm font-semibold ${notice.ok ? "bg-emerald-50 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300" : "bg-red-50 text-red-700 dark:bg-red-950/40 dark:text-red-300"}`}>{notice.message}</p>}
    <div className="mt-5 grid gap-4 lg:grid-cols-2">{sales.balances.map(row => <BalanceCard key={row.currency} row={row}
      account={payouts.accounts.find(item => item.currency === row.currency)}
      pending={payouts.payouts.some(item => item.currency === row.currency && openPayout(item.status))}
      onDone={done} onError={message => setNotice({ ok: false, message })} />)}</div>
    {payouts.payouts.length > 0 && <div className="mt-6 overflow-x-auto"><h3 className="mb-2 text-sm font-bold text-slate-900 dark:text-slate-100">Reversements</h3><table className="w-full min-w-[560px] text-left text-sm"><thead><tr className="aq-table-head"><th className="px-4 py-3">Date</th><th>Montant</th><th>Vers</th><th>État</th><th></th></tr></thead><tbody className="divide-y divide-slate-100 dark:divide-slate-800">{payouts.payouts.map(payout => <tr key={payout.id}>
      <td className="px-4 py-3">{new Date(payout.createdAt).toLocaleString("fr-FR")}</td><td className="font-semibold">{money(payout.amount, payout.currency)}</td><td>{payout.provider} · {payout.phoneNumber}</td>
      <td>{payoutLabels[payout.status] || payout.status}{payout.failureMessage && <span className="block text-xs text-slate-500 dark:text-slate-400">{payout.failureMessage}</span>}</td>
      <td>{payout.status === "REQUESTED" && <button type="button" onClick={() => cancel(payout)} className="text-sm font-bold text-blue-700 dark:text-blue-300">Annuler</button>}</td>
    </tr>)}</tbody></table></div>}
    {sales.recentSales?.length > 0 && <div className="mt-6 overflow-x-auto"><h3 className="mb-2 text-sm font-bold text-slate-900 dark:text-slate-100">Ventes récentes</h3><table className="w-full min-w-[640px] text-left text-sm"><thead><tr className="aq-table-head"><th className="px-4 py-3">Acheteur</th><th>Offre</th><th>Prix</th><th>Commission</th><th>Pour vous</th><th>Date</th></tr></thead><tbody className="divide-y divide-slate-100 dark:divide-slate-800">{sales.recentSales.map(sale => <tr key={sale.id}>
      <td className="px-4 py-3 font-semibold text-slate-900 dark:text-slate-100">{sale.buyerName}{saleBadges[sale.status] && <span className={`ml-2 rounded-full px-2 py-0.5 text-xs font-bold ${saleBadges[sale.status][1]}`}>{saleBadges[sale.status][0]}</span>}</td>
      <td>{sale.offerName}</td><td>{money(sale.amount, sale.currency)}</td><td>{money(sale.commission, sale.currency)} ({sale.commissionPercent} %)</td><td className="font-semibold">{sale.status === "COMPLETED" ? money(sale.organizerAmount, sale.currency) : "—"}</td>
      <td>{sale.completedAt ? new Date(sale.completedAt).toLocaleString("fr-FR") : "—"}</td>
    </tr>)}</tbody></table></div>}
  </section>;
}

function BalanceCard({ row, account, pending, onDone, onError }) {
  const [mode, setMode] = useState(null);
  const [providers, setProviders] = useState(null);
  const [draft, setDraft] = useState({ providerKey: "", phoneNumber: "", amount: "", password: "" });
  const [busy, setBusy] = useState(false);
  const set = field => event => setDraft(current => ({ ...current, [field]: event.target.value }));
  const open = next => {
    setMode(current => current === next ? null : next);
    setDraft({ providerKey: "", phoneNumber: "", amount: "", password: "" });
    if (next === "account" && !providers) apiFetch("/registration-forms/payouts/providers").then(jsonOrThrow)
      .then(data => setProviders(data.providers.filter(item => item.currency === row.currency)))
      .catch(reason => { setProviders([]); onError(reason.message); });
  };
  const submit = async event => {
    event.preventDefault(); setBusy(true);
    try {
      const [provider, country] = draft.providerKey.split("|");
      const data = mode === "account"
        ? await jsonOrThrow(await apiFetch("/registration-forms/payouts/accounts", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ currency: row.currency, provider, country, phoneNumber: draft.phoneNumber, password: draft.password }) }))
        : await jsonOrThrow(await apiFetch("/registration-forms/payouts", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ currency: row.currency, amount: draft.amount, password: draft.password }) }));
      setMode(null);
      await onDone(data.message);
    } catch (reason) { onError(reason.message); }
    finally { setBusy(false); }
  };
  const canRequest = account && !pending && Number(row.balance) > 0;
  return <div className="rounded-2xl border border-slate-200 p-4 dark:border-slate-800">
    <p className="text-xs font-bold uppercase tracking-wide text-slate-400 dark:text-slate-500">Solde disponible {row.currency}</p>
    <p className="mt-1 text-2xl font-black text-slate-950 dark:text-slate-50">{money(row.balance, row.currency)}</p>
    <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">{row.ticketsSold} billet(s) · {money(row.gross, row.currency)} encaissés · {money(row.commission, row.currency)} de commission</p>
    <p className="mt-3 text-sm text-slate-700 dark:text-slate-300">{account ? <>Reçu sur <strong>{account.provider}</strong> · {account.phoneNumber}</> : "Aucun compte de réception enregistré."}</p>
    <div className="mt-3 flex flex-wrap gap-2">
      <button type="button" onClick={() => open("account")} className="rounded-xl border border-slate-300 px-3 py-2 text-sm font-bold dark:border-slate-700 dark:text-slate-200">{account ? "Modifier le compte" : "Ajouter un compte"}</button>
      <button type="button" disabled={!canRequest} onClick={() => open("payout")} title={pending ? "Un reversement est déjà en cours" : undefined} className="aq-button-primary px-3 py-2 text-sm disabled:opacity-45">Demander le reversement</button>
    </div>
    {mode && <form onSubmit={submit} className="mt-4 space-y-3 rounded-xl bg-slate-50 p-3 dark:bg-slate-950/60">
      {mode === "account" ? <>
        <label className="block text-xs font-semibold">Opérateur<select required value={draft.providerKey} onChange={set("providerKey")} className={inputClass}><option value="">{providers === null ? "Chargement…" : providers.length ? "Sélectionner" : `Aucun opérateur ne verse en ${row.currency}`}</option>{(providers || []).map(item => <option key={`${item.provider}|${item.country}`} value={`${item.provider}|${item.country}`}>{item.displayName}{item.countryDisplayName ? ` · ${item.countryDisplayName}` : ""}</option>)}</select></label>
        <label className="block text-xs font-semibold">Numéro Mobile Money<input required type="tel" value={draft.phoneNumber} onChange={set("phoneNumber")} className={inputClass} /></label>
      </> : <label className="block text-xs font-semibold">Montant (vide = tout le solde)<input inputMode="decimal" placeholder={row.balance} value={draft.amount} onChange={set("amount")} className={inputClass} /></label>}
      <label className="block text-xs font-semibold">Votre mot de passe<input required type="password" autoComplete="current-password" value={draft.password} onChange={set("password")} className={inputClass} /></label>
      <button disabled={busy} className="aq-button-primary w-full justify-center px-3 py-2 text-sm">{busy && <Loader2 className="h-4 w-4 animate-spin" />} {mode === "account" ? "Enregistrer le compte" : "Envoyer la demande"}</button>
    </form>}
  </div>;
}
