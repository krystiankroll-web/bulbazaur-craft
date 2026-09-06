// Start gry: ekran startowy, ładowanie / zapis świata, autozapis, audio.
(function (BC) {
  var Boot = {};
  var overlay = document.getElementById('overlay');
  var started = false;
  var SAVE_KEY = 'bc.world2';

  if (typeof THREE === 'undefined') {
    overlay.style.display = 'none';
    document.getElementById('err').style.display = 'flex';
    return;
  }

  function loadWorld() {
    try {
      var s = localStorage.getItem(SAVE_KEY);
      if (s) return BC.World.deserialize(s);
    } catch (e) { console.warn('Nie udało się wczytać zapisu', e); }
    return new BC.World({ seed: Math.floor(Math.random() * 1e9) });
  }
  function save() {
    if (!BC.Game.world) return;
    try {
      localStorage.setItem(SAVE_KEY, BC.Game.world.serialize());
      BC.Player.savePos();
    } catch (e) { console.warn('Zapis nieudany', e); }
  }
  Boot.save = save;

  function setLoading(text) {
    var el = document.getElementById('loading');
    el.style.display = text ? 'flex' : 'none';
    el.textContent = text || '';
  }

  function start(world) {
    BC.Audio.init();
    if (!started) {
      started = true;
      setLoading('Bulbazaur szuka dobrego miejsca…');
      overlay.style.display = 'none';
      // daj przeglądarce narysować ekran ładowania
      setTimeout(function () {
        var sp = world.findSpawn(0, 0);
        BC.Game.init(world);
        BC.Game.preload(sp.x, sp.z, 2);
        var spawn = { x: sp.x, y: world.surfaceY(Math.floor(sp.x), Math.floor(sp.z)) + 1.01, z: sp.z };
        BC.HUD.init(BC.Game.atlas);
        BC.Player.init(BC.Game, spawn);
        BC.Game.preload(BC.Player.body.pos.x, BC.Player.body.pos.z, 2);
        setInterval(function () { save(); }, 10000);
        window.addEventListener('beforeunload', save);
        setLoading(null);
        BC.Player.setPaused(false);
        BC.Player.lockPointer();
      }, 30);
      return;
    }
    overlay.style.display = 'none';
    BC.Player.setPaused(false);
    BC.Player.lockPointer();
  }

  Boot.showMenu = function () {
    overlay.style.display = 'flex';
    document.getElementById('btnPlay').textContent = 'Graj dalej';
    BC.Player.setPaused(true);
  };
  Boot.syncAudioUi = function () {
    document.getElementById('chkMusic').checked = BC.Audio.musicOn;
    document.getElementById('chkSfx').checked = BC.Audio.sfxOn;
  };

  document.getElementById('btnPlay').addEventListener('click', function () {
    if (started) { start(); return; }
    start(loadWorld());
  });
  document.getElementById('btnNew').addEventListener('click', function () {
    if (started && !confirm('Na pewno zacząć nowy świat? Obecny zniknie.')) return;
    try { localStorage.removeItem(SAVE_KEY); localStorage.removeItem('bc.player'); } catch (e) {}
    if (started) { location.reload(); return; }
    start(new BC.World({ seed: Math.floor(Math.random() * 1e9) }));
  });
  document.getElementById('chkMusic').addEventListener('change', function (e) { BC.Audio.setMusic(e.target.checked); });
  document.getElementById('chkSfx').addEventListener('change', function (e) { BC.Audio.setSfx(e.target.checked); });
  try {
    var prefs = JSON.parse(localStorage.getItem('bc.prefs') || '{}');
    if (prefs.music === false) BC.Audio.musicOn = false;
    if (prefs.sfx === false) BC.Audio.sfxOn = false;
  } catch (e) {}
  Boot.syncAudioUi();
  setInterval(function () { try { localStorage.setItem('bc.prefs', JSON.stringify({ music: BC.Audio.musicOn, sfx: BC.Audio.sfxOn })); } catch (e) {} }, 3000);
  BC.Boot = Boot;
})(window.BC);
