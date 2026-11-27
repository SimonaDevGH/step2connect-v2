// Isolated browser journey: all APIs and Amplify Auth are fixtures.
// No real SMS, email, Cognito, DynamoDB or S3 operations.
// Run: node --experimental-websocket scripts/check-profile-browser.cjs
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const { chromiumSession } = require('./lib/chromium-session.cjs');

const OLD = '+393000000001';
const NEXT = '+393000000002';
const AUTH_KEY = '__s2c_test_auth';
const authModule = `
  const key = ${JSON.stringify(AUTH_KEY)};
  const read = () => JSON.parse(sessionStorage.getItem(key) || '{"phone":"${OLD}","sub":"fixture-subject","calls":{}}');
  const save = state => sessionStorage.setItem(key, JSON.stringify(state));
  const count = name => {const state=read(); state.calls[name]=(state.calls[name]||0)+1; save(state);};
  const fail = name => {const error=new Error(name); error.name=name; throw error;};
  export async function getCurrentUser() {if(read().loggedOut) fail('UserUnAuthenticatedException'); return {userId:read().sub};}
  export async function fetchUserAttributes() {const s=read(); return {sub:s.sub,phone_number:s.phone,given_name:'Token',family_name:'Name',email:'fixture@example.invalid'};}
  export async function fetchAuthSession(options={}) {
    count(options.forceRefresh ? 'refresh' : 'session');
    const state=read();
    const payload={sub:state.sub,phone_number:state.phone,phone_number_verified:true,token_use:'id',exp:Math.floor(Date.now()/1000)+3600};
    return {tokens:{idToken:{payload,toString:()=> 'e30.'+btoa(JSON.stringify(payload))+'.fixture'}}};
  }
  export async function updateUserAttributes({userAttributes}) {
    count('update'); const state=read(); state.pending=userAttributes.phone_number; save(state);
    return {phone_number:{isUpdated:false,nextStep:{updateAttributeStep:'CONFIRM_ATTRIBUTE_WITH_CODE'}}};
  }
  export async function confirmUserAttribute({confirmationCode}) {
    count('confirm');
    if(confirmationCode==='111111') fail('ExpiredCodeException');
    if(confirmationCode!=='123456') fail('CodeMismatchException');
    const state=read(); state.phone=state.pending; delete state.pending; save(state);
  }
  export async function sendUserAttributeVerificationCode() {count('resend');}
  export async function signOut() {count('logout'); const state=read();state.loggedOut=true;save(state);}
  export async function signUp() {fail('UnexpectedSignUp');}
  export async function confirmSignUp() {fail('UnexpectedConfirmSignUp');}
  export async function autoSignIn() {fail('UnexpectedAutoSignIn');}
  export async function signIn() {fail('UnexpectedSignIn');}
  export async function confirmSignIn() {fail('UnexpectedConfirmSignIn');}
`;

async function main() {
  if (!process.env.REPLIT_DEV_DOMAIN) throw new Error('Development domain required');
  const origin = `https://${process.env.REPLIT_DEV_DOMAIN}`;
  const { DEFAULT_SECTIONS } = await import('../src/lib/sectionAccess.js');
  const sections = structuredClone(DEFAULT_SECTIONS);
  sections.quiz.status = 'published';
  let previewRole = null, taken = false, syncFailure = false;
  const crm = { firstName: 'Fixture', lastName: 'Surname', email: 'fixture@example.invalid', phone: OLD,
    company: 'Fixture company', site: 'Fixture site' };
  const calls = { profile: 0, context: 0, sync: 0 };
  const browser = await chromiumSession();
  const { cdp, evaluate, wait, events } = browser;
  try {
    events['Runtime.exceptionThrown'] = ({ exceptionDetails }) =>
      browser.failures.push(exceptionDetails.exception?.description || exceptionDetails.text);
    events['Fetch.requestPaused'] = async ({ requestId, request }) => {
      const url = new URL(request.url);
      let status = 200, body = {}, type = 'application/json';
      if (url.pathname.endsWith('/aws-amplify_auth.js')) {
        body = authModule;
        type = 'text/javascript';
      } else if (url.hostname.includes('cognito-idp')) {
        browser.failures.push('Unexpected real Cognito request');
        status = 503;
      } else if (url.pathname === '/api/users/preview-admin/session') {
        if (!previewRole) { status = 401; body = {}; }
        else body = { type: previewRole, phone: OLD, firstName: 'Fixture', lastName: 'Surname', company: crm.company };
      } else if (url.pathname === '/api/users/me') body = { firstName: crm.firstName, type: 'standard_legacy' };
      else if (url.pathname === '/api/users/me/profile') { calls.profile++; body = { ...crm }; }
      else if (url.pathname === '/api/users/me/phone-change-context') {
        calls.context++;
        body = { profileReference: 'signed-fixture-reference' };
      } else if (url.pathname === '/api/users/me/phone-sync') {
        calls.sync++;
        const claims = JSON.parse(Buffer.from((request.headers.Authorization || request.headers.authorization).split('.')[1], 'base64').toString());
        assert.equal(claims.phone_number_verified, true);
        assert.equal(claims.phone_number, NEXT);
        assert.deepEqual(JSON.parse(request.postData), { profileReference: 'signed-fixture-reference' });
        if (syncFailure) { status = 503; body = { error: 'Fixture unavailable' }; }
        else { crm.phone = claims.phone_number; body = { phone: crm.phone }; }
      } else if (url.pathname === '/api/users/account-status') body = { exists: taken, flow: 'cognito' };
      else if (url.pathname === '/api/sections') body = { sections };
      else if (url.pathname === '/api/notifications') body = { items: [], unread: 0 };
      else if (url.pathname === '/api/content') body = [];
      else if (url.pathname.startsWith('/api/quiz')) body = { items: [], badges: [], results: {} };
      else { status = 404; body = {}; }
      await cdp('Fetch.fulfillRequest', { requestId, responseCode: status,
        responseHeaders: [{ name: 'Content-Type', value: type }],
        body: Buffer.from(type === 'text/javascript' ? body : JSON.stringify(body)).toString('base64') });
    };
    await cdp('Page.enable');
    await cdp('Runtime.enable');
    await cdp('Fetch.enable', { patterns: [
      { urlPattern: '*/api/*' }, { urlPattern: '*aws-amplify_auth.js*' }, { urlPattern: '*cognito-idp.*' },
    ] });
    await cdp('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, mobile: true, deviceScaleFactor: 1 });
    const visit = async path => {
      await cdp('Page.navigate', { url: origin + path });
      await wait(`!!document.querySelector('.bottom-bar')`);
    };
    const click = selector => evaluate(`document.querySelector(${JSON.stringify(selector)}).click()`);
    const fill = (selector, value) => evaluate(`(() => {
      const node=document.querySelector(${JSON.stringify(selector)});
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(node,${JSON.stringify(value)});
      node.dispatchEvent(new Event('input',{bubbles:true}));
    })()`);
    const fixture = () => evaluate(`JSON.parse(sessionStorage.getItem(${JSON.stringify(AUTH_KEY)}))`);
    const submitPhone = async (currentPhone = OLD, newPhone = NEXT) => {
      await fill('.profile-phone-form input:first-of-type', currentPhone);
      // Both labels contain one input, so select their fields explicitly.
      await fill('.profile-phone-form .profile-field:nth-child(2) input', newPhone);
      await click('.profile-phone-form button[type=submit]');
    };
    const assertNoOverflow = async () => assert.equal(await evaluate(`document.documentElement.scrollWidth <= innerWidth + 1`), true);

    await visit('/home');
    await click('.bottom-bar > button:first-child');
    await wait(`location.pathname === '/profile' && document.querySelector('.profile-identity h1')?.textContent === 'Fixture Surname'`);
    assert.equal(await evaluate(`document.querySelector('.bottom-bar > button:first-child').getAttribute('aria-current')`), 'page');
    await click('.profile-menu-row:nth-child(2)');
    await wait(`location.pathname === '/quiz/badges'`);
    await click('.bottom-bar > button:first-child');
    await wait(`!!document.querySelector('.profile-menu-row')`);
    await click('.profile-menu-row:first-child');
    await wait(`document.querySelectorAll('.profile-detail-row').length === 6`);
    assert.equal(await evaluate(`document.querySelectorAll('.profile-edit-phone').length`), 1);
    assert.deepEqual(await evaluate(`(() => {const r=document.querySelector('.profile-edit-phone').getBoundingClientRect();return [r.width>=44,r.height>=44]})()`), [true, true]);
    assert.equal(await evaluate(`document.querySelectorAll('.profile-detail-row strong')[1].textContent`), 'Surname', 'Read CRM surname rather than the Cognito hint');

    for (const lang of ['it', 'en', 'bn']) {
      await evaluate(`localStorage.setItem('s2c_lang',${JSON.stringify(lang)})`);
      const dictionary = (await import(`../src/i18n/${lang}.js`)).default;
      for (const width of [320, 390, 768]) {
        await cdp('Emulation.setDeviceMetricsOverride', { width, height: 844, mobile: true, deviceScaleFactor: 1 });
        await visit('/profile/my-data');
        await wait(`document.querySelectorAll('.profile-detail-row').length === 6`);
        assert.equal(await evaluate(`document.querySelector('h1').textContent`), dictionary.profileMyData);
        await assertNoOverflow();
        await visit('/profile/my-data/change-phone');
        await wait(`!!document.querySelector('.profile-phone-form')`);
        assert.equal(await evaluate(`document.querySelectorAll('.profile-phone-form input')[0].value`), '');
        assert.equal(await evaluate(`document.querySelectorAll('.profile-phone-form input')[1].value`), '');
        await assertNoOverflow();
      }
    }
    await evaluate(`localStorage.setItem('s2c_lang','it')`);
    await cdp('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, mobile: true, deviceScaleFactor: 1 });
    await visit('/profile/my-data/change-phone-confirmation');
    await wait(`location.pathname === '/profile/my-data'`);
    await visit('/profile/my-data/change-phone-verification');
    await wait(`location.pathname === '/profile/my-data/change-phone'`);
    await submitPhone('+393000000009');
    await wait(`document.querySelector('[role=alert]')?.textContent.includes('attuale non è corretto')`);
    await submitPhone(OLD, OLD);
    await wait(`document.querySelector('[role=alert]')?.textContent.includes('uguale')`);
    taken = true;
    await submitPhone();
    await wait(`document.querySelector('[role=alert]')?.textContent.includes('già registrato')`);
    assert.equal((await fixture()).calls.update || 0, 0);
    taken = false;
    await submitPhone();
    await wait(`location.pathname.endsWith('change-phone-verification') && !!document.querySelector('#profile-phone-code')`);
    assert.equal(crm.phone, OLD);
    assert.equal((await fixture()).phone, OLD);
    assert.equal(await evaluate(`document.querySelector('.profile-resend').disabled`), true);
    await evaluate(`window.__realNow=Date.now;Date.now=()=>window.__realNow()+61000`);
    await wait(`!document.querySelector('.profile-resend').disabled`);
    await click('.profile-resend');
    await wait(`document.querySelector('.profile-resend').disabled`);
    assert.equal((await fixture()).calls.resend, 1);
    for (const [code, fragment] of [['000000', 'non è corretto'], ['111111', 'scaduto']]) {
      await fill('#profile-phone-code', code);
      await click('.profile-verify-card button[type=submit]');
      await wait(`document.querySelector('[role=alert]')?.textContent.includes(${JSON.stringify(fragment)})`);
    }
    assert.equal(calls.sync, 0);
    syncFailure = true;
    await fill('#profile-phone-code', '123456');
    await click('.profile-verify-card button[type=submit]');
    await wait(`!!document.querySelector('[role=alert]') && !document.querySelector('#profile-phone-code')`);
    assert.equal(crm.phone, OLD, 'Failed sync cannot show a successful CRM update');
    const confirms = (await fixture()).calls.confirm;
    syncFailure = false;
    await visit('/profile/my-data/change-phone-verification');
    await wait(`!!document.querySelector('.profile-verify-card button[type=submit]') && !document.querySelector('#profile-phone-code')`);
    await click('.profile-verify-card button[type=submit]');
    await wait(`location.pathname.endsWith('change-phone-confirmation') && !!document.querySelector('.profile-success-icon')`);
    assert.equal((await fixture()).calls.confirm, confirms, 'Retry must not confirm the SMS a second time');
    assert.equal(crm.phone, NEXT);
    assert.equal(await evaluate(`sessionStorage.getItem('s2c_phone_change')`), null);
    assert.equal(await evaluate(`document.querySelector('.profile-confirmed-number strong').textContent`), NEXT);
    await assertNoOverflow();
    const shot = await cdp('Page.captureScreenshot', { format: 'png' });
    await fs.writeFile('/tmp/s2c-profile-confirmation.png', Buffer.from(shot.data, 'base64'));
    await visit('/profile/my-data');
    await wait(`document.querySelectorAll('.profile-detail-row strong')[3]?.textContent === ${JSON.stringify(NEXT)}`);

    // An interrupted, unconfirmed change preserves both the old Cognito and CRM phone.
    crm.phone = OLD;
    await evaluate(`sessionStorage.setItem(${JSON.stringify(AUTH_KEY)},JSON.stringify({phone:${JSON.stringify(OLD)},sub:'fixture-subject',calls:{}}))`);
    await visit('/profile/my-data/change-phone');
    await wait(`!!document.querySelector('.profile-phone-form')`);
    await submitPhone();
    await wait(`!!document.querySelector('#profile-phone-code')`);
    await visit('/profile/my-data');
    await wait(`document.querySelectorAll('.profile-detail-row').length === 6`);
    assert.equal((await fixture()).phone, OLD);
    assert.equal(crm.phone, OLD);
    assert.equal((await fixture()).calls.confirm || 0, 0);
    await wait(`Number(getComputedStyle(document.querySelector('.profile-details-card')).opacity) >= 0.99`);
    const dataShot = await cdp('Page.captureScreenshot', { format: 'png' });
    await fs.writeFile('/tmp/s2c-profile-my-data.png', Buffer.from(dataShot.data, 'base64'));

    for (const role of ['fincantieri_users', 'admin']) {
      previewRole = role;
      await evaluate(`localStorage.setItem('s2c_preview_session','fixture-preview');sessionStorage.removeItem('s2c_phone_change')`);
      const reads = calls.profile;
      await visit('/profile/my-data');
      await wait(`document.querySelectorAll('.profile-detail-row').length === 6`);
      assert.equal(await evaluate(`!!document.querySelector('.profile-edit-phone')`), false);
      for (const path of ['change-phone', 'change-phone-verification', 'change-phone-confirmation']) {
        await visit('/profile/my-data/' + path);
        await wait(`location.pathname === '/profile/my-data'`);
      }
      assert.equal(calls.profile, reads, 'Personal-code profile data must not call Cognito profile API');
    }
    previewRole = 'fincantieri_users';
    sections.quiz.status = 'internal';
    await visit('/profile');
    await wait(`!!document.querySelector('.profile-menu-row')`);
    assert.equal(await evaluate(`document.querySelectorAll('.profile-menu-row').length`), 1);
    await click('.profile-logout');
    await wait(`!!document.querySelector('.login-page')`);
    assert.equal(await evaluate(`localStorage.getItem('s2c_preview_session')`), null);
    assert.equal((await fixture()).calls.logout, 1);

    previewRole = null;
    await evaluate(`sessionStorage.setItem(${JSON.stringify(AUTH_KEY)},JSON.stringify({phone:${JSON.stringify(OLD)},sub:'fixture-subject',calls:{}}))`);
    await visit('/home');
    await click('.top-bar button[aria-label="Menu"]');
    await wait(`!!document.querySelector('.side-menu-item.logout')`);
    await click('.side-menu-item.logout');
    await wait(`!!document.querySelector('.login-page')`);
    assert.equal((await fixture()).calls.logout, 1);
    assert.deepEqual(browser.failures, []);
    console.log('PROFILE_BROWSER_PASS: six CRM fields, profile/footer/badges/logout, IT/EN/BN at 320/390/768, validation order, code errors, resend cooldown, token refresh, sync retry after reload, interrupted change and preview/personal-code route guards. All APIs and Amplify mocked; no real SMS or AWS writes.');
  } catch (error) {
    console.error('PROFILE_FIXTURE_DIAGNOSTIC', await evaluate(`({
      path:location.pathname,
      alert:document.querySelector('[role=alert]')?.textContent,
      fixtureCalls:JSON.parse(sessionStorage.getItem(${JSON.stringify(AUTH_KEY)})||'{}').calls,
      hasPending:!!sessionStorage.getItem('s2c_phone_change')
    })`));
    throw error;
  } finally { await browser.close(); }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
