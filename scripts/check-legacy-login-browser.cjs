// Real browser + isolated API/Cognito fixtures: no SMS, S3 or CRM writes.
const assert = require('node:assert/strict');
const { chromiumSession } = require('./lib/chromium-session.cjs');
const origin = `https://${process.env.REPLIT_DEV_DOMAIN}`;
const TOKEN = 'a'.repeat(43);
const PHONE = '+393000000001';
const sessions = [];
(async () => {
  const { DEFAULT_SECTIONS: sections } = await import('../src/lib/sectionAccess.js');
  const create = async (options = {}) => {
    const b = await chromiumSession(); sessions.push(b);
    b.flow = { events: [], complete: [], syncPayloads: [], consent: 0, confirmed: false, synced: false, cognito: 0, consentSaved: false };
    b.events['Fetch.requestPaused'] = async ({ requestId, request }) => {
      const url = new URL(request.url);
      let data = {}, code = 200;
      if (request.method === 'OPTIONS') {
        // Browser preflight is not an application attempt.
      } else if (url.hostname.startsWith('cognito-idp.')) {
        b.flow.cognito++;
        const target = Object.entries(request.headers).find(([k]) => k.toLowerCase() === 'x-amz-target')?.[1] || '';
        const subject = '00000000-0000-4000-8000-000000000001';
        const auth = () => {
          const now = Math.floor(Date.now() / 1000);
          const token = use => [
            Buffer.from(JSON.stringify({ alg: 'RS256', kid: 'fixture' })).toString('base64url'),
            Buffer.from(JSON.stringify({ sub: subject, phone_number: PHONE, token_use: use,
              'cognito:username': PHONE, username: PHONE, iat: now, exp: now + 3600,
              auth_time: now, iss: url.origin + '/fixture' })).toString('base64url'), 'fixture',
          ].join('.');
          return { AuthenticationResult: { IdToken: token('id'), AccessToken: token('access'),
            RefreshToken: 'fixture-refresh', ExpiresIn: 3600, TokenType: 'Bearer' } };
        };
        if (target.endsWith('.SignUp')) {
          b.flow.events.push('signup');
          data = { UserConfirmed: false, UserSub: subject, CodeDeliveryDetails: {
            Destination: '***0001', DeliveryMedium: 'SMS', AttributeName: 'phone_number' } };
        } else if (target.endsWith('.ConfirmSignUp')) {
          b.flow.confirmed = true; b.flow.events.push('confirmed'); data = { Session: 'fixture-confirmed' };
        } else if (target.endsWith('.GetUser')) {
          data = { Username: PHONE, UserAttributes: [
            { Name: 'sub', Value: subject }, { Name: 'phone_number', Value: PHONE },
          ] };
        } else if (target.endsWith('.InitiateAuth')) {
          if (options.missingCognito) {
            code = 400; data = { __type: 'UserNotFoundException', message: 'Fixture account unavailable' };
          } else if (options.exists) {
            b.flow.events.push('signin');
            data = { ChallengeName: 'SMS_OTP', Session: 'fixture-challenge',
              ChallengeParameters: { USERNAME: PHONE, CODE_DELIVERY_DESTINATION: '***0001',
                CODE_DELIVERY_DELIVERY_MEDIUM: 'SMS' } };
          } else data = auth();
        } else if (target.endsWith('.RespondToAuthChallenge')) {
          b.flow.confirmed = true; b.flow.events.push('confirmed'); data = auth();
        }
      } else if (url.pathname === '/api/legacy/link') {
        assert.equal(url.searchParams.get('t'), TOKEN);
        if (options.invalid) { code = 404; data = { error: 'Link unavailable' }; }
        else data = { firstName: options.noNames ? '' : 'Fixture', lastName: options.noNames ? '' : "D'Errico",
          email: 'fixture@example.test', company: options.unknownOptions ? 'Unknown' : 'company',
          site: options.unknownOptions ? 'Unknown' : 'site' };
      } else if (url.pathname === '/api/registration-options') {
        data = { companies: ['Company'], sites: ['Site'] };
      } else if (url.pathname === '/api/users/account-status') {
        data = options.exists ? { exists: true, flow: options.dedicated || 'cognito' } : { exists: false };
      } else if (url.pathname.endsWith('/users/sync')) {
        assert.equal(b.flow.confirmed, true);
        b.flow.events.push('sync-start'); b.flow.syncPayloads.push(JSON.parse(request.postData));
        await new Promise(resolve => setTimeout(resolve, 250));
        if (options.syncFail) { code = 500; data = { error: 'Fixture sync failure' }; }
        else { b.flow.synced = true; data = { ok: true }; }
        b.flow.events.push('sync-end');
      } else if (url.pathname === '/api/legacy/complete') {
        assert.equal(b.flow.synced, true);
        assert.equal(b.flow.consentSaved, true);
        assert.equal(await b.evaluate(`!!document.querySelector('.app-shell')`), true);
        assert.ok(Object.entries(request.headers).some(([key, value]) =>
          key.toLowerCase() === 'authorization' && value.startsWith('Bearer ')));
        b.flow.complete.push(JSON.parse(request.postData)); b.flow.events.push('complete');
        if (options.typeFail || options.completeFail || b.flow.complete.length === 1) { code = 503; data = { error: 'Fixture temporary error' }; }
        else data = { ok: true };
      } else if (url.pathname === '/api/users/consent') {
        assert.equal(b.flow.confirmed, true); assert.equal(b.flow.synced, true);
        const consent = JSON.parse(request.postData);
        assert.equal(consent.privacy_policy_consent, true);
        assert.ok(Date.parse(consent.privacyAcceptedAt) >= b.flow.clickedAt);
        assert.ok(Date.parse(consent.privacyAcceptedAt) <= b.flow.otpShownAt,
          'acceptance timestamp is the continue click, not SMS verification');
        b.flow.consent++; b.flow.events.push('consent');
        if (options.consentFail) { code = 500; data = { error: 'Fixture consent failure' }; }
        else { b.flow.consentSaved = true; data = { ok: true, ...consent }; }
      } else if (url.pathname === '/api/users/me') data = { firstName: 'Fixture', type: 'standard' };
      else if (url.pathname === '/api/sections') data = { sections };
      else if (url.pathname.startsWith('/api/notifications')) data = { items: [], unread: 0 };
      else if (url.pathname.startsWith('/api/content')) data = [];
      else code = 404;
      await b.cdp('Fetch.fulfillRequest', { requestId, responseCode: code,
        responseHeaders: [
          { name: 'Content-Type', value: 'application/x-amz-json-1.1' },
          { name: 'Access-Control-Allow-Origin', value: '*' },
          { name: 'Access-Control-Allow-Methods', value: 'POST, GET, OPTIONS' },
          { name: 'Access-Control-Allow-Headers', value: 'content-type,authorization,x-amz-target,x-amz-user-agent,amz-sdk-invocation-id,amz-sdk-request,cache-control' },
        ], body: Buffer.from(JSON.stringify(data)).toString('base64') });
    };
    await b.cdp('Page.enable');
    await b.cdp('Fetch.enable', { patterns: [
      { urlPattern: '*/api/*' }, { urlPattern: '*cognito-idp.*' }, { urlPattern: '*/users/sync' },
    ] });
    await b.cdp('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 1, mobile: true });
    await b.cdp('Page.addScriptToEvaluateOnNewDocument', { source: `localStorage.setItem('s2c_lang',${JSON.stringify(options.lang || 'it')});` });
    b.click = selector => b.cdp('Runtime.evaluate', {
      expression: `document.querySelector(${JSON.stringify(selector)}).click()`, userGesture: true });
    b.set = (selector, value) => b.evaluate(`(() => {
      const el = document.querySelector(${JSON.stringify(selector)});
      Object.getOwnPropertyDescriptor(el.tagName==='SELECT'?HTMLSelectElement.prototype:HTMLInputElement.prototype,'value').set.call(el,${JSON.stringify(value)});
      el.dispatchEvent(new Event(el.tagName==='SELECT'?'change':'input',{bubbles:true}));
    })()`);
    await b.cdp('Page.navigate', { url: `${origin}/bentornato?t=${TOKEN}` });
    return b;
  };
  try {
    for (const options of [
      {}, { exists: true }, { exists: true, syncFail: true }, { completeFail: true },
      { consentFail: true }, { exists: true, consentFail: true }, { typeFail: true },
      { exists: true, missingCognito: true }, { exists: true, dedicated: 'preview' },
      { exists: true, dedicated: 'personal-code', lang: 'en' },
      { exists: true, dedicated: 'personal-code', lang: 'bn' },
      { invalid: true }, { unknownOptions: true }, { noNames: true },
    ]) {
      const b = await create(options);
      if (options.invalid) {
        await b.wait(`location.pathname==='/' && !!document.querySelector('.account-notice')`);
        assert.equal(await b.evaluate(`document.querySelector('.account-notice').textContent`),
          'Accedi o registrati con il tuo numero di telefono.');
        assert.equal(b.flow.cognito, 0);
      } else {
        await b.wait(`document.querySelectorAll('select option').length===4`);
        assert.equal(await b.evaluate(`document.querySelectorAll('input[readonly]').length`), 3);
        assert.equal(await b.evaluate(`!!document.querySelector('#privacy-accepted') || !!document.querySelector('.login-tabs')`), false);
        assert.equal(await b.evaluate(`location.search`), '');
        assert.equal(await b.evaluate(`window._lptStop`), true);
        assert.ok(await b.evaluate(`document.documentElement.scrollWidth <= innerWidth`));
        assert.equal(await b.evaluate(`document.querySelector('select').value`), options.unknownOptions ? '' : 'Company');
        assert.equal(await b.evaluate(`document.querySelectorAll('select')[1].value`), options.unknownOptions ? '' : 'Site');
        await b.set('input[type=tel]', PHONE);
        assert.equal(await b.evaluate(`document.querySelector('.btn-primary').disabled`), true);
        assert.equal(await b.evaluate(`document.querySelector('#legacy-privacy-accepted').required`), true);
        assert.equal(await b.evaluate(`document.querySelector('.login-privacy-consent a').getAttribute('href')`), '/privacy');
        await b.click('#legacy-privacy-accepted');
        if (options.unknownOptions) {
          assert.equal(await b.evaluate(`document.querySelector('.btn-primary').disabled`), true);
          await b.set('select', 'Company'); await b.set('select:nth-of-type(1)', 'Company');
          await b.evaluate(`(() => {
            const el=document.querySelectorAll('select')[1];
            Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype,'value').set.call(el,'Site');
            el.dispatchEvent(new Event('change',{bubbles:true}));
          })()`);
        }
        await b.wait(`!document.querySelector('.btn-primary').disabled`);
        b.flow.clickedAt = Date.now();
        await b.click('.btn-primary');
        if (options.dedicated) {
          await b.wait(`!!document.querySelector('.account-notice[role=status]')`);
          assert.equal(b.flow.cognito, 0);
          await b.click('.btn-primary');
          await b.wait(`location.pathname==='/' && !!document.querySelector('.login-tabs')`);
        } else if (options.missingCognito) {
          await b.wait(`!!document.querySelector('.error-text')`);
          assert.equal(await b.evaluate(`!!document.querySelector('.otp-input')`), false);
          assert.equal(b.flow.complete.length, 0);
        } else {
          await b.wait(`!!document.querySelector('.otp-input')`);
          b.flow.otpShownAt = Date.now();
          assert.equal(b.flow.complete.length, 0);
          assert.equal(b.flow.syncPayloads.length, 0);
          assert.equal(b.flow.consent, 0);
          await b.set('.otp-input', '123456'); await b.click('.btn-primary');
          await b.wait(`location.pathname==='/home' && !!document.querySelector('.app-shell')`);
          for (let i = 0; i < 60 && !b.flow.events.includes('sync-end'); i++) await new Promise(r => setTimeout(r, 100));
          if (options.syncFail || options.consentFail) {
            if (options.consentFail) {
              for (let i = 0; i < 60 && b.flow.consent < 2; i++) await new Promise(r => setTimeout(r, 100));
            }
            await new Promise(r => setTimeout(r, 300)); assert.equal(b.flow.complete.length, 0);
          } else {
            for (let i = 0; i < 60 && b.flow.complete.length < 2; i++) await new Promise(r => setTimeout(r, 100));
            assert.deepEqual(b.flow.complete, [{ token: TOKEN }, { token: TOKEN }]);
          }
          assert.equal(b.flow.syncPayloads.length, 1);
          assert.deepEqual(b.flow.syncPayloads[0], {
            phone: PHONE, ...(!options.noNames ? { firstName: 'Fixture', lastName: "D'Errico" } : {}),
            email: 'fixture@example.test', company: 'Company', site: 'Site',
          });
          assert.equal(b.flow.events.includes('signup'), !options.exists);
          assert.equal(b.flow.consent, options.syncFail ? 0 : options.consentFail ? 2 : 1);
          if (b.flow.complete.length) {
            assert.ok(b.flow.events.indexOf('sync-end') < b.flow.events.indexOf('consent'));
            assert.ok(b.flow.events.indexOf('consent') < b.flow.events.indexOf('complete'));
          }
        }
      }
      assert.equal(await b.evaluate(`JSON.stringify({...localStorage,...sessionStorage}).includes(${JSON.stringify(TOKEN)})`), false);
      assert.deepEqual(b.failures, []);
      console.log(`PASS legacy browser: ${JSON.stringify(options)}`);
      await b.close(); sessions.splice(sessions.indexOf(b), 1);
    }
    console.log('PASS: 14 isolated legacy browser scenarios; no real SMS or persistent writes.');
  } finally { await Promise.all(sessions.map(b => b.close())); }
})().catch(error => { console.error(error); process.exitCode = 1; });
