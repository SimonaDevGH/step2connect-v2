// Optional integration journey with isolated API fixtures. Never opens a real
// WhatsApp conversation and never writes to Cognito, DynamoDB or S3.
// Run: node --experimental-websocket scripts/check-home-whatsapp-browser.cjs
const assert = require('node:assert/strict');
const { chromiumSession } = require('./lib/chromium-session.cjs');

async function main() {
  const origin = `https://${process.env.REPLIT_DEV_DOMAIN}`;
  if (!process.env.REPLIT_DEV_DOMAIN) throw new Error('Development domain required');
  const { DEFAULT_SECTIONS } = await import('../src/lib/sectionAccess.js');
  const { WA_ANALYZE_URL, WA_TRANSLATE_URL } = await import('../src/lib/whatsapp.js');
  const sections = structuredClone(DEFAULT_SECTIONS);
  sections.quiz.status = 'published';
  sections.notifications.status = 'published';
  // The existing preview session transport supports only admin/Fincantieri.
  // Use its non-admin role; the unit visibility matrix covers standard too.
  let role = 'fincantieri_users';
  let featuredVisibility = 'published';
  let featuredMissing = false;
  let guidesUnavailable = false;
  const writes = [];
  const browser = await chromiumSession();
  const { cdp, evaluate, wait, events } = browser;
  const title = 'CMS featured fixture';
  try {
    events['Fetch.requestPaused'] = async ({ requestId, request }) => {
      const url = new URL(request.url);
      let body = {};
      let status = 200;
      if (url.pathname === '/api/users/preview-admin/session') {
        body = { type: role, phone: '+390000000001', firstName: 'Fixture', isAdmin: role === 'admin' };
      } else if (url.pathname === '/api/sections') body = { sections };
      else if (url.pathname.startsWith('/api/admin/sections/') && request.method === 'PUT') {
        const key = url.pathname.split('/').pop();
        sections[key] = { status: JSON.parse(request.postData).status };
        writes.push(key);
        body = { sections };
      } else if (url.pathname === '/api/notifications') body = { items: [], unread: 0 };
      else if (url.pathname === '/api/content' || url.pathname === '/api/admin/content') {
        body = [];
        if (url.searchParams.get('type') === 'guides') {
          if (guidesUnavailable) { status = 503; body = { error: 'Fixture unavailable' }; }
          else if (!featuredMissing) body = [{
            id: 'guida-al-servizio', type: 'guides', visibility: featuredVisibility,
            title, metaDesc: 'CMS featured description', emoji: '📘',
            body: '<p>Featured detail fixture</p>', status: 'published',
          }];
        }
      } else if (url.pathname === '/api/content/guides/guida-al-servizio') {
        body = { id: 'guida-al-servizio', title, visibility: featuredVisibility, body: '<p>Featured detail fixture</p>' };
      } else if (url.pathname === '/api/quiz') body = { items: [], progress: {} };
      else if (url.pathname === '/api/quiz/progress') body = { results: {} };
      else { body = null; status = 404; }
      await cdp('Fetch.fulfillRequest', {
        requestId, responseCode: status,
        responseHeaders: [{ name: 'Content-Type', value: 'application/json' }],
        body: Buffer.from(JSON.stringify(body)).toString('base64'),
      });
    };
    events['Runtime.exceptionThrown'] = ({ exceptionDetails }) =>
      browser.failures.push(exceptionDetails.exception?.description || exceptionDetails.text);
    events['Page.javascriptDialogOpening'] = () => cdp('Page.handleJavaScriptDialog', { accept: true });
    await cdp('Page.enable');
    await cdp('Runtime.enable');
    await cdp('Fetch.enable', { patterns: [{ urlPattern: '*/api/*' }] });
    const token = `e30.${Buffer.from(JSON.stringify({
      email: 'fixture@example.invalid', exp: Math.floor(Date.now() / 1000) + 3600,
    })).toString('base64url')}.fixture`;
    await cdp('Page.addScriptToEvaluateOnNewDocument', { source: `
      localStorage.setItem('s2c_preview_session', 'fixture-browser-session');
      localStorage.setItem('adminToken', ${JSON.stringify(token)});
      window.__askMeScrolls = [];
      const originalScroll = Element.prototype.scrollIntoView;
      Element.prototype.scrollIntoView = function(options) {
        window.__askMeScrolls.push({ id: this.id, behavior: options?.behavior });
        return originalScroll.call(this, options);
      };
    ` });
    const visit = async (route) => {
      await cdp('Page.navigate', { url: origin + route });
      await wait(`location.pathname === ${JSON.stringify(route)} && !!document.querySelector(${JSON.stringify(route.startsWith('/admin/') ? '.cms-section-nav' : '.bottom-bar')})`);
    };
    const click = (selector) => evaluate(`document.querySelector(${JSON.stringify(selector)}).click()`);
    const clickText = (selector, text) => evaluate(`(() => {
      const node = [...document.querySelectorAll(${JSON.stringify(selector)})]
        .find(node => node.textContent.trim() === ${JSON.stringify(text)});
      if (!node) throw new Error('Missing control ' + ${JSON.stringify(text)});
      node.click();
    })()`);
    const linksTo = async (url) => evaluate(`[...document.querySelectorAll('a')].filter(node => node.href === ${JSON.stringify(url)}).map(node => ({
      target: node.target, noreferrer: node.rel.split(/\\s+/).includes('noreferrer')
    }))`);
    const assertLinks = async (url, count) => {
      const links = await linksTo(url);
      assert.equal(links.length, count);
      for (const link of links) assert.deepEqual(link, { target: '_blank', noreferrer: true });
    };
    const showHome = async () => {
      await visit('/home');
      await wait(`!!document.querySelector('#ask-me') && document.querySelectorAll('.home-page .guide-cat-card').length === 5`);
    };

    for (const [lang, games, guides] of [
      ['it', 'Games', 'Tutte le guide'], ['en', 'Games', 'All guides'], ['bn', 'গেমস', 'সব গাইড'],
    ]) {
      const dictionary = (await import(`../src/i18n/${lang}.js`)).default;
      await visit('/home');
      await evaluate(`localStorage.setItem('s2c_lang', ${JSON.stringify(lang)})`);
      await showHome();
      await wait(`document.querySelector('.guide-featured-title')?.textContent.trim() === ${JSON.stringify(title)}`);
      assert.deepEqual(await evaluate(`[...document.querySelectorAll('.tool-item .tool-label')].map(node => node.textContent.trim())`),
        [games, guides, dictionary.translator, dictionary.analyzeTitle]);
      assert.equal(await evaluate(`!!document.querySelector('#ask-me #LP_DIV_1785257734021')`), true);
      assert.equal(await evaluate(`document.querySelectorAll('.bottom-bar > *').length`), 4);
      assert.equal(await evaluate(`!!document.querySelector('.notif-bell')`), true);
      assert.deepEqual(await evaluate(`({
        circles: [...document.querySelectorAll('.quick-action-icon, .quick-action-ask .ask-me-button-icon')].map(node => Math.round(node.getBoundingClientRect().width)),
        bot: !!document.querySelector('.quick-action-ask .lucide-bot'),
        cityFullRow: getComputedStyle(document.querySelector('.home-guide-grid .guide-cat-card:last-child')).gridColumn
      })`), { circles: [68, 76, 68], bot: true, cityFullRow: '1 / -1' });
      await assertLinks(WA_ANALYZE_URL, 2);
      await assertLinks(WA_TRANSLATE_URL, 2);
      const order = await evaluate(`(() => {
        const root = document.querySelector('.home-page');
        const featured = root.querySelector('.guide-featured-card');
        const ask = root.querySelector('#ask-me');
        const tools = root.querySelector('.tools-section');
        return !!(root.querySelector('.hero').compareDocumentPosition(featured) & Node.DOCUMENT_POSITION_FOLLOWING)
          && !!(featured.compareDocumentPosition(ask) & Node.DOCUMENT_POSITION_FOLLOWING)
          && !!(ask.compareDocumentPosition(tools) & Node.DOCUMENT_POSITION_FOLLOWING);
      })()`);
      assert.equal(order, true);
      await clickText('.home-page button', 'Ask Me');
      await wait(`window.__askMeScrolls.some(entry => entry.id === 'ask-me' && entry.behavior === 'smooth')`);
      await clickText('.bottom-bar button', 'Ask Me');
      await wait(`window.__askMeScrolls.filter(entry => entry.id === 'ask-me').length >= 2`);
      await click('.guide-featured-card');
      await wait(`location.pathname === '/guides/guida-al-servizio' && document.body.textContent.includes('Featured detail fixture')`);
      await clickText('.bottom-bar button', 'Ask Me');
      await wait(`location.pathname === '/home' && window.__askMeScrolls.filter(entry => entry.id === 'ask-me').length >= 3`);
      await wait(`document.querySelector('.guide-featured-title')?.textContent.trim() === ${JSON.stringify(title)}`);
      await visit('/guides');
      await wait(`document.querySelector('.guide-featured-title')?.textContent.trim() === ${JSON.stringify(title)}`);
      await click('button[aria-label="Menu"]');
      assert.equal(await evaluate(`document.querySelector('.side-menu').textContent.includes(${JSON.stringify(games)})`), true);
      await clickText('.side-menu-item', 'WhatsApp');
      await wait(`location.pathname === '/whatsapp' && document.body.textContent.includes(${JSON.stringify(dictionary.waPageTitle)})`);
      assert.equal(await evaluate(`document.body.textContent.includes('393490645720')`), false);
      assert.equal(await evaluate(`document.querySelector('.bottom-bar .active')?.textContent.trim()`), 'WhatsApp');
      await assertLinks(WA_ANALYZE_URL, 1);
      await assertLinks(WA_TRANSLATE_URL, 1);
      assert.ok(await evaluate(`document.body.textContent.includes(${JSON.stringify(dictionary.waAnalyzeStep3)}) && document.body.textContent.includes(${JSON.stringify(dictionary.waTranslateStep3)})`));
      for (const width of [320, 390, 768]) {
        await cdp('Emulation.setDeviceMetricsOverride', { width, height: 844, deviceScaleFactor: 1, mobile: true });
        assert.ok(await evaluate(`document.documentElement.scrollWidth <= ${width + 1}`), `${lang} WhatsApp overflow at ${width}`);
        assert.ok(await evaluate(`[...document.querySelectorAll('a[target="_blank"]')].every(node => node.getBoundingClientRect().height >= 48)`));
        if (width === 390) await browser.screenshot(`s2c-whatsapp-${lang}-390.png`);
      }
      await cdp('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 1, mobile: true });
      await showHome();
      assert.ok(await evaluate(`document.documentElement.scrollWidth <= innerWidth + 1`), `${lang} Home overflow`);
      await browser.screenshot(`s2c-home-${lang}-390.png`);
    }

    await evaluate(`localStorage.setItem('s2c_lang', 'it')`);
    role = 'admin';
    await visit('/admin/content/whatsapp');
    await wait(`document.querySelector('h1')?.textContent === 'WhatsApp'`);
    assert.equal(await evaluate(`document.querySelectorAll('.cms-section-tab').length`), 8);
    for (const key of ['translator', 'analyze-document']) {
      await visit(key === 'translator' ? '/admin/content/traduttore' : '/admin/content/analizza-documento');
      await wait(`!!document.querySelector('.cms-section-status')`);
      await clickText('.cms-status-pill', 'Interno');
      await wait(`document.body.textContent.includes('Salvato')`);
      assert.equal(sections[key].status, 'internal');
      assert.equal(await evaluate(`[...document.querySelectorAll('a')].some(node => node.pathname === '/whatsapp')`), true);
    }
    assert.deepEqual(writes.sort(), ['analyze-document', 'translator']);
    role = 'fincantieri_users';
    await showHome();
    await assertLinks(WA_ANALYZE_URL, 0);
    await assertLinks(WA_TRANSLATE_URL, 0);
    await visit('/whatsapp');
    await wait(`document.body.textContent.includes('Step2Connect su WhatsApp')`);
    await assertLinks(WA_ANALYZE_URL, 0);
    await assertLinks(WA_TRANSLATE_URL, 0);
    // Each subfeature can be restored independently.
    sections.translator.status = 'published';
    await visit('/whatsapp');
    await wait(`document.body.textContent.includes('Traduci su WhatsApp')`);
    await assertLinks(WA_ANALYZE_URL, 0);
    await assertLinks(WA_TRANSLATE_URL, 1);
    sections.whatsapp.status = 'internal';
    await showHome();
    assert.equal(await evaluate(`[...document.querySelectorAll('.bottom-bar button, .bottom-bar a')].some(node => node.textContent.trim() === 'WhatsApp')`), false);
    assert.equal(await evaluate(`document.querySelectorAll('.bottom-bar > *').length`), 4);
    await cdp('Page.navigate', { url: origin + '/whatsapp' });
    await wait(`location.pathname === '/home' && !!document.querySelector('.home-page')`);
    for (const route of ['/translator', '/analyze-document']) {
      await cdp('Page.navigate', { url: origin + route });
      await wait(`location.pathname === '/home' && !!document.querySelector('.home-page')`);
    }
    featuredVisibility = 'internal';
    await showHome();
    await wait(`!document.querySelector('.guide-featured-card')`);
    await visit('/guides');
    await wait(`document.querySelectorAll('.guide-cat-card').length === 5 && !document.querySelector('.guide-featured-card')`);
    featuredMissing = true;
    await showHome();
    await wait(`document.querySelector('.guide-featured-title')?.textContent.trim() === 'Guida al servizio'`);
    guidesUnavailable = true;
    await visit('/guides');
    await wait(`document.querySelector('.guide-featured-title')?.textContent.trim() === 'Guida al servizio'`);
    assert.deepEqual(browser.failures, []);
    console.log('HOME_WHATSAPP_BROWSER_PASS: IT/EN/BN, five categories, shared CMS featured/fallback/visibility, exact WA links, Ask Me from Home and other routes, four bottom slots, active WhatsApp, mobile 320/390/768, CMS feature controls, hidden section and old-route fallback. All API calls simulated; no WhatsApp messages or AWS writes.');
  } catch (error) {
    console.error('Fixture browser state:', await evaluate(`({
      pathname: location.pathname,
      title: document.title,
      rootText: document.querySelector('#root')?.textContent.slice(0, 250)
    })`));
    console.error('Fixture layout:', await evaluate(`({
      viewport: innerWidth, width: document.documentElement.scrollWidth,
      wide: [...document.querySelectorAll('body *')].filter(node => node.getBoundingClientRect().right > innerWidth + 1 && !node.closest('.side-menu'))
        .slice(0, 12).map(node => ({ tag: node.tagName, cls: node.className?.baseVal ?? node.className, right: node.getBoundingClientRect().right }))
    })`));
    await browser.screenshot('s2c-home-whatsapp-failure.png');
    console.error('Browser exceptions:', browser.failures);
    throw error;
  } finally { await browser.close(); }
}

main().catch((error) => { console.error(error.stack); process.exitCode = 1; });
