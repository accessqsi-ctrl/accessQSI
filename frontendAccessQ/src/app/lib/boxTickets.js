// Libellés partagés par les pages de la box.
export const formatDate = value => new Intl.DateTimeFormat("fr-FR", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));

export const ticketBadge = ticket => {
  if (ticket.status === "PROCESSING") return { label: "En préparation", className: "bg-blue-50 text-blue-700 dark:bg-blue-950/50 dark:text-blue-300" };
  if (ticket.status === "FAILED") return { label: "Interrompu", className: "bg-red-50 text-red-700 dark:bg-red-950/50 dark:text-red-300" };
  if (ticket.qrStatus === "revoked") return { label: "Révoqué", className: "bg-red-50 text-red-700 dark:bg-red-950/50 dark:text-red-300" };
  if (ticket.qrStatus === "used_up") return { label: "Utilisé", className: "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300" };
  if (ticket.qrStatus === "expired") return { label: "Expiré", className: "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300" };
  return { label: "Valide", className: "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300" };
};

export const formatMoney = (amount, currency) => {
  try { return new Intl.NumberFormat("fr-FR", { style: "currency", currency }).format(Number(amount)); }
  catch { return `${amount} ${currency}`; }
};
