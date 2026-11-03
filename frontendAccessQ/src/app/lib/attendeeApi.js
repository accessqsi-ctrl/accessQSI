"use client";

// Session participant (box) : cookies distincts de ceux des organisateurs, renouvelés via /attendee/refresh.
const buildUrl = path => `/api${path}`;

let refreshing = null;
const refreshAttendeeSession = () => {
  // Plusieurs requêtes expirées en même temps partagent un seul renouvellement.
  refreshing ||= fetch(buildUrl("/attendee/refresh"), { method: "POST", credentials: "include" }).finally(() => { refreshing = null; });
  return refreshing;
};

export async function attendeeFetch(path, options = {}) {
  const requestOptions = { ...options, credentials: "include", headers: { ...(options.headers || {}) } };
  const response = await fetch(buildUrl(path), requestOptions);
  if (response.status !== 401) return response;
  const refreshed = await refreshAttendeeSession();
  if (!refreshed.ok) return response;
  return fetch(buildUrl(path), requestOptions);
}

export async function attendeeJson(path, options = {}) {
  const response = await attendeeFetch(path, {
    ...options,
    headers: { ...(options.body ? { "Content-Type": "application/json" } : {}), ...(options.headers || {}) }
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(data.message || "Une erreur est survenue.");
    error.code = data.code;
    error.status = response.status;
    throw error;
  }
  return data;
}

// Renvoie le participant connecté, ou null sans rediriger.
export async function loadAttendee() {
  try {
    return (await attendeeJson("/attendee/me")).attendee;
  } catch (error) {
    if (error.status === 401) return null;
    throw error;
  }
}

export const passwordRules = "8 caractères minimum, avec une majuscule, une minuscule, un chiffre et un symbole, sans espace.";
export const isValidPassword = password => password.length >= 8 && /[A-Z]/.test(password) && /[a-z]/.test(password) && /\d/.test(password) && /[^A-Za-z0-9]/.test(password) && !/\s/.test(password);
