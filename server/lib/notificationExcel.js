const ExcelJS = require('exceljs');
const { getCalendar, validateNotification, invalid } = require('./notifications');
const { romeToday, addDays, validDate, weekKey } = require('./notificationDates');

const COLUMNS = [
  ['id_notifica', 'id'], ['obiettivo', 'obiettivo'], ['tipo_notifica', 'tipo'],
  ['ID contenuto', 'contentId'], ['ID guida CMS', 'guideId'], ['pagina', 'link'],
  ['data_pubblicazione', 'startDate'], ['data_fine', 'endDate'],
  ['frequenza', 'frequency'], ['notifica_attiva', 'active'], ['territorio', 'territory'],
  ['Aggancio (perché quella data)', 'hook'], ['Stato data', 'dateStatus'],
  ['Messaggio IT', 'it'], ['Messaggio EN', 'en'], ['Messaggio BN', 'bn'],
];
const normalize = (value) => String(value ?? '').normalize('NFD').replace(/\p{Diacritic}/gu, '').trim().toLowerCase().replace(/\s+/g, ' ');

function cellValue(cell) {
  const value = cell?.value;
  if (value && typeof value === 'object' && !(value instanceof Date)) {
    if ('formula' in value || 'sharedFormula' in value) return value.result;
    if (value.richText) return value.richText.map((part) => part.text).join('');
    if ('text' in value) return value.text;
  }
  return value;
}

function dateValue(value, date1904 = false) {
  if (value instanceof Date && !Number.isNaN(+value)) return value.toISOString().slice(0, 10);
  if (typeof value === 'number') {
    const base = Date.UTC(date1904 ? 1904 : 1899, date1904 ? 0 : 11, date1904 ? 1 : 30);
    return new Date(base + Math.floor(value) * 86400000).toISOString().slice(0, 10);
  }
  const input = String(value ?? '').trim();
  const match = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(input);
  return match ? `${match[3]}-${match[2].padStart(2, '0')}-${match[1].padStart(2, '0')}` : input;
}

async function previewImport(buffer) {
  const workbook = new ExcelJS.Workbook();
  try { await workbook.xlsx.load(buffer); } catch { throw invalid('File Excel non valido'); }
  const sheet = workbook.getWorksheet('Calendario') || workbook.worksheets[0];
  if (!sheet) throw invalid('Il file non contiene fogli');
  if (sheet.rowCount > 5001) throw invalid('Massimo 5000 righe per importazione');
  const headers = new Map();
  sheet.getRow(1).eachCell((cell, column) => headers.set(normalize(cellValue(cell)), column));
  for (const name of ['id_notifica', 'data_pubblicazione']) {
    if (!headers.has(normalize(name))) throw invalid(`Colonna obbligatoria mancante: ${name}`);
  }
  const existing = new Set((await getCalendar()).notifications.map((item) => item.id));
  const seen = new Set();
  const guideCache = new Map();
  const rows = [];
  for (let index = 2; index <= sheet.rowCount; index++) {
    const row = sheet.getRow(index);
    const get = (header) => {
      const column = headers.get(normalize(header));
      return column ? cellValue(row.getCell(column)) : undefined;
    };
    if (!row.hasValues || [...headers.values()].every((col) => cellValue(row.getCell(col)) == null || cellValue(row.getCell(col)) === '')) continue;
    const proposed = (base, alternative) => String(get(alternative) ?? '').trim() ? get(alternative) : get(base);
    const startDate = dateValue(get('data_pubblicazione'), workbook.properties.date1904);
    const endValue = get('data_fine');
    const endDate = String(endValue ?? '').trim()
      ? dateValue(endValue, workbook.properties.date1904)
      : validDate(startDate) ? addDays(startDate, 14) : '';
    const enumValue = (header) => normalize(get(header)).replace(/\s+/g, '_');
    const notification = {
      id: String(get('id_notifica') ?? '').trim(),
      obiettivo: enumValue('obiettivo'), tipo: enumValue('tipo_notifica'),
      contentId: String(get('ID contenuto') ?? '').trim(),
      guideId: String(get('ID guida CMS') ?? '').trim(),
      link: String(get('pagina') ?? '').trim(),
      startDate, endDate, frequency: enumValue('frequenza'),
      active: ['vero', 'true', 'si', '1'].includes(normalize(get('notifica_attiva'))),
      territory: String(get('territorio') ?? '').trim(),
      hook: String(proposed('Aggancio (perché quella data)', 'Aggancio proposto') ?? '').trim(),
      dateStatus: String(proposed('Stato data', 'Stato data proposto') ?? '').trim(),
      message: {
        it: String(proposed('Messaggio IT', 'Messaggio IT proposto') ?? '').trim(),
        en: String(get('Messaggio EN') ?? '').trim(), bn: String(get('Messaggio BN') ?? '').trim(),
      },
    };
    const skipped = normalize(get('Approvazione')) === 'da eliminare';
    const result = { rowNumber: index, notification, errors: [], warnings: [], skipped,
      action: skipped ? 'skip' : existing.has(notification.id) ? 'update' : 'new' };
    if (skipped) result.warnings.push('Riga saltata: Approvazione = Da eliminare');
    else {
      try { result.notification = await validateNotification(notification, guideCache); }
      catch (err) {
        if (err.status !== 400) throw err;
        result.errors.push(...(err.details || [err.message]));
      }
      if (seen.has(notification.id)) result.errors.push(`ID duplicato nel file: ${notification.id}`);
      seen.add(notification.id);
      if ([...notification.message.it].length > 180) result.warnings.push('Messaggio IT oltre 180 caratteri');
      for (const lang of ['en', 'bn']) if (!notification.message[lang]) result.warnings.push(`Traduzione ${lang.toUpperCase()} mancante`);
      if (validDate(startDate) && startDate < romeToday()) result.warnings.push('Data di pubblicazione passata');
    }
    rows.push(result);
  }
  const weeks = new Map();
  for (const row of rows.filter((row) => !row.skipped && validDate(row.notification.startDate))) {
    const key = weekKey(row.notification.startDate);
    weeks.set(key, (weeks.get(key) || 0) + 1);
  }
  for (const row of rows) {
    if (!row.skipped && validDate(row.notification.startDate) && weeks.get(weekKey(row.notification.startDate)) > 2) {
      row.warnings.push('Più di 2 notifiche nella stessa settimana');
    }
  }
  return { rows, totalRows: rows.length, canConfirm: rows.some((row) => !row.skipped) && rows.every((row) => !row.errors.length) };
}

async function exportCalendar() {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet('Calendario');
  sheet.addRow(COLUMNS.map(([label]) => label));
  for (const item of (await getCalendar()).notifications) {
    sheet.addRow(COLUMNS.map(([, key]) => ['it', 'en', 'bn'].includes(key) ? item.message?.[key] || '' : item[key] ?? ''));
  }
  sheet.getRow(1).font = { bold: true };
  sheet.views = [{ state: 'frozen', ySplit: 1 }];
  sheet.columns.forEach((column) => { column.width = 24; });
  return workbook.xlsx.writeBuffer();
}

module.exports = { previewImport, exportCalendar, cellValue, dateValue, COLUMNS };
