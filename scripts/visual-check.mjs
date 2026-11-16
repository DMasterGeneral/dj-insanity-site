#!/usr/bin/env node
// Headless Chrome page check over the DevTools protocol. No npm packages: Node 24's WebSocket + fetch.
//
//   node scripts/visual-check.mjs <baseUrl> <path>[,<path>...] [--out dir] [--wait ms] [--click selector]
//
// For each path x viewport (360x640, 390x844 phones; 1280x800 desktop): load, wait in real time,
// optionally click a selector, save a full-page PNG, and report console errors, uncaught exceptions,
// failed requests, horizontal overflow, and controls that a position:fixed element covers.
// Exits 1 on console errors / exceptions / overflow (or a --click selector that was not found).
// Chrome path: CHROME env var, else the default macOS install.

import { spawn } from 'node:child_process';
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

const VIEWPORTS = [
  { width: 360, height: 640, mobile: true },
  { width: 390, height: 844, mobile: true },
  { width: 1280, height: 800, mobile: false },
];
const MOBILE_UA =
  'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Mobile Safari/537.36';
const CHROME = process.env.CHROME || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';

function usage(msg) {
  if (msg) console.error(msg);
  console.error('usage: node scripts/visual-check.mjs <baseUrl> <path>[,<path>...] [--out dir] [--wait ms] [--click selector]');
  process.exit(2);
}

function parseArgs(argv) {
  const opts = { out: './.visual', wait: 1500, click: null };
  const pos = [];
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--out') opts.out = argv[++i];
    else if (a === '--wait') opts.wait = Number(argv[++i]);
    else if (a === '--click') opts.click = argv[++i];
    else if (a.startsWith('--')) usage(`unknown option ${a}`);
    else pos.push(a);
  }
  if (pos.length !== 2 || !opts.out || !Number.isFinite(opts.wait) || (opts.click === undefined)) usage();
  return { base: pos[0].replace(/\/$/, ''), paths: pos[1].split(',').filter(Boolean), ...opts };
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// ---- Chrome process -------------------------------------------------------------------------

let chrome = null;
let profileDir = null;

function cleanup() {
  if (chrome && chrome.exitCode === null) chrome.kill('SIGKILL');
  if (profileDir) {
    try { rmSync(profileDir, { recursive: true, force: true }); } catch { /* best effort */ }
    profileDir = null;
  }
}
process.on('exit', cleanup);
for (const sig of ['SIGINT', 'SIGTERM']) process.on(sig, () => { cleanup(); process.exit(130); });

function launchChrome() {
  profileDir = mkdtempSync(join(tmpdir(), 'visual-check-'));
  chrome = spawn(CHROME, [
    '--headless=new',
    '--remote-debugging-port=0',
    `--user-data-dir=${profileDir}`,
    '--no-first-run',
    '--no-default-browser-check',
    '--disable-extensions',
    '--disable-background-networking',
    '--hide-scrollbars',
    '--mute-audio',
    'about:blank',
  ], { stdio: ['ignore', 'ignore', 'pipe'] });

  return new Promise((resolveUrl, reject) => {
    let buf = '';
    const timer = setTimeout(() => reject(new Error(`Chrome did not start (${CHROME})`)), 20000);
    chrome.on('error', (e) => { clearTimeout(timer); reject(e); });
    chrome.on('exit', (code) => { clearTimeout(timer); reject(new Error(`Chrome exited early (code ${code})`)); });
    chrome.stderr.on('data', (d) => {
      buf += d.toString();
      const m = /DevTools listening on (ws:\/\/\S+)/.exec(buf);
      if (m) { clearTimeout(timer); resolveUrl(m[1]); }
    });
  });
}

// ---- Minimal CDP client (one browser WebSocket, flattened sessions) ------------------------

class CDP {
  constructor(url) {
    this.ws = new WebSocket(url);
    this.nextId = 1;
    this.pending = new Map();
    this.listeners = new Set();
    this.ws.addEventListener('message', (ev) => {
      const msg = JSON.parse(typeof ev.data === 'string' ? ev.data : Buffer.from(ev.data).toString());
      if (msg.id && this.pending.has(msg.id)) {
        const { resolve: ok, reject: fail, method } = this.pending.get(msg.id);
        this.pending.delete(msg.id);
        if (msg.error) fail(new Error(`${method}: ${msg.error.message}`));
        else ok(msg.result);
      } else if (msg.method) {
        for (const fn of this.listeners) fn(msg);
      }
    });
  }
  open() {
    return new Promise((ok, fail) => {
      this.ws.addEventListener('open', () => ok(), { once: true });
      this.ws.addEventListener('error', () => fail(new Error('CDP WebSocket failed')), { once: true });
    });
  }
  send(method, params = {}, sessionId) {
    const id = this.nextId++;
    this.ws.send(JSON.stringify({ id, method, params, ...(sessionId ? { sessionId } : {}) }));
    return new Promise((ok, fail) => this.pending.set(id, { resolve: ok, reject: fail, method }));
  }
  on(fn) { this.listeners.add(fn); return () => this.listeners.delete(fn); }
  close() { try { this.ws.close(); } catch { /* ignore */ } }
}

// ---- In-page checks (run via Runtime.evaluate) ---------------------------------------------

const OVERFLOW_JS = `({ scrollWidth: document.documentElement.scrollWidth, innerWidth: window.innerWidth })`;

// For each visible control, try every scroll position at which its centre is on screen; if a
// position:fixed element is on top at its centre in all of them, report the pair.
const COVERED_JS = `(() => {
  const describe = (el) => {
    let s = el.tagName.toLowerCase();
    if (el.id) s += '#' + el.id;
    const cls = typeof el.className === 'string' ? el.className.trim().split(/\\s+/).filter(Boolean).slice(0, 2) : [];
    if (cls.length) s += '.' + cls.join('.');
    const label = (el.getAttribute('aria-label') || el.innerText || el.value || el.placeholder || '').trim().replace(/\\s+/g, ' ').slice(0, 30);
    return label ? s + ' "' + label + '"' : s;
  };
  const fixedAncestor = (el) => {
    for (let n = el; n && n.nodeType === 1; n = n.parentElement) {
      if (getComputedStyle(n).position === 'fixed') return n;
    }
    return null;
  };
  const root = document.scrollingElement || document.documentElement;
  const prevBehavior = root.style.scrollBehavior;
  root.style.scrollBehavior = 'auto';
  const startY = window.scrollY;
  const vh = window.innerHeight, vw = window.innerWidth;
  const maxScroll = Math.max(0, root.scrollHeight - vh);
  const controls = [...document.querySelectorAll('button, a[href], input:not([type=hidden]), select, textarea, [role=button]')];
  const found = [];
  for (const el of controls) {
    if (fixedAncestor(el)) continue; // it is the floating thing, not the victim
    const cs = getComputedStyle(el);
    if (cs.visibility === 'hidden' || cs.display === 'none') continue;
    window.scrollTo(0, startY);
    const r0 = el.getBoundingClientRect();
    if (r0.width < 1 || r0.height < 1) continue;
    const cx = r0.left + r0.width / 2;
    if (cx < 0 || cx >= vw) continue;
    const docY = r0.top + window.scrollY + r0.height / 2;
    const lo = Math.max(0, Math.ceil(docY - vh + 1)), hi = Math.min(maxScroll, Math.floor(docY));
    if (lo > hi) continue;
    const steps = 12;
    let visible = false, cover = null;
    for (let i = 0; i <= steps && !visible; i++) {
      const y = Math.round(lo + ((hi - lo) * i) / steps);
      window.scrollTo(0, y);
      const vy = docY - window.scrollY;
      if (vy < 0 || vy >= vh) continue;
      const hit = document.elementFromPoint(cx, vy);
      if (!hit || hit === el || el.contains(hit) || hit.contains(el)) { visible = true; break; }
      const f = fixedAncestor(hit);
      if (f) cover = f; else visible = true; // covered by something non-fixed: not this check's concern
    }
    if (!visible && cover) found.push({ control: describe(el), fixed: describe(cover) });
  }
  window.scrollTo(0, startY);
  root.style.scrollBehavior = prevBehavior;
  return found;
})()`;

// ---- One page x viewport -------------------------------------------------------------------

async function checkOne(cdp, url, vp, opts, file) {
  const { browserContextId } = await cdp.send('Target.createBrowserContext');
  const { targetId } = await cdp.send('Target.createTarget', { url: 'about:blank', browserContextId });
  const { sessionId } = await cdp.send('Target.attachToTarget', { targetId, flatten: true });
  const s = (m, p) => cdp.send(m, p, sessionId);

  const result = { consoleErrors: [], exceptions: [], failedRequests: [], overflow: null, covered: [], notes: [] };
  let loaded;
  const loadedP = new Promise((r) => { loaded = r; });

  const off = cdp.on((msg) => {
    if (msg.sessionId !== sessionId) return;
    const p = msg.params;
    switch (msg.method) {
      case 'Page.loadEventFired': loaded(); break;
      case 'Runtime.consoleAPICalled':
        if (p.type === 'error' || p.type === 'assert') {
          result.consoleErrors.push(p.args.map((a) => a.value ?? a.description ?? a.type).join(' '));
        }
        break;
      case 'Runtime.exceptionThrown':
        result.exceptions.push(p.exceptionDetails.exception?.description?.split('\n')[0] || p.exceptionDetails.text);
        break;
      case 'Log.entryAdded':
        // Network-sourced log lines are already reported as failed requests.
        if (p.entry.level === 'error' && p.entry.source !== 'network') result.consoleErrors.push(p.entry.text);
        break;
      case 'Network.responseReceived':
        if (p.response.status >= 400) result.failedRequests.push(`${p.response.status} ${p.response.url}`);
        break;
      case 'Network.loadingFailed':
        if (!p.canceled) result.failedRequests.push(`${p.errorText} ${p.requestId}`);
        break;
    }
  });

  // Map requestId -> url for loadingFailed messages.
  const urls = new Map();
  const offUrls = cdp.on((msg) => {
    if (msg.sessionId === sessionId && msg.method === 'Network.requestWillBeSent') urls.set(msg.params.requestId, msg.params.request.url);
  });

  try {
    await Promise.all([s('Page.enable'), s('Runtime.enable'), s('Network.enable'), s('Log.enable')]);
    await s('Emulation.setDeviceMetricsOverride', {
      width: vp.width, height: vp.height, deviceScaleFactor: vp.mobile ? 2 : 1, mobile: vp.mobile,
    });
    if (vp.mobile) {
      await s('Emulation.setTouchEmulationEnabled', { enabled: true, maxTouchPoints: 5 });
      await s('Emulation.setUserAgentOverride', { userAgent: MOBILE_UA, platform: 'Android' });
    }

    const nav = await s('Page.navigate', { url });
    if (nav.errorText) throw new Error(`navigation failed: ${nav.errorText}`);
    await Promise.race([loadedP, sleep(30000).then(() => result.notes.push('load event timed out'))]);
    await sleep(opts.wait);

    if (opts.click) {
      const { result: r } = await s('Runtime.evaluate', {
        expression: `(() => { const el = document.querySelector(${JSON.stringify(opts.click)}); if (!el) return false; el.scrollIntoView({ block: 'center' }); el.click(); window.scrollTo(0, 0); return true; })()`,
        returnByValue: true,
      });
      if (!r.value) result.notes.push(`click: no element matches ${opts.click}`);
      await sleep(1000);
    }

    const ov = (await s('Runtime.evaluate', { expression: OVERFLOW_JS, returnByValue: true })).result.value;
    result.overflow = ov.scrollWidth > ov.innerWidth ? ov : null;
    result.covered = (await s('Runtime.evaluate', { expression: COVERED_JS, returnByValue: true })).result.value || [];

    const { cssContentSize } = await s('Page.getLayoutMetrics');
    const shot = await s('Page.captureScreenshot', {
      format: 'png',
      captureBeyondViewport: true,
      clip: {
        x: 0, y: 0,
        width: Math.max(vp.width, Math.ceil(cssContentSize.width)),
        height: Math.max(vp.height, Math.ceil(cssContentSize.height)),
        scale: 1,
      },
    });
    writeFileSync(file, Buffer.from(shot.data, 'base64'));
  } finally {
    off();
    offUrls();
    result.failedRequests = result.failedRequests.map((f) => f.replace(/ (\S+)$/, (m, id) => (urls.has(id) ? ` ${urls.get(id)}` : m)));
    await cdp.send('Target.closeTarget', { targetId }).catch(() => {});
    await cdp.send('Target.disposeBrowserContext', { browserContextId }).catch(() => {});
  }
  return result;
}

// ---- Main ----------------------------------------------------------------------------------

function slug(path) {
  const s = path.replace(/^\/+|\/+$/g, '').replace(/[^A-Za-z0-9]+/g, '-');
  return s || 'root';
}

function pad(s, n) { s = String(s); return s.length >= n ? s : s + ' '.repeat(n - s.length); }

async function main() {
  const opts = parseArgs(process.argv.slice(2));
  const outDir = resolve(opts.out);
  mkdirSync(outDir, { recursive: true });

  const wsUrl = await launchChrome();
  const cdp = new CDP(wsUrl);
  await cdp.open();

  const rows = [];
  let failed = false;
  for (const path of opts.paths) {
    for (const vp of VIEWPORTS) {
      const file = join(outDir, `${slug(path)}-${vp.width}x${vp.height}.png`);
      let r;
      try {
        r = await checkOne(cdp, opts.base + (path.startsWith('/') ? path : '/' + path), vp, opts, file);
      } catch (e) {
        r = { consoleErrors: [], exceptions: [], failedRequests: [], overflow: null, covered: [], notes: [`check failed: ${e.message}`] };
      }
      const bad = r.consoleErrors.length > 0 || r.exceptions.length > 0 || !!r.overflow || r.notes.length > 0;
      if (bad) failed = true;
      rows.push({ path, vp: `${vp.width}x${vp.height}`, file, r, bad });
    }
  }
  cdp.close();

  const header = [pad('path', 18), pad('viewport', 10), pad('console', 8), pad('except', 7), pad('failreq', 8), pad('overflow', 10), pad('covered', 8), 'screenshot'];
  console.log(header.join(' '));
  for (const { path, vp, file, r, bad } of rows) {
    console.log([
      pad(path, 18), pad(vp, 10), pad(r.consoleErrors.length, 8), pad(r.exceptions.length, 7),
      pad(r.failedRequests.length, 8), pad(r.overflow ? `${r.overflow.scrollWidth}>${r.overflow.innerWidth}` : 'ok', 10),
      pad(r.covered.length, 8), file + (bad ? '  FAIL' : ''),
    ].join(' '));
  }

  const details = rows.filter(({ r }) =>
    r.consoleErrors.length || r.exceptions.length || r.failedRequests.length || r.covered.length || r.notes.length);
  if (details.length) console.log('');
  for (const { path, vp, r } of details) {
    console.log(`${path} @ ${vp}`);
    for (const m of r.notes) console.log(`  note:      ${m}`);
    for (const m of r.consoleErrors) console.log(`  console:   ${m.slice(0, 200)}`);
    for (const m of r.exceptions) console.log(`  exception: ${m.slice(0, 200)}`);
    for (const m of r.failedRequests) console.log(`  request:   ${m.slice(0, 200)}`);
    for (const c of r.covered) console.log(`  covered:   ${c.control}  under fixed  ${c.fixed}`);
  }

  cleanup();
  process.exitCode = failed ? 1 : 0;
}

main().catch((e) => {
  console.error(e.message || e);
  cleanup();
  process.exitCode = 1;
});
