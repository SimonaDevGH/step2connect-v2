export function notificationDate(date, t, lang, now = new Date()) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Rome', year: 'numeric', month: '2-digit', day: '2-digit',
  }).formatToParts(now);
  const part = (type) => parts.find((item) => item.type === type).value;
  const today = `${part('year')}-${part('month')}-${part('day')}`;
  const days = Math.round((Date.parse(`${today}T12:00:00Z`) - Date.parse(`${date}T12:00:00Z`)) / 86400000);
  if (days === 0) return t('notifToday');
  if (days === 1) return t('notifYesterday');
  if (days > 1) return t('notifDaysAgo').replace('{count}', new Intl.NumberFormat(lang).format(days));
  return date;
}

export function splitNotificationMessage(message) {
  const value = String(message || '');
  const first = [...new Intl.Segmenter(undefined, { granularity: 'grapheme' }).segment(value)][0]?.segment || '';
  return /^\p{Extended_Pictographic}|\p{Regional_Indicator}/u.test(first)
    ? { emoji: first, text: value.slice(first.length).trimStart() }
    : { emoji: '', text: value };
}
