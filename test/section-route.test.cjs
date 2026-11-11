const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const Module = require('node:module');
const path = require('node:path');
const React = require('react');
const { renderToStaticMarkup } = require('react-dom/server');
const { transformSync } = require('esbuild');

test('direct refresh waits for profile and sections before deciding access; resolved admin is never redirected', async () => {
  const access = await import('../src/lib/sectionAccess.js');
  const auth = { user: { type: 'standard' }, profileReady: false };
  const configuration = { sections: access.DEFAULT_SECTIONS, sectionsReady: true };
  const filename = path.resolve('src/components/SectionRoute.jsx');
  const compiled = transformSync(fs.readFileSync(filename, 'utf8'), { loader: 'jsx', format: 'cjs', jsx: 'automatic' }).code;
  const componentModule = new Module(filename, module);
  componentModule.paths = module.paths;
  const originalLoad = Module._load;
  Module._load = function(request, parent, isMain) {
    if (request === '../context/AuthContext') return { useAuth: () => auth };
    if (request === '../context/SectionsContext') return { useSections: () => configuration };
    if (request === '../lib/sectionAccess') return access;
    if (request === 'react-router-dom') return {
      Navigate: ({ to }) => React.createElement('i', { 'data-redirect': to }),
    };
    return originalLoad.call(this, request, parent, isMain);
  };
  let SectionRoute;
  try {
    componentModule._compile(compiled, filename);
    SectionRoute = componentModule.exports.default;
  } finally { Module._load = originalLoad; }
  const render = () => renderToStaticMarkup(React.createElement(
    SectionRoute, { section: 'offices' }, React.createElement('p', null, 'Offices'),
  ));
  assert.equal(render(), '');
  auth.user = { type: 'admin' };
  assert.equal(render(), '');
  auth.profileReady = true;
  configuration.sectionsReady = false;
  assert.equal(render(), '');
  configuration.sectionsReady = true;
  assert.equal(render(), '<p>Offices</p>');
  auth.user = { type: 'fincantieri_users' };
  assert.match(render(), /data-redirect="\/home"/);
  auth.user = { type: 'standard' };
  assert.match(render(), /data-redirect="\/home"/);
});
