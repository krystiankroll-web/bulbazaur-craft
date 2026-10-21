// HUD: pasek bloków (z licznikami w przetrwaniu), portret, serca, jedzenie, powietrze, dzień, komunikaty.
(function (BC) {
  var HUD = {};
  var msgTimer = null;
  var PAGES = 3;
  var B = BC.Blocks;

  HUD.init = function (atlas) {
    HUD.atlas = atlas;
    HUD.page = 0; HUD.slot = 0; HUD.inv = null; HUD.mode = 'creative';
    HUD.icons = {};
    HUD.setPage(0);
  };
  function icon(id) {
    if (!HUD.icons[id]) HUD.icons[id] = HUD.atlas.icon(BC.BlockInfo[id].tex.side);
    return HUD.icons[id];
  }
  HUD.setPage = function (p) {
    HUD.page = ((p % PAGES) + PAGES) % PAGES;
    var bar = document.getElementById('hotbar');
    bar.innerHTML = '';
    BC.Hotbar[HUD.page].forEach(function (id, i) {
      var d = document.createElement('div');
      d.className = 'slot' + (i === HUD.slot ? ' active' : '');
      var img = document.createElement('img');
      img.src = icon(id);
      img.title = BC.BlockInfo[id].name;
      var n = document.createElement('span'); n.textContent = i + 1;
      var cnt = document.createElement('em');
      d.appendChild(img); d.appendChild(n); d.appendChild(cnt);
      d.addEventListener('mousedown', function (e) { e.stopPropagation(); HUD.setSlot(i); });
      d.addEventListener('touchstart', function (e) { e.stopPropagation(); e.preventDefault(); HUD.setSlot(i); }, { passive: false });
      bar.appendChild(d);
    });
    document.getElementById('page').textContent = 'Strona ' + (HUD.page + 1) + '/' + PAGES + (BC.isTouch ? '' : '  (Tab)');
    HUD.setSlot(HUD.slot, true);
    HUD.refreshCounts();
  };
  HUD.setSlot = function (i, silent) {
    HUD.slot = i;
    var slots = document.querySelectorAll('#hotbar .slot');
    slots.forEach(function (s, k) { s.classList.toggle('active', k === i); });
    var id = HUD.selected();
    var txt = BC.BlockInfo[id].name;
    if (HUD.mode === 'survival' && HUD.inv) txt += ' × ' + (HUD.inv[id] || 0);
    HUD.message(txt, 900);
    if (!silent && BC.Audio) BC.Audio.sfx('click');
  };
  HUD.selected = function () { return BC.Hotbar[HUD.page][HUD.slot]; };
  HUD.setInv = function (inv, mode) {
    HUD.inv = inv; HUD.mode = mode;
    document.body.classList.toggle('survival', mode === 'survival');
    HUD.refreshCounts();
  };
  HUD.refreshCounts = function () {
    var slots = document.querySelectorAll('#hotbar .slot');
    var surv = HUD.mode === 'survival' && HUD.inv;
    BC.Hotbar[HUD.page].forEach(function (id, i) {
      var s = slots[i]; if (!s) return;
      var n = surv ? (HUD.inv[id] || 0) : null;
      s.querySelector('em').textContent = surv ? n : '';
      s.classList.toggle('empty', surv && n === 0);
    });
    var apples = document.getElementById('apples');
    if (apples) apples.textContent = surv ? '🍎 ' + (HUD.inv[B.APPLE] || 0) : '';
  };
  HUD.setHero = function (hero) {
    var c = document.getElementById('portrait');
    if (c) BC.Heroes.drawPortrait(c, hero.id);
    var el = document.getElementById('powers');
    if (el) el.innerHTML = '<b>Q</b> ' + hero.q.icon + ' ' + hero.q.name + ' &nbsp; <b>E</b> ' + hero.e.icon + ' ' + hero.e.name +
      (hero.passive.button ? ' &nbsp; <b>Shift+Spacja</b> ' + hero.passive.icon + ' ' + hero.passive.name : ' &nbsp; ' + hero.passive.icon + ' ' + hero.passive.name);
  };
  HUD.setStats = function (st, underwater) {
    var hearts = document.getElementById('hearts'), food = document.getElementById('food'), air = document.getElementById('air');
    if (!hearts) return;
    hearts.innerHTML = bar(st.hp, 20, '❤️', '🤍');
    food.innerHTML = bar(st.food, 20, '🍗', '▫️');
    air.innerHTML = underwater ? bar(Math.ceil(st.air), 10, '🫧', '·', 1) : '';
    hearts.classList.toggle('low', st.hp <= 6);
  };
  function bar(val, max, full, empty, perIcon) {
    perIcon = perIcon || 2;
    var n = max / perIcon, out = '';
    for (var i = 0; i < n; i++) {
      var v = val - i * perIcon;
      out += '<i class="' + (v >= perIcon ? 'f' : (v > 0 ? 'h' : 'e')) + '">' + (v > 0 ? full : empty) + '</i>';
    }
    return out;
  }
  HUD.setDay = function (n, light) {
    var el = document.getElementById('day'); if (!el) return;
    var txt = (light < 0.2 ? '🌙 ' : (light < 0.5 ? '🌅 ' : '☀️ ')) + 'Dzień ' + n;
    if (el.textContent !== txt) el.textContent = txt;
  };
  HUD.message = function (text, ms) {
    var el = document.getElementById('msg');
    el.textContent = text; el.style.opacity = 1;
    clearTimeout(msgTimer);
    msgTimer = setTimeout(function () { el.style.opacity = 0; }, ms || 1500);
  };
  HUD.setCoords = function (x, y, z, biome) {
    var names = ['Łąka', 'Las', 'Pustynia', 'Śnieg'];
    document.getElementById('coords').textContent = 'X ' + Math.floor(x) + '  Y ' + Math.floor(y) + '  Z ' + Math.floor(z) + '   ' + names[biome];
  };
  HUD.setWater = function (on) { document.getElementById('water').style.display = on ? 'block' : 'none'; };
  BC.HUD = HUD;
})(window.BC);
