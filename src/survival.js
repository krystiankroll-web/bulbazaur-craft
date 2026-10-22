// Logika trybu przetrwania (czysta, testowalna w Node): statystyki, ekwipunek, dropy, warsztat, cykl dnia.
var BC = (typeof window !== "undefined") ? (window.BC = window.BC || {}) : (global.BC = global.BC || {});
if (typeof require !== 'undefined' && !BC.Physics) { require('./physics.js'); }
(function (BC) {
  var B = BC.Blocks, Info = BC.BlockInfo;
  var S = {};
  S.MAX_HP = 20; S.MAX_FOOD = 20; S.MAX_AIR = 10;
  S.HUNGER_SECONDS = 40;   // sekund na 1 punkt jedzenia
  S.REGEN_SECONDS = 4;     // sekund na 1 hp przy najedzeniu
  S.STARVE_SECONDS = 6;    // sekund na 1 hp przy głodzie
  S.STARVE_MIN_HP = 2;     // z głodu nie można zemdleć
  S.DAY_LENGTH = 480;      // sekund na dobę
  S.APPLE_FOOD = 6;

  // ---------- statystyki gracza ----------
  S.makeStats = function () {
    return { hp: S.MAX_HP, food: S.MAX_FOOD, air: S.MAX_AIR, hungerAcc: 0, regenAcc: 0, starveAcc: 0, drownAcc: 0, hurtT: 0 };
  };
  // ctx: { underwater, sprinting, flying, noDrown }. Zwraca listę zdarzeń: 'regen' | 'starve' | 'drown'.
  S.tickStats = function (st, dt, ctx) {
    ctx = ctx || {};
    var ev = [];
    st.hurtT = Math.max(0, st.hurtT - dt);
    st.hungerAcc += dt * ((ctx.sprinting || ctx.flying) ? 2 : 1);
    while (st.hungerAcc >= S.HUNGER_SECONDS) { st.hungerAcc -= S.HUNGER_SECONDS; st.food = Math.max(0, st.food - 1); }
    if (st.food >= 14 && st.hp < S.MAX_HP) {
      st.regenAcc += dt;
      if (st.regenAcc >= S.REGEN_SECONDS) { st.regenAcc = 0; st.hp = Math.min(S.MAX_HP, st.hp + 1); ev.push('regen'); }
    } else st.regenAcc = 0;
    if (st.food <= 0 && st.hp > S.STARVE_MIN_HP) {
      st.starveAcc += dt;
      if (st.starveAcc >= S.STARVE_SECONDS) { st.starveAcc = 0; st.hp = Math.max(S.STARVE_MIN_HP, st.hp - 1); st.hurtT = 0.4; ev.push('starve'); }
    } else st.starveAcc = 0;
    if (ctx.underwater && !ctx.noDrown) {
      st.air = Math.max(0, st.air - dt);
      if (st.air <= 0) {
        st.drownAcc += dt;
        if (st.drownAcc >= 1) { st.drownAcc = 0; S.damage(st, 2); ev.push('drown'); }
      }
    } else { st.air = Math.min(S.MAX_AIR, st.air + dt * 3); st.drownAcc = 0; }
    return ev;
  };
  S.damage = function (st, n) {
    st.hp = Math.max(0, st.hp - n);
    st.hurtT = 0.5;
    return st.hp <= 0;
  };
  S.fallDamage = function (dist) { return dist > 5.5 ? Math.floor(dist - 5) : 0; };
  S.jumpCost = function (st) { st.hungerAcc += 2; };
  S.canFly = function (st, mode) { return mode !== 'survival' || st.food > 0; };
  // Jedzenie: [id, ile punktów]. Kolejność rozstrzyga remis.
  S.FOODS = [[B.APPLE, S.APPLE_FOOD], [B.MILK, 4], [B.EGG, 3]];
  S.hasFood = function (inv) { return S.FOODS.some(function (f) { return (inv[f[0]] || 0) > 0; }); };
  // Zjada to, czego jest najwięcej. Zwraca id zjedzonego albo false.
  S.eat = function (st, inv) {
    if (st.food >= S.MAX_FOOD) return false;
    var best = null;
    S.FOODS.forEach(function (f) { var n = inv[f[0]] || 0; if (n > 0 && (!best || n > (inv[best[0]] || 0))) best = f; });
    if (!best) return false;
    S.invTake(inv, best[0], 1);
    st.food = Math.min(S.MAX_FOOD, st.food + best[1]);
    return best[0];
  };
  S.respawn = function (st) { st.hp = S.MAX_HP; st.food = Math.max(st.food, 14); st.air = S.MAX_AIR; st.hurtT = 0; };

  // ---------- ekwipunek ----------
  S.makeInv = function () { var inv = {}; inv[B.APPLE] = 3; return inv; };
  S.invAdd = function (inv, id, n) { if (id === null || id === undefined) return; inv[id] = (inv[id] || 0) + (n || 1); };
  S.invCount = function (inv, id) { return inv[id] || 0; };
  S.invTake = function (inv, id, n) {
    n = n || 1;
    if ((inv[id] || 0) < n) return false;
    inv[id] -= n; if (inv[id] === 0) delete inv[id];
    return true;
  };
  // Co wpada do plecaka po zniszczeniu bloku. rand: funkcja [0,1).
  S.dropFor = function (id, rand) {
    if (id === B.LEAVES) { var r = rand(); return r < 0.25 ? B.APPLE : (r < 0.40 ? B.SAPLING : null); }
    var d = Info[id].drop;
    return d === undefined ? id : d;
  };
  S.RECIPES = [
    { name: 'Deski', from: B.LOG, n: 1, to: B.PLANKS, m: 4 },
    { name: 'Szkło', from: B.SAND, n: 1, to: B.GLASS, m: 1 },
    { name: 'Pochodnie', from: B.LOG, n: 1, to: B.TORCH, m: 4 }
  ];
  S.craft = function (inv, idx) {
    var r = S.RECIPES[idx]; if (!r) return false;
    if (!S.invTake(inv, r.from, r.n)) return false;
    S.invAdd(inv, r.to, r.m);
    return true;
  };

  // ---------- cykl dnia ----------
  S.phase = function (time) { var p = (time / S.DAY_LENGTH) % 1; return p < 0 ? p + 1 : p; };
  // 0 = wschód, 0.25 = południe, 0.5 = zachód, 0.75 = północ. Wynik 0..1.
  S.sunLight = function (time) {
    var p = S.phase(time);
    return Math.max(0, Math.min(1, (Math.sin(p * Math.PI * 2) + 0.25) / 1.25));
  };
  S.isNight = function (time) { return S.sunLight(time) < 0.2; };
  S.dayNumber = function (time) { return Math.floor(time / S.DAY_LENGTH) + 1; };
  S.START_TIME = S.DAY_LENGTH * 0.05;

  BC.Survival = S;
})(BC);
if (typeof module !== 'undefined') module.exports = BC;
