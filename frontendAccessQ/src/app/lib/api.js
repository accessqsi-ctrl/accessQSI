"use client";

const API_URL = process.env.NEXT_PUBLIC_API_URL;

const buildUrl = (path) => {
    if (path.startsWith("http")) return path;
    return `${API_URL}${path}`;
};

const authStatuses = [401, 403];

function redirectToLogin() {
    if (typeof window === "undefined") return;
    if (window.location.pathname === "/login") return;

    const next = `${window.location.pathname}${window.location.search}`;
    window.location.href = `/login?next=${encodeURIComponent(next)}`;
}

async function isBusinessForbidden(response) {
    if (response.status !== 403) return false;
    const contentType = response.headers.get("content-type") || "";
    if (!contentType.includes("application/json")) return false;

    try {
        const data = await response.clone().json();
        return data && data.success === false && Boolean(data.message);
    } catch {
        return false;
    }
}

export async function apiFetch(path, options = {}) {
    const { redirectOnAuthFailure = true, ...fetchOptions } = options;
    const requestOptions = {
        ...fetchOptions,
        credentials: "include",
        headers: {
            ...(fetchOptions.headers || {})
        }
    };

    let response = await fetch(buildUrl(path), requestOptions);

    if (!authStatuses.includes(response.status)) {
        return response;
    }

    if (await isBusinessForbidden(response)) {
        return response;
    }

    const refreshResponse = await refreshSession({ redirectOnAuthFailure: false });

    if (!refreshResponse.ok) {
        if (redirectOnAuthFailure) redirectToLogin();
        return response;
    }

    response = await fetch(buildUrl(path), requestOptions);
    if (
        authStatuses.includes(response.status) &&
        !(await isBusinessForbidden(response)) &&
        redirectOnAuthFailure
    ) {
        redirectToLogin();
    }

    return response;
}

export async function refreshSession(options = {}) {
    const { redirectOnAuthFailure = true } = options;
    const response = await fetch(buildUrl("/user/refresh"), {
        method: "POST",
        credentials: "include"
    });

    if (!response.ok && redirectOnAuthFailure) {
        redirectToLogin();
    }

    return response;
}

export function apiUrl(path) {
    return buildUrl(path);
}
