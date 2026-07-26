"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { apiFetch } from "./api";

export function useUserPlan() {
    const [userProfile, setUserProfile] = useState(null);
    const [profileLoading, setProfileLoading] = useState(true);

    const refreshPlan = useCallback(async () => {
        try {
            const res = await apiFetch("/user/profile");
            const data = await res.json();
            if (data.success) setUserProfile(data.user || null);
            return data.user || null;
        } catch {
            setUserProfile(null);
            return null;
        } finally {
            setProfileLoading(false);
        }
    }, []);

    useEffect(() => {
        refreshPlan();
    }, [refreshPlan]);

    const subscription = useMemo(() => {
        const rawSubscription = userProfile?.subscription || {};
        const isPro = Boolean(rawSubscription.isPro ?? userProfile?.isPro ?? false);

        return {
            plan: rawSubscription.plan || userProfile?.plan || (isPro ? "PRO" : "FREE"),
            planName: rawSubscription.planName || userProfile?.planName || (isPro ? "Pro" : "Free"),
            isPro,
            planLimits: rawSubscription.planLimits || userProfile?.planLimits || {},
            planUsage: rawSubscription.planUsage || userProfile?.planUsage || {},
            planCapabilities: rawSubscription.planCapabilities || userProfile?.planCapabilities || [],
            planFeatures: rawSubscription.planFeatures || userProfile?.planFeatures || []
        };
    }, [userProfile]);

    return {
        userProfile,
        profileLoading,
        refreshPlan,
        ...subscription,
        isFreePlan: !subscription.isPro,
        isProPlan: subscription.isPro
    };
}
