// Optional browser regression check. All application API calls are intercepted
// inside Chromium; no real accounts, credentials or S3 objects are changed.
// Run: node --experimental-websocket scripts/test-visibility-browser.cjs
const assert = require('node:assert/strict');
const { spawn } = require('node:child_process');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');

async function main() {
  if (typeof WebSocket === 'undefined') throw new Error('Use node --experimental-websocket');
  if (!process.env.REPLIT_DEV_DOMAIN) throw new Error('REPLIT_DEV_DOMAIN is required');
  const origin = `https://${process.env.REPLIT_DEV_DOMAIN}`;
  const profile = await fs.mkdtemp(path.join(os.tmpdir(), 's2c-browser-'));
  const chrome = spawn('/repl/tools/bin/chromium', [
    '--headless', '--no-sandbox', '--disable-gpu', '--disable-dev-shm-usage',
    '--remote-debugging-port=0', `--user-data-dir=${profile}`, 'about:blank',
  ], { stdio: ['ignore', 'ignore', 'pipe'] });
  let socket;
  try {
    const browserUrl = await new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error('Chromium startup timeout')), 20000);
      chrome.stderr.on('data', (data) => {
        const match = data.toString().match(/DevTools listening on (ws:\/\/[^\s]+)/);
        if (match) { clearTimeout(timer); resolve(match[1]); }
      });
      chrome.once('exit', (code) => { clearTimeout(timer); reject(new Error(`Chromium exited: ${code}`)); });
    });
    const debuggingOrigin = browserUrl.replace(/^ws:/, 'http:').split('/devtools/')[0];
    const targets = await (await fetch(`${debuggingOrigin}/json/list`)).json();
    socket = new WebSocket(targets.find((target) => target.type === 'page').webSocketDebuggerUrl);
    await new Promise((resolve, reject) => { socket.onopen = resolve; socket.onerror = reject; });
    let sequence = 0;
    const pending = new Map();
    const events = {};
    const cdp = (method, params = {}) => new Promise((resolve, reject) => {
      const id = ++sequence;
      const timer = setTimeout(() => { pending.delete(id); reject(new Error(`CDP timeout: ${method}`)); }, 15000);
      pending.set(id, { resolve, reject, timer });
      socket.send(JSON.stringify({ id, method, params }));
    });
    socket.onmessage = ({ data }) => {
      const value = JSON.parse(data);
      if (value.id) {
        const entry = pending.get(value.id);
        if (!entry) return;
        clearTimeout(entry.timer);
        pending.delete(value.id);
        value.error ? entry.reject(new Error(JSON.stringify(value.error))) : entry.resolve(value.result);
      } else if (events[value.method]) {
        Promise.resolve(events[value.method](value.params)).catch((err) => { console.error(err.message); process.exitCode = 1; });
      }
    };
    const evaluate = async (expression) => {
      const result = await cdp('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
      if (result.exceptionDetails) throw new Error(result.exceptionDetails.text);
      return result.result?.value;
    };
    const wait = async (expression) => {
      for (let attempt = 0; attempt < 100; attempt++) {
        if (await evaluate(expression)) return;
        await new Promise((resolve) => setTimeout(resolve, 100));
      }
      throw new Error(`Browser assertion timed out: ${expression}`);
    };
    const click = async (selector, label) => evaluate(`(() => {
      const node = [...document.querySelectorAll(${JSON.stringify(selector)})]
        .find(node => node.textContent.trim() === ${JSON.stringify(label)});
      if (!node) throw new Error('Missing button: ' + ${JSON.stringify(label)});
      node.click(); return true;
    })()`);
    const defaultSections = (await import('../src/lib/sectionAccess.js')).DEFAULT_SECTIONS;
    const sections = structuredClone(defaultSections);
    const guides = ['internal', 'preview', 'published'].map((visibility) => ({
      id: `fixture-${visibility}`, type: 'guides', category: 'documents',
      title: `Fixture ${visibility}`, body: `<p>Body ${visibility}</p>`, visibility,
      status: 'published', hasUnpublishedChanges: true,
      updatedAt: '2026-01-01T00:00:00Z', url: `/guides/documents/fixture-${visibility}`,
    }));
    let role = 'admin';
    const interceptedWrites = [];
    events['Fetch.requestPaused'] = async ({ requestId, request }) => {
      const url = new URL(request.url);
      let body = {};
      const contentType = 'application/json';
      if (url.pathname === '/api/users/preview-admin/session') {
        body = { type: role, phone: '+393123456789', firstName: 'Fixture', isAdmin: role === 'admin' };
      } else if (url.pathname === '/api/sections') body = { sections };
      else if (request.method === 'PUT' && url.pathname.startsWith('/api/admin/sections/')) {
        const key = url.pathname.split('/').pop();
        sections[key] = { status: JSON.parse(request.postData).status };
        interceptedWrites.push(url.pathname);
        body = { sections };
      } else if (request.method === 'PUT' && url.pathname.endsWith('/visibility')) {
        const id = url.pathname.split('/').at(-2);
        Object.assign(guides.find((guide) => guide.id === id), JSON.parse(request.postData));
        interceptedWrites.push(url.pathname);
        body = { ok: true };
      } else if (url.pathname === '/api/admin/content') body = guides;
      else if (url.pathname === '/api/content') body = url.searchParams.get('type') === 'guides' ? guides : [];
      else if (url.pathname.startsWith('/api/content/guides/')) body = guides.find((guide) => guide.id === url.pathname.split('/').pop()) || null;
      else if (url.pathname.startsWith('/api/content/')) body = null;
      await cdp('Fetch.fulfillRequest', {
        requestId, responseCode: body === null ? 404 : 200,
        responseHeaders: [{ name: 'Content-Type', value: contentType }],
        body: Buffer.from(JSON.stringify(body)).toString('base64'),
      });
    };
    events['Page.javascriptDialogOpening'] = () => cdp('Page.handleJavaScriptDialog', { accept: true });
    await cdp('Page.enable');
    await cdp('Fetch.enable', { patterns: [{ urlPattern: '*/api/*' }] });
    const dummyToken = `e30.${Buffer.from(JSON.stringify({
      email: 'fixture@example.invalid', exp: Math.floor(Date.now() / 1000) + 3600,
    })).toString('base64url')}.fixture`;
    await cdp('Page.addScriptToEvaluateOnNewDocument', { source: `
      localStorage.setItem('s2c_preview_session', 'browser-fixture-only');
      localStorage.setItem('adminToken', ${JSON.stringify(dummyToken)});
    ` });
    const visit = async (route) => cdp('Page.navigate', { url: origin + route });
    await visit('/admin/content');
    await wait(`location.pathname === '/admin/content/guide-pratiche' && !!document.querySelector('.cms-row-visibility')`);
    assert.equal(await evaluate(`document.querySelectorAll('.cms-section-tab').length`), 9);
    await click('.cms-section-tab', 'Quiz');
    await wait(`document.querySelector('h1')?.textContent === 'Quiz'`);
    await click('.cms-status-pill', 'Anteprima');
    await wait(`document.body.textContent.includes('Salvato')`);
    assert.equal(sections.quiz.status, 'preview');
    await click('.cms-section-tab', 'Guide pratiche');
    await wait(`!!document.querySelector('.cms-row-visibility')`);
    await evaluate(`document.querySelectorAll('.cms-row-visibility')[0].querySelectorAll('button')[1].click()`);
    await wait(`document.body.textContent.includes('Salvato')`);
    assert.equal(guides[0].visibility, 'preview');
    // Restore the internal fixture through the same UI.
    await evaluate(`document.querySelectorAll('.cms-row-visibility')[0].querySelectorAll('button')[0].click()`);
    await wait(`document.body.textContent.includes('Salvato')`);
    assert.equal(guides[0].visibility, 'internal');
    await click('.cms-section-tab', 'Altro');
    await wait(`document.body.textContent.includes('Altre sezioni')`);
    assert.equal(await evaluate(`document.querySelectorAll('.cms-section-status').length`), 2);
    await cdp('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 1, mobile: true });
    assert.equal(await evaluate(`document.documentElement.scrollWidth <= 391`), true);
    await visit('/offices');
    await wait(`location.pathname === '/offices' && document.body.textContent.includes('Questura')`);
    await cdp('Page.reload');
    await wait(`location.pathname === '/offices' && document.body.textContent.includes('Questura')`);
    await evaluate(`document.querySelector('button[aria-label="Menu"]').click()`);
    assert.ok(await evaluate(`document.querySelector('.side-menu').textContent.includes('Interno')`));
    role = 'fincantieri_users';
    await visit('/offices');
    await wait(`location.pathname === '/home' && !!document.querySelector('.home-page')`);
    assert.equal(await evaluate(`!!document.querySelector('.offices-card')`), false);
    await evaluate(`document.querySelector('button[aria-label="Menu"]').click()`);
    assert.equal(await evaluate(`document.querySelector('.side-menu').textContent.includes('Trova uffici')`), false);
    await visit('/quiz');
    await wait(`location.pathname === '/quiz' && !!document.querySelector('.page-hero')`);
    await visit('/guides/documents');
    await wait(`document.body.textContent.includes('Fixture preview')`);
    assert.equal(await evaluate(`document.body.textContent.includes('Fixture internal')`), false);
    await visit('/guides/documents/fixture-internal');
    await wait(`!!document.querySelector('.guide-placeholder-block')`);
    assert.equal(await evaluate(`document.body.textContent.includes('Body internal')`), false);
    await visit('/guides/documents/fixture-preview');
    await wait(`document.body.textContent.includes('Body preview')`);
    assert.ok(interceptedWrites.length >= 3);
    console.log('BROWSER_VISIBILITY_PASS: CMS immediate section/page saves, mobile tabs, Altro controls, admin refresh, preview role menu/Home/direct routes and guide filtering.');
    console.log('All API writes intercepted. No live user or S3 data changed.');
  } finally {
    socket?.close();
    chrome.kill('SIGTERM');
    await new Promise((resolve) => chrome.once('exit', resolve));
    await fs.rm(profile, { recursive: true, force: true });
  }
}

main().catch((err) => { console.error(err.message); process.exitCode = 1; });
