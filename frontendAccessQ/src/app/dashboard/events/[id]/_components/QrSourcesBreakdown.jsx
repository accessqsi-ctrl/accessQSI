const ROLES = { ORG_ADMIN: "administrateur", SUPER_ADMIN: "administrateur", ORG_AGENT: "agent", OPERATOR: "opérateur" };

// Origine des QR de l'événement : billetterie, chaque membre qui en a créé, et QR antérieurs au suivi de l'auteur.
export default function QrSourcesBreakdown({ usage, currentUserId }) {
  if (!usage?.sources) return null;
  const { ticketing, members, unattributed } = usage.sources;
  const rows = [
    ...(ticketing > 0 || usage.reserved > 0 ? [{ key: "ticketing", label: "Billetterie", count: ticketing, note: usage.reserved > 0 ? `+ ${usage.reserved} place(s) vendue(s) en attente` : null }] : []),
    ...members.map(member => ({ key: `user-${member.userId}`, label: member.userId === currentUserId ? "Vous" : member.name, count: member.count, note: member.userId === currentUserId ? null : ROLES[member.role] || null })),
    ...(unattributed > 0 ? [{ key: "unattributed", label: "Non attribués", count: unattributed, note: "créés avant le suivi de l’auteur" }] : [])
  ];
  if (!rows.length) return null;
  return <div className="mt-3 rounded-lg border border-slate-200 px-4 py-3 text-sm dark:border-slate-800">
    <p className="font-semibold text-slate-700 dark:text-slate-200">Origine des QR</p>
    <ul className="mt-2 flex flex-wrap gap-2">{rows.map(row => <li key={row.key} className="rounded-full bg-slate-100 px-3 py-1 text-xs text-slate-700 dark:bg-slate-800 dark:text-slate-200"><span className="font-bold">{row.count}</span> · {row.label}{row.note && <span className="text-slate-500 dark:text-slate-400"> ({row.note})</span>}</li>)}</ul>
  </div>;
}
