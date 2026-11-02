// Small optional CDP test helper; API mocks stay in the calling test script.
const { spawn } = require('node:child_process');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');

async function chromiumSession() {
  if (typeof WebSocket === 'undefined') throw new Error('Use node --experimental-websocket');
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), 's2c-notification-browser-'));
  const process = spawn('/repl/tools/bin/chromium', [
    '--headless', '--no-sandbox', '--disable-gpu', '--disable-dev-shm-usage',
    '--remote-debugging-port=0', `--user-data-dir=${directory}`, 'about:blank',
  ], { stdio: ['ignore', 'ignore', 'pipe'] });
  const browserUrl = await new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('Chromium startup timeout')), 15000);
    process.stderr.on('data', (data) => {
      const match = data.toString().match(/DevTools listening on (ws:\/\/\S+)/);
      if (match) { clearTimeout(timer); resolve(match[1]); }
    });
    process.once('exit', () => { clearTimeout(timer); reject(new Error('Chromium exited')); });
  });
  const debuggingOrigin = browserUrl.replace(/^ws:/, 'http:').split('/devtools/')[0];
  const targets = await (await fetch(`${debuggingOrigin}/json/list`)).json();
  const socket = new WebSocket(targets.find((target) => target.type === 'page').webSocketDebuggerUrl);
  await new Promise((resolve, reject) => { socket.onopen = resolve; socket.onerror = reject; });
  let nextId = 0;
  const pending = new Map();
  const events = {};
  const failures = [];
  const cdp = (method, params = {}) => new Promise((resolve, reject) => {
    const id = ++nextId;
    const timer = setTimeout(() => { pending.delete(id); reject(new Error(`CDP timeout: ${method}`)); }, 15000);
    pending.set(id, { resolve, reject, timer });
    socket.send(JSON.stringify({ id, method, params }));
  });
  socket.onmessage = ({ data }) => {
    const value = JSON.parse(data);
    if (value.id) {
      const entry = pending.get(value.id);
      if (!entry) return;
      clearTimeout(entry.timer); pending.delete(value.id);
      value.error ? entry.reject(new Error(JSON.stringify(value.error))) : entry.resolve(value.result);
    } else if (events[value.method]) {
      Promise.resolve(events[value.method](value.params)).catch((err) => {
        if (!err.message.includes('Invalid InterceptionId.')) failures.push(err.message);
      });
    }
  };
  const evaluate = async (expression) => {
    const value = await cdp('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
    if (value.exceptionDetails) throw new Error(`${value.exceptionDetails.exception?.description || value.exceptionDetails.text}\n${expression}`);
    return value.result?.value;
  };
  const wait = async (expression) => {
    for (let i = 0; i < 120; i++) {
      if (await evaluate(expression)) return;
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
    throw new Error(`Browser assertion timeout: ${expression}`);
  };
  const screenshot = async (name) => {
    const result = await cdp('Page.captureScreenshot', { format: 'png' });
    await fs.writeFile(path.join(os.tmpdir(), name), Buffer.from(result.data, 'base64'));
  };
  return {
    cdp, evaluate, wait, events, failures, screenshot,
    async close() {
      socket.close();
      const exited = new Promise((resolve) => process.once('exit', resolve));
      process.kill('SIGTERM'); await exited;
      await fs.rm(directory, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
    },
  };
}

module.exports = { chromiumSession };
