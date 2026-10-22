// Drugi gracz: model jego Pokémona z podpisem nad głową, płynny ruch do pozycji z sieci.
(function (BC) {
  var P = BC.NetProto;
  var R = { model: null, hero: null, pos: null, target: null, yaw: 0, body: { pos: { x: 0, y: -100, z: 0 } } };

  function label(text) {
    var cv = document.createElement('canvas'); cv.width = 256; cv.height = 64;
    var ctx = cv.getContext('2d');
    ctx.fillStyle = 'rgba(0,0,0,0.5)'; ctx.fillRect(8, 10, 240, 44);
    ctx.font = 'bold 30px sans-serif'; ctx.fillStyle = '#fff'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(text, 128, 33);
    var t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace;
    var s = new THREE.Sprite(new THREE.SpriteMaterial({ map: t, depthTest: false, transparent: true }));
    s.scale.set(1.6, 0.4, 1);
    return s;
  }

  R.create = function (heroId) {
    R.remove();
    var h = BC.Heroes.get(heroId);
    R.hero = heroId;
    R.model = h.model();
    var tag = label(h.emoji + ' ' + h.name);
    tag.position.set(0, 2.0, 0);
    R.model.group.add(tag);
    BC.Game.scene.add(R.model.group);
  };
  // Nowa pozycja z wiadomości `pos`.
  R.setTarget = function (m) {
    if (!R.model || m.hero !== R.hero) R.create(m.hero);
    R.target = m;
    if (!R.pos) { R.pos = { x: m.x, y: m.y, z: m.z }; R.yaw = m.yaw; }
  };
  R.update = function (dt, t) {
    if (!R.model || !R.target) return;
    var px = R.pos.x, pz = R.pos.z, tg = R.target;
    R.pos.x = P.approach(R.pos.x, tg.x, dt, 12);
    R.pos.y = P.approach(R.pos.y, tg.y, dt, 12);
    R.pos.z = P.approach(R.pos.z, tg.z, dt, 12);
    R.yaw = P.approachAngle(R.yaw, tg.yaw, dt, 12);
    R.body.pos.x = R.pos.x; R.body.pos.y = R.pos.y; R.body.pos.z = R.pos.z;
    var g = R.model.group;
    g.position.set(R.pos.x, R.pos.y, R.pos.z);
    g.rotation.y = R.yaw;
    R.model.setWalk(t, tg.fly ? 0 : Math.hypot(R.pos.x - px, R.pos.z - pz) / Math.max(dt, 0.001));
  };
  R.remove = function () {
    if (R.model) BC.Game.scene.remove(R.model.group);
    R.model = null; R.hero = null; R.target = null; R.pos = null;
    R.body.pos.y = -100;
  };
  BC.Remote = R;
})(window.BC);
