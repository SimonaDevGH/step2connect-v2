/**
 * Runs only after OTP verification. The authenticated UI can load independently.
 * Consent must never be sent before profile sync succeeds or on ordinary login.
 */
export async function syncProfileAfterLogin({
  isRegister, idToken, profile, consent, syncProfile, savePrivacyConsent,
  warn = (message) => console.warn(message),
}) {
  try {
    await syncProfile(idToken, profile, { requireSuccess: isRegister });
  } catch {
    if (isRegister) warn('[privacy-consent] profile sync failed; consent not saved');
    return;
  }
  if (!isRegister || consent?.privacy_policy_consent !== true
    || typeof consent.privacyAcceptedAt !== 'string') return;
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      await savePrivacyConsent(idToken, consent);
      return;
    } catch {
      // Retry once, then allow access without logging any personal data.
    }
  }
  warn('[privacy-consent] save failed after two attempts');
}
