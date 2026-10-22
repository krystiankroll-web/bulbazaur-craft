// Start gry: menu (nowy świat, bohater, warsztat, omdlenie, gra we dwoje), ładowanie / zapis, autozapis, audio, PWA.
(function (BC) {
  var Boot = {};
  var overlay = document.getElementById('overlay');
  var started = false;
  var SAVE_KEY = 'bc.world2', GAME_KEY = 'bc.game';
  var S = BC.Survival;
  var pick = { mode: 'creative', hero: 'bulbasaur' };

  if (typeof THREE === 'undefined') {
    overlay.style.display = 'none';
    document.getElementById('err').style.display = 'flex';
    return;
  }

  function $(id) { return document.getElementById(id); }
  function loadWorld() {
    try {
      var s = localStorage.getItem(SAVE_KEY);
      if (s) return BC.World.deserialize(s);
    } catch (e) { console.warn('Nie udało się wczytać zapisu', e); }
    return null;
  }
  function loadGame() {
    try { var s = localStorage.getItem(GAME_KEY); return s ? JSON.parse(s) : null; } catch (e) { return null; }
  }
  function save() {
    if (!BC.Game.world || Boot.guest) return;   // gość nie nadpisuje swojego zapisu światem kolegi
    try {
      localStorage.setItem(SAVE_KEY, BC.Game.world.serialize());
      var st = BC.Player.getState();
      st.time = BC.Game.time;
      localStorage.setItem(GAME_KEY, JSON.stringify(st));
      BC.Player.savePos();
    } catch (e) { console.warn('Zapis nieudany', e); }
  }
  Boot.save = save;

  function setLoading(text) {
    var el = $('loading');
    el.style.display = text ? 'flex' : 'none';
    el.textContent = text || '';
  }
  function showPanel(id) {
    ['menuMain', 'panelNew', 'panelHero', 'panelCraft', 'panelDeath', 'panelNet'].forEach(function (p) { $(p).style.display = p === id ? 'flex' : 'none'; });
    overlay.style.display = 'flex';
    document.body.classList.add('menu');
  }
  function hideOverlay() { overlay.style.display = 'none'; document.body.classList.remove('menu'); }
  function tryFullscreen() {
    if (!BC.isTouch) return;
    var el = document.documentElement;
    try { if (el.requestFullscreen && !document.fullscreenElement) el.requestFullscreen().catch(function () {}); } catch (e) {}
    try { if (screen.orientation && screen.orientation.lock) screen.orientation.lock('landscape').catch(function () {}); } catch (e) {}
  }

  function start(world, game) {
    BC.Audio.init();
    tryFullscreen();
    if (!started) {
      started = true;
      game = game || {};
      setLoading('Szukam dobrego miejsca…');
      hideOverlay();
      setTimeout(function () {
        var sp = game.spawn || world.findSpawn(0, 0);
        BC.Game.init(world, { mode: game.mode, time: game.time });
        BC.Game.preload(sp.x, sp.z, 2);
        var spawn = game.spawn ? { x: sp.x, y: sp.y, z: sp.z } : { x: sp.x, y: world.surfaceY(Math.floor(sp.x), Math.floor(sp.z)) + 1.01, z: sp.z };
        if (game.guest) { Boot.guest = true; BC.Monsters.puppet = true; }
        BC.HUD.init(BC.Game.atlas);
        var stats = S.makeStats();
        if (game.hp !== undefined) { stats.hp = game.hp; stats.food = game.food; }
        BC.Player.init(BC.Game, spawn, { mode: game.mode || 'creative', hero: game.hero || 'bulbasaur', stats: stats, inv: game.inv || S.makeInv(), guest: !!game.guest });
        BC.Game.preload(BC.Player.body.pos.x, BC.Player.body.pos.z, 2);
        BC.HUD.setStats(stats, false);
        setInterval(function () { save(); }, 10000);
        window.addEventListener('beforeunload', save);
        document.addEventListener('visibilitychange', function () { if (document.hidden) { save(); if (!BC.Player.paused) BC.Player.openMenu(); } });
        setLoading(null);
        BC.Player.setPaused(false);
        BC.Player.lockPointer();
        Boot.updateStatus();
        BC.Net.setReady();
      }, 30);
      return;
    }
    hideOverlay();
    BC.Player.setPaused(false);
    BC.Player.lockPointer();
  }

  Boot.updateStatus = function () {
    var st = $('status');
    if (!started) { st.textContent = ''; return; }
    var h = BC.Player.hero;
    st.textContent = (BC.Player.mode === 'survival' ? '⚔️ Przetrwanie' : '🎨 Kreatywny') + ' · ' + h.emoji + ' ' + h.name + ' · Dzień ' + S.dayNumber(BC.Game.time);
    $('btnCraft').style.display = BC.Player.mode === 'survival' ? '' : 'none';
    $('btnHero').style.display = '';
  };
  Boot.showMenu = function () {
    showPanel('menuMain');
    $('btnPlay').textContent = 'Graj dalej';
    BC.Player.setPaused(true);
    Boot.updateStatus();
    save();
  };
  Boot.showDeath = function () {
    showPanel('panelDeath');
  };
  Boot.syncAudioUi = function () {
    $('chkMusic').checked = BC.Audio.musicOn;
    $('chkSfx').checked = BC.Audio.sfxOn;
  };

  // ---------- karty bohaterów ----------
  function heroCards(container, onPick) {
    container.innerHTML = '';
    BC.Heroes.order.forEach(function (id) {
      var h = BC.Heroes.all[id];
      var card = document.createElement('div');
      card.className = 'card hero' + (pick.hero === id ? ' sel' : '');
      card.style.setProperty('--c', h.color);
      var c = document.createElement('canvas'); c.width = 64; c.height = 64;
      BC.Heroes.drawPortrait(c, id);
      card.appendChild(c);
      var t = document.createElement('div'); t.className = 'ttl'; t.textContent = h.emoji + ' ' + h.name; card.appendChild(t);
      var d = document.createElement('div'); d.className = 'dsc'; d.textContent = h.q.icon + ' ' + h.q.name + ' · ' + h.e.icon + ' ' + h.e.name + ' · ' + h.passive.icon + ' ' + h.passive.name; card.appendChild(d);
      card.addEventListener('click', function () {
        pick.hero = id;
        container.querySelectorAll('.card').forEach(function (k) { k.classList.remove('sel'); });
        card.classList.add('sel');
        if (onPick) onPick(id);
      });
      container.appendChild(card);
    });
  }
  function modeCards() {
    document.querySelectorAll('#modes .card').forEach(function (card) {
      card.classList.toggle('sel', card.dataset.mode === pick.mode);
      card.onclick = function () {
        pick.mode = card.dataset.mode;
        document.querySelectorAll('#modes .card').forEach(function (k) { k.classList.toggle('sel', k === card); });
      };
    });
  }
  function craftList() {
    var box = $('recipes'); box.innerHTML = '';
    var inv = BC.Player.inv, Info = BC.BlockInfo;
    S.RECIPES.forEach(function (r, i) {
      var row = document.createElement('div'); row.className = 'recipe';
      var have = inv[r.from] || 0;
      row.innerHTML = '<img src="' + BC.Game.atlas.icon(Info[r.from].tex.side) + '"> ' + r.n + ' × ' + Info[r.from].name +
        ' <span class="arr">→</span> <img src="' + BC.Game.atlas.icon(Info[r.to].tex.side) + '"> ' + r.m + ' × ' + Info[r.to].name +
        ' <small>masz ' + have + ' × ' + Info[r.from].name + ', ' + (inv[r.to] || 0) + ' × ' + Info[r.to].name + '</small>';
      var b = document.createElement('button'); b.textContent = 'Zrób'; b.disabled = have < r.n;
      b.addEventListener('click', function () { if (BC.Player.craft(i)) craftList(); });
      row.appendChild(b);
      box.appendChild(row);
    });
  }

  // ---------- przyciski ----------
  $('btnPlay').addEventListener('click', function () {
    if (started) { start(); return; }
    var w = loadWorld();
    if (w) { start(w, loadGame() || {}); return; }
    showPanel('panelNew'); modeCards(); heroCards($('heroesNew'));
  });
  $('btnNew').addEventListener('click', function () {
    if (started && !confirm('Na pewno zacząć nowy świat? Obecny zniknie.')) return;
    showPanel('panelNew'); modeCards(); heroCards($('heroesNew'));
  });
  $('btnStart').addEventListener('click', function () {
    try { localStorage.removeItem(SAVE_KEY); localStorage.removeItem('bc.player'); localStorage.removeItem(GAME_KEY); } catch (e) {}
    try { localStorage.setItem(GAME_KEY, JSON.stringify({ mode: pick.mode, hero: pick.hero })); } catch (e) {}
    if (started) { location.reload(); return; }
    start(new BC.World({ seed: Math.floor(Math.random() * 1e9) }), { mode: pick.mode, hero: pick.hero });
  });
  $('btnBackNew').addEventListener('click', function () { showPanel('menuMain'); });
  $('btnHero').addEventListener('click', function () {
    pick.hero = BC.Player.hero.id;
    showPanel('panelHero'); heroCards($('heroesPick'), function (id) { BC.Player.setHero(id); Boot.updateStatus(); });
  });
  $('btnBackHero').addEventListener('click', function () { showPanel('menuMain'); });
  $('btnCraft').addEventListener('click', function () { showPanel('panelCraft'); craftList(); });
  $('btnBackCraft').addEventListener('click', function () { showPanel('menuMain'); });
  $('btnRespawn').addEventListener('click', function () { hideOverlay(); BC.Player.respawn(); BC.Player.lockPointer(); });
  $('chkMusic').addEventListener('change', function (e) { BC.Audio.setMusic(e.target.checked); });
  $('chkSfx').addEventListener('change', function (e) { BC.Audio.setSfx(e.target.checked); });
  try {
    var prefs = JSON.parse(localStorage.getItem('bc.prefs') || '{}');
    if (prefs.music === false) BC.Audio.musicOn = false;
    if (prefs.sfx === false) BC.Audio.sfxOn = false;
  } catch (e) {}
  Boot.syncAudioUi();
  setInterval(function () { try { localStorage.setItem('bc.prefs', JSON.stringify({ music: BC.Audio.musicOn, sfx: BC.Audio.sfxOn })); } catch (e) {} }, 3000);

  // ---------- gra we dwoje ----------
  var Net = BC.Net, NP = BC.NetProto;
  function badge(state) {
    var b = $('netBadge');
    b.style.display = 'block';
    b.textContent = state === 'two' ? '👫 Pokój ' + Net.code + ' · gracie we dwoje'
      : state === 'guest' ? '👫 Grasz u kolegi · pokój ' + Net.code
      : '👫 Pokój ' + Net.code + ' · czekam na kolegę';
  }
  Net.onStatus = badge;
  function netPanel() {
    var g = loadGame();
    if (g && g.hero && !started) pick.hero = g.hero;
    if (started) pick.hero = BC.Player.hero.id;
    $('netErr').textContent = '';
    $('btnEnter').style.display = 'none';
    $('joinBox').style.display = Net.role === 'host' ? 'none' : 'flex';
    $('rowHost').style.display = Net.role === 'host' ? 'none' : 'flex';
    $('netCode').innerHTML = Net.role === 'host' ? 'Kod pokoju:<b>' + Net.code + '</b>Podaj go koledze.' : '';
    showPanel('panelNet');
    heroCards($('heroesNet'));
  }
  $('btnNet').addEventListener('click', netPanel);
  $('btnBackNet').addEventListener('click', function () { showPanel('menuMain'); });
  $('btnHost').addEventListener('click', function () {
    $('netErr').textContent = '';
    $('netCode').textContent = 'Tworzę pokój…';
    $('btnHost').disabled = true;
    Net.host(function (code) {
      $('btnHost').disabled = false;
      $('rowHost').style.display = 'none'; $('joinBox').style.display = 'none';
      $('netCode').innerHTML = 'Kod pokoju:<b>' + code + '</b>Podaj go koledze. Możesz już grać — dołączy w każdej chwili.';
      $('btnEnter').style.display = '';
      $('btnEnter').onclick = function () {
        if (started) { start(); return; }
        var w = loadWorld();
        if (w) { start(w, loadGame() || {}); return; }
        start(new BC.World({ seed: Math.floor(Math.random() * 1e9) }), { mode: pick.mode, hero: pick.hero });
      };
    }, function (err) { $('btnHost').disabled = false; $('netCode').textContent = ''; $('netErr').textContent = err; });
  });
  $('btnJoin').addEventListener('click', function () {
    var code = NP.normCode($('inCode').value);
    if (!code) { $('netErr').textContent = 'Kod ma 4 znaki, np. KAT7.'; return; }
    save();
    try { sessionStorage.setItem('bc.join', JSON.stringify({ code: code, hero: pick.hero })); } catch (e) {}
    location.reload();
  });
  $('inCode').addEventListener('keydown', function (e) { e.stopPropagation(); if (e.key === 'Enter') $('btnJoin').click(); });
  // Po przeładowaniu z „Dołącz”: łączymy się i czekamy na stuknięcie (odblokowuje dźwięk i pełny ekran).
  function joinFlow(j) {
    pick.hero = j.hero || pick.hero;
    netPanel();
    $('rowHost').style.display = 'none'; $('joinBox').style.display = 'none';
    $('netCode').textContent = 'Łączę z pokojem ' + j.code + '…';
    Net.join(j.code, pick.hero, function (m) {
      $('netCode').innerHTML = 'Połączono z pokojem<b>' + j.code + '</b>';
      $('btnEnter').style.display = '';
      $('btnBackNet').style.display = 'none';
      $('btnEnter').onclick = function () {
        $('btnEnter').onclick = null;
        start(BC.World.deserialize(m.world), { mode: m.mode, time: m.time, hero: pick.hero, spawn: m.spawn, guest: true });
        badge('guest');
        $('btnHero').style.display = '';
      };
    }, function (err) {
      $('netCode').textContent = '';
      $('netErr').textContent = err;
      $('rowHost').style.display = 'flex'; $('joinBox').style.display = 'flex';
      $('inCode').value = j.code;
    });
  }

  // Stan początkowy menu
  var hasSave = !!localStorage.getItem(SAVE_KEY);
  $('btnPlay').textContent = hasSave ? 'Graj dalej' : 'Graj';
  $('btnNew').style.display = hasSave ? '' : 'none';
  $('btnHero').style.display = 'none';
  $('btnCraft').style.display = 'none';
  if (BC.isTouch) document.body.classList.add('touch');
  showPanel('menuMain');
  var joinReq = null;
  try { joinReq = JSON.parse(sessionStorage.getItem('bc.join') || 'null'); sessionStorage.removeItem('bc.join'); } catch (e) {}
  if (joinReq) joinFlow(joinReq);
  if ('serviceWorker' in navigator && location.protocol !== 'file:') { try { navigator.serviceWorker.register('sw.js').catch(function () {}); } catch (e) {} }
  BC.Boot = Boot;
})(window.BC);
