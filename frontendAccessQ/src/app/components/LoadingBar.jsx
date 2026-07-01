"use client";

export default function LoadingBar({ label = "Traitement en cours", className = "" }) {
    return (
        <div className={`space-y-2 ${className}`} role="progressbar" aria-label={label} aria-busy="true">
            <div className="flex items-center justify-between gap-3">
                <span className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">{label}</span>
                <span className="h-2 w-2 rounded-full bg-blue-500 shadow-[0_0_0_4px_rgba(37,99,235,0.12)]" />
            </div>
            <div className="process-progress">
                <span />
            </div>
        </div>
    );
}
