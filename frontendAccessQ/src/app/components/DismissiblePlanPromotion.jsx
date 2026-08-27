"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import { X } from "lucide-react";

const SIX_DAYS_MS = 6 * 24 * 60 * 60 * 1000;
const PROMOTION_EVENT = "accessq-plan-promotion-updated";

const storageKeyFor = (promotionId, userId) => `accessq:plan-promotion:${userId || "anonymous"}:${promotionId}`;

const readDismissedUntil = (storageKey) => {
    if (typeof window === "undefined") return 0;
    try {
        const value = Number(window.localStorage.getItem(storageKey));
        return Number.isFinite(value) ? value : 0;
    } catch {
        return 0;
    }
};

const subscribeToStorageKey = (storageKey, callback) => {
    const handleStorage = (event) => {
        if (event.key === storageKey) callback();
    };
    const handlePromotionUpdate = (event) => {
        if (event.detail === storageKey) callback();
    };
    window.addEventListener("storage", handleStorage);
    window.addEventListener(PROMOTION_EVENT, handlePromotionUpdate);
    return () => {
        window.removeEventListener("storage", handleStorage);
        window.removeEventListener(PROMOTION_EVENT, handlePromotionUpdate);
    };
};

export default function DismissiblePlanPromotion({ promotionId, userId, className = "", children }) {
    const storageKey = storageKeyFor(promotionId, userId);
    const dismissedUntil = useSyncExternalStore(
        (callback) => subscribeToStorageKey(storageKey, callback),
        () => readDismissedUntil(storageKey),
        () => 0
    );
    const [now, setNow] = useState(() => Date.now());

    useEffect(() => {
        if (dismissedUntil <= now) return undefined;
        const timer = window.setTimeout(() => setNow(Date.now()), dismissedUntil - now);
        return () => window.clearTimeout(timer);
    }, [dismissedUntil, now]);

    const dismiss = () => {
        const nextDisplayAt = Date.now() + SIX_DAYS_MS;
        try {
            window.localStorage.setItem(storageKey, String(nextDisplayAt));
        } catch {
            // La fermeture reste sans effet persistant lorsque le stockage est indisponible.
        }
        setNow(Date.now());
        window.dispatchEvent(new CustomEvent(PROMOTION_EVENT, { detail: storageKey }));
    };

    if (dismissedUntil > now) return null;

    return (
        <div className={`relative ${className}`}>
            {children}
            <button
                type="button"
                onClick={dismiss}
                aria-label="Masquer cette suggestion de plan pendant 6 jours"
                title="Masquer pendant 6 jours"
                className="absolute right-2 top-2 rounded-lg p-1.5 text-current opacity-60 transition hover:bg-black/5 hover:opacity-100 dark:hover:bg-white/10"
            >
                <X className="h-4 w-4" />
            </button>
        </div>
    );
}
