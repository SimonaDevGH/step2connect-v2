/**
 * Starts the phone login flow.
 *
 * The account status is checked before either form starts an OTP flow.
 * Existing standard accounts start Cognito, while preview accounts keep the
 * server challenge flow.
 */
export async function beginPhoneLogin({
  mode,
  phone,
  userData,
  getPhoneAccountStatus,
  checkPreviewAdmin,
  requestOTP,
}) {
  const account = await getPhoneAccountStatus(phone);
  if (!account) {
    return { kind: 'error' };
  }

  if (mode === 'login' && !account.exists) {
    return { kind: 'switch-to-register' };
  }

  if (mode === 'register' && account.exists) {
    return { kind: 'switch-to-login' };
  }

  if (mode === 'login') {
    if (account.flow === 'preview') {
      const preview = await checkPreviewAdmin(phone);
      if (preview?.isAdmin) {
        return { kind: 'admin-preview-code', challenge: preview.challenge };
      }
    }
  }

  return {
    kind: 'otp',
    result: await requestOTP(phone, userData),
  };
}