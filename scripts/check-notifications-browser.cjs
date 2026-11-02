// All writes are browser-intercepted fixtures. Reads the uploaded Excel and
// checks real draft guide existence on S3, but never writes any real AWS data.
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const { chromiumSession } = require('./lib/chromium-session.cjs');
const { previewImport } = require('../server/lib/notificationExcel');
const { romeToday } = require('../server/lib/notificationDates');

async function main() {
  if (!process.env.REPLIT_DEV_DOMAIN) throw new Error('Development domain required');
  const file = path.resolve(process.argv.slice(2).find((value) => !value.startsWith('--')) || 'attached_assets/0_S2C_calendario_notifiche_2027_V3_1793633892347.xlsx');
  const calendarFile = await fs.readFile(file);
  const preview = await previewImport(calendarFile); // Read-only validation against actual draft guides.
  assert.equal(preview.canConfirm, true);
  assert.equal(preview.totalRows, 45);
  const origin = `https://${process.env.REPLIT_DEV_DOMAIN}`;
  const sections = structuredClone((await import('../src/lib/sectionAccess.js')).DEFAULT_SECTIONS);
  sections.notifications.status = 'published';
  const readIds = new Set();
  const today = romeToday();
  let records = Array.from({ length: 12 }, (_, index) => ({
    id: `TEST-${index + 1}`, message: { it: `📢 Notifica reale simulata ${index + 1}`, en: '', bn: '' },
    link: '/guides/health/emergency', startDate: today, endDate: today, active: true,
    territory: 'Tutti', tipo: 'content_engagement', obiettivo: 'leggere_contenuti', guideId: 'emergency',
    contentId: '004', frequency: 'una_volta', dateStatus: 'Confermata', hook: '',
  }));
  let imported = false;
  let exported = false;
  const sessions = [];
  const appItems = (lang) => {
    if (sections.notifications.status === 'internal') return [];
    return records.filter((item) => item.active && item.startDate <= today && item.endDate >= today
      && ['Tutti', 'Monfalcone'].includes(item.territory)).map((item) => ({
      id: item.id, message: item.message[lang] || item.message.it, link: item.link,
      startDate: item.startDate, read: readIds.has(item.id),
    }));
  };
  const createBrowser = async () => {
    const browser = await chromiumSession();
    sessions.push(browser);
    const { cdp, events } = browser;
    events['Fetch.requestPaused'] = async ({ requestId, request }) => {
      const url = new URL(request.url);
      const contentType = Object.entries(request.headers).find(([key]) => key.toLowerCase() === 'content-type')?.[1];
      const body = request.postData && contentType?.includes('application/json')
        ? JSON.parse(request.postData) : null;
      let response = {};
      let code = 200;
      let mime = 'application/json';
      if (url.pathname === '/api/users/preview-admin/session') response = { type: 'fincantieri_users', phone: '+390000000001', firstName: 'Fixture' };
      else if (url.pathname === '/api/sections') response = { sections };
      else if (url.pathname.startsWith('/api/notifications')) {
        const items = appItems(url.searchParams.get('lang') || 'it');
        if (url.pathname.endsWith('/read-all')) items.forEach((item) => readIds.add(item.id));
        else if (url.pathname.endsWith('/read')) (body?.ids || []).forEach((id) => readIds.add(id));
        const updated = appItems(url.searchParams.get('lang') || 'it');
        response = { items: updated, unread: updated.filter((item) => !item.read).length };
      } else if (url.pathname === '/api/admin/notifications/import/preview') response = preview;
      else if (url.pathname === '/api/admin/notifications/import/confirm') {
        const map = new Map(records.map((item) => [item.id, item]));
        assert.equal(body.notifications.length, 45);
        body.notifications.forEach((item) => map.set(item.id, item));
        records = [...map.values()]; imported = true;
        response = { notifications: records, imported: 45 };
      } else if (url.pathname === '/api/admin/notifications/export') {
        exported = true; response = calendarFile;
        mime = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
      } else if (url.pathname === '/api/admin/notifications') response = { notifications: records };
      else if (url.pathname.startsWith('/api/admin/notifications/') && request.method === 'PUT') {
        records = records.map((item) => item.id === body.id ? body : item);
        response = { notifications: records };
      } else if (url.pathname === '/api/admin/content' || url.pathname === '/api/content') {
        response = url.searchParams.get('type') === 'guides'
          ? [{ id: 'emergency', title: 'Pronto soccorso', category: 'health', url: '/guides/health/emergency' }] : [];
      } else if (url.pathname.endsWith('/guides/emergency')) response = { id: 'emergency', title: 'Pronto soccorso', body: '<p>Guida di prova</p>', visibility: 'published' };
      else { response = null; code = 404; }
      await cdp('Fetch.fulfillRequest', {
        requestId, responseCode: code, responseHeaders: [{ name: 'Content-Type', value: mime }],
        body: (Buffer.isBuffer(response) ? response : Buffer.from(JSON.stringify(response))).toString('base64'),
      });
    };
    events['Runtime.exceptionThrown'] = ({ exceptionDetails }) => browser.failures.push(exceptionDetails.exception?.description || exceptionDetails.text);
    await cdp('Runtime.enable'); await cdp('Page.enable');
    await cdp('Fetch.enable', { patterns: [{ urlPattern: '*/api/*' }] });
    const adminToken = `e30.${Buffer.from(JSON.stringify({ email: 'fixture@example.invalid', exp: Math.floor(Date.now() / 1000) + 3600 })).toString('base64url')}.fixture`;
    await cdp('Page.addScriptToEvaluateOnNewDocument', { source: `
      localStorage.setItem('s2c_preview_session', 'fixture-browser-session');
      localStorage.setItem('adminToken', ${JSON.stringify(adminToken)});
      localStorage.setItem('s2c_lang', 'it');
    ` });
    browser.visit = (route) => cdp('Page.navigate', { url: origin + route });
    browser.clickText = (text) => browser.evaluate(`(() => {
      const button = [...document.querySelectorAll('button')].find(node => node.textContent.trim() === ${JSON.stringify(text)});
      if (!button) throw new Error('Missing button ' + ${JSON.stringify(text)});
      button.click();
    })()`);
    return browser;
  };
  try {
    if (process.argv.includes('--cms-mobile-only')) {
      records = [...records, ...preview.rows.map((row) => row.notification)];
      const browser = await createBrowser();
      await browser.visit('/admin/content/notifiche');
      await browser.wait(`!!document.querySelector('.cms-notif-table')`);
      await browser.clickText('Calendario');
      await browser.cdp('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 1, mobile: true });
      await browser.wait(`!!document.querySelector('.cms-notif-calendar-grid')`);
      await browser.screenshot('s2c-notifications-cms-mobile.png');
      const layout = await browser.evaluate(`({
        width: innerWidth, scrollWidth: document.documentElement.scrollWidth,
        wide: [...document.querySelectorAll('.cms-notifications *')].filter(node => node.getBoundingClientRect().right > 391)
          .slice(0,12).map(node=>({tag:node.tagName, cls:node.className,width:node.getBoundingClientRect().width}))
      })`);
      console.log(JSON.stringify(layout));
      assert.ok(layout.scrollWidth <= 391, 'CMS mobile overflow');
      console.log('CMS_MOBILE_PASS');
      return;
    }
    const browser = await createBrowser();
    const { evaluate, wait, cdp } = browser;
    await browser.visit('/home');
    await wait(`document.querySelector('.notif-bell-count')?.textContent === '9+'`);
    await evaluate(`document.querySelector('.notif-bell').click()`);
    await wait(`document.querySelectorAll('.notif-card.unread').length === 12`);
    await evaluate(`document.querySelector('.notif-card').click()`);
    await wait(`location.pathname === '/guides/health/emergency'`);
    assert.equal(readIds.size, 1);
    await browser.visit('/notifications');
    await wait(`document.querySelectorAll('.notif-card.unread').length === 11`);
    await evaluate(`document.querySelector('.notif-read-all').click()`);
    await wait(`document.querySelectorAll('.notif-card.unread').length === 0 && !document.querySelector('.notif-bell-count')`);
    assert.equal(readIds.size, 12);
    const anotherBrowser = await createBrowser();
    await anotherBrowser.visit('/notifications');
    await anotherBrowser.wait(`document.querySelectorAll('.notif-card.read').length === 12 && !document.querySelector('.notif-bell-count')`);
    await evaluate(`document.querySelector('.top-lang-btn').click()`);
    await wait(`document.querySelectorAll('.top-lang-option').length === 3`);
    await evaluate(`document.querySelectorAll('.top-lang-option')[2].click()`);
    await wait(`document.querySelector('.top-lang-btn').textContent.includes('BN')`);
    await wait(`document.querySelector('.notif-card .notif-text')?.textContent.includes('Notifica reale simulata')`);
    await cdp('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 1, mobile: true });
    assert.ok(await evaluate(`document.documentElement.scrollWidth <= 391`));
    await browser.screenshot('s2c-notifications-mobile.png');
    sections.notifications.status = 'internal';
    await browser.visit('/notifications');
    await wait(`location.pathname === '/home' && !!document.querySelector('.home-page')`);
    assert.equal(await evaluate(`!!document.querySelector('.notif-bell')`), false);
    await browser.visit('/admin/content/notifiche');
    await wait(`!!document.querySelector('.cms-notif-table')`);
    await cdp('Emulation.setDeviceMetricsOverride', { width: 1280, height: 1000, deviceScaleFactor: 1, mobile: false });
    await browser.clickText('Nuova notifica');
    await wait(`!!document.querySelector('form[aria-label="Nuova notifica"]')`);
    assert.equal(await evaluate(`document.querySelectorAll('.cms-notif-language textarea').length`), 3);
    assert.ok(await evaluate(`[...document.querySelectorAll('select option')].some(node => node.value === 'welcome')`));
    await browser.clickText('Annulla');
    await wait(`!document.querySelector('.cms-notif-editor')`);
    const doc = await cdp('DOM.getDocument');
    const input = await cdp('DOM.querySelector', { nodeId: doc.root.nodeId, selector: 'input[type="file"]' });
    await cdp('DOM.setFileInputFiles', { nodeId: input.nodeId, files: [file] });
    await wait(`document.body.textContent.includes('Conferma import')`);
    assert.equal(await evaluate(`[...document.querySelectorAll('button')].find(node=>node.textContent.trim()==='Conferma import').disabled`), false);
    assert.ok(await evaluate(`document.body.textContent.includes('N-WELCOME')`));
    await browser.screenshot('s2c-notifications-import.png');
    await browser.clickText('Conferma import');
    await wait(`document.body.textContent.includes('Import completato:')`);
    assert.equal(imported, true);
    assert.equal(records.length, 57);
    await browser.clickText('Esporta Excel');
    await wait(`document.body.textContent.includes('Esportazione avviata')`);
    assert.equal(exported, true);
    await browser.clickText('Calendario');
    await wait(`!!document.querySelector('.cms-notif-calendar-grid')`);
    await browser.screenshot('s2c-notifications-calendar.png');
    await cdp('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 1, mobile: true });
    assert.ok(await evaluate(`document.documentElement.scrollWidth <= 391`));
    for (const session of sessions) assert.deepEqual(session.failures, []);
    console.log('NOTIFICATIONS_BROWSER_PASS: bell 9+, click/read/all-read, persisted fixture state in a second browser, BN fallback, hidden section, mobile, CMS editor/welcome, real 45-row Excel preview/confirm, export and calendar.');
    console.log('No real AWS writes. Preview checked actual draft guide existence via read-only S3 requests.');
  } finally { for (const session of sessions) await session.close(); }
}

main().catch((err) => { console.error(err.stack); process.exitCode = 1; });
