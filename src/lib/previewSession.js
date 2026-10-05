/** Costruisce l'utente solo dal tipo verificato e restituito dal server. */
export function buildPreviewUser(profile) {
  if (!['admin', 'fincantieri_users'].includes(profile?.type)) return null;
  const firstName = profile.firstName ?? '';
  const lastName = profile.lastName ?? '';
  return {
    phone: profile.phone ?? '',
    firstName,
    lastName,
    email: '',
    company: profile.company ?? '',
    site: '',
    name: `${firstName} ${lastName}`.trim()
      || profile.phone || (profile.type === 'admin' ? 'Admin' : ''),
    type: profile.type,
  };
}
