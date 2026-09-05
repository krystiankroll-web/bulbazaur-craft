// Start gry: ekran startowy, wczytanie / zapis świata, autozapis.
(function (BC) {
  var Boot = {};
  var overlay = document.getElementById('overlay');
  var started = false;
  var SAVE_KEY = 'bc.world';

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
    return new BC.World({ seed: 1337 }).generate();
  }
  function save() {
    if (!BC.Game.world) return;
    try {
      localStorage.setItem(SAVE_KEY, BC.Game.world.serialize());
      BC.Player.savePos();
    } catch (e) { console.warn('Zapis nieudany', e); }
  }
  Boot.save = save;

  function start(world) {
    overlay.style.display = 'none';
    if (!started) {
      started = true;
      BC.Game.init(world);
      BC.HUD.init(BC.Game.atlas);
      BC.Player.init(BC.Game);
      setInterval(function () { save(); BC.HUD.message('Zapisano', 600); }, 10000);
      window.addEventListener('beforeunload', save);
    }
    BC.Player.setPaused(false);
    BC.Player.lockPointer();
  }

  Boot.showMenu = function () {
    overlay.style.display = 'flex';
    document.getElementById('btnPlay').textContent = 'Graj dalej';
    BC.Player.setPaused(true);
  };

  document.getElementById('btnPlay').addEventListener('click', function () {
    if (started) { start(); return; }
    start(loadWorld());
  });
  document.getElementById('btnNew').addEventListener('click', function () {
    if (started && !confirm('Na pewno zacząć nowy świat? Obecny zniknie.')) return;
    try { localStorage.removeItem(SAVE_KEY); localStorage.removeItem('bc.player'); } catch (e) {}
    if (started) { location.reload(); return; }
    var seed = Math.floor(Math.random() * 1e9);
    start(new BC.World({ seed: seed }).generate());
  });
  BC.Boot = Boot;
})(window.BC);
