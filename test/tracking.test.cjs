const assert = require('node:assert/strict');
const test = require('node:test');
const fs = require('node:fs');
const path = require('node:path');

const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
const load = () => import('../vite-plugins/tracking.js');

test('senza ID index.html resta invariato', async () => {
  const { injectTracking } = await load();
  assert.equal(injectTracking(html, {}), html);
});

test('con GTM e CookieYes: ordine consenso → banner → GTM, CSP estesa, noscript', async () => {
  const { injectTracking } = await load();
  const out = injectTracking(html, { gtmId: 'GTM-MBTNLTFT', cookieyesId: 'cfb0840a1223a996cd39c212' });
  const consent = out.indexOf("gtag('consent','default'");
  const banner = out.indexOf('cdn-cookieyes.com/client_data/cfb0840a1223a996cd39c212/script.js');
  const gtm = out.indexOf("'dataLayer','GTM-MBTNLTFT'");
  const firstModule = out.indexOf('<script type="module"');
  assert.ok(consent > 0 && consent < banner && banner < gtm && gtm < firstModule);
  assert.match(out, /analytics_storage:'denied'/);
  assert.match(out, /<body>\n    <noscript><iframe src="https:\/\/www\.googletagmanager\.com\/ns\.html\?id=GTM-MBTNLTFT"/);
  const csp = out.match(/Content-Security-Policy" content="([^"]*)"/)[1];
  assert.match(csp, /script-src [^;]*https:\/\/www\.googletagmanager\.com/);
  assert.match(csp, /script-src [^;]*https:\/\/cdn-cookieyes\.com/);
  assert.match(csp, /connect-src [^;]*https:\/\/\*\.google-analytics\.com/);
  assert.match(csp, /connect-src [^;]*https:\/\/log\.cookieyes\.com/);
  assert.match(csp, /frame-src [^;]*https:\/\/www\.googletagmanager\.com/);
});

test('solo GTM: niente banner né sorgenti CookieYes aggiunte', async () => {
  const { injectTracking } = await load();
  const out = injectTracking(html, { gtmId: 'GTM-ABC123' });
  assert.ok(!out.includes('cdn-cookieyes.com/client_data'));
  assert.ok(!out.includes('log.cookieyes.com'));
  assert.match(out, /GTM-ABC123/);
});

test('ID non validi vengono rifiutati (niente iniezione di codice)', async () => {
  const { validateTrackingIds } = await load();
  assert.throws(() => validateTrackingIds({ gtmId: "GTM-X');alert(1);//" }), /VITE_GTM_ID/);
  assert.throws(() => validateTrackingIds({ cookieyesId: '../evil' }), /VITE_COOKIEYES_ID/);
});

test('extendCsp non duplica sorgenti e crea direttive mancanti', async () => {
  const { extendCsp } = await load();
  const out = extendCsp("default-src 'self'; script-src 'self' https://a.com", { 'script-src': ['https://a.com', 'https://b.com'], 'frame-src': ['https://c.com'] });
  assert.equal(out, "default-src 'self'; script-src 'self' https://a.com https://b.com; frame-src 'self' https://c.com;");
});
