const assert = require('node:assert/strict');
const test = require('node:test');

const {
  parseCsv,
  parseRegistrationOptions,
} = require('../server/lib/registrationOptions');

test('registration CSV parser maps Azienda and Cantieri columns', () => {
  const csv = '\uFEFFAzienda;Cantieri\n'
    + '"Fincantieri S.p.A.";"Monfalcone (GO)"\n'
    + '"Altra azienda";"Monfalcone (GO)"\n'
    + '"Altra azienda";"Cantiere, prova"\n';

  assert.deepEqual(parseRegistrationOptions(csv), {
    companies: ['Fincantieri S.p.A.', 'Altra azienda'],
    sites: ['Monfalcone (GO)', 'Cantiere, prova'],
  });
});

test('registration CSV parser supports escaped quotes and CRLF', () => {
  const rows = parseCsv('Azienda,Cantieri\r\n"Cantiere ""A""","Sito 1"\r\n');
  assert.deepEqual(rows, [
    ['Azienda', 'Cantieri'],
    ['Cantiere "A"', 'Sito 1'],
  ]);
});

test('registration CSV parser rejects missing required columns', () => {
  assert.throws(
    () => parseRegistrationOptions('Azienda,Altro\nAcme,Sito'),
    /Azienda and Cantieri columns/,
  );
});