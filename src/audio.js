// Muzyka i dźwięki generowane w Web Audio (bez plików).
(function (BC) {
  var A = { ctx: null, musicOn: true, sfxOn: true, started: false };
  var master, musicGain, sfxGain, delay, delayGain, noiseBuf;
  var BPM = 74, STEP = 60 / BPM / 2; // ósemki
  var nextStep = 0, stepIdx = 0, timer = null;
  var chordTable = [
    [60, 64, 67], [55, 59, 62], [57, 60, 64], [53, 57, 60],
    [60, 64, 67], [52, 55, 59], [53, 57, 60], [55, 59, 62]
  ];
  var scale = [60, 62, 64, 67, 69, 72, 74, 76, 79, 81, 84, 86, 88];
  var melodyIdx = 6, lastMelodyStep = -9;

  function freq(m) { return 440 * Math.pow(2, (m - 69) / 12); }

  A.init = function () {
    if (A.ctx) { if (A.ctx.state === 'suspended') A.ctx.resume(); return; }
    var Ctx = window.AudioContext || window.webkitAudioContext;
    if (!Ctx) return;
    var ctx = A.ctx = new Ctx();
    master = ctx.createGain(); master.gain.value = 0.9; master.connect(ctx.destination);
    musicGain = ctx.createGain(); musicGain.gain.value = A.musicOn ? 0.5 : 0; musicGain.connect(master);
    sfxGain = ctx.createGain(); sfxGain.gain.value = A.sfxOn ? 0.6 : 0; sfxGain.connect(master);
    delay = ctx.createDelay(1.0); delay.delayTime.value = STEP * 1.5;
    delayGain = ctx.createGain(); delayGain.gain.value = 0.32;
    var lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 2200;
    delay.connect(lp); lp.connect(delayGain); delayGain.connect(delay); delayGain.connect(musicGain);
    // szum do efektów
    noiseBuf = ctx.createBuffer(1, ctx.sampleRate * 0.5, ctx.sampleRate);
    var d = noiseBuf.getChannelData(0);
    for (var i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    nextStep = ctx.currentTime + 0.2; stepIdx = 0;
    timer = setInterval(schedule, 120);
    A.started = true;
  };

  function tone(dest, type, f, t, dur, vol, attack, detune) {
    var ctx = A.ctx;
    var o = ctx.createOscillator(); o.type = type; o.frequency.value = f; if (detune) o.detune.value = detune;
    var g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(vol, t + (attack || 0.01));
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(dest);
    o.start(t); o.stop(t + dur + 0.05);
    return o;
  }

  function schedule() {
    if (!A.ctx) return;
    var ctx = A.ctx;
    while (nextStep < ctx.currentTime + 1.2) {
      if (A.musicOn) playStep(stepIdx, nextStep);
      nextStep += STEP; stepIdx++; A.steps = stepIdx;
    }
  }

  function playStep(i, t) {
    var bar = Math.floor(i / 8) % 8, s = i % 8;
    var chord = chordTable[bar];
    // pad akordowy na początku taktu
    if (s === 0) {
      for (var k = 0; k < chord.length; k++) {
        tone(musicGain, 'triangle', freq(chord[k]), t, STEP * 8.5, 0.05, 1.0, 5);
        tone(musicGain, 'sine', freq(chord[k] - 12), t, STEP * 8.5, 0.04, 1.2, -5);
      }
    }
    // bas
    if (s === 0 || s === 4) tone(musicGain, 'sine', freq(chord[0] - 24), t, STEP * 3, s === 0 ? 0.16 : 0.1, 0.02);
    if (s === 6 && Math.random() < 0.5) tone(musicGain, 'sine', freq(chord[0] - 24 + 7), t, STEP * 1.5, 0.08, 0.02);
    // melodia pentatoniczna – spokojny spacer po skali
    var strong = s % 2 === 0;
    var p = strong ? 0.55 : 0.28;
    if (i - lastMelodyStep >= 6) p += 0.3;
    if (Math.random() < p) {
      var move = Math.floor(Math.random() * 5) - 2;
      if (s === 0 && Math.random() < 0.7) {
        // ton akordu blisko poprzedniej nuty
        var best = melodyIdx, bestD = 99;
        for (var q = 0; q < scale.length; q++) {
          if (chord.indexOf((scale[q] % 12) + 60) < 0 && chord.indexOf((scale[q] % 12) + 48) < 0) continue;
          var dd = Math.abs(q - melodyIdx); if (dd < bestD) { bestD = dd; best = q; }
        }
        melodyIdx = best;
      } else {
        melodyIdx = Math.max(2, Math.min(scale.length - 1, melodyIdx + move));
      }
      var dur = (Math.random() < 0.3 ? STEP * 3 : STEP * 1.6);
      var f = freq(scale[melodyIdx]);
      tone(musicGain, 'sine', f, t, dur, 0.13, 0.02);
      tone(musicGain, 'triangle', f * 2, t, dur * 0.6, 0.025, 0.02);
      tone(delay, 'sine', f, t, dur, 0.07, 0.02);
      lastMelodyStep = i;
    }
    // delikatny dzwoneczek co jakiś czas
    if (s === 3 && Math.random() < 0.15) tone(delay, 'sine', freq(chord[2] + 12), t, STEP * 2, 0.05, 0.01);
  }

  A.setMusic = function (on) {
    A.musicOn = on;
    if (musicGain) musicGain.gain.linearRampToValueAtTime(on ? 0.5 : 0.0001, A.ctx.currentTime + 0.4);
  };
  A.setSfx = function (on) { A.sfxOn = on; if (sfxGain) sfxGain.gain.value = on ? 0.6 : 0; };

  function noise(dest, t, dur, filterType, f0, f1, vol) {
    var ctx = A.ctx;
    var src = ctx.createBufferSource(); src.buffer = noiseBuf;
    var flt = ctx.createBiquadFilter(); flt.type = filterType; flt.frequency.setValueAtTime(f0, t);
    if (f1) flt.frequency.exponentialRampToValueAtTime(f1, t + dur);
    var g = ctx.createGain(); g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(flt); flt.connect(g); g.connect(dest); src.start(t); src.stop(t + dur + 0.02);
  }
  function sweep(dest, type, f0, f1, t, dur, vol) {
    var ctx = A.ctx;
    var o = ctx.createOscillator(); o.type = type; o.frequency.setValueAtTime(f0, t); o.frequency.exponentialRampToValueAtTime(f1, t + dur);
    var g = ctx.createGain(); g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(dest); o.start(t); o.stop(t + dur + 0.02);
  }

  A.sfx = function (name) {
    if (!A.ctx || !A.sfxOn) return;
    var ctx = A.ctx, t = ctx.currentTime;
    switch (name) {
      case 'break': noise(sfxGain, t, 0.14, 'lowpass', 1400, 300, 0.5); sweep(sfxGain, 'square', 160, 60, t, 0.08, 0.08); break;
      case 'place': sweep(sfxGain, 'sine', 220, 110, t, 0.09, 0.25); noise(sfxGain, t, 0.05, 'highpass', 2000, 0, 0.15); break;
      case 'jump': sweep(sfxGain, 'sine', 320, 620, t, 0.14, 0.18); break;
      case 'highjump': sweep(sfxGain, 'sine', 300, 1000, t, 0.28, 0.2); sweep(sfxGain, 'triangle', 600, 1600, t, 0.2, 0.06); break;
      case 'land': noise(sfxGain, t, 0.08, 'lowpass', 600, 200, 0.25); break;
      case 'vine': noise(sfxGain, t, 0.28, 'bandpass', 500, 2400, 0.35); sweep(sfxGain, 'sawtooth', 200, 90, t + 0.18, 0.1, 0.06); break;
      case 'grow': [72, 76, 79, 84].forEach(function (m, i) { tone(sfxGain, 'sine', freq(m), t + i * 0.09, 0.5, 0.18, 0.01); }); break;
      case 'plant': sweep(sfxGain, 'sine', 500, 900, t, 0.12, 0.15); break;
      case 'fly': tone(sfxGain, 'sine', freq(76), t, 0.15, 0.15, 0.01); tone(sfxGain, 'sine', freq(83), t + 0.12, 0.2, 0.15, 0.01); break;
      case 'unfly': tone(sfxGain, 'sine', freq(83), t, 0.15, 0.15, 0.01); tone(sfxGain, 'sine', freq(76), t + 0.12, 0.2, 0.15, 0.01); break;
      case 'splash': noise(sfxGain, t, 0.35, 'lowpass', 900, 250, 0.35); break;
      case 'home': [67, 72, 76].forEach(function (m, i) { tone(sfxGain, 'triangle', freq(m), t + i * 0.08, 0.35, 0.15, 0.01); }); break;
      case 'click': sweep(sfxGain, 'sine', 800, 500, t, 0.05, 0.12); break;
      case 'nope': sweep(sfxGain, 'square', 200, 150, t, 0.12, 0.06); break;
    }
  };
  BC.Audio = A;
})(window.BC);
