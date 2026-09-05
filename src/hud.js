// HUD: pasek bloków, portret, komunikaty.
(function (BC) {
  var HUD = {};
  var msgTimer = null;

  HUD.init = function (atlas) {
    HUD.atlas = atlas;
    HUD.page = 0; HUD.slot = 0;
    HUD.drawPortrait();
    HUD.setPage(0);
  };
  HUD.setPage = function (p) {
    HUD.page = p;
    var bar = document.getElementById('hotbar');
    bar.innerHTML = '';
    BC.Hotbar[p].forEach(function (id, i) {
      var d = document.createElement('div');
      d.className = 'slot' + (i === HUD.slot ? ' active' : '');
      var img = document.createElement('img');
      img.src = HUD.atlas.icon(BC.BlockInfo[id].tex.side);
      img.title = BC.BlockInfo[id].name;
      var n = document.createElement('span'); n.textContent = i + 1;
      d.appendChild(img); d.appendChild(n);
      bar.appendChild(d);
    });
    document.getElementById('page').textContent = 'Strona ' + (p + 1) + '/2  (Tab)';
    HUD.setSlot(HUD.slot);
  };
  HUD.setSlot = function (i) {
    HUD.slot = i;
    var slots = document.querySelectorAll('#hotbar .slot');
    slots.forEach(function (s, k) { s.classList.toggle('active', k === i); });
    HUD.message(BC.BlockInfo[HUD.selected()].name, 900);
  };
  HUD.selected = function () { return BC.Hotbar[HUD.page][HUD.slot]; };
  HUD.message = function (text, ms) {
    var el = document.getElementById('msg');
    el.textContent = text; el.style.opacity = 1;
    clearTimeout(msgTimer);
    msgTimer = setTimeout(function () { el.style.opacity = 0; }, ms || 1500);
  };
  // Pikselowy portret Bulbazaura 16x16 skalowany do 64x64
  HUD.drawPortrait = function () {
    var c = document.getElementById('portrait'); if (!c) return;
    var ctx = c.getContext('2d');
    var P = { '.': null, g: '#7fc8a9', d: '#3f8f6e', b: '#4fae3c', B: '#2f7a2a', r: '#d63b3b', w: '#ffffff', k: '#222222', p: '#ffb0c0' };
    var rows = [
      '.....BBBBB......',
      '....BbbbbbB.....',
      '...BbbbbbbbB....',
      '...BbbBbbBbbB...',
      '..ggBbbbbbbBgg..',
      '.gggggBBBBBgggg.',
      '.ggggggggggggggg',
      'gggwrkggggwrkggg',
      'gggwrkggggwrkggg',
      'ggggggggdgggggg.',
      'gggggddggggdgggg',
      'ggggdggggggggggg',
      '.gggggkkkkkggggg',
      '.ggggggggggggggg',
      '..ggg.....ggg...',
      '..ggg.....ggg...'
    ];
    ctx.clearRect(0, 0, 64, 64);
    for (var y = 0; y < 16; y++) for (var x = 0; x < 16; x++) {
      var ch = rows[y][x]; if (!P[ch]) continue;
      ctx.fillStyle = P[ch]; ctx.fillRect(x * 4, y * 4, 4, 4);
    }
  };
  BC.HUD = HUD;
})(window.BC);
