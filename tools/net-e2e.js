// Test e2e gry we dwoje: dwie karty headless Chrome (gospodarz A, gość B) łączą się przez broker PeerJS.
const { spawn } = require('child_process');
const fs = require('fs');
const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const URL = process.argv[2] || 'http://127.0.0.1:8765/index.html';
const SP = require('path').join(__dirname, 'out'); fs.mkdirSync(SP, { recursive: true });
// dwie osobne przeglądarki = dwa telefony (osobny localStorage, obie karty widoczne)
function launch(port, name) {
  const prof = SP + '/chrome-net-' + name;
  fs.rmSync(prof, { recursive: true, force: true });
  return spawn(CHROME, ['--headless=new', '--disable-gpu', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--no-first-run', '--no-default-browser-check',
    '--remote-debugging-port=' + port, '--user-data-dir=' + prof, '--window-size=1000,640', 'about:blank'], { stdio: 'ignore' });
}
const chromes = [launch(9334, 'a'), launch(9335, 'b')];
const chrome = { kill: () => chromes.forEach(c => c.kill()) };
const sleep = (ms) => new Promise(r => setTimeout(r, ms));
const logs = [];
async function page(name, wsUrl) {
  const ws = new WebSocket(wsUrl); let id = 0; const pend = {};
  await new Promise(r => ws.onopen = r);
  ws.onmessage = (m) => {
    const d = JSON.parse(m.data);
    if (d.id && pend[d.id]) { (d.error ? pend[d.id].rej(new Error(JSON.stringify(d.error))) : pend[d.id].res(d.result)); delete pend[d.id]; return; }
    if (d.method === 'Runtime.exceptionThrown') { const e = d.params.exceptionDetails; logs.push(name + ' [EXC] ' + (e.exception && e.exception.description || e.text)); }
    if (d.method === 'Runtime.consoleAPICalled' && d.params.type === 'error') logs.push(name + ' [err] ' + d.params.args.map(a => a.value || a.description).join(' '));
  };
  const send = (method, params = {}) => new Promise((res, rej) => { const i = ++id; pend[i] = { res, rej }; ws.send(JSON.stringify({ id: i, method, params })); });
  await send('Runtime.enable'); await send('Page.enable');
  const ev = async (expr) => { const r = await send('Runtime.evaluate', { expression: expr, returnByValue: true, awaitPromise: true }); return r.exceptionDetails ? 'EVAL ERROR: ' + (r.exceptionDetails.exception && r.exceptionDetails.exception.description) : r.result.value; };
  const until = async (expr, ms = 20000) => { const t0 = Date.now(); while (Date.now() - t0 < ms) { const v = await ev(expr); if (v && !String(v).startsWith('EVAL ERROR')) return v; await sleep(300); } return await ev(expr); };
  const shot = async (file) => { const s = await send('Page.captureScreenshot', { format: 'png' }); fs.writeFileSync(file, Buffer.from(s.data, 'base64')); };
  return { send, ev, until, shot, ws };
}
let ok = 0, bad = 0;
function check(label, cond, info) { if (cond) ok++; else bad++; console.log((cond ? 'OK   ' : 'FAIL ') + label + (info !== undefined ? '  → ' + JSON.stringify(info) : '')); }
(async () => {
  async function firstPage(port) {
    for (let i = 0; i < 50; i++) { try { const t = await (await fetch(`http://127.0.0.1:${port}/json/list`)).json(); const p = t.find(x => x.type === 'page'); if (p) return p.webSocketDebuggerUrl; } catch (e) {} await sleep(200); }
  }
  const A = await page('A', await firstPage(9334));
  const B = await page('B', await firstPage(9335));

  // A: nowy świat w przetrwaniu, potem pokój
  await A.send('Page.navigate', { url: URL }); await sleep(2500);
  await A.ev(`document.getElementById('btnPlay').click(); document.querySelector('#modes .card[data-mode=survival]').click(); document.getElementById('btnStart').click(); 1`);
  await A.until(`BC.Player && BC.Player.body && !BC.Player.paused`);
  await A.ev(`BC.Game.time = BC.Survival.DAY_LENGTH * 0.2; BC.Player.openMenu(); document.getElementById('btnNet').click(); document.getElementById('btnHost').click(); 1`);
  const code = await A.until(`BC.Net.code && document.getElementById('btnEnter').style.display === '' && BC.Net.code`);
  check('A: pokój utworzony', /^[A-Z2-9]{4}$/.test(code), code);
  await A.ev(`document.getElementById('btnEnter').click(); 1`);

  // B: dołącza
  await B.send('Page.navigate', { url: URL }); await sleep(2500);
  await B.ev(`document.getElementById('btnNet').click(); document.getElementById('inCode').value = '${code.toLowerCase()}'; document.getElementById('btnJoin').click(); 1`);
  await sleep(2500);
  const enter = await B.until(`document.getElementById('btnEnter').style.display === '' && document.getElementById('panelNet').style.display === 'flex'`, 25000);
  check('B: połączono z pokojem', enter === true, await B.ev(`document.getElementById('netErr').textContent + ' | ' + document.getElementById('netCode').textContent`));
  await B.ev(`document.getElementById('btnEnter').click(); 1`);
  await B.until(`BC.Player && BC.Player.body && !BC.Player.paused`);
  await sleep(2000);
  const seedA = await A.ev(`BC.Game.world.seed`), seedB = await B.ev(`BC.Game.world.seed`);
  check('ten sam świat (seed)', seedA === seedB, [seedA, seedB]);
  check('B: tryb gospodarza', (await B.ev(`BC.Player.mode`)) === 'survival');
  check('B: gość nie zapisuje', (await B.ev(`BC.Boot.guest === true && BC.Monsters.puppet === true`)) === true);
  check('A widzi kolegę', (await A.until(`!!BC.Remote.model && !!BC.Remote.pos`)) === true);
  console.log('A stan:', await A.ev(`JSON.stringify({hidden:document.hidden, paused:BC.Player.paused, ready:BC.Net.ready, active:BC.Net.active(), role:BC.Net.role})`));
  console.log('B stan:', await B.ev(`JSON.stringify({hidden:document.hidden, paused:BC.Player.paused, ready:BC.Net.ready, active:BC.Net.active(), role:BC.Net.role})`));
  check('B widzi gospodarza', (await B.until(`!!BC.Remote.model && !!BC.Remote.pos`)) === true);
  check('A: odznaka „we dwoje”', String(await A.ev(`document.getElementById('netBadge').textContent`)).includes('we dwoje'));

  // bloki w obie strony
  const pb = await B.ev(`(()=>{const p=BC.Player.body.pos;const x=Math.floor(p.x)+2,z=Math.floor(p.z),y=Math.floor(p.y)+3;BC.Game.setBlock(x,y,z,BC.Blocks.BRICK);return [x,y,z]})()`);
  check('blok od gościa u gospodarza', (await A.until(`BC.Game.world.get(${pb}) === BC.Blocks.BRICK`, 5000)) === true, pb);
  const pa = await A.ev(`(()=>{const p=BC.Player.body.pos;const x=Math.floor(p.x)-2,z=Math.floor(p.z),y=Math.floor(p.y)+3;BC.Game.setBlock(x,y,z,BC.Blocks.GLASS);return [x,y,z]})()`);
  check('blok od gospodarza u gościa', (await B.until(`BC.Game.world.get(${pa}) === BC.Blocks.GLASS`, 5000)) === true, pa);

  // krowa od gospodarza widoczna u gościa, głaskanie u gościa daje mleko
  const cowId = await A.ev(`(()=>{const p=BC.Remote.pos;const c=BC.Monsters.spawnAt({x:p.x+1.5,y:p.y+0.01,z:p.z},'krowa');return c.id})()`);
  check('krowa u gościa', (await B.until(`BC.Monsters.list.some(c=>c.id===${cowId})`, 5000)) === true);
  await B.ev(`BC.Player.pet(BC.Monsters.list.find(c=>c.id===${cowId})); 1`);
  check('mleko u gościa po głaskaniu', (await B.until(`(BC.Player.inv[BC.Blocks.MILK]||0) === 1`, 5000)) === true, await B.ev(`BC.Player.inv`));
  check('krowa u gospodarza idzie za gościem', (await A.ev(`BC.Monsters.list.find(c=>c.id===${cowId}).follow`)) === 1);

  // potwór u gospodarza: gość go bije i dostaje wiadomość o pokonaniu
  const monId = await A.ev(`(()=>{BC.Game.time=BC.Survival.DAY_LENGTH*0.75;const p=BC.Remote.pos;const c=BC.Monsters.spawnAt({x:p.x+2,y:p.y+0.01,z:p.z},'cieniak');return c.id})()`);
  await B.until(`BC.Monsters.list.some(c=>c.id===${monId})`, 5000);
  await B.ev(`(()=>{const m=BC.Monsters.list.find(c=>c.id===${monId});for(let i=0;i<3;i++)BC.Player.attack(m,2);return 1})()`);
  check('potwór pokonany przez gościa', (await A.until(`!BC.Monsters.list.some(c=>c.id===${monId} && !c.dead)`, 5000)) === true);

  await A.shot(SP + '/net-A.png'); await B.shot(SP + '/net-B.png');

  // gość wychodzi
  await B.send('Page.navigate', { url: 'about:blank' });
  check('A: „Kolega wyszedł”', (await A.until(`BC.Net.conn === null && BC.Remote.model === null`, 15000)) === true);

  console.log(`\n${ok} OK, ${bad} FAIL`);
  console.log('--- błędy z konsoli ---'); logs.forEach(l => console.log(l));
  chrome.kill(); process.exit(bad ? 1 : 0);
})().catch(e => { console.error('CRASH', e); chrome.kill(); process.exit(2); });
