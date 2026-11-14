const { sendEmail } = require('./sendEmail');
const { normalizeEmail } = require('./legacyUsers');

const COOLDOWN_MS = 10 * 60 * 1000;
const escapeHtml = value => String(value).replace(/[&<>"']/g, char => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
}[char]));

function legacyAccessMessage(record) {
  const name = String(record.first_name || record.display_name || '').trim();
  const link = record.link_univoco;
  const url = new URL(link);
  if (!['https:', 'http:'].includes(url.protocol)) throw new Error('Invalid legacy access link');
  const parts = [
    { lang: 'it', greeting: 'Ciao', text: 'Per accedere alla nuova Step2Connect apri questo link, conferma i tuoi dati e inserisci il tuo numero di telefono.',
      button: 'Accedi a Step2Connect', note: 'Il link è personale e non va condiviso.' },
    { lang: 'en', greeting: 'Hello', text: 'To access the new Step2Connect, open this link, confirm your details and enter your phone number.',
      button: 'Access Step2Connect', note: 'This link is personal. Do not share it.' },
    { lang: 'bn', greeting: 'নমস্কার', text: 'নতুন Step2Connect-এ প্রবেশ করতে এই লিংকটি খুলুন, আপনার তথ্য নিশ্চিত করুন এবং আপনার ফোন নম্বর লিখুন।',
      button: 'Step2Connect-এ প্রবেশ করুন', note: 'এই লিংকটি ব্যক্তিগত। এটি কারও সাথে শেয়ার করবেন না।' },
  ];
  return {
    to: normalizeEmail(record.user_email),
    subject: 'Step2Connect — Link personale / Personal link / ব্যক্তিগত লিংক',
    text: parts.map(part => `${part.greeting}${name ? ` ${name}` : ''},\n${part.text}\n${link}\n${part.note}`).join('\n\n---\n\n'),
    html: `<!doctype html><html><body>${parts.map(part =>
      `<section lang="${part.lang}"><p>${part.greeting}${name ? ` ${escapeHtml(name)}` : ''},</p><p>${part.text}</p><p><a href="${escapeHtml(link)}">${part.button}</a></p><p>${part.note}</p></section>`
    ).join('<hr>')}</body></html>`,
  };
}

// Only IDs, timestamps and in-flight promises are retained, never a registry cache.
// Concurrent calls for the same row share the result, including delivery failures.
function createLegacyEmailSender({
  send = sendEmail, now = Date.now, getFrom = () => process.env.LEGACY_FROM_EMAIL,
} = {}) {
  const deliveries = new Map();
  return async function sendLegacyAccessEmail(record) {
    // No fallback to the admin sender, including during the cooldown period.
    const from = String(getFrom() || '').trim();
    if (!/^[^\s@<>]+@step2connect\.it$/i.test(from)) throw new Error('Legacy sender not configured');
    const time = now();
    for (const [id, delivery] of deliveries) {
      if (!delivery.pending && time - delivery.sentAt >= COOLDOWN_MS) deliveries.delete(id);
    }
    const current = deliveries.get(record.id);
    if (current?.pending) return current.pending;
    if (current && time - current.sentAt < COOLDOWN_MS) return;
    const delivery = {};
    deliveries.set(record.id, delivery);
    // Defer sending until the pending promise is stored, even for synchronous failures.
    delivery.pending = Promise.resolve().then(() => send({ ...legacyAccessMessage(record), from }));
    try {
      await delivery.pending;
      delivery.sentAt = now();
      delivery.pending = null;
    } catch {
      deliveries.delete(record.id);
      throw new Error('Legacy email delivery failed');
    }
  };
}

module.exports = {
  COOLDOWN_MS, legacyAccessMessage, createLegacyEmailSender,
  sendLegacyAccessEmail: createLegacyEmailSender(),
};
