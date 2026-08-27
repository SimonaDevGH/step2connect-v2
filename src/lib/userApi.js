import { buildProfileSyncPayload } from './profileSync.js';

const BASE = import.meta.env.VITE_API_BASE_URL;

async function sameOriginApiFetch(path, idToken, options = {}) {
  const res = await fetch(path, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${idToken}`,
      ...(options.headers || {}),
    },
  });
  if (!res.ok) {
    const text = await res.text().catch(() => res.status);
    throw new Error(`API ${path} → ${res.status}: ${text}`);
  }
  return res.json();
}

async function apiFetch(path, idToken, options = {}) {
  if (!BASE) return null;
  const res = await fetch(`${BASE}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${idToken}`,
      ...(options.headers || {}),
    },
  });
  if (!res.ok) {
    const text = await res.text().catch(() => res.status);
    throw new Error(`API ${path} → ${res.status}: ${text}`);
  }
  return res.json();
}

/**
 * Crea o aggiorna il profilo utente al primo accesso.
 * @param {string} idToken
 * @param {{ phone, firstName, lastName, email, company, site }} profile
 */
export async function syncProfile(idToken, profile) {
  // Il login normale non raccoglie nuovamente i dati anagrafici: non inviare
  // stringhe vuote, altrimenti un backend di tipo upsert potrebbe cancellare
  // valori già presenti (anche se impostati manualmente).
  const syncPayload = buildProfileSyncPayload(profile);

  // Unicamente il numero non è un aggiornamento: evita del tutto la chiamata
  // durante un login normale privo di nuovi dati.
  if (!syncPayload) return null;

  try {
    return await apiFetch('/users/sync', idToken, {
      method: 'POST',
      body: JSON.stringify(syncPayload),
    });
  } catch (err) {
    console.warn('[userApi] syncProfile failed (non-blocking):', err.message);
    return null;
  }
}

/**
 * Legge il profilo corrente dell'utente.
 * @param {string} idToken
 */
export async function getMyProfile(idToken) {
  try {
    return await sameOriginApiFetch('/api/users/me', idToken, { method: 'GET' });
  } catch (err) {
    console.warn('[userApi] getMyProfile failed:', err.message);
    return null;
  }
}

/**
 * Verifica se il numero ha già un profilo applicativo prima di avviare Cognito.
 * La risposta contiene solo lo stato necessario al routing del form.
 */
export async function getPhoneAccountStatus(phone) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 4000);

  try {
    const res = await fetch('/api/users/account-status', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phone }),
      signal: controller.signal,
    });
    if (!res.ok) return null;

    const data = await res.json();
    if (data?.exists === false) return { exists: false };
    if (data?.exists === true && ['preview', 'cognito'].includes(data.flow)) {
      return { exists: true, flow: data.flow };
    }
    return null;
  } catch {
    return null;
  } finally {
    clearTimeout(timeoutId);
  }
}

export async function getRegistrationOptions() {
  const res = await fetch('/api/registration-options');
  if (!res.ok) {
    throw new Error(`Registration options unavailable: ${res.status}`);
  }

  const data = await res.json();
  if (!Array.isArray(data?.companies) || !Array.isArray(data?.sites)
    || !data.companies.length || !data.sites.length) {
    throw new Error('Registration options are invalid');
  }

  return {
    companies: data.companies,
    sites: data.sites,
  };
}

/**
 * Prepara una challenge opaca per il login telefonico.
 * La risposta non rivela se il numero appartiene a un amministratore.
 */
export async function checkPreviewAdmin(phone) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 4000);

  try {
    const res = await fetch('/api/users/preview-admin', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phone }),
      signal: controller.signal,
    });
    if (!res.ok) return false;
    const data = await res.json();
    return typeof data.challenge === 'string'
      ? { isAdmin: true, challenge: data.challenge }
      : { isAdmin: false };
  } catch {
    return false;
  } finally {
    clearTimeout(timeoutId);
  }
}

/**
 * Verifica il codice della preview admin e riceve una sessione firmata dal server.
 */
export async function verifyPreviewAdmin(phone, code, challenge) {
  try {
    const res = await fetch('/api/users/preview-admin/verify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phone, code, challenge }),
    });
    if (!res.ok) return null;
    const data = await res.json();
    return data?.isAdmin === true && typeof data.token === 'string' ? data : null;
  } catch {
    return null;
  }
}

/**
 * Verifica una sessione preview già rilasciata dal server.
 */
export async function getPreviewSession(token) {
  try {
    const res = await fetch('/api/users/preview-admin/session', {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) return null;
    const data = await res.json();
    return data?.isAdmin === true && data.type === 'admin' ? data : null;
  } catch {
    return null;
  }
}

/**
 * Aggiorna campi del profilo.
 * @param {string} idToken
 * @param {object} patch
 */
export async function updateMyProfile(idToken, patch) {
  try {
    return await apiFetch('/users/me', idToken, {
      method: 'PATCH',
      body: JSON.stringify(patch),
    });
  } catch (err) {
    console.warn('[userApi] updateMyProfile failed:', err.message);
    return null;
  }
}
