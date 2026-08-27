/**
 * Accetta esclusivamente i due formati telefonici supportati dall'app:
 * - Italia: +39 seguito da 10 cifre nazionali, che iniziano con 3
 * - Bangladesh: +880 seguito da 10 cifre nazionali, che iniziano con 1
 *
 * Gli spazi e i separatori comuni sono consentiti per facilitare la digitazione,
 * ma il prefisso deve iniziare con il carattere "+".
 */
export function validatePhoneNumber(value) {
  if (typeof value !== 'string') return { valid: false };

  const phone = value.trim().replace(/[\s().-]/g, '');
  if (/^\+393\d{9}$/.test(phone)) return { valid: true, country: 'it' };
  if (/^\+8801\d{9}$/.test(phone)) return { valid: true, country: 'bd' };
  return { valid: false };
}