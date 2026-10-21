// Sterowanie dotykowe: joystick, rozglądanie przeciąganiem, przyciski akcji.
(function (BC) {
  var T = { enabled: false };
  BC.isTouch = (navigator.maxTouchPoints > 0) || ('ontouchstart' in window);

  var joy = { id: null, cx: 0, cy: 0, dx: 0, dy: 0 };
  var look = { id: null, x: 0, y: 0, moved: 0, t0: 0 };
  var R = 56; // promień joysticka w px

  function el(id) { return document.getElementById(id); }

  T.init = function (player) {
    if (!BC.isTouch) return;
    T.enabled = true;
    T.player = player;
    document.body.classList.add('touch');
    var root = el('touch');
    root.style.display = 'block';
    var pad = el('joy'), knob = el('joyKnob');
    var canvas = player.canvas;

    function inPad(x, y) { var r = pad.getBoundingClientRect(); return x >= r.left - 20 && x <= r.right + 20 && y >= r.top - 20 && y <= r.bottom + 20; }
    function setKnob(dx, dy) { knob.style.transform = 'translate(' + dx + 'px,' + dy + 'px)'; }

    function onStart(e) {
      if (!player.active()) return;
      for (var i = 0; i < e.changedTouches.length; i++) {
        var t = e.changedTouches[i];
        if (joy.id === null && inPad(t.clientX, t.clientY)) {
          var r = pad.getBoundingClientRect();
          joy.id = t.identifier; joy.cx = r.left + r.width / 2; joy.cy = r.top + r.height / 2; joy.dx = 0; joy.dy = 0;
        } else if (look.id === null) {
          look.id = t.identifier; look.x = t.clientX; look.y = t.clientY; look.moved = 0; look.t0 = performance.now();
        }
      }
      e.preventDefault();
    }
    function onMove(e) {
      for (var i = 0; i < e.changedTouches.length; i++) {
        var t = e.changedTouches[i];
        if (t.identifier === joy.id) {
          var dx = t.clientX - joy.cx, dy = t.clientY - joy.cy, l = Math.hypot(dx, dy);
          if (l > R) { dx = dx / l * R; dy = dy / l * R; }
          joy.dx = dx / R; joy.dy = dy / R; setKnob(dx, dy);
        } else if (t.identifier === look.id) {
          var mx = t.clientX - look.x, my = t.clientY - look.y;
          look.x = t.clientX; look.y = t.clientY; look.moved += Math.abs(mx) + Math.abs(my);
          player.addLook(-mx * 0.005, -my * 0.005);
        }
      }
      e.preventDefault();
    }
    function onEnd(e) {
      for (var i = 0; i < e.changedTouches.length; i++) {
        var t = e.changedTouches[i];
        if (t.identifier === joy.id) { joy.id = null; joy.dx = 0; joy.dy = 0; setKnob(0, 0); }
        else if (t.identifier === look.id) {
          look.id = null;
          if (look.moved < 12 && performance.now() - look.t0 < 350) player.tapAction();
        }
      }
      e.preventDefault();
    }
    var area = el('touchArea');
    area.addEventListener('touchstart', onStart, { passive: false });
    area.addEventListener('touchmove', onMove, { passive: false });
    area.addEventListener('touchend', onEnd, { passive: false });
    area.addEventListener('touchcancel', onEnd, { passive: false });
    canvas.addEventListener('touchstart', function (e) { onStart(e); }, { passive: false });
    canvas.addEventListener('touchmove', function (e) { onMove(e); }, { passive: false });
    canvas.addEventListener('touchend', function (e) { onEnd(e); }, { passive: false });

    // przyciski
    function bind(id, down, up) {
      var b = el(id); if (!b) return;
      b.addEventListener('touchstart', function (e) { e.preventDefault(); e.stopPropagation(); b.classList.add('down'); if (player.active() || id === 'tbMenu') down(); }, { passive: false });
      b.addEventListener('touchend', function (e) { e.preventDefault(); e.stopPropagation(); b.classList.remove('down'); if (up) up(); }, { passive: false });
      b.addEventListener('touchcancel', function (e) { b.classList.remove('down'); if (up) up(); }, { passive: false });
    }
    bind('tbJump', function () { player.virtual.jump = true; player.pressJump(); }, function () { player.virtual.jump = false; });
    bind('tbDown', function () { player.virtual.down = true; }, function () { player.virtual.down = false; });
    bind('tbBreak', function () { player.primaryAction(); });
    bind('tbPlace', function () { player.placeBlock(); });
    bind('tbQ', function () { player.useQ(); });
    bind('tbE', function () { player.useE(); });
    bind('tbSuper', function () { player.useSuper(); });
    bind('tbFly', function () { player.toggleFly(); });
    bind('tbEat', function () { player.eat(); });
    bind('tbView', function () { player.toggleView(); });
    bind('tbMenu', function () { player.openMenu(); });
    bind('tbPage', function () { BC.HUD.setPage(BC.HUD.page + 1); });
    T.refresh();
  };

  // Pokazuje przyciski właściwe dla bohatera i trybu.
  T.refresh = function () {
    if (!T.enabled) return;
    var p = T.player, h = p.hero;
    function show(id, on, label) { var b = el(id); if (!b) return; b.style.display = on ? '' : 'none'; if (label !== undefined) b.innerHTML = label; }
    show('tbQ', true, '<b>' + h.q.icon + '</b><span>' + h.q.name + '</span>');
    show('tbE', true, '<b>' + h.e.icon + '</b><span>' + h.e.name + '</span>');
    show('tbSuper', !!h.passive.button, '<b>' + h.passive.icon + '</b><span>' + h.passive.name + '</span>');
    show('tbFly', p.mode === 'creative');
    show('tbDown', p.mode === 'creative' && p.body.flying);
    show('tbEat', p.mode === 'survival');
  };
  T.update = function () {
    if (!T.enabled) return;
    var v = T.player.virtual;
    v.mx = joy.dx; v.mz = -joy.dy;
    v.sprint = Math.hypot(joy.dx, joy.dy) > 0.92;
  };
  BC.Touch = T;
})(window.BC);
