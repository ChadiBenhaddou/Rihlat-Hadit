// Browser smoke test over the Chrome DevTools Protocol (no extra dependencies).
// Usage: node scripts/smoke.mjs <url> [--width=1440] [--height=1000] [--wait=4000] [--shot=file.png]
//        [--eval="js expression"] [--dark] [--reduced-motion] [--key=ArrowLeft,...]
import { spawn } from 'node:child_process';
import { writeFileSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const url = process.argv[2];
const opt = Object.fromEntries(process.argv.slice(3).map((a) => { const [k, ...v] = a.replace(/^--/, '').split('='); return [k, v.join('=') || true]; }));
const width = Number(opt.width ?? 1440), height = Number(opt.height ?? 1000), wait = Number(opt.wait ?? 4000);
const port = 9300 + Math.floor(Math.random() * 500);
const profile = mkdtempSync(join(process.env.SMOKE_TMP ?? tmpdir(), 'smoke-'));
const chrome = spawn('chromium', ['--headless=new', '--disable-gpu', '--hide-scrollbars', `--remote-debugging-port=${port}`, `--user-data-dir=${profile}`, `--window-size=${width},${height}`, 'about:blank'], { stdio: 'ignore' });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let target;
for (let i = 0; i < 50 && !target; i++) { try { target = (await (await fetch(`http://127.0.0.1:${port}/json`)).json()).find((t) => t.type === 'page'); } catch { await sleep(200); } }
const ws = new WebSocket(target.webSocketDebuggerUrl);
await new Promise((r) => ws.addEventListener('open', r));
let id = 0; const waiters = new Map(); const logs = [];
ws.addEventListener('message', (m) => {
  const d = JSON.parse(m.data);
  if (d.id && waiters.has(d.id)) { waiters.get(d.id)(d); waiters.delete(d.id); }
  if (d.method === 'Runtime.consoleAPICalled') logs.push(`console.${d.params.type}: ${d.params.args.map((a) => a.value ?? a.description ?? '').join(' ')}`.slice(0, 400));
  if (d.method === 'Runtime.exceptionThrown') logs.push(`EXCEPTION: ${d.params.exceptionDetails.exception?.description ?? d.params.exceptionDetails.text}`.slice(0, 600));
  if (d.method === 'Log.entryAdded') logs.push(`log.${d.params.entry.level}: ${d.params.entry.text}`.slice(0, 400));
});
const send = (method, params = {}) => new Promise((r) => { const i = ++id; waiters.set(i, r); ws.send(JSON.stringify({ id: i, method, params })); });
await send('Runtime.enable'); await send('Log.enable'); await send('Page.enable');
await send('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: 1, mobile: width < 700 });
const media = [];
if (opt.dark) media.push({ name: 'prefers-color-scheme', value: 'dark' });
if (opt['reduced-motion']) media.push({ name: 'prefers-reduced-motion', value: 'reduce' });
if (media.length) await send('Emulation.setEmulatedMedia', { features: media });
await send('Page.navigate', { url });
await sleep(wait);
for (const key of String(opt.key ?? '').split(',').filter(Boolean)) {
  const code = key === ' ' || key === 'Space' ? ' ' : key;
  await send('Input.dispatchKeyEvent', { type: 'keyDown', key: code, code: key === 'Space' ? 'Space' : key, windowsVirtualKeyCode: { ArrowLeft: 37, ArrowRight: 39, Home: 36, Space: 32, Tab: 9, Enter: 13 }[key] ?? 0 });
  await send('Input.dispatchKeyEvent', { type: 'keyUp', key: code, code: key === 'Space' ? 'Space' : key });
  await sleep(900);
}
if (opt.eval) { const r = await send('Runtime.evaluate', { expression: opt.eval, returnByValue: true, awaitPromise: true }); console.log('EVAL:', JSON.stringify(r.result?.result?.value ?? r.result)); }
if (opt.shot) { const r = await send('Page.captureScreenshot', { format: 'png' }); writeFileSync(opt.shot, Buffer.from(r.result.data, 'base64')); console.log('SHOT:', opt.shot); }
for (const l of logs) console.log(l);
ws.close(); chrome.kill();
