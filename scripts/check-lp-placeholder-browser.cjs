// App API responses are fixtures; never click the LivePerson engagement.
// --measure reads the real engagement's computed styles before comparisons.
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const { chromiumSession } = require('./lib/chromium-session.cjs');

const LINES = [
  'Chiedimi qualsiasi cosa — sono qui per aiutarti',
  '-',
  'Ask me anything — I’m here to help you',
  '-',
  'আমাকে যেকোনো কিছু জিজ্ঞাসা করুন — আমি আপনাকে সাহায্য করতে এখানে আছি।',
];
const ID = 'LP_DIV_1785257734021';
const STYLES = ['fontFamily', 'fontSize', 'fontWeight', 'color', 'lineHeight',
  'padding', 'margin', 'borderRadius', 'boxShadow', 'backgroundColor', 'border',
  'display', 'flexDirection', 'alignItems', 'justifyContent', 'rowGap', 'boxSizing'];

async function main() {
  if (!process.env.REPLIT_DEV_DOMAIN) throw new Error('Development domain required');
  const origin = process.argv.find(arg => arg.startsWith('--origin='))?.slice('--origin='.length)
    || `https://${process.env.REPLIT_DEV_DOMAIN}`;
  const browser = await chromiumSession();
  const { cdp, evaluate, wait, events } = browser;
  const live = process.argv.includes('--measure');
  try {
    events['Runtime.exceptionThrown'] = ({ exceptionDetails }) =>
      browser.failures.push(exceptionDetails.exception?.description || exceptionDetails.text);
    events['Fetch.requestPaused'] = async ({ requestId, request }) => {
      const url = new URL(request.url);
      let body = {}, status = 200;
      if (url.pathname === '/api/users/preview-admin/session') {
        body = { type: 'fincantieri_users', phone: '+390000000001', firstName: 'Fixture' };
      } else if (url.pathname === '/api/sections') body = { sections: {} };
      else if (url.pathname === '/api/content') body = [];
      else if (url.pathname === '/api/notifications') body = { items: [], unread: 0 };
      else status = 404;
      await cdp('Fetch.fulfillRequest', { requestId, responseCode: status,
        responseHeaders: [{ name: 'Content-Type', value: 'application/json' }],
        body: Buffer.from(JSON.stringify(body)).toString('base64') });
    };
    await cdp('Page.enable');
    await cdp('Runtime.enable');
    await cdp('Network.enable');
    await cdp('Network.setCacheDisabled', { cacheDisabled: true });
    // Never intercept third-party /api/ paths: LP itself uses them.
    await cdp('Fetch.enable', { patterns: [{ urlPattern: origin + '/api/*' }] });
    if (!live) await cdp('Network.setBlockedURLs', { urls: ['*liveperson.net*', '*lpsnmedia*'] });
    await cdp('Page.addScriptToEvaluateOnNewDocument', { source: `
      localStorage.setItem('s2c_preview_session', 'fixture-lp-placeholder');
      window.__lpObservers = {active:0,disconnected:0};
      const NativeObserver = window.MutationObserver;
      window.MutationObserver = class extends NativeObserver {
        observe(target, options) {
          if(target.id === '${ID}' && !this.__watchingLP) {
            this.__watchingLP = true;window.__lpObservers.active++;
          }
          return super.observe(target, options);
        }
        disconnect() {
          if(this.__watchingLP) {
            this.__watchingLP=false;
            window.__lpObservers.active--;window.__lpObservers.disconnected++;
          }
          return super.disconnect();
        }
      };
      if(sessionStorage.getItem('lp-preloaded') === 'yes') {
        const early = new NativeObserver(() => {
          const host=document.getElementById('${ID}');
          if(host) {host.append(document.createElement('span'));early.disconnect();}
        });
        early.observe(document,{childList:true,subtree:true});
      }
    ` });
    const visit = async () => {
      await cdp('Page.navigate', { url: origin + '/home' });
      await wait(`!!document.getElementById('${ID}')`);
      await evaluate(`document.getElementById('ask-me').scrollIntoView({block:'center'})`);
    };
    const measure = () => evaluate(`(() => {
      const host=document.getElementById('${ID}'),box=host.querySelector('#assistant-engagement-box');
      if(!box) return null;
      const pick=node=>Object.fromEntries(${JSON.stringify(STYLES)}.map(key=>[key,getComputedStyle(node)[key]]));
      return {box:pick(box),inner:pick(box.firstElementChild),text:pick(box.firstElementChild.firstElementChild),
        boxInline:box.getAttribute('style'),innerInline:box.firstElementChild.getAttribute('style'),
        hostHeight:host.getBoundingClientRect().height,hostWidth:host.getBoundingClientRect().width,
        cardHeight:box.getBoundingClientRect().height,cardWidth:box.getBoundingClientRect().width,
        wrapperStyle:host.firstElementChild.getAttribute('style')};
    })()`);
    if (live) {
      await cdp('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, mobile: true, deviceScaleFactor: 1 });
      await visit();
      for (let attempt = 0; attempt < 60; attempt++) {
        if (await evaluate(`!!document.querySelector('#assistant-engagement-box')`)) break;
        await new Promise(resolve => setTimeout(resolve, 500));
      }
      const result = await measure();
      if (!result) throw new Error('Real engagement did not appear');
      console.log('REAL_LP_STYLES', JSON.stringify(result, null, 2));
      for (const width of [320, 390, 768]) {
        await cdp('Emulation.setDeviceMetricsOverride', { width, height: 844, mobile: true, deviceScaleFactor: 1 });
        console.log('REAL_LP_SIZE', width, JSON.stringify(await measure()));
      }
      await browser.screenshot('lp-real-engagement-measured.png');
      return;
    }

    // Captured from the real LP engagement: same inline card and text layout.
    const markup = `<div style="margin:1px;position:relative">
      <div style="display:flex;align-items:center;gap:14px;background:#fff;border-radius:16px;padding:16px 18px 16px 58px;box-shadow:0 2px 10px rgba(0,0,0,.08);font-family:Arial,sans-serif;box-sizing:border-box">
        <div style="display:flex;flex-direction:column;gap:2px">
          ${LINES.map(text => `<div style="font-size:13px;color:#7a7f8c;line-height:normal">${text}</div>`).join('')}
        </div>
      </div></div>`;
    for (const lang of ['it', 'en', 'bn']) {
      for (const width of [320, 390, 768]) {
        await cdp('Emulation.setDeviceMetricsOverride', { width, height: 844, mobile: true, deviceScaleFactor: 1 });
        await visit();
        await evaluate(`localStorage.setItem('s2c_lang', ${JSON.stringify(lang)})`);
        await visit();
        assert.deepEqual(await evaluate(`[...document.querySelector('.lp-placeholder').children].map(node=>node.textContent)`), LINES);
        assert.equal(await evaluate(`document.querySelector('.lp-placeholder').getAttribute('aria-hidden')`), 'true');
        assert.equal(await evaluate(`getComputedStyle(document.querySelector('.lp-placeholder')).visibility`), 'visible');
        assert.equal(await evaluate(`document.querySelector('.lp-placeholder').tabIndex`), -1);
        assert.equal(await evaluate(`document.querySelectorAll('.lp-placeholder a,.lp-placeholder button,[onclick].lp-placeholder').length`), 0);
        assert.equal(await evaluate(`document.getElementById('${ID}').hasChildNodes()`), false);
        assert.equal(await evaluate(`window.__lpObservers.active`), 1);
        const before = await evaluate(`(() => {
          const p=document.querySelector('.lp-placeholder'),r=p.getBoundingClientRect();
          return {height:document.querySelector('.lp-engagement-slot').getBoundingClientRect().height,
            x:r.x,y:r.y,cardHeight:r.height,cardWidth:r.width,
            lines:[...p.children].map(node=>{const r=node.getBoundingClientRect();
              return {x:r.x,y:r.y,width:r.width,height:r.height};})};
        })()`);
        // Real LP measurements at these viewports, including Bengali fallback font.
        assert.equal(before.cardHeight, { 320: 181, 390: 149, 768: 134 }[width]);
        await evaluate(`document.getElementById('${ID}').innerHTML=${JSON.stringify(markup)}`);
        await wait(`getComputedStyle(document.querySelector('.lp-placeholder')).visibility === 'hidden'`);
        assert.equal(await evaluate(`window.__lpObservers.active`), 0);
        const after = await evaluate(`(() => {
          const card=document.getElementById('${ID}').firstElementChild.firstElementChild;
          const r=card.getBoundingClientRect();
          return {height:document.querySelector('.lp-engagement-slot').getBoundingClientRect().height,
            x:r.x,y:r.y,cardHeight:r.height,cardWidth:r.width,
            lines:[...card.firstElementChild.children].map(node=>{const r=node.getBoundingClientRect();
              return {x:r.x,y:r.y,width:r.width,height:r.height};})};
        })()`);
        assert.deepEqual(after, before, `${lang}/${width}: no shift when LP inserts content`);
        assert.equal(await evaluate(`document.documentElement.scrollWidth <= innerWidth + 1`), true);
        if (lang === 'it' && width === 390) {
          await evaluate(`document.getElementById('ask-me').scrollIntoView({block:'center'})`);
          await browser.screenshot('lp-placeholder-loaded.png');
        }
      }
    }
    await visit();
    await evaluate(`document.querySelector('.bottom-bar button:first-child').click()`);
    await wait(`location.pathname === '/profile'`);
    assert.equal(await evaluate(`window.__lpObservers.active`), 0, 'Unmount disconnects the observer');
    await evaluate(`document.querySelector('.bottom-btn-home').click()`);
    await wait(`!!document.querySelector('.lp-placeholder')`);
    assert.equal(await evaluate(`getComputedStyle(document.querySelector('.lp-placeholder')).visibility`), 'visible');
    assert.equal(await evaluate(`window.__lpObservers.active`), 1);
    await evaluate(`localStorage.setItem('s2c_lang','it')`);
    await cdp('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, mobile: true, deviceScaleFactor: 1 });
    await visit();
    await evaluate(`document.getElementById('ask-me').scrollIntoView({block:'center'})`);
    await browser.screenshot('lp-placeholder-blocked.png');
    await evaluate(`sessionStorage.setItem('lp-preloaded','yes')`);
    await visit();
    await wait(`getComputedStyle(document.querySelector('.lp-placeholder')).visibility === 'hidden'`);
    assert.equal(await evaluate(`window.__lpObservers.active`), 0, 'Already inserted content is detected on mount');
    assert.deepEqual(browser.failures, []);
    console.log('LP_PLACEHOLDER_BROWSER_PASS: identical five lines in IT/EN/BN, 320/390/768, LP blocked, delayed and already-present content, pixel-stable swap, noninteractive placeholder, observer disconnected on arrival and unmount, navigation without exceptions.');
  } finally { await browser.close(); }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
