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
  try {
    return await apiFetch('/users/sync', idToken, {
      method: 'POST',
      body: JSON.stringify(profile),
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
