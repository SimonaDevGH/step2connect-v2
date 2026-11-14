export function isValidEmail(value) {
  return typeof value === 'string' && value.trim().length <= 254
    && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
}
