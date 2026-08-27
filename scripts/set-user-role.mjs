/**
 * Trusted operator command for CMS menu roles.
 *
 * Usage:
 *   npm run user:role -- promote <phone>
 *   npm run user:role -- standard <phone>
 *
 * This command is intentionally not exposed through HTTP. It uses the backend
 * AWS identity and updates only the matching existing profile.
 */
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
require('dotenv').config();

const { setUserRoleByPhone } = require('../server/lib/userProfiles');

function normalizePhone(rawPhone) {
  if (typeof rawPhone !== 'string') return '';
  const trimmed = rawPhone.trim();
  const digits = trimmed.replace(/\D/g, '');
  if (!digits) return '';
  if (trimmed.startsWith('+')) return `+${digits}`;
  if (digits.startsWith('00')) return `+${digits.slice(2)}`;
  if (digits.startsWith('39') && digits.length >= 11) return `+${digits}`;
  return `+39${digits}`;
}

function maskedPhone(phone) {
  return `${phone.slice(0, 4)}${'*'.repeat(Math.max(0, phone.length - 7))}${phone.slice(-3)}`;
}

const [, , command, rawPhone] = process.argv;
const phone = normalizePhone(rawPhone);
const roles = {
  promote: { type: 'admin', adminPsw: true },
  standard: { type: 'standard', adminPsw: false },
};

if (!roles[command] || !phone) {
  console.error('Usage: npm run user:role -- <promote|standard> <phone>');
  process.exit(1);
}

try {
  const profile = await setUserRoleByPhone(phone, roles[command]);
  const roleApplied = profile?.type === roles[command].type
    && profile?.adminPsw === roles[command].adminPsw;
  if (!roleApplied) throw new Error('Role update could not be verified');
  console.log(`Role ${roles[command].type} applied to ${maskedPhone(phone)}.`);
} catch (error) {
  console.error(`Unable to update ${maskedPhone(phone)}: ${error.message}`);
  process.exit(1);
}