// Model Bulbazaura z klocków (Three.js Group) + animacja chodzenia.
(function (BC) {
  function box(w, h, d, color, x, y, z, parent) {
    var m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), new THREE.MeshLambertMaterial({ color: color }));
    m.position.set(x, y, z);
    parent.add(m);
    return m;
  }
  function create() {
    var group = new THREE.Group();
    var body = new THREE.Group(); group.add(body);
    var teal = 0x7fc8a9, dark = 0x3f8f6e, bulb = 0x4fae3c, bulbDark = 0x2f7a2a;
    // tułów (długość wzdłuż -z = przód)
    box(0.9, 0.55, 1.1, teal, 0, 0.55, 0.05, body);
    // głowa
    var head = box(0.85, 0.65, 0.7, teal, 0, 0.85, -0.6, body);
    // oczy
    box(0.14, 0.2, 0.05, 0xffffff, -0.28, 0.1, -0.36, head);
    box(0.14, 0.2, 0.05, 0xffffff, 0.28, 0.1, -0.36, head);
    box(0.08, 0.14, 0.06, 0xd63b3b, -0.27, 0.1, -0.37, head);
    box(0.08, 0.14, 0.06, 0xd63b3b, 0.27, 0.1, -0.37, head);
    // uszy
    box(0.18, 0.22, 0.18, teal, -0.3, 0.42, -0.1, head);
    box(0.18, 0.22, 0.18, teal, 0.3, 0.42, -0.1, head);
    // plamki
    box(0.2, 0.02, 0.2, dark, 0.3, 0.83, 0.2, body);
    box(0.16, 0.02, 0.16, dark, -0.25, 0.83, 0.4, body);
    box(0.12, 0.12, 0.02, dark, 0.2, 0.55, -0.51, body);
    box(0.02, 0.15, 0.15, dark, -0.46, 0.5, 0.3, body);
    box(0.02, 0.15, 0.15, dark, 0.46, 0.5, 0.1, body);
    // cebulka na grzbiecie
    box(0.75, 0.55, 0.75, bulb, 0, 1.05, 0.3, body);
    box(0.5, 0.25, 0.5, bulbDark, 0, 1.42, 0.3, body);
    box(0.25, 0.3, 0.25, bulbDark, 0, 1.55, 0.3, body);
    box(0.4, 0.06, 0.15, 0x6fd35c, -0.35, 1.3, 0.3, body);
    box(0.4, 0.06, 0.15, 0x6fd35c, 0.35, 1.3, 0.3, body);
    // łapy (obrót wokół górnej krawędzi)
    var legs = [];
    [[-0.32, -0.35], [0.32, -0.35], [-0.32, 0.4], [0.32, 0.4]].forEach(function (p) {
      var pivot = new THREE.Group(); pivot.position.set(p[0], 0.35, p[1]); body.add(pivot);
      box(0.3, 0.35, 0.3, teal, 0, -0.17, 0, pivot);
      legs.push(pivot);
    });
    function setWalk(t, speed) {
      var amp = Math.min(0.6, speed * 0.15);
      for (var i = 0; i < legs.length; i++) legs[i].rotation.x = Math.sin(t * 9 + (i % 2 ? Math.PI : 0) + (i > 1 ? Math.PI : 0)) * amp;
      body.position.y = Math.abs(Math.sin(t * 9)) * amp * 0.08;
    }
    return { group: group, legs: legs, setWalk: setWalk };
  }
  BC.Bulbasaur = { create: create };
})(window.BC);
