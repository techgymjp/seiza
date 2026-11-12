// プラネタリウム風のBGM (Web Audio でその場で合成)
// ゆっくり移り変わるパッドの和音 + 低音 + ランダムにきらめくベル + 長い残響
(function () {
  'use strict';

  const CHORD_SEC = 9; // 1つの和音の長さ
  // 和音進行 (MIDIノート番号): Fmaj9 → Em7 → Dm9 → Cmaj9 → B♭maj7(#11) → Am7 → Dm9 → Csus
  const PROGRESSION = [
    { bass: 41, pad: [53, 57, 60, 64, 67], bell: [72, 76, 79, 81, 84, 88] },
    { bass: 40, pad: [52, 55, 59, 62, 67], bell: [71, 74, 76, 79, 83, 86] },
    { bass: 38, pad: [50, 53, 57, 60, 64], bell: [69, 72, 74, 77, 81, 84] },
    { bass: 36, pad: [52, 55, 59, 62, 64], bell: [72, 74, 76, 79, 83, 86] },
    { bass: 34, pad: [50, 53, 57, 62, 64], bell: [69, 74, 76, 77, 81, 86] },
    { bass: 33, pad: [52, 55, 57, 60, 64], bell: [69, 72, 76, 79, 81, 84] },
    { bass: 38, pad: [50, 53, 57, 60, 64], bell: [69, 72, 74, 77, 81, 84] },
    { bass: 36, pad: [53, 55, 60, 62, 67], bell: [72, 74, 79, 81, 84, 86] },
  ];

  const mtof = (m) => 440 * Math.pow(2, (m - 69) / 12);

  let ac = null;
  let master = null, padBus = null, bellBus = null, reverb = null, padFilter = null;
  let timer = null;
  let playing = false;
  let nextChordTime = 0, chordIndex = 0, nextBellTime = 0;
  const VOLUME = 0.3;

  function makeImpulse(seconds, decay) {
    const rate = ac.sampleRate;
    const len = Math.floor(rate * seconds);
    const buf = ac.createBuffer(2, len, rate);
    for (let ch = 0; ch < 2; ch++) {
      const d = buf.getChannelData(ch);
      for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, decay);
    }
    return buf;
  }

  function init() {
    if (ac) return true;
    try {
      ac = new (window.AudioContext || window.webkitAudioContext)();
    } catch (e) {
      return false;
    }
    master = ac.createGain();
    master.gain.value = 0;
    master.connect(ac.destination);

    // 残響 (広いドームの響き)
    reverb = ac.createConvolver();
    reverb.buffer = makeImpulse(5.5, 2.6);
    const wet = ac.createGain();
    wet.gain.value = 0.9;
    reverb.connect(wet).connect(master);

    // パッド: ローパスフィルターをゆっくり揺らす
    padFilter = ac.createBiquadFilter();
    padFilter.type = 'lowpass';
    padFilter.frequency.value = 900;
    padFilter.Q.value = 0.7;
    const lfo = ac.createOscillator();
    const lfoGain = ac.createGain();
    lfo.frequency.value = 0.05;
    lfoGain.gain.value = 450;
    lfo.connect(lfoGain).connect(padFilter.frequency);
    lfo.start();

    padBus = ac.createGain();
    padBus.gain.value = 0.5;
    padBus.connect(padFilter);
    const padDry = ac.createGain();
    padDry.gain.value = 0.55;
    padFilter.connect(padDry).connect(master);
    padFilter.connect(reverb);

    bellBus = ac.createGain();
    bellBus.gain.value = 0.5;
    const bellDry = ac.createGain();
    bellDry.gain.value = 0.35;
    bellBus.connect(bellDry).connect(master);
    bellBus.connect(reverb);
    return true;
  }

  function panNode(value) {
    if (ac.createStereoPanner) {
      const p = ac.createStereoPanner();
      p.pan.value = value;
      return p;
    }
    return ac.createGain();
  }

  function playPadNote(midi, t, dur, vol) {
    const f = mtof(midi);
    const g = ac.createGain();
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(vol, t + 3.5);
    g.gain.setValueAtTime(vol, t + dur - 1);
    g.gain.linearRampToValueAtTime(0, t + dur + 4);
    const pan = panNode((Math.random() - 0.5) * 0.8);
    g.connect(pan).connect(padBus);
    [[-6, 'sine'], [6, 'triangle']].forEach(([detune, type]) => {
      const o = ac.createOscillator();
      o.type = type;
      o.frequency.value = f;
      o.detune.value = detune + (Math.random() - 0.5) * 4;
      o.connect(g);
      o.start(t);
      o.stop(t + dur + 4.2);
    });
  }

  function playBass(midi, t, dur) {
    const o = ac.createOscillator();
    o.type = 'sine';
    o.frequency.value = mtof(midi);
    const g = ac.createGain();
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(0.18, t + 2.5);
    g.gain.setValueAtTime(0.18, t + dur - 1);
    g.gain.linearRampToValueAtTime(0, t + dur + 3);
    o.connect(g).connect(padFilter);
    o.start(t);
    o.stop(t + dur + 3.2);
  }

  // セレスタのような音: 基音 + 倍音を減衰させる
  function playBell(midi, t, vol) {
    const f = mtof(midi);
    const pan = panNode((Math.random() - 0.5) * 1.6);
    pan.connect(bellBus);
    [[1, 1, 3.2], [2.0, 0.25, 1.6], [3.01, 0.08, 0.9], [4.2, 0.04, 0.5]].forEach(([mul, amp, decay]) => {
      const o = ac.createOscillator();
      o.type = 'sine';
      o.frequency.value = f * mul;
      const g = ac.createGain();
      g.gain.setValueAtTime(0, t);
      g.gain.linearRampToValueAtTime(vol * amp, t + 0.008);
      g.gain.exponentialRampToValueAtTime(0.0001, t + decay);
      o.connect(g).connect(pan);
      o.start(t);
      o.stop(t + decay + 0.1);
    });
  }

  function schedule() {
    const now = ac.currentTime;
    const ahead = now + 1.5;
    while (nextChordTime < ahead) {
      const ch = PROGRESSION[chordIndex % PROGRESSION.length];
      ch.pad.forEach((m, k) => playPadNote(m, nextChordTime + k * 0.25, CHORD_SEC, 0.05));
      playBass(ch.bass, nextChordTime, CHORD_SEC);
      chordIndex++;
      nextChordTime += CHORD_SEC;
    }
    while (nextBellTime < ahead) {
      const cur = PROGRESSION[(chordIndex - 1 + PROGRESSION.length) % PROGRESSION.length];
      const notes = cur.bell;
      const m = notes[Math.floor(Math.random() * notes.length)];
      playBell(m, nextBellTime, 0.05 + Math.random() * 0.05);
      // ときどき2音続けてきらめかせる
      if (Math.random() < 0.3) {
        const m2 = notes[Math.floor(Math.random() * notes.length)];
        playBell(m2 + 12 > 98 ? m2 : m2 + 12, nextBellTime + 0.18, 0.03);
      }
      nextBellTime += 0.9 + Math.random() * 2.4;
    }
  }

  function start() {
    if (playing) return;
    if (!init()) return;
    if (ac.state === 'suspended') ac.resume();
    playing = true;
    const now = ac.currentTime;
    nextChordTime = Math.max(nextChordTime, now + 0.1);
    nextBellTime = Math.max(nextBellTime, now + 2);
    master.gain.cancelScheduledValues(now);
    master.gain.setValueAtTime(master.gain.value, now);
    master.gain.linearRampToValueAtTime(VOLUME, now + 3);
    schedule();
    timer = setInterval(schedule, 400);
  }

  function stop() {
    if (!playing || !ac) return;
    playing = false;
    clearInterval(timer);
    timer = null;
    const now = ac.currentTime;
    master.gain.cancelScheduledValues(now);
    master.gain.setValueAtTime(master.gain.value, now);
    master.gain.linearRampToValueAtTime(0, now + 1.2);
    // 次に再開したときは新しい和音から
    nextChordTime = now + 1.5;
  }

  // 別のタブに切り替えたら止める
  document.addEventListener('visibilitychange', () => {
    if (!ac) return;
    if (document.hidden) ac.suspend();
    else if (playing) ac.resume();
  });

  window.BGM = { start, stop, isPlaying: () => playing };
})();
