/**
 * CMS navigation is based on the role resolved by the authenticated backend
 * profile. Preview-only credentials are intentionally not part of this check.
 */
export function isCmsAdmin(user) {
  return user?.type === 'admin';
}