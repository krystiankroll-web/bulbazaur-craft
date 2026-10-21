// Bohaterowie: definicje mocy, modele z klocków (Three.js Group) z animacją chodzenia, portrety 16x16.
(function (BC) {
  function box(w, h, d, color, x, y, z, parent) {
    var m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), new THREE.MeshLambertMaterial({ color: color }));
    m.position.set(x, y, z);
    parent.add(m);
    return m;
  }
  // Wspólny czworonożny korpus: tułów, głowa, oczy, łapy. Zwraca części do dekoracji.
  function base(c) {
    var group = new THREE.Group();
    var body = new THREE.Group(); group.add(body);
    box(0.9, 0.55, 1.1, c.skin, 0, 0.55, 0.05, body);
    if (c.belly) box(0.7, 0.3, 0.9, c.belly, 0, 0.36, 0.0, body);
    var head = box(0.85, 0.65, 0.7, c.skin, 0, 0.85, -0.6, body);
    box(0.14, 0.2, 0.05, 0xffffff, -0.28, 0.1, -0.36, head);
    box(0.14, 0.2, 0.05, 0xffffff, 0.28, 0.1, -0.36, head);
    box(0.08, 0.14, 0.06, c.eye, -0.27, 0.1, -0.37, head);
    box(0.08, 0.14, 0.06, c.eye, 0.27, 0.1, -0.37, head);
    var legs = [];
    [[-0.32, -0.35], [0.32, -0.35], [-0.32, 0.4], [0.32, 0.4]].forEach(function (p) {
      var pivot = new THREE.Group(); pivot.position.set(p[0], 0.35, p[1]); body.add(pivot);
      box(0.3, 0.35, 0.3, c.skin, 0, -0.17, 0, pivot);
      legs.push(pivot);
    });
    return { group: group, body: body, head: head, legs: legs, anim: [] };
  }
  function finish(parts) {
    parts.setWalk = function (t, speed) {
      var amp = Math.min(0.6, speed * 0.15);
      for (var i = 0; i < parts.legs.length; i++) parts.legs[i].rotation.x = Math.sin(t * 9 + (i % 2 ? Math.PI : 0) + (i > 1 ? Math.PI : 0)) * amp;
      parts.body.position.y = Math.abs(Math.sin(t * 9)) * amp * 0.08;
      for (var k = 0; k < parts.anim.length; k++) parts.anim[k](t, speed);
    };
    return parts;
  }

  function bulbasaur() {
    var teal = 0x7fc8a9, dark = 0x3f8f6e, bulb = 0x4fae3c, bulbDark = 0x2f7a2a;
    var p = base({ skin: teal, eye: 0xd63b3b });
    box(0.18, 0.22, 0.18, teal, -0.3, 0.42, -0.1, p.head);
    box(0.18, 0.22, 0.18, teal, 0.3, 0.42, -0.1, p.head);
    box(0.2, 0.02, 0.2, dark, 0.3, 0.83, 0.2, p.body);
    box(0.16, 0.02, 0.16, dark, -0.25, 0.83, 0.4, p.body);
    box(0.12, 0.12, 0.02, dark, 0.2, 0.55, -0.51, p.body);
    box(0.02, 0.15, 0.15, dark, -0.46, 0.5, 0.3, p.body);
    box(0.02, 0.15, 0.15, dark, 0.46, 0.5, 0.1, p.body);
    box(0.75, 0.55, 0.75, bulb, 0, 1.05, 0.3, p.body);
    box(0.5, 0.25, 0.5, bulbDark, 0, 1.42, 0.3, p.body);
    box(0.25, 0.3, 0.25, bulbDark, 0, 1.55, 0.3, p.body);
    box(0.4, 0.06, 0.15, 0x6fd35c, -0.35, 1.3, 0.3, p.body);
    box(0.4, 0.06, 0.15, 0x6fd35c, 0.35, 1.3, 0.3, p.body);
    return finish(p);
  }
  function charmander() {
    var orange = 0xf28a3c, cream = 0xf7d9a0;
    var p = base({ skin: orange, eye: 0x2a6fd6, belly: cream });
    box(0.3, 0.18, 0.35, cream, 0, -0.2, -0.3, p.head); // podbródek
    // ogon z płomieniem
    var tail = new THREE.Group(); tail.position.set(0, 0.6, 0.6); p.body.add(tail);
    box(0.22, 0.22, 0.6, orange, 0, 0.1, 0.3, tail);
    box(0.18, 0.18, 0.4, orange, 0, 0.3, 0.7, tail);
    var flame = box(0.3, 0.42, 0.3, 0xffb020, 0, 0.7, 0.75, tail);
    var flame2 = box(0.16, 0.24, 0.16, 0xffe070, 0, 1.0, 0.75, tail);
    flame.material.emissive = new THREE.Color(0xff6a00);
    flame2.material.emissive = new THREE.Color(0xffc040);
    p.anim.push(function (t) {
      var s = 1 + Math.sin(t * 13) * 0.15;
      flame.scale.set(s, 1 / s + 0.2, s); flame2.scale.set(1 / s, s, 1 / s);
      tail.rotation.x = Math.sin(t * 2.5) * 0.15;
    });
    p.flame = flame;
    return finish(p);
  }
  function squirtle() {
    var blue = 0x7fc7e6, shell = 0x8a5a2b, rim = 0xf2e2b0;
    var p = base({ skin: blue, eye: 0x4a2a1a, belly: rim });
    box(0.8, 0.5, 0.95, shell, 0, 0.9, 0.1, p.body);
    box(0.9, 0.12, 1.05, rim, 0, 0.72, 0.1, p.body);
    box(0.5, 0.08, 0.6, 0x6a4420, 0, 1.17, 0.1, p.body);
    var tail = box(0.22, 0.22, 0.5, blue, 0, 0.5, 0.75, p.body);
    box(0.3, 0.3, 0.3, blue, 0, 0.62, 1.05, p.body);
    p.anim.push(function (t) { tail.rotation.y = Math.sin(t * 3) * 0.3; });
    return finish(p);
  }
  function pikachu() {
    var yellow = 0xf7d02c, black = 0x2a2420, red = 0xe0453b, brown = 0x8a5a1a;
    var p = base({ skin: yellow, eye: black });
    // policzki
    box(0.12, 0.14, 0.06, red, -0.38, -0.08, -0.36, p.head);
    box(0.12, 0.14, 0.06, red, 0.38, -0.08, -0.36, p.head);
    // uszy
    [[-0.3, -0.25], [0.3, 0.25]].forEach(function (u) {
      var ear = new THREE.Group(); ear.position.set(u[0], 0.3, -0.05); ear.rotation.z = u[1]; p.head.add(ear);
      box(0.16, 0.55, 0.16, yellow, 0, 0.27, 0, ear);
      box(0.17, 0.2, 0.17, black, 0, 0.6, 0, ear);
    });
    // paski na grzbiecie
    box(0.6, 0.02, 0.1, brown, 0, 0.83, 0.1, p.body);
    box(0.6, 0.02, 0.1, brown, 0, 0.83, 0.35, p.body);
    // ogon zygzak
    var tail = new THREE.Group(); tail.position.set(0, 0.6, 0.6); p.body.add(tail);
    box(0.1, 0.3, 0.1, brown, 0, 0.1, 0.05, tail);
    box(0.1, 0.1, 0.4, yellow, 0.15, 0.3, 0.2, tail);
    box(0.1, 0.4, 0.1, yellow, 0.15, 0.5, 0.4, tail);
    box(0.1, 0.1, 0.45, yellow, 0.0, 0.75, 0.5, tail);
    box(0.14, 0.5, 0.1, yellow, -0.1, 0.95, 0.75, tail);
    p.anim.push(function (t, speed) { tail.rotation.y = Math.sin(t * 6) * (0.15 + Math.min(0.3, speed * 0.05)); });
    return finish(p);
  }

  // Portrety 16x16: litery = kolory z palety bohatera.
  var PORTRAITS = {
    bulbasaur: { P: { g: '#7fc8a9', d: '#3f8f6e', b: '#4fae3c', B: '#2f7a2a', r: '#d63b3b', w: '#ffffff', k: '#222222' }, rows: [
      '.....BBBBB......', '....BbbbbbB.....', '...BbbbbbbbB....', '...BbbBbbBbbB...', '..ggBbbbbbbBgg..', '.gggggBBBBBgggg.',
      '.ggggggggggggggg', 'gggwrkggggwrkggg', 'gggwrkggggwrkggg', 'ggggggggdgggggg.', 'gggggddggggdgggg', 'ggggdggggggggggg',
      '.gggggkkkkkggggg', '.ggggggggggggggg', '..ggg.....ggg...', '..ggg.....ggg...'] },
    charmander: { P: { o: '#f28a3c', c: '#f7d9a0', f: '#ffb020', F: '#ffe070', r: '#ff6a00', b: '#2a6fd6', w: '#ffffff', k: '#222222' }, rows: [
      '............F...', '...........fFf..', '...........rfr..', '............o...', '..oooooooo..o...', '.oooooooooo.o...',
      'oooooooooooooo..', 'ooowbkooowbkooo.', 'ooowbkooowbkooo.', 'oooooooooooooo..', 'oooooccccoooooo.', '.ooooccccccooo..',
      '.oooockkkkcooo..', '.ooooccccccooo..', '..ooo.....ooo...', '..ooo.....ooo...'] },
    squirtle: { P: { s: '#7fc7e6', S: '#4a9cc0', h: '#8a5a2b', H: '#6a4420', c: '#f2e2b0', w: '#ffffff', k: '#4a2a1a' }, rows: [
      '................', '....hhhhhhhh....', '...hHhhhhhhHh...', '..hhhhHhhHhhhh..', '..cccccccccccc..', '.ssssssssssssss.',
      '.ssssssssssssss.', 'ssswkkssswkksss.', 'ssswkkssswkksss.', 'ssssssssssssssss', 'sssssSSSSSSsssss', '.sssssccccsssss.',
      '.ssssscckccssss.', '.sssssccccsssss.', '..sss......sss..', '..sss......sss..'] },
    pikachu: { P: { y: '#f7d02c', k: '#2a2420', r: '#e0453b', w: '#ffffff', b: '#8a5a1a' }, rows: [
      'kk...........kk.', 'kyk.........kyk.', '.yyk.......kyy..', '.yyyk.....kyyy..', '..yyyyyyyyyyy...', '.yyyyyyyyyyyyy..',
      'yyyyyyyyyyyyyyy.', 'yyywkkyyyywkkyy.', 'yyywkkyyyywkkyy.', 'yyyyyyykyyyyyyy.', 'yrryyyyyyyyyrry.', 'yrryyykkkkyyrry.',
      '.yyyyyyyyyyyyy..', '.yyyyyyyyyyyyy..', '..yyy.....yyy...', '..yyy.....yyy...'] }
  };

  var HEROES = {
    bulbasaur: {
      id: 'bulbasaur', name: 'Bulbazaur', emoji: '🌱', color: '#7fc8a9',
      desc: 'Pnącza niszczą z daleka, nasionko sadzi drzewo, wysoki skok.',
      q: { name: 'Pnącza', icon: '🌿' }, e: { name: 'Nasionko', icon: '🌱' }, passive: { name: 'Wysoki skok', icon: '⬆️', button: true },
      speed: 5.5, waterSpeed: 3.2, noDrown: false, doubleJump: false, nightLight: false, model: bulbasaur
    },
    charmander: {
      id: 'charmander', name: 'Charmander', emoji: '🔥', color: '#f28a3c',
      desc: 'Płomień spala drewno i liście, ognisko stawia pochodnię, ogon świeci w nocy.',
      q: { name: 'Płomień', icon: '🔥' }, e: { name: 'Ognisko', icon: '🕯️' }, passive: { name: 'Świeci w nocy', icon: '✨', button: false },
      speed: 5.5, waterSpeed: 2.6, noDrown: false, doubleJump: false, nightLight: true, model: charmander
    },
    squirtle: {
      id: 'squirtle', name: 'Squirtle', emoji: '💧', color: '#7fc7e6',
      desc: 'Strumień stawia wodę, bańka ją zasysa, pływa szybko i nigdy nie tonie.',
      q: { name: 'Strumień', icon: '💦' }, e: { name: 'Bańka', icon: '🫧' }, passive: { name: 'Pływak', icon: '🏊', button: false },
      speed: 5.2, waterSpeed: 6.5, noDrown: true, doubleJump: false, nightLight: false, model: squirtle
    },
    pikachu: {
      id: 'pikachu', name: 'Pikachu', emoji: '⚡', color: '#f7d02c',
      desc: 'Piorun uderza z 12 bloków, szybki atak to zryw do przodu, najszybszy i skacze dwa razy.',
      q: { name: 'Piorun', icon: '⚡' }, e: { name: 'Szybki atak', icon: '💨' }, passive: { name: 'Podwójny skok', icon: '🐇', button: false },
      speed: 6.5, waterSpeed: 3.0, noDrown: false, doubleJump: true, nightLight: false, model: pikachu
    }
  };
  var ORDER = ['bulbasaur', 'charmander', 'squirtle', 'pikachu'];

  function drawPortrait(canvas, heroId) {
    var pr = PORTRAITS[heroId] || PORTRAITS.bulbasaur;
    var ctx = canvas.getContext('2d');
    var s = canvas.width / 16;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    for (var y = 0; y < 16; y++) for (var x = 0; x < 16; x++) {
      var ch = pr.rows[y][x]; if (!pr.P[ch]) continue;
      ctx.fillStyle = pr.P[ch]; ctx.fillRect(x * s, y * s, s, s);
    }
  }

  BC.Heroes = { all: HEROES, order: ORDER, get: function (id) { return HEROES[id] || HEROES.bulbasaur; }, drawPortrait: drawPortrait, PORTRAITS: PORTRAITS };
  // zgodność wstecz
  BC.Bulbasaur = { create: bulbasaur };
})(window.BC);
