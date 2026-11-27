import { validatePhoneNumber } from './phoneValidation.js';

export const PHONE_CHANGE_STORAGE_KEY = 's2c_phone_change';

export function profileError(messageKey) {
  return Object.assign(new Error(messageKey), { messageKey });
}

export function phoneChangeError(error, fallback = 'profilePhoneError') {
  if (error?.messageKey) return error;
  const keys = {
    CodeMismatchException: 'profileCodeIncorrect',
    ExpiredCodeException: 'profileCodeExpired',
    AliasExistsException: 'profilePhoneInUse',
    UsernameExistsException: 'profilePhoneInUse',
    LimitExceededException: 'profileTooManyAttempts',
    TooManyRequestsException: 'profileTooManyAttempts',
  };
  return profileError(keys[error?.name] || fallback);
}

export function normalizeSupportedPhone(phone) {
  return typeof phone === 'string' ? phone.trim().replace(/[\s().-]/g, '') : '';
}

export async function preparePhoneChange({
  currentPhone, newPhone, profilePhone, subject, getAccountStatus, createContext, updateAttributes, now = Date.now,
}) {
  const oldPhone = normalizeSupportedPhone(currentPhone);
  const nextPhone = normalizeSupportedPhone(newPhone);
  if (!validatePhoneNumber(oldPhone).valid || !validatePhoneNumber(nextPhone).valid) throw profileError('profilePhoneInvalid');
  if (oldPhone !== normalizeSupportedPhone(profilePhone)) throw profileError('profileCurrentPhoneIncorrect');
  if (oldPhone === nextPhone) throw profileError('profilePhoneSame');
  const status = await getAccountStatus(nextPhone);
  if (!status) throw profileError('profilePhoneError');
  if (status.exists) throw profileError('profilePhoneInUse');
  const { profileReference } = await createContext(nextPhone);
  if (!profileReference) throw profileError('profilePhoneError');
  await updateAttributes({ userAttributes: { phone_number: nextPhone } });
  return { oldPhone, newPhone: nextPhone, subject, profileReference, phase: 'verification', resendAt: now() + 60_000 };
}

// These are pending UI data, not a Cognito token. The backend verifies the signed
// reference AND the refreshed Cognito subject/verified phone before every write.
export function readPhoneChange(subject) {
  try {
    const value = JSON.parse(sessionStorage.getItem(PHONE_CHANGE_STORAGE_KEY) || 'null');
    if (value?.subject !== subject || !subject || !value.profileReference
      || !['verification', 'sync'].includes(value.phase)
      || !validatePhoneNumber(value.newPhone).valid || !validatePhoneNumber(value.oldPhone).valid
      || !Number.isFinite(value.resendAt)) return null;
    return value;
  } catch { return null; }
}

export function storePhoneChange(value) {
  try {
    if (value) sessionStorage.setItem(PHONE_CHANGE_STORAGE_KEY, JSON.stringify(value));
    else sessionStorage.removeItem(PHONE_CHANGE_STORAGE_KEY);
  } catch { /* Memory-only operation still works if sessionStorage is unavailable. */ }
}
