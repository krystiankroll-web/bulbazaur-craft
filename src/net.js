// Gra we dwoje: połączenie WebRTC przez PeerJS (kod pokoju), wymiana pozycji, bloków i stanu stworzeń.
// Gospodarz symuluje stworzenia i czas; bloki zmienia każdy u siebie i wysyła koledze.
(function (BC) {
  var P = BC.NetProto;
  var N = { role: null, code: null, peer: null, conn: null, ready: false,
    onGive: null, onHurt: null, onKilled: null, onStatus: null };
  var MSG = {
    noRoom: 'Nie ma pokoju o takim kodzie. Sprawdź kod u kolegi.',
    noNet: 'Nie udało się połączyć — połączcie oba telefony z tym samym Wi‑Fi i spróbujcie jeszcze raz.',
    broker: 'Brak internetu albo pośrednik nie odpowiada. Spróbuj za chwilę.',
    full: 'Ten pokój jest już pełny — grają w nim dwie osoby.'
  };
  N.MSG = MSG;
  var queue = [], pending = [], applying = false, tPos = 0, tBlocks = 0, tSnap = 0, tTime = 0;
  var BROKER_ERRORS = ['network', 'server-error', 'socket-error', 'socket-closed', 'browser-incompatible', 'ssl-unavailable'];

  N.active = function () { return !!(N.conn && N.conn.open); };
  N.send = function (m) { if (N.active()) N.conn.send(m); };
  function status(s) { if (N.onStatus) N.onStatus(s); }
  function r2(v) { return Math.round(v * 100) / 100; }

  // Gra wystartowała — od teraz obsługujemy wiadomości (wcześniejsze czekały w kolejce).
  N.setReady = function () {
    N.ready = true;
    var list = pending; pending = [];
    list.forEach(onData);
  };

  // ---------- gospodarz ----------
  N.host = function (onCode, onError) {
    if (N.role === 'host' && N.code) { onCode(N.code); return; }
    if (typeof Peer === 'undefined') { onError(MSG.broker); return; }
    N.role = 'host';
    var tries = 0, opened = false;
    function open() {
      N.code = P.makeCode(Math.random);
      var peer = N.peer = new Peer(P.peerId(N.code));
      peer.on('open', function () { opened = true; onCode(N.code); status('wait'); });
      peer.on('error', function (e) {
        if (e.type === 'unavailable-id' && tries++ < 5) { peer.destroy(); open(); return; }
        if (!opened) { N.role = null; N.code = null; onError(MSG.broker); }
      });
      // utrata pośrednika nie przerywa gry, ale pokój musi dalej przyjmować kolegę
      peer.on('disconnected', function () { setTimeout(function () { try { if (!peer.destroyed) peer.reconnect(); } catch (e) {} }, 2000); });
      peer.on('connection', function (c) {
        if (N.active()) {
          c.on('open', function () { c.send({ t: 'full' }); setTimeout(function () { c.close(); }, 800); });
          return;
        }
        N.conn = c;
        c.on('data', receive);
        c.on('close', function () {
          if (N.conn !== c) return;
          N.conn = null;
          BC.Remote.remove();
          BC.HUD.message('Kolega wyszedł', 2000);
          status('wait');
        });
      });
    }
    open();
  };

  // ---------- gość ----------
  N.join = function (code, hero, onWelcome, onError) {
    if (typeof Peer === 'undefined') { onError(MSG.broker); return; }
    N.role = 'guest'; N.code = code;
    var welcomed = false, failed = false;
    function fail(msg) {
      if (welcomed || failed) return;
      failed = true; clearTimeout(timer);
      try { N.peer.destroy(); } catch (e) {}
      N.conn = null;
      onError(msg);
    }
    var timer = setTimeout(function () { fail(MSG.noNet); }, 20000);
    var peer = N.peer = new Peer();
    peer.on('error', function (e) { fail(e.type === 'peer-unavailable' ? MSG.noRoom : (BROKER_ERRORS.indexOf(e.type) >= 0 ? MSG.broker : MSG.noNet)); });
    peer.on('open', function () {
      var c = N.conn = peer.connect(P.peerId(code), { reliable: true });
      c.on('open', function () { c.send({ t: 'hello', hero: hero }); });
      c.on('data', function (m) {
        if (m.t === 'full') { fail(MSG.full); return; }
        if (m.t === 'welcome') { if (!welcomed && !failed) { welcomed = true; clearTimeout(timer); onWelcome(m); } return; }
        if (welcomed) receive(m);
      });
      c.on('close', function () {
        if (!welcomed) { fail(MSG.noNet); return; }
        N.conn = null;
        BC.HUD.message('Połączenie z kolegą przerwane', 2500);
        setTimeout(function () { location.reload(); }, 2500);
      });
    });
  };

  // ---------- wiadomości ----------
  function receive(m) { if (!N.ready) { pending.push(m); return; } onData(m); }
  function onData(m) {
    var G = BC.Game, M = BC.Monsters;
    switch (m.t) {
      case 'hello': {
        BC.Remote.create(m.hero);
        var p = BC.Player.body.pos;
        N.send({ t: 'welcome', world: G.world.serialize(), mode: G.mode, time: G.time, spawn: { x: p.x + 1.5, y: p.y + 0.5, z: p.z } });
        BC.HUD.message('Kolega dołączył!', 2000); BC.Audio.sfx('home');
        status('two');
        break;
      }
      case 'pos': BC.Remote.setTarget(m); break;
      case 'blocks': N.applyBlocks(m.list); break;
      case 'snap': M.applySnapshot(m); break;
      case 'time': G.time = m.time; break;
      case 'hit': M.remoteHit(m); break;
      case 'pet': M.remotePet(m); break;
      case 'killed': if (N.onKilled) N.onKilled(m.type); break;
      case 'give': if (N.onGive) N.onGive(m.item, m.why, m.name); break;
      case 'hurt': if (N.onHurt) N.onHurt(m.dmg, m.from); break;
      case 'fx': M.remoteFx(m); break;
    }
  }
  N.applyBlocks = function (list) {
    var G = BC.Game, keys = {};
    applying = true;
    list.forEach(function (b) { G.world.set(b[0], b[1], b[2], b[3]).forEach(function (k) { keys[k] = 1; }); });
    applying = false;
    G.rebuildChunks(Object.keys(keys));
    G.torchTimer = 0;
  };
  // Woła to świat przy każdej zmianie bloku (World.onChange).
  N.onLocalBlock = function (x, y, z, id) { if (!applying && N.active()) queue.push([x, y, z, id]); };

  N.update = function (dt) {
    if (!N.active() || !N.ready) return;
    tPos -= dt; tBlocks -= dt; tSnap -= dt; tTime -= dt;
    if (tPos <= 0) {
      tPos = 0.1;
      var b = BC.Player.body;
      N.send({ t: 'pos', x: r2(b.pos.x), y: r2(b.pos.y), z: r2(b.pos.z), yaw: r2(BC.Player.getLook().yaw), hero: BC.Player.hero.id, fly: !!b.flying });
    }
    if (tBlocks <= 0 && queue.length) { tBlocks = 0.1; N.send({ t: 'blocks', list: queue }); queue = []; }
    if (N.role === 'host') {
      if (tSnap <= 0) { tSnap = 0.1; N.send(BC.Monsters.snapshot()); }
      if (tTime <= 0) { tTime = 2; N.send({ t: 'time', time: BC.Game.time }); }
    }
  };
  // Gracze, których widzą stworzenia u gospodarza (nr 0 = ja, nr 1 = kolega).
  N.players = function () {
    var list = [BC.Player];
    if (N.role === 'host' && N.active() && BC.Remote.pos) list.push(BC.Remote);
    return list;
  };

  BC.Net = N;
})(window.BC);
