// Modele stworzeń z klocków (Three.js) i ich animacja. Przód modelu = +z, obrót = c.yaw.
(function (BC) {
  var CM = {};

  // Buduje model z listy klocków. Zwraca { group, legs, arms, mats, parts }.
  function builder() {
    var g = new THREE.Group(), mats = [], parts = {}, legs = [], arms = [];
    function mat(color, opts) {
      opts = opts || {};
      var m = new THREE.MeshLambertMaterial({ color: color, transparent: !!opts.opacity, opacity: opts.opacity || 1 });
      if (!opts.fixed) mats.push(m);
      return m;
    }
    function bx(w, h, d, m, x, y, z, parent) {
      var o = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m);
      o.position.set(x, y, z); (parent || g).add(o); return o;
    }
    // Noga na zawiasie: górna krawędź na wysokości top.
    function leg(w, h, m, x, top, z, list) {
      var p = new THREE.Group(); p.position.set(x, top, z); g.add(p);
      bx(w, h, w, m, 0, -h / 2, 0, p); (list || legs).push(p); return p;
    }
    return { g: g, mat: mat, bx: bx, leg: leg, parts: parts, legs: legs, arms: arms, mats: mats };
  }
  function eyes(b, parent, x, y, z, color, size) {
    var m = b.mat(color || 0x111111, { fixed: true }), s = size || 0.09;
    b.bx(s, s * 1.2, 0.04, m, -x, y, z, parent); b.bx(s, s * 1.2, 0.04, m, x, y, z, parent);
  }

  var makers = {
    cieniak: function (b) {
      var body = b.mat(0x3a2650), dark = b.mat(0x1e1230);
      b.bx(0.5, 0.7, 0.3, body, 0, 0.95, 0);
      var head = b.bx(0.5, 0.5, 0.5, body, 0, 1.55, 0);
      b.bx(0.5, 0.08, 0.5, dark, 0, 0.29, 0, head);
      var red = new THREE.MeshBasicMaterial({ color: 0xff3030 });
      b.bx(0.1, 0.12, 0.05, red, -0.13, 0.05, 0.26, head); b.bx(0.1, 0.12, 0.05, red, 0.13, 0.05, 0.26, head);
      [-0.35, 0.35].forEach(function (x) {
        var p = new THREE.Group(); p.position.set(x, 1.25, 0); b.g.add(p);
        b.bx(0.2, 0.6, 0.2, dark, 0, -0.3, 0, p); p.rotation.x = -Math.PI / 2; b.arms.push(p);
      });
      b.leg(0.22, 0.6, dark, -0.13, 0.6, 0); b.leg(0.22, 0.6, dark, 0.13, 0.6, 0);
    },
    skoczek: function (b) {
      var outer = b.mat(0x6ad04a, { opacity: 0.8 }), inner = b.mat(0x3f9a2a);
      b.parts.blob = new THREE.Group(); b.g.add(b.parts.blob);
      b.bx(0.9, 0.9, 0.9, outer, 0, 0.45, 0, b.parts.blob);
      b.bx(0.45, 0.45, 0.45, inner, 0, 0.4, 0, b.parts.blob);
      eyes(b, b.parts.blob, 0.2, 0.6, 0.46, 0x103010, 0.14);
      b.bx(0.2, 0.06, 0.04, b.mat(0x103010, { fixed: true }), 0, 0.32, 0.46, b.parts.blob);
    },
    kolczak: function (b) {
      var green = b.mat(0x3f9a3c), dark = b.mat(0x2a6a28), spike = b.mat(0xf0e090, { fixed: true });
      var body = b.bx(0.6, 1.0, 0.6, green, 0, 0.75, 0);
      [[0.31, 0.3, 0], [-0.31, 0.1, 0], [0.31, -0.2, 0], [-0.31, -0.3, 0], [0, 0.2, -0.31], [0, -0.1, -0.31], [0.15, 0.45, 0.31], [-0.15, -0.35, 0.31]].forEach(function (s) {
        b.bx(Math.abs(s[0]) > 0 ? 0.18 : 0.06, 0.06, Math.abs(s[2]) > 0 ? 0.18 : 0.06, spike, s[0] * 1.15, s[1], s[2] * 1.15, body);
      });
      b.bx(0.12, 0.12, 0.04, new THREE.MeshBasicMaterial({ color: 0xff3030 }), -0.14, 0.25, 0.31, body);
      b.bx(0.12, 0.12, 0.04, new THREE.MeshBasicMaterial({ color: 0xff3030 }), 0.14, 0.25, 0.31, body);
      b.leg(0.18, 0.25, dark, -0.15, 0.25, 0); b.leg(0.18, 0.25, dark, 0.15, 0.25, 0);
    },
    wybuchacz: function (b) {
      var orange = b.mat(0xe07020), dark = b.mat(0x2a1a10);
      b.bx(0.5, 0.75, 0.35, orange, 0, 0.75, 0);
      var head = b.bx(0.55, 0.55, 0.55, orange, 0, 1.4, 0);
      var face = b.mat(0x1a1008, { fixed: true });
      b.bx(0.12, 0.12, 0.04, face, -0.13, 0.08, 0.28, head); b.bx(0.12, 0.12, 0.04, face, 0.13, 0.08, 0.28, head);
      b.bx(0.12, 0.2, 0.04, face, 0, -0.08, 0.28, head);
      [[-0.14, -0.1], [0.14, -0.1], [-0.14, 0.1], [0.14, 0.1]].forEach(function (p) { b.leg(0.18, 0.38, dark, p[0], 0.38, p[1]); });
    },
    krowa: function (b) {
      var white = b.mat(0xf4f4f0), black = b.mat(0x222222), pink = b.mat(0xf0a0a8), horn = b.mat(0xe8e0c8);
      var body = b.bx(0.9, 0.7, 1.3, white, 0, 0.85, 0);
      b.bx(0.5, 0.4, 0.5, black, 0.21, 0.16, -0.2, body); b.bx(0.4, 0.3, 0.4, black, -0.26, 0.21, 0.3, body);
      var head = b.bx(0.55, 0.5, 0.45, white, 0, 1.05, 0.82);
      b.bx(0.4, 0.22, 0.08, pink, 0, -0.14, 0.25, head);
      b.bx(0.08, 0.14, 0.08, horn, -0.22, 0.3, 0, head); b.bx(0.08, 0.14, 0.08, horn, 0.22, 0.3, 0, head);
      eyes(b, head, 0.16, 0.08, 0.23);
      [[-0.28, -0.45], [0.28, -0.45], [-0.28, 0.45], [0.28, 0.45]].forEach(function (p) { b.leg(0.22, 0.5, white, p[0], 0.5, p[1]); });
    },
    owca: function (b) {
      var wool = b.mat(0xf2f0e8), skin = b.mat(0xd8b8a8), face = b.mat(0x8a8070);
      b.parts.wool = b.bx(0.95, 0.75, 1.2, wool, 0, 0.85, 0);
      b.parts.skin = b.bx(0.7, 0.5, 1.0, skin, 0, 0.8, 0); b.parts.skin.visible = false;
      var head = b.bx(0.42, 0.42, 0.42, face, 0, 1.05, 0.72);
      b.bx(0.46, 0.14, 0.3, wool, 0, 0.24, -0.04, head);
      eyes(b, head, 0.12, 0.05, 0.22);
      [[-0.26, -0.4], [0.26, -0.4], [-0.26, 0.4], [0.26, 0.4]].forEach(function (p) { b.leg(0.2, 0.5, face, p[0], 0.5, p[1]); });
    },
    kurczak: function (b) {
      var white = b.mat(0xfafafa), red = b.mat(0xe03030), yellow = b.mat(0xf0b020);
      b.bx(0.4, 0.4, 0.5, white, 0, 0.45, 0);
      b.bx(0.06, 0.25, 0.35, white, -0.23, 0.48, -0.02); b.bx(0.06, 0.25, 0.35, white, 0.23, 0.48, -0.02);
      var head = b.bx(0.28, 0.32, 0.25, white, 0, 0.78, 0.22);
      b.bx(0.06, 0.1, 0.16, red, 0, 0.2, 0, head);
      b.bx(0.12, 0.06, 0.12, yellow, 0, 0, 0.18, head);
      b.bx(0.08, 0.1, 0.06, red, 0, -0.1, 0.14, head);
      eyes(b, head, 0.08, 0.06, 0.13, 0x111111, 0.05);
      b.leg(0.06, 0.25, yellow, -0.1, 0.25, 0); b.leg(0.06, 0.25, yellow, 0.1, 0.25, 0);
    },
    swinka: function (b) {
      var pink = b.mat(0xf0a0a8), dark = b.mat(0xd87882);
      b.bx(0.8, 0.6, 1.0, pink, 0, 0.6, 0);
      var head = b.bx(0.5, 0.5, 0.45, pink, 0, 0.7, 0.6);
      b.bx(0.26, 0.18, 0.08, dark, 0, -0.06, 0.25, head);
      b.bx(0.05, 0.06, 0.02, b.mat(0x80404a, { fixed: true }), -0.06, -0.06, 0.29, head);
      b.bx(0.05, 0.06, 0.02, b.mat(0x80404a, { fixed: true }), 0.06, -0.06, 0.29, head);
      eyes(b, head, 0.14, 0.1, 0.23);
      [[-0.24, -0.32], [0.24, -0.32], [-0.24, 0.32], [0.24, 0.32]].forEach(function (p) { b.leg(0.2, 0.3, pink, p[0], 0.3, p[1]); });
    }
  };

  CM.make = function (type) {
    var b = builder();
    makers[type === 'skoczek_maly' ? 'skoczek' : type](b);
    var scale = type === 'skoczek_maly' ? 0.55 : 1;
    b.g.scale.setScalar(scale);
    return { group: b.g, legs: b.legs, arms: b.arms, mats: b.mats, parts: b.parts, scale: scale, base: b.mats.map(function (m) { return m.color.getHex(); }) };
  };

  function tint(model, hex) {
    for (var i = 0; i < model.mats.length; i++) model.mats[i].color.setHex(hex === null ? model.base[i] : hex);
  }

  // Ustawia model wg stanu stworzenia (pozycja, obrót, nogi, efekty).
  CM.animate = function (c, model, t) {
    var b = c.body, g = model.group;
    g.position.set(b.pos.x, b.pos.y, b.pos.z);
    g.rotation.y = c.yaw;
    g.scale.setScalar(model.scale);
    var sp = Math.hypot(b.vel.x, b.vel.z), amp = Math.min(0.7, sp * 0.25);
    for (var i = 0; i < model.legs.length; i++) model.legs[i].rotation.x = Math.sin(t * 8 + c.phase + (i % 2 ? Math.PI : 0) + (i > 1 ? Math.PI : 0)) * amp;
    for (var k = 0; k < model.arms.length; k++) model.arms[k].rotation.x = -Math.PI / 2 + Math.sin(t * 3 + c.phase + k * Math.PI) * 0.15;
    if (model.parts.blob) {
      var sq = b.onGround ? 1 : Math.max(0.8, Math.min(1.25, 1 + b.vel.y * 0.04));
      model.parts.blob.scale.set(1 / Math.sqrt(sq), sq, 1 / Math.sqrt(sq));
    }
    if (model.parts.wool) { var shorn = c.shornT > 0; model.parts.wool.visible = !shorn; model.parts.skin.visible = shorn; }
    if (c.burning) { tint(model, Math.sin(t * 20) > 0 ? 0xff8020 : 0x8a3a10); return; }
    if (c.fuseT !== undefined && c.fuseT !== null) {
      tint(model, Math.sin(c.fuseT * (8 + c.fuseT * 16)) > 0 ? 0xffffff : null);
      g.scale.setScalar(model.scale * (1 + c.fuseT * 0.12));
      return;
    }
    tint(model, c.hurtT > 0 ? 0xff6060 : null);
  };

  BC.CreatureModels = CM;
})(window.BC);
