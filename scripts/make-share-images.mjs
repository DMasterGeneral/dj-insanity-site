#!/usr/bin/env node
// Render the link-preview image and the iOS home-screen icon with headless Chrome over CDP.
//   node scripts/make-share-images.mjs
// Writes public/og-image.png (1200x630) and public/apple-touch-icon.png (180x180).
// Uses Inter from node_modules/@fontsource-variable/inter and the vinyl from public/favicon.svg.
// Chrome path: CHROME env var, else the default macOS install.

import { spawn } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const CHROME = process.env.CHROME || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const root = new URL('..', import.meta.url).pathname;
const font = readFileSync(join(root, 'node_modules/@fontsource-variable/inter/files/inter-latin-wght-normal.woff2')).toString('base64');
const favicon = readFileSync(join(root, 'public/favicon.svg'), 'utf8');

// Deterministic waveform: tall in the middle, tapering to the edges.
function bars(n) {
  let out = '';
  for (let i = 0; i < n; i++) {
    const x = i / (n - 1);
    const env = Math.sin(Math.PI * x) ** 1.5;
    const wiggle = 0.55 + 0.45 * Math.abs(Math.sin(i * 1.7) * Math.cos(i * 0.43));
    const h = Math.max(6, Math.round(110 * env * wiggle));
    const gold = Math.abs(x - 0.5) < 0.06;
    out += `<i style="height:${h}px;background:${gold ? '#F59E0B' : '#2563EB'};opacity:${gold ? 1 : 0.35 + 0.65 * env}"></i>`;
  }
  return out;
}

const OG = `<!doctype html><html><head><style>
@font-face { font-family: Inter; src: url(data:font/woff2;base64,${font}) format('woff2'); font-weight: 100 900; }
html, body { margin: 0; width: 1200px; height: 630px; background: #050505; overflow: hidden; }
body { display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 44px; font-family: Inter; }
h1 { margin: 0; color: #fff; font-weight: 900; font-size: 156px; letter-spacing: -0.035em; line-height: 1; }
h1 span { color: #2563EB; }
.wave { display: flex; align-items: center; gap: 6px; height: 120px; }
.wave i { display: block; width: 8px; border-radius: 4px; }
</style></head><body>
<h1>DJ <span>INSANITY</span></h1>
<div class="wave">${bars(64)}</div>
</body></html>`;

// iOS masks the corners itself, so the icon is full-bleed (no rounded rect).
const ICON = `<!doctype html><html><head><style>
html, body { margin: 0; width: 180px; height: 180px; overflow: hidden; }
svg { display: block; width: 180px; height: 180px; }
</style></head><body>${favicon.replace(/ rx="\d+"/, '')}</body></html>`;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function main() {
  const profile = mkdtempSync(join(tmpdir(), 'share-images-'));
  const chrome = spawn(CHROME, ['--headless=new', '--remote-debugging-port=0', `--user-data-dir=${profile}`,
    '--no-first-run', '--hide-scrollbars', 'about:blank'], { stdio: ['ignore', 'ignore', 'pipe'] });
  try {
    const wsUrl = await new Promise((ok, fail) => {
      let buf = '';
      chrome.on('error', fail);
      chrome.stderr.on('data', (d) => {
        const m = /DevTools listening on (ws:\/\/\S+)/.exec((buf += d));
        if (m) ok(m[1]);
      });
    });
    const ws = new WebSocket(wsUrl);
    await new Promise((ok) => ws.addEventListener('open', ok, { once: true }));
    let id = 0;
    const pending = new Map();
    ws.addEventListener('message', (ev) => {
      const msg = JSON.parse(ev.data);
      if (pending.has(msg.id)) {
        pending.get(msg.id)(msg);
        pending.delete(msg.id);
      }
    });
    const send = (method, params = {}, sessionId) => new Promise((ok, fail) => {
      const n = ++id;
      pending.set(n, (m) => (m.error ? fail(new Error(`${method}: ${m.error.message}`)) : ok(m.result)));
      ws.send(JSON.stringify({ id: n, method, params, sessionId }));
    });

    const { targetId } = await send('Target.createTarget', { url: 'about:blank' });
    const { sessionId } = await send('Target.attachToTarget', { targetId, flatten: true });
    const s = (m, p) => send(m, p, sessionId);
    await s('Page.enable');
    const { frameTree } = await s('Page.getFrameTree');

    for (const [html, width, height, file] of [[OG, 1200, 630, 'og-image.png'], [ICON, 180, 180, 'apple-touch-icon.png']]) {
      await s('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: 1, mobile: false });
      await s('Page.setDocumentContent', { frameId: frameTree.frame.id, html });
      await s('Runtime.evaluate', { expression: 'document.fonts.ready.then(() => true)', awaitPromise: true });
      await sleep(200);
      const shot = await s('Page.captureScreenshot', { format: 'png', clip: { x: 0, y: 0, width, height, scale: 1 } });
      const out = join(root, 'public', file);
      writeFileSync(out, Buffer.from(shot.data, 'base64'));
      console.log(`wrote ${out}`);
    }
    ws.close();
  } finally {
    chrome.kill('SIGKILL');
    rmSync(profile, { recursive: true, force: true });
  }
}

main().catch((e) => {
  console.error(e.message || e);
  process.exitCode = 1;
});
