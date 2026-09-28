import { apiUrl } from "../lib/api";

const templateAccentClasses = {
    blue: "border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-900/60 dark:bg-blue-950/25 dark:text-blue-200",
    amber: "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-900/60 dark:bg-amber-950/25 dark:text-amber-200",
    emerald: "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900/60 dark:bg-emerald-950/25 dark:text-emerald-200",
    teal: "border-teal-200 bg-teal-50 text-teal-700 dark:border-teal-900/60 dark:bg-teal-950/25 dark:text-teal-200",
    rose: "border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-900/60 dark:bg-rose-950/25 dark:text-rose-200",
    navy: "border-blue-200 bg-blue-50 text-[#080d5f] dark:border-blue-900/60 dark:bg-blue-950/25 dark:text-blue-200",
    violet: "border-violet-200 bg-violet-50 text-violet-700 dark:border-violet-900/60 dark:bg-violet-950/25 dark:text-violet-200",
    slate: "border-slate-200 bg-slate-50 text-slate-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
};

export default function CardTemplatePreview({ template }) {
    const isQrOnly = !template;
    const isWide = template?.layout === "wide" || template?.layout === "compact";
    const accentClass = template ? templateAccentClasses[template.accent] || templateAccentClasses.slate : "border-slate-200 bg-slate-50 text-slate-600 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200";
    const customStyle = template?.primaryColor ? { borderColor: template.primaryColor, backgroundColor: template.secondaryColor, color: template.primaryColor } : undefined;

    return (
        <div className={`relative overflow-hidden rounded-xl border ${accentClass} ${isWide ? "aspect-[16/6]" : "aspect-[9/13]"}`} style={customStyle}>
            {isQrOnly ? (
                <div className="flex h-full items-center justify-center">
                    <div className="grid h-16 w-16 grid-cols-3 gap-1 rounded-lg bg-white p-2 shadow-sm dark:bg-slate-950">
                        {Array.from({ length: 9 }).map((_, index) => (
                            <span key={index} className={`rounded-sm ${index % 2 === 0 ? "bg-slate-900 dark:bg-slate-100" : "bg-slate-300 dark:bg-slate-600"}`} />
                        ))}
                    </div>
                </div>
            ) : (
                <>
                    {template.backgroundImageUrl && (
                        <img
                            src={apiUrl(template.backgroundImageUrl)}
                            alt=""
                            className="absolute inset-0 h-full w-full object-cover"
                        />
                    )}
                    <div className={`absolute left-0 top-0 ${isWide ? "h-full w-[30%]" : "h-[28%] w-full"} bg-current opacity-90`} />
                    <div className="absolute inset-3 flex flex-col justify-between">
                        <div className={isWide ? "ml-[34%]" : "mt-[34%]"}>
                            <div className="h-2.5 w-24 rounded-full bg-slate-900/80 dark:bg-white/80" />
                            <div className="mt-2 h-2 w-16 rounded-full bg-slate-500/40" />
                            <div className="mt-2 h-2 w-20 rounded-full bg-slate-500/25" />
                        </div>
                        <div className="flex items-end justify-between gap-3">
                            <div className="space-y-1.5">
                                <div className="h-2 w-14 rounded-full bg-slate-500/30" />
                                <div className="h-2 w-10 rounded-full bg-slate-500/20" />
                            </div>
                            <div className="grid h-12 w-12 grid-cols-3 gap-0.5 rounded-md bg-white p-1.5 shadow-sm dark:bg-slate-950">
                                {Array.from({ length: 9 }).map((_, index) => (
                                    <span key={index} className={`rounded-[2px] ${index % 2 === 0 ? "bg-slate-900 dark:bg-slate-100" : "bg-slate-300 dark:bg-slate-600"}`} />
                                ))}
                            </div>
                        </div>
                    </div>
                </>
            )}
        </div>
    );
}
