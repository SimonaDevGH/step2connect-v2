/**
 * Runs after successful Cognito SMS authentication, independently of page lifetime.
 * The token never enters the CRM payload or browser storage.
 */
export async function syncLegacyProfileAfterLogin({
  idToken, profile, token, syncProfile, completeLegacyMigration,
  warn = message => console.warn(message),
}) {
  try {
    // Strict even for existing users; ordinary login retains its own behavior.
    await syncProfile(idToken, profile, { requireSuccess: true });
  } catch {
    warn('[legacy] profile sync failed; migration not completed');
    return;
  }
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      await completeLegacyMigration(idToken, token);
      return;
    } catch {
      // A failed response may follow a successful write; the second request is safe.
    }
  }
  warn('[legacy] completion failed after two attempts');
}
