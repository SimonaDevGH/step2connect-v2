// Responsive checks with isolated API/session fixtures; no real sign-in or writes.
const assert = require('node:assert/strict');
const { chromiumSession } = require('./lib/chromium-session.cjs');
const origin = `https://${process.env.REPLIT_DEV_DOMAIN}`;
const sessions = [];
(async () => {
  const sections = (await import('../src/lib/sectionAccess.js')).DEFAULT_SECTIONS;
  let checks = 0;
  try {
    for (const signedIn of [false, true]) {
      const b = await chromiumSession();
      sessions.push(b);
      b.events['Fetch.requestPaused'] = async ({ requestId, request }) => {
        const path = new URL(request.url).pathname;
        let data = [], code = 200;
        if (path === '/api/sections') data = { sections };
        else if (path === '/api/users/preview-admin/session') {
          code = signedIn ? 200 : 401;
          data = signedIn ? { type: 'fincantieri_users', phone: '+393000000001', firstName: 'Fixture' } : {};
        }
        await b.cdp('Fetch.fulfillRequest', { requestId, responseCode: code,
          responseHeaders: [{ name: 'Content-Type', value: 'application/json' }],
          body: Buffer.from(JSON.stringify(data)).toString('base64') });
      };
      await b.cdp('Page.enable');
      await b.cdp('Fetch.enable', { patterns: [{ urlPattern: '*/api/*' }] });
      await b.cdp('Page.addScriptToEvaluateOnNewDocument', { source:
        `${signedIn ? "localStorage.setItem('s2c_preview_session','fixture');" : ''}` });
      for (const width of [320, 375, 390, 430, 768, 1280]) {
        await b.cdp('Emulation.setDeviceMetricsOverride', {
          width, height: 844, deviceScaleFactor: 1, mobile: width < 768,
        });
        await b.cdp('Page.navigate', { url: origin + '/privacy' });
        await b.wait(`!!document.querySelector('.privacy-body')`);
        const dimensions = await b.evaluate(`(() => {
          const page=document.querySelector('.privacy-page');
          const body=document.querySelector('.privacy-body');
          const button=document.querySelector('.back-btn').getBoundingClientRect();
          return {
            viewport:innerWidth, scroll:document.documentElement.scrollWidth,
            page:page.clientWidth, pageScroll:page.scrollWidth,
            body:body.getBoundingClientRect().width,
            textSize:parseFloat(getComputedStyle(body.querySelector('p')).fontSize),
            buttonHeight:button.height, buttonWidth:button.width,
            authenticated:!!document.querySelector('.app-shell'),
            viewportMeta:document.querySelector('meta[name="viewport"]').content,
          };
        })()`);
        assert.equal(dimensions.authenticated, signedIn);
        assert.ok(dimensions.scroll <= width + 1, JSON.stringify(dimensions));
        assert.ok(dimensions.pageScroll <= dimensions.page + 1, JSON.stringify(dimensions));
        assert.ok(dimensions.body <= 800, JSON.stringify(dimensions));
        assert.ok(dimensions.textSize >= 16);
        assert.ok(dimensions.buttonHeight >= 44 && dimensions.buttonWidth >= 44);
        assert.ok(!/user-scalable=no|maximum-scale=1/.test(dimensions.viewportMeta));
        // Reach the final line without clipping beneath the authenticated bottom bar.
        await b.evaluate(`(() => {
          const scroller=document.querySelector('.main-content') || document.scrollingElement;
          scroller.style.scrollBehavior='auto';scroller.scrollTop=scroller.scrollHeight;
        })()`);
        await b.wait(`(() => {
          const last=document.querySelector('.prv-updated').getBoundingClientRect();
          const bottom=document.querySelector('.bottom-bar')?.getBoundingClientRect().top || innerHeight;
          return last.top>=0 && last.bottom<=bottom+1;
        })()`);
        // Larger text must reflow rather than force horizontal scrolling.
        await b.evaluate(`document.documentElement.style.fontSize='200%'`);
        assert.ok(await b.evaluate(`document.documentElement.scrollWidth<=innerWidth+1`));
        assert.ok(await b.evaluate(`document.querySelector('.privacy-page').scrollWidth<=document.querySelector('.privacy-page').clientWidth+1`));
        await b.evaluate(`document.documentElement.style.fontSize=''`);
        checks++;
      }
      for (const lang of ['it', 'en', 'bn']) {
        await b.evaluate(`localStorage.setItem('s2c_lang',${JSON.stringify(lang)})`);
        await b.cdp('Emulation.setDeviceMetricsOverride', { width: 320, height: 844, deviceScaleFactor: 1, mobile: true });
        await b.cdp('Page.navigate', { url: origin + '/privacy' });
        await b.wait(`!!document.querySelector('.privacy-body')`);
        assert.ok(await b.evaluate(`document.documentElement.scrollWidth<=321`));
        checks++;
      }
      assert.deepEqual(b.failures, []);
    }
    console.log(`PASS: ${checks} public/authenticated privacy viewport/language cases, 320–1280px, readable type, wrapping, touch target, 200% text and scroll to end.`);
  } finally { await Promise.all(sessions.map(b => b.close())); }
})().catch(error => { console.error(error); process.exitCode = 1; });
