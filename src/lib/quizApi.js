import { fetchAuthSession } from 'aws-amplify/auth';

export function quizStars(score = 0, total = 4) {
  if (!total || !score) return 0;
  return score >= total ? 3 : score / total >= 0.75 ? 2 : score / total >= 0.5 ? 1 : 0;
}

export async function quizToken() {
  const preview = localStorage.getItem('s2c_preview_session');
  if (preview) return preview;
  try {
    const session = await fetchAuthSession();
    return session?.tokens?.idToken?.toString() || '';
  } catch {
    return '';
  }
}

export async function quizApi(path, options = {}) {
  const token = await quizToken();
  const headers = { ...(options.body instanceof FormData ? {} : { 'Content-Type': 'application/json' }), ...(options.headers || {}) };
  if (token) headers.Authorization = `Bearer ${token}`;
  const response = await fetch(path, { ...options, headers });
  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    throw new Error(body.error || `HTTP ${response.status}`);
  }
  return response.json();
}
