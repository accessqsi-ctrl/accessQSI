"use client";

export default function PlanQuotaStatus({ label, quota, className = "" }) {
    if (!quota || quota.limit === null || quota.limit === undefined) return null;

    const percentage = Math.min(100, Math.round((quota.used / quota.limit) * 100));

    return (
        <div className={`rounded-lg border px-4 py-3 ${quota.reached ? "border-amber-300 bg-amber-50 text-amber-900 dark:border-amber-900/60 dark:bg-amber-950/30 dark:text-amber-100" : "border-slate-200 bg-slate-50 text-slate-700 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-200"} ${className}`}>
            <div className="flex items-center justify-between gap-4 text-sm">
                <span className="font-semibold">{label}</span>
                <span className="whitespace-nowrap font-bold">{quota.used} / {quota.limit}</span>
            </div>
            <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-slate-200 dark:bg-slate-800">
                <div
                    className={`h-full rounded-full ${quota.reached ? "bg-amber-600" : "bg-blue-600"}`}
                    style={{ width: `${percentage}%` }}
                />
            </div>
            <p className="mt-2 text-xs">
                {quota.reached
                    ? "Limite atteinte. Le plan Pro supprime cette limite."
                    : `${quota.remaining} place${quota.remaining > 1 ? "s" : ""} disponible${quota.remaining > 1 ? "s" : ""}.`}
            </p>
        </div>
    );
}
