// Isolated browser checks: no real registrations, SMS, CRM writes or sign-ins.
const assert = require('node:assert/strict');
const { chromiumSession } = require('./lib/chromium-session.cjs');
const origin = `https://${process.env.REPLIT_DEV_DOMAIN}`;
const sessions = [];
(async () => {
  const sections = (await import('../src/lib/sectionAccess.js')).DEFAULT_SECTIONS;
  const create = async (signedIn = false) => {
    const b = await chromiumSession();
    sessions.push(b);
    b.events['Fetch.requestPaused'] = async ({ requestId, request }) => {
      const url = new URL(request.url);
      let data = {}, code = 200;
      if (url.hostname.startsWith('cognito-idp.')) {
        // Return the Cognito SignUp result locally; nothing reaches AWS.
        data = { UserConfirmed: false, UserSub: '00000000-0000-4000-8000-000000000001',
          CodeDeliveryDetails: { Destination: '***0001', DeliveryMedium: 'SMS', AttributeName: 'phone_number' } };
      } else if (url.pathname === '/api/registration-options') data = { companies: ['Test company'], sites: ['Test site'] };
      else if (url.pathname === '/api/users/account-status') data = { exists: false };
      else if (url.pathname === '/api/users/preview-admin/session') {
        code = signedIn ? 200 : 401;
        data = signedIn ? { type: 'fincantieri_users', phone: '+390000000001', firstName: 'Fixture' } : {};
      } else if (url.pathname === '/api/sections') data = { sections };
      else if (url.pathname.startsWith('/api/notifications')) data = { items: [], unread: 0 };
      else { code = 404; }
      await b.cdp('Fetch.fulfillRequest', { requestId, responseCode: code,
        responseHeaders: [
          { name: 'Content-Type', value: 'application/x-amz-json-1.1' },
          { name: 'Access-Control-Allow-Origin', value: '*' },
          { name: 'Access-Control-Allow-Methods', value: 'POST, GET, OPTIONS' },
          { name: 'Access-Control-Allow-Headers', value: request.headers['Access-Control-Request-Headers'] || 'content-type,x-amz-target,x-amz-user-agent,amz-sdk-invocation-id,amz-sdk-request' },
        ],
        body: Buffer.from(JSON.stringify(data)).toString('base64') });
    };
    await b.cdp('Page.enable');
    await b.cdp('Fetch.enable', { patterns: [{ urlPattern: '*/api/*' }, { urlPattern: '*cognito-idp.*' }] });
    await b.cdp('Page.addScriptToEvaluateOnNewDocument', { source:
      `localStorage.setItem('s2c_lang','it');${signedIn ? "localStorage.setItem('s2c_preview_session','fixture');" : ''}` });
    b.visit = (path) => b.cdp('Page.navigate', { url: origin + path });
    b.click = (selector) => b.cdp('Runtime.evaluate', {
      expression: `document.querySelector(${JSON.stringify(selector)}).click()`, userGesture: true,
    });
    return b;
  };
  try {
    const b = await create();
    await b.cdp('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 1, mobile: true });
    await b.visit('/privacy');
    await b.wait(`!!document.querySelector('.privacy-body')`);
    assert.equal(await b.evaluate(`document.querySelector('.back-btn').textContent.trim()`), 'Indietro');
    await b.click('.back-btn');
    await b.wait(`location.pathname==='/' && !!document.querySelector('.login-card')`);
    assert.equal(await b.evaluate(`!!document.querySelector('#privacy-accepted')`), false);
    await b.click('.login-tab:nth-child(2)');
    await b.wait(`document.querySelectorAll('select option').length===4`);
    await b.evaluate(`(() => {
      const set = (el, value) => {
        Object.getOwnPropertyDescriptor(el.tagName==='SELECT' ? HTMLSelectElement.prototype : HTMLInputElement.prototype,'value').set.call(el,value);
        el.dispatchEvent(new Event(el.tagName==='SELECT'?'change':'input',{bubbles:true}));
      };
      const inputs=document.querySelectorAll('.input-group input');
      ['Test','User','+393000000001',''].forEach((v,i)=>set(inputs[i],v));
      document.querySelectorAll('select').forEach(el=>set(el,el.options[1].value));
    })()`);
    await b.wait(`document.querySelector('select').value==='Test company'`);
    assert.equal(await b.evaluate(`document.querySelector('.btn-primary').disabled`), true);
    assert.equal(await b.evaluate(`document.querySelector('#privacy-accepted').checked`), false);
    await b.click('#privacy-accepted');
    await b.wait(`!document.querySelector('.btn-primary').disabled`);
    for (const [index, expected] of [[0, 'Ho letto e accetto l’informativa privacy *'],
      [1, 'I have read and accept the privacy policy *'],
      [2, 'আমি গোপনীয়তা নীতি পড়েছি এবং গ্রহণ করছি *']]) {
      await b.click(`.lang-selector button:nth-child(${index + 1})`);
      await b.wait(`document.querySelector('#privacy-accepted-label').textContent===${JSON.stringify(expected)}`);
    }
    await b.click('.lang-selector button:first-child');
    const links = await b.evaluate(`[...document.querySelectorAll('.login-card a')].map(a=>({href:a.getAttribute('href'),target:a.target,rel:a.rel}))`);
    assert.equal(links.length, 2);
    for (const link of links) {
      assert.equal(link.href, '/privacy'); assert.equal(link.target, '_blank');
      assert.equal(link.rel, 'noopener noreferrer');
    }
    // Click both actual links and verify that new tabs open without changing the form.
    const before = await b.cdp('Target.getTargets');
    await b.click('.login-privacy-consent a');
    await b.click('.login-privacy-footer a');
    let opened = [];
    for (let i = 0; i < 40; i++) {
      const now = await b.cdp('Target.getTargets');
      opened = now.targetInfos.filter(t => t.type === 'page' && t.url === origin + '/privacy'
        && !before.targetInfos.some(old => old.targetId === t.targetId));
      if (opened.length === 2) break;
      await new Promise(r => setTimeout(r, 100));
    }
    assert.equal(opened.length, 2);
    assert.equal(await b.evaluate(`document.querySelector('.input-group input').value`), 'Test');
    assert.equal(await b.evaluate(`document.querySelector('#privacy-accepted').checked`), true);
    assert.ok(await b.evaluate(`document.documentElement.scrollWidth<=390`));
    // Exercise registration through a mocked Cognito response, with zero real SMS.
    await b.click('.btn-primary');
    await b.wait(`!!document.querySelector('.otp-input') || !!document.querySelector('.error-text')`);
    assert.equal(await b.evaluate(`document.querySelector('.error-text')?.textContent || ''`), '');
    await b.wait(`!!document.querySelector('.otp-input')`);
    assert.equal(await b.evaluate(`document.querySelector('.login-privacy-footer a').getAttribute('href')`), '/privacy');
    await b.click('.login-tab:first-child');
    assert.equal(await b.evaluate(`!!document.querySelector('#privacy-accepted')`), false);
    await b.click('.login-tab:nth-child(2)');
    await b.wait(`!!document.querySelector('#privacy-accepted')`);
    assert.equal(await b.evaluate(`document.querySelector('#privacy-accepted').checked`), false);
    assert.equal(await b.evaluate(`document.querySelector('.btn-primary').disabled`), true);
    // Authenticated UI exercised via an isolated server-session fixture, never an auth bypass.
    const signed = await create(true);
    await signed.visit('/privacy');
    await signed.wait(`!!document.querySelector('.app-shell .privacy-body')`);
    assert.equal(await signed.evaluate(`document.querySelector('.back-btn').textContent.trim()`), 'Menu');
    await signed.click('.back-btn');
    await signed.wait(`location.pathname==='/home'`);
    console.log('PASS: public/private privacy, direct-entry fallback, IT/EN/BN consent, registration gating/reset, new-tab links preserve form, mocked SMS-code screen, mobile width.');
    for (const session of sessions) assert.deepEqual(session.failures, []);
  } finally { await Promise.all(sessions.map(s => s.close())); }
})().catch(error => { console.error(error); process.exitCode = 1; });
