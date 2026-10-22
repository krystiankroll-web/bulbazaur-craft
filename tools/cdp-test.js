// Test dymny gry w headless Chrome przez CDP (bez zależności: Node 22+ ma WebSocket).
const { spawn } = require('child_process');
const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const PORT = 9333, URL = process.argv[2] || 'http://127.0.0.1:8765/index.html';
const MOBILE = process.argv.includes('--mobile');
require('fs').mkdirSync(require('path').join(__dirname, 'out'), { recursive: true });
const prof = require('path').join(__dirname, 'out', 'chrome-prof') + (MOBILE ? '-m' : '');
require('fs').rmSync(prof, { recursive: true, force: true });
const chrome = spawn(CHROME, ['--headless=new', '--disable-gpu', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--no-first-run', '--no-default-browser-check',
  '--remote-debugging-port=' + PORT, '--user-data-dir=' + prof, '--window-size=1280,800', 'about:blank'], { stdio: 'ignore' });
const sleep = (ms) => new Promise(r => setTimeout(r, ms));
let id = 0, pending = {}, ws;
const send = (method, params = {}) => new Promise((res, rej) => { const i = ++id; pending[i] = { res, rej }; ws.send(JSON.stringify({ id: i, method, params })); });
const logs = [];
(async () => {
  let targets;
  for (let i = 0; i < 50; i++) { try { targets = await (await fetch(`http://127.0.0.1:${PORT}/json/list`)).json(); if (targets.length) break; } catch (e) {} await sleep(200); }
  const page = targets.find(t => t.type === 'page' && t.url === 'about:blank') || targets.find(t => t.type === 'page');
  ws = new WebSocket(page.webSocketDebuggerUrl);
  await new Promise(r => ws.onopen = r);
  ws.onmessage = (m) => {
    const d = JSON.parse(m.data);
    if (d.id && pending[d.id]) { (d.error ? pending[d.id].rej(new Error(JSON.stringify(d.error))) : pending[d.id].res(d.result)); delete pending[d.id]; return; }
    if (d.method === 'Runtime.consoleAPICalled') logs.push('[' + d.params.type + '] ' + d.params.args.map(a => a.value !== undefined ? String(a.value) : (a.description || a.type)).join(' '));
    if (d.method === 'Runtime.exceptionThrown') { const e = d.params.exceptionDetails; logs.push('[EXCEPTION] ' + (e.exception && e.exception.description || e.text) + ' @' + (e.url || '') + ':' + e.lineNumber); }
  };
  await send('Runtime.enable'); await send('Page.enable'); await send('Log.enable');
  if (MOBILE) { await send('Emulation.setDeviceMetricsOverride', { width: 844, height: 390, deviceScaleFactor: 2, mobile: true }); await send('Emulation.setTouchEmulationEnabled', { enabled: true, maxTouchPoints: 5 }); }
  await send('Page.navigate', { url: URL });
  await sleep(2500);
  const ev = async (expr) => { const r = await send('Runtime.evaluate', { expression: expr, returnByValue: true, awaitPromise: true }); return r.exceptionDetails ? 'EVAL ERROR: ' + (r.exceptionDetails.exception && r.exceptionDetails.exception.description) : r.result.value; };
  console.log('three:', await ev('typeof THREE'), 'BC:', await ev('Object.keys(BC).join(",")'), 'isTouch:', await ev('BC.isTouch'));
  const steps = JSON.parse(process.argv.find(a => a.startsWith('--steps=')) ? process.argv.find(a => a.startsWith('--steps=')).slice(8) : '[]');
  for (const s of steps) {
    if (s.startsWith('CDP:')) { const c = JSON.parse(s.slice(4)); const r = await send(c.method, c.params); console.log('> CDP', c.method, JSON.stringify(c.params).slice(0, 80), '=>', JSON.stringify(r).slice(0, 80)); await sleep(c.wait || 100); continue; }
    const r = await ev(s);
    console.log('>', s.slice(0, 90), '=>', typeof r === 'string' ? r.slice(0, 300) : JSON.stringify(r));
    await sleep(600);
  }
  await sleep(1500);
  const shot = await send('Page.captureScreenshot', { format: 'png' });
  require('fs').writeFileSync(prof + '-shot.png', Buffer.from(shot.data, 'base64'));
  console.log('--- console ---'); logs.forEach(l => console.log(l)); console.log('screenshot:', prof + '-shot.png');
  ws.close(); chrome.kill(); process.exit(0);
})().catch(e => { console.error('FAIL', e); chrome.kill(); process.exit(1); });
