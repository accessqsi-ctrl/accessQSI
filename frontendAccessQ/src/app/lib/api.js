"use client";

const API_URL = process.env.NEXT_PUBLIC_API_URL;

const buildUrl = (path) => {
    if (path.startsWith("http")) return path;
    return `${API_URL}${path}`;
};

export async function apiFetch(path, options = {}) {
    const requestOptions = {
        ...options,
        credentials: "include",
        headers: {
            ...(options.headers || {})
        }
    };

    let response = await fetch(buildUrl(path), requestOptions);

    if (response.status !== 401 && response.status !== 403) {
        return response;
    }

    const refreshResponse = await fetch(buildUrl("/user/refresh"), {
        method: "POST",
        credentials: "include"
    });

    if (!refreshResponse.ok) {
        return response;
    }

    response = await fetch(buildUrl(path), requestOptions);
    return response;
}

export async function refreshSession() {
    return fetch(buildUrl("/user/refresh"), {
        method: "POST",
        credentials: "include"
    });
}

export function apiUrl(path) {
    return buildUrl(path);
}
