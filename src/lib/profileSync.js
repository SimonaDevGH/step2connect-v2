export function buildProfileSyncPayload(profile) {
  const nonEmptyProfile = Object.fromEntries(
    Object.entries(profile || {}).filter(([key, value]) => {
      if (key === 'phone') return typeof value === 'string' && value.trim() !== '';
      return value !== null
        && value !== undefined
        && (typeof value !== 'string' || value.trim() !== '');
    }),
  );

  // Il telefono identifica il profilo, ma da solo non rappresenta una modifica.
  if (!nonEmptyProfile.phone || Object.keys(nonEmptyProfile).length <= 1) return null;
  return nonEmptyProfile;
}