// Service worker: cache aplikacji, żeby gra działała offline po pierwszym uruchomieniu (poza file://).
var CACHE = 'bc-v4a';
var FILES = ['./', './index.html', './manifest.json', './icon-192.png', './icon-512.png',
  './src/blocks.js', './src/noise.js', './src/world.js', './src/mesher.js', './src/physics.js', './src/raycast.js', './src/survival.js',
  './src/textures.js', './src/audio.js', './src/heroes.js', './src/monsters.js', './src/touch.js', './src/hud.js', './src/player.js', './src/main.js', './src/boot.js',
  'https://cdnjs.cloudflare.com/ajax/libs/three.js/0.160.0/three.min.js'];
self.addEventListener('install', function (e) { e.waitUntil(caches.open(CACHE).then(function (c) { return c.addAll(FILES); }).catch(function () {})); self.skipWaiting(); });
self.addEventListener('activate', function (e) { e.waitUntil(caches.keys().then(function (ks) { return Promise.all(ks.filter(function (k) { return k !== CACHE; }).map(function (k) { return caches.delete(k); })); })); });
self.addEventListener('fetch', function (e) {
  e.respondWith(fetch(e.request).then(function (r) { var cp = r.clone(); caches.open(CACHE).then(function (c) { c.put(e.request, cp); }); return r; })
    .catch(function () { return caches.match(e.request); }));
});
