// 星座みつけ - メインロジック
(function () {
  'use strict';
  const A = window.Astro;
  const D2R = A.D2R;

  // ---------------------------------------------------------------
  // 設定
  // ---------------------------------------------------------------
  const DIFFICULTY = {
    easy: { label: 'かんたん', magLimit: 4.0, showShape: true, showLines: true },
    normal: { label: 'ふつう', magLimit: 5.0, showShape: true, showLines: true },
    hard: { label: 'むずかしい', magLimit: 6.0, showShape: false, showLines: false },
  };
  const MAX_ROUNDS = 5;
  const DEFAULT_LOCATION = { lat: 35.681, lon: 139.767, label: '東京（仮）' };
  const PRESETS = [
    { label: '札幌', lat: 43.062, lon: 141.354 },
    { label: '東京', lat: 35.681, lon: 139.767 },
    { label: '大阪', lat: 34.702, lon: 135.496 },
    { label: '福岡', lat: 33.59, lon: 130.401 },
    { label: '那覇', lat: 26.212, lon: 127.681 },
    { label: 'シンガポール', lat: 1.352, lon: 103.82 },
    { label: 'シドニー', lat: -33.869, lon: 151.209 },
    { label: 'ロンドン', lat: 51.507, lon: -0.128 },
    { label: 'ニューヨーク', lat: 40.713, lon: -74.006 },
  ];
  const STORAGE_KEY = 'seiza-mitsuke-v1';

  // ---------------------------------------------------------------
  // 恒星カタログと星座の対応づけ
  // ---------------------------------------------------------------
  const raw = window.STAR_DATA;
  const catRa = [], catDec = [], catMag = [], catBv = [];
  for (let i = 0; i < raw.length; i += 4) {
    catRa.push(raw[i]); catDec.push(raw[i + 1]); catMag.push(raw[i + 2]); catBv.push(raw[i + 3]);
  }

  function angDist(ra1, dec1, ra2, dec2) {
    const c = Math.sin(dec1 * D2R) * Math.sin(dec2 * D2R)
      + Math.cos(dec1 * D2R) * Math.cos(dec2 * D2R) * Math.cos((ra1 - ra2) * D2R);
    return Math.acos(Math.max(-1, Math.min(1, c))) / D2R;
  }

  const CONS = window.CONSTELLATIONS;
  const starOwner = new Map(); // カタログ index -> 星座 id
  CONS.forEach((con) => {
    con.catIdx = con.stars.map((s) => {
      const ra = s.ra * 15;
      let best = -1, bestD = 0.6;
      for (let i = 0; i < catRa.length; i++) {
        if (Math.abs(catDec[i] - s.dec) > bestD) continue;
        const dd = angDist(ra, s.dec, catRa[i], catDec[i]);
        if (dd < bestD) { bestD = dd; best = i; }
      }
      if (best < 0) {
        catRa.push(ra); catDec.push(s.dec); catMag.push(s.mag); catBv.push(0.6);
        best = catRa.length - 1;
      }
      starOwner.set(best, con.id);
      return best;
    });
  });

  const N = catRa.length;
  const sinDec = new Float64Array(N), cosDec = new Float64Array(N);
  for (let i = 0; i < N; i++) { sinDec[i] = Math.sin(catDec[i] * D2R); cosDec[i] = Math.cos(catDec[i] * D2R); }
  const scrX = new Float32Array(N), scrY = new Float32Array(N), scrR = new Float32Array(N);
  const scrVis = new Uint8Array(N);
  const twinkle = new Float32Array(N);
  for (let i = 0; i < N; i++) twinkle[i] = Math.random() * Math.PI * 2;

  function bvColor(bv) {
    const stops = [
      [-0.3, [155, 180, 255]], [0.0, [200, 215, 255]], [0.4, [248, 247, 255]],
      [0.8, [255, 240, 205]], [1.2, [255, 210, 150]], [1.8, [255, 170, 110]],
    ];
    if (bv <= stops[0][0]) return stops[0][1];
    for (let i = 1; i < stops.length; i++) {
      if (bv <= stops[i][0]) {
        const [b0, c0] = stops[i - 1], [b1, c1] = stops[i];
        const t = (bv - b0) / (b1 - b0);
        return c0.map((c, k) => Math.round(c + (c1[k] - c) * t));
      }
    }
    return stops[stops.length - 1][1];
  }
  const starRGB = [];
  for (let i = 0; i < N; i++) starRGB.push(bvColor(catBv[i]).join(','));

  // ---------------------------------------------------------------
  // 状態
  // ---------------------------------------------------------------
  const state = {
    lat: DEFAULT_LOCATION.lat,
    lon: DEFAULT_LOCATION.lon,
    locLabel: DEFAULT_LOCATION.label,
    locStatus: '位置情報を取得しています…',
    timeOffset: 0, // 実時刻からのずれ (ms)。0 なら現在時刻
    view: { az: 180, alt: 40, fov: 90 },
    follow: false,
    device: null, // {az, alt} スマホの向き
    deviceSeen: false,
    difficulty: 'normal',
    screen: 'title', // title | play | solved | result
    rounds: [],
    roundIndex: 0,
    round: null,
    totalScore: 0,
    history: [],
    muted: false,
    effects: [],
    solvedCons: [], // このゲームで見つけた星座 (うっすら線を残す)
    hintArrowUntil: 0,
  };

  const saved = loadSave();
  state.difficulty = saved.difficulty || 'normal';
  state.muted = !!saved.muted;

  function loadSave() {
    try { return JSON.parse(localStorage.getItem(STORAGE_KEY)) || {}; } catch (e) { return {}; }
  }
  function writeSave(patch) {
    try {
      const cur = loadSave();
      localStorage.setItem(STORAGE_KEY, JSON.stringify(Object.assign(cur, patch)));
    } catch (e) { /* 保存できなくても遊べる */ }
  }

  const simNow = () => Date.now() + state.timeOffset;

  // ---------------------------------------------------------------
  // DOM
  // ---------------------------------------------------------------
  const $ = (id) => document.getElementById(id);
  const canvas = $('sky');
  const ctx = canvas.getContext('2d');
  let W = 0, H = 0, DPR = 1;

  function resize() {
    DPR = Math.min(window.devicePixelRatio || 1, 2);
    W = window.innerWidth; H = window.innerHeight;
    canvas.width = Math.round(W * DPR); canvas.height = Math.round(H * DPR);
    canvas.style.width = W + 'px'; canvas.style.height = H + 'px';
  }
  window.addEventListener('resize', resize);
  resize();

  // ---------------------------------------------------------------
  // 投影 (ステレオ投影, 視線方向を画面中央に)
  // ---------------------------------------------------------------
  const basis = { c: [0, 1, 0], u: [0, 0, 1], r: [1, 0, 0], S: 1, cx: 0, cy: 0 };

  function makeBasis(az, alt) {
    const a = alt * D2R, z = az * D2R;
    const c = [Math.cos(a) * Math.sin(z), Math.cos(a) * Math.cos(z), Math.sin(a)];
    const u = [-Math.sin(a) * Math.sin(z), -Math.sin(a) * Math.cos(z), Math.cos(a)];
    const r = [Math.cos(z), -Math.sin(z), 0];
    return { c, u, r };
  }

  function updateBasis() {
    const b = makeBasis(state.view.az, state.view.alt);
    basis.c = b.c; basis.u = b.u; basis.r = b.r;
    basis.S = (Math.max(W, H) / 2) / (2 * Math.tan((state.view.fov * D2R) / 4));
    basis.cx = W / 2; basis.cy = H / 2;
  }

  const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];

  // v: ENU ベクトル -> 画面座標
  function project(v, out) {
    const d = dot(v, basis.c);
    if (d < -0.5) return false;
    const k = 2 / (1 + d);
    out[0] = basis.cx + k * dot(v, basis.r) * basis.S;
    out[1] = basis.cy - k * dot(v, basis.u) * basis.S;
    return true;
  }

  // 天体の情報
  let sky = { lst: 0, jd: 0, sun: null, moon: null, planets: [] };

  function computeSky() {
    const jd = A.julianDate(simNow());
    const lst = A.localSiderealDeg(jd, state.lon);
    const ss = A.solarSystem(jd);
    const mn = A.moon(jd);
    const sunV = A.equToEnu(ss.sun.ra, ss.sun.dec, lst, state.lat);
    const moonV = A.equToEnu(mn.ra, mn.dec, lst, state.lat);
    // 月の視差 (地平に近いほど低く見える)
    const par = Math.asin(1 / mn.distEarthRadii);
    const mAlt = Math.asin(moonV[2]) - par * Math.cos(Math.asin(moonV[2]));
    const mAz = Math.atan2(moonV[0], moonV[1]);
    const moonTopo = [Math.cos(mAlt) * Math.sin(mAz), Math.cos(mAlt) * Math.cos(mAz), Math.sin(mAlt)];
    sky = {
      jd, lst,
      sun: { v: sunV, alt: Math.asin(sunV[2]) / D2R },
      moon: { v: moonTopo, alt: mAlt / D2R, elong: mn.elong },
      planets: ss.planets.map((p) => {
        const v = A.equToEnu(p.ra, p.dec, lst, state.lat);
        return Object.assign({ v, alt: Math.asin(v[2]) / D2R }, p);
      }),
    };
  }

  function starEnu(i, lst) {
    const H = (lst - catRa[i]) * D2R;
    const p = state.lat * D2R;
    const sp = Math.sin(p), cp = Math.cos(p);
    const sH = Math.sin(H), cH = Math.cos(H);
    return [-cosDec[i] * sH, cp * sinDec[i] - sp * cosDec[i] * cH, sp * sinDec[i] + cp * cosDec[i] * cH];
  }

  function conCenterEnu(con, lst) {
    const s = [0, 0, 0];
    con.catIdx.forEach((i) => { const v = starEnu(i, lst); s[0] += v[0]; s[1] += v[1]; s[2] += v[2]; });
    const l = Math.hypot(s[0], s[1], s[2]);
    return [s[0] / l, s[1] / l, s[2] / l];
  }

  function conMinAlt(con, lst) {
    let m = 90;
    con.catIdx.forEach((i) => { m = Math.min(m, Math.asin(starEnu(i, lst)[2]) / D2R); });
    return m;
  }

  // 今の時刻・場所で見える星座
  function visibleConstellations() {
    const jd = A.julianDate(simNow());
    const lst = A.localSiderealDeg(jd, state.lon);
    return CONS.filter((c) => conMinAlt(c, lst) > 5);
  }

  // ---------------------------------------------------------------
  // 描画
  // ---------------------------------------------------------------
  const tmp = [0, 0];

  function skyColors(sunAlt) {
    // 夜 -> 薄明 -> 昼
    const lerp = (a, b, t) => a.map((v, i) => Math.round(v + (b[i] - v) * t));
    const night = [[4, 8, 26], [14, 24, 56]];
    const twi = [[22, 36, 84], [92, 84, 130]];
    const day = [[34, 70, 124], [96, 140, 186]];
    let top, bot;
    if (sunAlt < -18) { [top, bot] = night; }
    else if (sunAlt < -6) { const t = (sunAlt + 18) / 12; top = lerp(night[0], twi[0], t); bot = lerp(night[1], twi[1], t); }
    else if (sunAlt < 2) { const t = (sunAlt + 6) / 8; top = lerp(twi[0], day[0], t); bot = lerp(twi[1], day[1], t); }
    else { [top, bot] = day; }
    return { top: `rgb(${top})`, bot: `rgb(${bot})` };
  }

  function starRadius(mag, limit) {
    const zoom = Math.pow(90 / state.view.fov, 0.35);
    return Math.max(0.55, Math.min(4.6, (0.65 + (limit - mag) * 0.62) * zoom));
  }

  function render(t) {
    updateBasis();
    computeSky();
    const diff = DIFFICULTY[state.difficulty];
    const limit = diff.magLimit;
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);

    const sunAlt = sky.sun.alt;
    const col = skyColors(sunAlt);
    const g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, col.top); g.addColorStop(1, col.bot);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);
    const dayDim = sunAlt > -6 ? 0.9 : 1;

    // 恒星
    const lst = sky.lst;
    const p = state.lat * D2R;
    const sp = Math.sin(p), cp = Math.cos(p);
    const c = basis.c, u = basis.u, r = basis.r, S = basis.S, cx = basis.cx, cy = basis.cy;
    const v = [0, 0, 0];
    for (let i = 0; i < N; i++) {
      scrVis[i] = 0;
      if (catMag[i] > limit && !starOwner.has(i)) continue;
      const Hh = (lst - catRa[i]) * D2R;
      const sH = Math.sin(Hh), cH = Math.cos(Hh);
      v[0] = -cosDec[i] * sH;
      v[1] = cp * sinDec[i] - sp * cosDec[i] * cH;
      v[2] = sp * sinDec[i] + cp * cosDec[i] * cH;
      if (v[2] < -0.02) continue;
      const d = v[0] * c[0] + v[1] * c[1] + v[2] * c[2];
      if (d < -0.5) continue;
      const k = 2 / (1 + d);
      const x = cx + k * (v[0] * r[0] + v[1] * r[1] + v[2] * r[2]) * S;
      const y = cy - k * (v[0] * u[0] + v[1] * u[1] + v[2] * u[2]) * S;
      if (x < -20 || x > W + 20 || y < -20 || y > H + 20) continue;
      const mag = Math.min(catMag[i], limit);
      const rad = starRadius(mag, limit);
      scrX[i] = x; scrY[i] = y; scrR[i] = rad; scrVis[i] = 1;
      let alpha = mag < 3 ? 0.85 + 0.15 * Math.sin(t / 400 + twinkle[i]) : 0.75;
      alpha *= dayDim;
      // 地平線近くは減光
      if (v[2] < 0.08) alpha *= 0.4 + 0.6 * Math.max(0, v[2] / 0.08);
      if (rad > 2.2) {
        ctx.fillStyle = `rgba(${starRGB[i]},${alpha * 0.18})`;
        ctx.beginPath(); ctx.arc(x, y, rad * 2.6, 0, Math.PI * 2); ctx.fill();
      }
      ctx.fillStyle = `rgba(${starRGB[i]},${alpha})`;
      if (rad < 1.1) {
        ctx.fillRect(x - rad, y - rad, rad * 2, rad * 2);
      } else {
        ctx.beginPath(); ctx.arc(x, y, rad, 0, Math.PI * 2); ctx.fill();
      }
    }

    drawSolvedConstellations();
    drawRoundLines(t);
    drawSolarSystem();
    drawGround();
    drawEffects(t);
    drawHintArrow(t);
  }

  function lineBetween(i, j) {
    ctx.beginPath();
    ctx.moveTo(scrX[i], scrY[i]);
    ctx.lineTo(scrX[j], scrY[j]);
    ctx.stroke();
  }

  function drawSolvedConstellations() {
    ctx.lineWidth = 1.2;
    ctx.strokeStyle = 'rgba(255, 214, 120, 0.35)';
    state.solvedCons.forEach((con) => {
      con.lines.forEach(([a, b]) => {
        const i = con.catIdx[a], j = con.catIdx[b];
        if (scrVis[i] && scrVis[j]) lineBetween(i, j);
      });
    });
  }

  function drawRoundLines(t) {
    const rd = state.round;
    if (!rd) return;
    ctx.lineCap = 'round';
    // なぞった線
    ctx.lineWidth = 2.4;
    ctx.strokeStyle = 'rgba(120, 220, 255, 0.85)';
    ctx.shadowColor = 'rgba(120, 220, 255, 0.8)';
    ctx.shadowBlur = 8;
    rd.segments.forEach(([i, j]) => { if (scrVis[i] && scrVis[j]) lineBetween(i, j); });
    // 指からのびる線
    if (pointer.mode === 'trace' && pointer.lastStar >= 0 && scrVis[pointer.lastStar]) {
      ctx.strokeStyle = 'rgba(120, 220, 255, 0.45)';
      ctx.setLineDash([6, 6]);
      ctx.beginPath();
      ctx.moveTo(scrX[pointer.lastStar], scrY[pointer.lastStar]);
      ctx.lineTo(pointer.x, pointer.y);
      ctx.stroke();
      ctx.setLineDash([]);
    }
    ctx.shadowBlur = 0;
    // 見つけた星
    rd.found.forEach((i) => {
      if (!scrVis[i]) return;
      ctx.strokeStyle = 'rgba(140, 230, 255, 0.95)';
      ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(scrX[i], scrY[i], 9 + Math.sin(t / 250) * 1.5, 0, Math.PI * 2); ctx.stroke();
    });
    // 正解したら星座線をアニメーション表示
    if (rd.solvedAt) {
      const prog = Math.min(1, (performance.now() - rd.solvedAt) / 1200);
      const con = rd.con;
      ctx.strokeStyle = 'rgba(255, 214, 120, 0.95)';
      ctx.shadowColor = 'rgba(255, 200, 90, 0.9)';
      ctx.shadowBlur = 12;
      ctx.lineWidth = 2.6;
      const n = con.lines.length;
      con.lines.forEach(([a, b], k) => {
        const i = con.catIdx[a], j = con.catIdx[b];
        if (!scrVis[i] || !scrVis[j]) return;
        const local = Math.max(0, Math.min(1, prog * n - k * 0.6));
        if (local <= 0) return;
        ctx.beginPath();
        ctx.moveTo(scrX[i], scrY[i]);
        ctx.lineTo(scrX[i] + (scrX[j] - scrX[i]) * local, scrY[i] + (scrY[j] - scrY[i]) * local);
        ctx.stroke();
      });
      ctx.shadowBlur = 0;
      // 星の名前
      if (prog >= 1) {
        ctx.font = '11px sans-serif';
        ctx.fillStyle = 'rgba(255, 236, 190, 0.9)';
        ctx.textAlign = 'left';
        con.catIdx.forEach((i, k) => {
          if (scrVis[i] && con.stars[k].mag < 2.6) ctx.fillText(con.stars[k].name, scrX[i] + 8, scrY[i] - 6);
        });
      }
    }
  }

  function drawLabel(text, x, y, color) {
    ctx.font = 'bold 12px sans-serif';
    ctx.textAlign = 'left';
    ctx.fillStyle = 'rgba(0,0,0,0.5)';
    ctx.fillText(text, x + 1, y + 1);
    ctx.fillStyle = color;
    ctx.fillText(text, x, y);
  }

  function drawSolarSystem() {
    const pt = [0, 0];
    const degPx = (deg) => basis.S * deg * D2R;
    // 惑星
    sky.planets.forEach((pl) => {
      if (pl.alt < -0.5 || !project(pl.v, pt)) return;
      ctx.fillStyle = pl.color;
      ctx.shadowColor = pl.color; ctx.shadowBlur = 10;
      ctx.beginPath(); ctx.arc(pt[0], pt[1], pl.size, 0, Math.PI * 2); ctx.fill();
      ctx.shadowBlur = 0;
      drawLabel(pl.name, pt[0] + pl.size + 4, pt[1] + 4, '#ffd9a8');
    });
    // 太陽
    if (sky.sun.alt > -1 && project(sky.sun.v, pt)) {
      const rad = Math.max(12, degPx(0.27));
      const sg = ctx.createRadialGradient(pt[0], pt[1], rad * 0.3, pt[0], pt[1], rad * 3);
      sg.addColorStop(0, 'rgba(255,250,220,1)');
      sg.addColorStop(0.35, 'rgba(255,230,140,0.6)');
      sg.addColorStop(1, 'rgba(255,220,120,0)');
      ctx.fillStyle = sg;
      ctx.beginPath(); ctx.arc(pt[0], pt[1], rad * 3, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#fffbe6';
      ctx.beginPath(); ctx.arc(pt[0], pt[1], rad, 0, Math.PI * 2); ctx.fill();
      drawLabel('太陽', pt[0] + rad + 4, pt[1] + 4, '#fff2b0');
    }
    // 月 (満ち欠けつき)
    if (sky.moon.alt > -1 && project(sky.moon.v, pt)) {
      const rad = Math.max(10, degPx(0.26));
      // 太陽の方向 (画面上)
      const sv = sky.sun.v, mv = sky.moon.v;
      const toward = [mv[0] + sv[0] * 0.02, mv[1] + sv[1] * 0.02, mv[2] + sv[2] * 0.02];
      const l = Math.hypot(toward[0], toward[1], toward[2]);
      const p2 = [0, 0];
      let ang = 0;
      if (project([toward[0] / l, toward[1] / l, toward[2] / l], p2)) ang = Math.atan2(p2[1] - pt[1], p2[0] - pt[0]);
      const phase = (1 - Math.cos(sky.moon.elong * D2R)) / 2; // 輝面比
      ctx.save();
      ctx.translate(pt[0], pt[1]);
      ctx.rotate(ang);
      ctx.fillStyle = 'rgba(40,44,60,0.85)';
      ctx.beginPath(); ctx.arc(0, 0, rad, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#f4f1dc';
      ctx.shadowColor = '#f4f1dc'; ctx.shadowBlur = 14;
      ctx.beginPath();
      ctx.arc(0, 0, rad, -Math.PI / 2, Math.PI / 2, false); // 太陽側の半円
      const ex = rad * Math.abs(1 - 2 * phase);
      ctx.ellipse(0, 0, ex, rad, 0, Math.PI / 2, -Math.PI / 2, phase < 0.5);
      ctx.fill();
      ctx.restore();
      drawLabel('月', pt[0] + rad + 4, pt[1] + 4, '#f4f1dc');
    }
  }

  function drawGround() {
    const alt0 = state.view.alt;
    const az0 = state.view.az;
    const p1 = [0, 0], p2 = [0, 0], p3 = [0, 0];
    project(A.altAzToEnu(0, az0), p2);
    project(A.altAzToEnu(0, az0 - 90), p1);
    project(A.altAzToEnu(0, az0 + 90), p3);
    ctx.save();
    const ground = ctx.createLinearGradient(0, p2[1], 0, Math.max(p2[1] + 1, H));
    ground.addColorStop(0, 'rgba(18, 32, 26, 0.97)');
    ground.addColorStop(1, 'rgba(6, 12, 10, 1)');
    ctx.fillStyle = ground;
    ctx.beginPath();
    // 3点を通る円を求める
    const ax = p1[0], ay = p1[1], bx = p2[0], by = p2[1], cxp = p3[0], cyp = p3[1];
    const dd = 2 * (ax * (by - cyp) + bx * (cyp - ay) + cxp * (ay - by));
    let ok = false;
    if (Math.abs(alt0) > 0.3 && Math.abs(dd) > 1e-6) {
      const ux = ((ax * ax + ay * ay) * (by - cyp) + (bx * bx + by * by) * (cyp - ay) + (cxp * cxp + cyp * cyp) * (ay - by)) / dd;
      const uy = ((ax * ax + ay * ay) * (cxp - bx) + (bx * bx + by * by) * (ax - cxp) + (cxp * cxp + cyp * cyp) * (bx - ax)) / dd;
      const R = Math.hypot(ax - ux, ay - uy);
      if (R < 60000) {
        ok = true;
        const centerInside = Math.hypot(basis.cx - ux, basis.cy - uy) < R;
        if (alt0 > 0 === centerInside) {
          // 画面中央 (空) が円の内側 -> 地面は円の外側
          ctx.rect(-10, -10, W + 20, H + 20);
          ctx.moveTo(ux + R, uy);
          ctx.arc(ux, uy, R, 0, Math.PI * 2, true);
          ctx.fill('evenodd');
        } else {
          ctx.arc(ux, uy, R, 0, Math.PI * 2);
          ctx.fill();
        }
      }
    }
    if (!ok) {
      // ほぼ直線
      let tx = p3[0] - p1[0], ty = p3[1] - p1[1];
      const l = Math.hypot(tx, ty) || 1; tx /= l; ty /= l;
      let nx = -ty, ny = tx;
      if (ny < 0) { nx = -nx; ny = -ny; }
      const F = 1e5;
      ctx.moveTo(p1[0] - tx * F, p1[1] - ty * F);
      ctx.lineTo(p3[0] + tx * F, p3[1] + ty * F);
      ctx.lineTo(p3[0] + tx * F + nx * F, p3[1] + ty * F + ny * F);
      ctx.lineTo(p1[0] - tx * F + nx * F, p1[1] - ty * F + ny * F);
      ctx.closePath();
      ctx.fill();
    }
    ctx.restore();

    // 方角ラベル
    const labels = ['北', '北東', '東', '南東', '南', '南西', '西', '北西'];
    ctx.textAlign = 'center';
    labels.forEach((lb, k) => {
      const v = A.altAzToEnu(0, k * 45);
      if (dot(v, basis.c) < 0.05) return;
      const pt = [0, 0];
      if (!project(v, pt)) return;
      if (pt[0] < -30 || pt[0] > W + 30 || pt[1] < -30 || pt[1] > H + 30) return;
      ctx.font = k % 2 === 0 ? 'bold 16px sans-serif' : '13px sans-serif';
      ctx.fillStyle = k === 0 ? '#ff8f8f' : 'rgba(220, 235, 255, 0.85)';
      ctx.fillText(lb, pt[0], pt[1] + 22);
      ctx.fillRect(pt[0] - 0.5, pt[1], 1, 8);
    });
  }

  function drawEffects(t) {
    const now = performance.now();
    state.effects = state.effects.filter((e) => now - e.t < e.dur);
    state.effects.forEach((e) => {
      const k = (now - e.t) / e.dur;
      if (!scrVis[e.idx]) return;
      const x = scrX[e.idx], y = scrY[e.idx];
      if (e.kind === 'miss') {
        ctx.strokeStyle = `rgba(255, 90, 90, ${1 - k})`;
        ctx.lineWidth = 2.5;
        ctx.beginPath(); ctx.arc(x, y, 8 + k * 14, 0, Math.PI * 2); ctx.stroke();
      } else if (e.kind === 'hit') {
        ctx.strokeStyle = `rgba(140, 240, 255, ${1 - k})`;
        ctx.lineWidth = 3;
        ctx.beginPath(); ctx.arc(x, y, 8 + k * 26, 0, Math.PI * 2); ctx.stroke();
      } else if (e.kind === 'hint') {
        const a = 0.5 + 0.5 * Math.sin(k * Math.PI * 8);
        ctx.strokeStyle = `rgba(255, 230, 120, ${a})`;
        ctx.lineWidth = 3;
        ctx.beginPath(); ctx.arc(x, y, 16, 0, Math.PI * 2); ctx.stroke();
      }
    });
  }

  function drawHintArrow(t) {
    const rd = state.round;
    if (!rd || rd.solvedAt || performance.now() > state.hintArrowUntil) return;
    const v = conCenterEnu(rd.con, sky.lst);
    const pt = [0, 0];
    const vis = project(v, pt) && pt[0] > 40 && pt[0] < W - 40 && pt[1] > 90 && pt[1] < H - 90;
    if (vis) return;
    const ang = Math.atan2(-dot(v, basis.u), dot(v, basis.r));
    const R = Math.min(W, H) * 0.32;
    const x = W / 2 + Math.cos(ang) * R, y = H / 2 + Math.sin(ang) * R;
    ctx.save();
    ctx.translate(x, y); ctx.rotate(ang);
    ctx.globalAlpha = 0.6 + 0.4 * Math.sin(t / 150);
    ctx.fillStyle = '#ffe27a';
    ctx.beginPath(); ctx.moveTo(26, 0); ctx.lineTo(-10, -16); ctx.lineTo(-2, 0); ctx.lineTo(-10, 16); ctx.closePath(); ctx.fill();
    ctx.restore();
  }

  // ---------------------------------------------------------------
  // 星座の形 (サムネイル)
  // ---------------------------------------------------------------
  // mode 'sky': 今の空での見え方 (天頂が上) / 'chart': 星図 (天の北極が上)
  function drawShape(cv, con, mode, opts) {
    opts = opts || {};
    const c2 = cv.getContext('2d');
    const w = cv.width, h = cv.height;
    c2.clearRect(0, 0, w, h);
    let vecs, cvec, up;
    if (mode === 'sky') {
      vecs = con.catIdx.map((i) => starEnu(i, sky.lst || A.localSiderealDeg(A.julianDate(simNow()), state.lon)));
      up = [0, 0, 1];
    } else {
      vecs = con.catIdx.map((i) => [cosDec[i] * Math.cos(catRa[i] * D2R), cosDec[i] * Math.sin(catRa[i] * D2R), sinDec[i]]);
      up = [0, 0, 1];
    }
    cvec = [0, 0, 0];
    vecs.forEach((v) => { cvec[0] += v[0]; cvec[1] += v[1]; cvec[2] += v[2]; });
    const l = Math.hypot(cvec[0], cvec[1], cvec[2]);
    cvec = cvec.map((x) => x / l);
    let uu = [up[0] - dot(up, cvec) * cvec[0], up[1] - dot(up, cvec) * cvec[1], up[2] - dot(up, cvec) * cvec[2]];
    const ul = Math.hypot(uu[0], uu[1], uu[2]) || 1;
    uu = uu.map((x) => x / ul);
    const rr = [cvec[1] * uu[2] - cvec[2] * uu[1], cvec[2] * uu[0] - cvec[0] * uu[2], cvec[0] * uu[1] - cvec[1] * uu[0]];
    const pts = vecs.map((v) => {
      const d = dot(v, cvec), k = 2 / (1 + d);
      return [k * dot(v, rr), -k * dot(v, uu)];
    });
    const xs = pts.map((p) => p[0]), ys = pts.map((p) => p[1]);
    const minX = Math.min(...xs), maxX = Math.max(...xs), minY = Math.min(...ys), maxY = Math.max(...ys);
    const pad = opts.pad || w * 0.14;
    const sc = Math.min((w - pad * 2) / Math.max(maxX - minX, 1e-6), (h - pad * 2) / Math.max(maxY - minY, 1e-6));
    const ox = w / 2 - ((minX + maxX) / 2) * sc, oy = h / 2 - ((minY + maxY) / 2) * sc;
    const P = pts.map((p) => [ox + p[0] * sc, oy + p[1] * sc]);
    if (opts.lines !== false) {
      c2.strokeStyle = opts.lineColor || 'rgba(140, 210, 255, 0.75)';
      c2.lineWidth = Math.max(1, w / 90);
      c2.lineCap = 'round';
      con.lines.forEach(([a, b]) => {
        c2.beginPath(); c2.moveTo(P[a][0], P[a][1]); c2.lineTo(P[b][0], P[b][1]); c2.stroke();
      });
    }
    con.stars.forEach((s, k) => {
      const rad = Math.max(1.4, (w / 70) * (1 + (3.5 - Math.min(s.mag, 4.5)) * 0.35));
      c2.fillStyle = opts.starColor || '#fff';
      c2.beginPath(); c2.arc(P[k][0], P[k][1], rad, 0, Math.PI * 2); c2.fill();
    });
  }

  // ---------------------------------------------------------------
  // 入力 (なぞる / ドラッグで見回す / ピンチで拡大)
  // ---------------------------------------------------------------
  const pointer = { mode: null, id: null, x: 0, y: 0, lastX: 0, lastY: 0, lastStar: -1, missed: new Set() };
  const activePointers = new Map();
  let pinchStart = null;

  function hitTest(x, y, strict) {
    const rd = state.round;
    let bestT = -1, bestTD = 26;
    let bestO = -1, bestOD = 1e9;
    for (let i = 0; i < N; i++) {
      if (!scrVis[i]) continue;
      const dx = scrX[i] - x, dy = scrY[i] - y;
      if (Math.abs(dx) > 30 || Math.abs(dy) > 30) continue;
      const dist = Math.hypot(dx, dy);
      if (rd && rd.targetSet.has(i)) {
        if (dist < bestTD) { bestTD = dist; bestT = i; }
      } else {
        const lim = strict ? 6 : 7 + scrR[i] * 1.5;
        if (dist < lim && dist < bestOD) { bestOD = dist; bestO = i; }
      }
    }
    if (bestT >= 0) return bestT;
    return bestO;
  }

  function touchStar(i) {
    const rd = state.round;
    if (!rd || rd.solvedAt || i < 0) return;
    if (i === pointer.lastStar) return;
    if (rd.targetSet.has(i)) {
      const isNew = !rd.found.has(i);
      if (isNew) {
        rd.found.add(i);
        state.effects.push({ idx: i, kind: 'hit', t: performance.now(), dur: 600 });
        sound.note(rd.found.size);
      }
      const prev = pointer.lastStar;
      if (prev >= 0 && prev !== i) {
        const key = prev < i ? prev + '-' + i : i + '-' + prev;
        if (!rd.segKeys.has(key)) { rd.segKeys.add(key); rd.segments.push([prev, i]); }
      }
      pointer.lastStar = i;
      updateTask();
      if (rd.found.size === rd.targetSet.size) solveRound();
    } else if (!pointer.missed.has(i)) {
      pointer.missed.add(i);
      rd.misses++;
      state.effects.push({ idx: i, kind: 'miss', t: performance.now(), dur: 500 });
      sound.miss();
      updateTask();
    }
  }

  function traceAlong(x0, y0, x1, y1) {
    const dist = Math.hypot(x1 - x0, y1 - y0);
    const steps = Math.max(1, Math.ceil(dist / 5));
    for (let s = 1; s <= steps; s++) {
      const x = x0 + ((x1 - x0) * s) / steps, y = y0 + ((y1 - y0) * s) / steps;
      const i = hitTest(x, y);
      if (i >= 0) touchStar(i);
    }
  }

  function degPerPx() {
    return state.view.fov / Math.max(W, H);
  }

  canvas.addEventListener('pointerdown', (e) => {
    canvas.setPointerCapture(e.pointerId);
    activePointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (activePointers.size === 2) {
      const [a, b] = [...activePointers.values()];
      pinchStart = { d: Math.hypot(a.x - b.x, a.y - b.y), fov: state.view.fov };
      pointer.mode = 'pinch';
      pointer.lastStar = -1;
      return;
    }
    pointer.id = e.pointerId;
    pointer.x = pointer.lastX = e.clientX;
    pointer.y = pointer.lastY = e.clientY;
    pointer.missed = new Set();
    pointer.lastStar = -1;
    // なぞり始めは星の近く、それ以外のドラッグは見回し
    const hit = state.screen === 'play' ? hitTest(e.clientX, e.clientY, true) : -1;
    if (hit >= 0) {
      pointer.mode = 'trace';
      touchStar(hit);
    } else {
      pointer.mode = 'pan';
    }
  });

  canvas.addEventListener('pointermove', (e) => {
    if (activePointers.has(e.pointerId)) activePointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pointer.mode === 'pinch' && activePointers.size >= 2 && pinchStart) {
      const [a, b] = [...activePointers.values()];
      const d = Math.hypot(a.x - b.x, a.y - b.y);
      setFov(pinchStart.fov * (pinchStart.d / Math.max(d, 1)));
      return;
    }
    if (e.pointerId !== pointer.id) return;
    const x = e.clientX, y = e.clientY;
    if (pointer.mode === 'trace') {
      traceAlong(pointer.x, pointer.y, x, y);
    } else if (pointer.mode === 'pan') {
      const k = degPerPx();
      setFollow(false);
      state.view.az = A.norm360(state.view.az - (x - pointer.x) * k);
      state.view.alt = Math.max(-10, Math.min(85, state.view.alt + (y - pointer.y) * k));
    }
    pointer.x = x; pointer.y = y;
  });

  function endPointer(e) {
    activePointers.delete(e.pointerId);
    if (activePointers.size < 2) pinchStart = null;
    if (e.pointerId === pointer.id || activePointers.size === 0) {
      pointer.mode = null; pointer.id = null; pointer.lastStar = -1;
    }
  }
  canvas.addEventListener('pointerup', endPointer);
  canvas.addEventListener('pointercancel', endPointer);

  canvas.addEventListener('wheel', (e) => {
    e.preventDefault();
    setFov(state.view.fov * Math.exp(e.deltaY * 0.0012));
  }, { passive: false });

  window.addEventListener('keydown', (e) => {
    const step = 5;
    if (e.key === 'ArrowLeft') { setFollow(false); state.view.az = A.norm360(state.view.az - step); }
    else if (e.key === 'ArrowRight') { setFollow(false); state.view.az = A.norm360(state.view.az + step); }
    else if (e.key === 'ArrowUp') { setFollow(false); state.view.alt = Math.min(85, state.view.alt + step); }
    else if (e.key === 'ArrowDown') { setFollow(false); state.view.alt = Math.max(-10, state.view.alt - step); }
    else if (e.key === '+' || e.key === '=') setFov(state.view.fov / 1.15);
    else if (e.key === '-') setFov(state.view.fov * 1.15);
  });

  function setFov(f) {
    state.view.fov = Math.max(25, Math.min(150, f));
  }

  // ---------------------------------------------------------------
  // スマホの向き (コンパス + 傾き)
  // ---------------------------------------------------------------
  let iosHeadingOffset = null;

  function onOrientation(e, absolute) {
    if (e.alpha == null || e.beta == null || e.gamma == null) return;
    let alpha = e.alpha;
    if (typeof e.webkitCompassHeading === 'number' && !isNaN(e.webkitCompassHeading)) {
      // iOS: alpha は相対値なので、コンパス方位との差でそろえる
      const off = A.norm360(360 - e.webkitCompassHeading - e.alpha);
      iosHeadingOffset = iosHeadingOffset == null ? off : iosHeadingOffset + angleDiff(off, iosHeadingOffset) * 0.1;
      alpha = e.alpha + iosHeadingOffset;
    } else if (!absolute && !e.absolute) {
      return; // 方位がわからない
    }
    const a = alpha * D2R, b = e.beta * D2R, g = e.gamma * D2R;
    const cA = Math.cos(a), sA = Math.sin(a), cB = Math.cos(b), sB = Math.sin(b), cG = Math.cos(g), sG = Math.sin(g);
    // 端末の背面 (カメラ側) が向いている方向
    const back = [-(cA * sG + cG * sA * sB), -(sA * sG - cA * cG * sB), -(cB * cG)];
    const aa = A.enuToAltAz(back);
    const first = !state.deviceSeen;
    state.device = { az: aa.az, alt: aa.alt };
    state.deviceSeen = true;
    if (first) {
      // 最初は端末の向いている方角をデフォルトにする
      state.view.az = aa.az;
      state.view.alt = Math.max(-10, Math.min(85, aa.alt));
      setFollow(true);
      $('btnFollow').hidden = false;
    }
  }

  function angleDiff(a, b) {
    return ((a - b + 540) % 360) - 180;
  }

  function setupOrientation() {
    if ('ondeviceorientationabsolute' in window) {
      window.addEventListener('deviceorientationabsolute', (e) => onOrientation(e, true));
    } else {
      window.addEventListener('deviceorientation', (e) => onOrientation(e, false));
    }
  }

  async function requestOrientationPermission() {
    try {
      if (typeof DeviceOrientationEvent !== 'undefined' && typeof DeviceOrientationEvent.requestPermission === 'function') {
        const res = await DeviceOrientationEvent.requestPermission();
        if (res !== 'granted') return;
      }
    } catch (e) { /* 拒否されても手動で遊べる */ }
  }

  function setFollow(on) {
    state.follow = on && state.deviceSeen;
    $('btnFollow').classList.toggle('active', state.follow);
  }

  function updateFollow() {
    if (!state.follow || !state.device || pointer.mode) return;
    const k = 0.15;
    state.view.az = A.norm360(state.view.az + angleDiff(state.device.az, state.view.az) * k);
    const targetAlt = Math.max(-10, Math.min(85, state.device.alt));
    state.view.alt += (targetAlt - state.view.alt) * k;
  }

  // ---------------------------------------------------------------
  // 位置情報
  // ---------------------------------------------------------------
  function requestLocation() {
    if (!navigator.geolocation) {
      state.locStatus = 'この端末では位置情報が使えないため、東京の空を表示しています';
      refreshTitle();
      return;
    }
    state.locStatus = '位置情報を取得しています…';
    refreshTitle();
    navigator.geolocation.getCurrentPosition((pos) => {
      setLocation(pos.coords.latitude, pos.coords.longitude, '現在地');
      state.locStatus = '現在地の空を表示しています';
      refreshTitle();
    }, () => {
      state.locStatus = '位置情報を取得できなかったため、東京の空を表示しています（⚙で変更できます）';
      refreshTitle();
    }, { enableHighAccuracy: false, timeout: 10000, maximumAge: 600000 });
  }

  function setLocation(lat, lon, label) {
    state.lat = Math.max(-89.9, Math.min(89.9, lat));
    state.lon = ((lon + 540) % 360) - 180;
    state.locLabel = label;
    writeSave({ loc: { lat: state.lat, lon: state.lon, label } });
  }

  // ---------------------------------------------------------------
  // ゲーム進行
  // ---------------------------------------------------------------
  function shuffle(arr) {
    const a = arr.slice();
    for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
    return a;
  }

  function startGame() {
    computeSky();
    const vis = visibleConstellations();
    if (vis.length === 0) {
      $('titleMsg').textContent = 'いまの時刻・場所では地平線の上に出ている星座がありません。⚙ で時刻を変えてみてください。';
      return;
    }
    state.rounds = shuffle(vis).slice(0, MAX_ROUNDS);
    state.roundIndex = 0;
    state.totalScore = 0;
    state.history = [];
    state.solvedCons = [];
    showOverlay(null);
    state.screen = 'play';
    document.body.classList.add('playing');
    startRound();
  }

  function startRound() {
    const con = state.rounds[state.roundIndex];
    state.round = {
      con,
      targetSet: new Set(con.catIdx),
      found: new Set(),
      segments: [],
      segKeys: new Set(),
      misses: 0,
      hints: 0,
      startTime: performance.now(),
      solvedAt: 0,
      gaveUp: false,
    };
    state.screen = 'play';
    state.hintArrowUntil = 0;
    $('taskName').textContent = con.name;
    const diff = DIFFICULTY[state.difficulty];
    const thumb = $('thumb');
    thumb.hidden = !diff.showShape;
    if (diff.showShape) drawShape(thumb, con, 'sky', { lines: diff.showLines });
    updateTask();
  }

  function elapsedSec() {
    const rd = state.round;
    if (!rd) return 0;
    const end = rd.solvedAt || performance.now();
    return (end - rd.startTime) / 1000;
  }

  function roundScore(rd) {
    if (rd.gaveUp) return 0;
    const t = elapsedSec();
    const base = 1000;
    const timePenalty = Math.min(500, Math.floor(t * 4));
    return Math.max(100, base - timePenalty - rd.misses * 30 - rd.hints * 150);
  }

  function solveRound(gaveUp) {
    const rd = state.round;
    rd.solvedAt = performance.now();
    rd.gaveUp = !!gaveUp;
    if (gaveUp) {
      // 答えを見せる: 見回して星座を画面中央に
      rd.con.catIdx.forEach((i) => rd.found.add(i));
    } else {
      sound.fanfare();
    }
    const score = roundScore(rd);
    state.totalScore += score;
    state.history.push({ con: rd.con, score, time: elapsedSec(), misses: rd.misses, hints: rd.hints, gaveUp: rd.gaveUp });
    state.solvedCons.push(rd.con);
    pointer.mode = null; pointer.lastStar = -1;
    if (!gaveUp) {
      const zukan = loadSave().zukan || {};
      zukan[rd.con.id] = (zukan[rd.con.id] || 0) + 1;
      writeSave({ zukan });
    }
    centerOn(rd.con);
    updateTask();
    setTimeout(() => showSolvedCard(score), gaveUp ? 900 : 1500);
  }

  function centerOn(con) {
    const v = conCenterEnu(con, sky.lst);
    const aa = A.enuToAltAz(v);
    setFollow(false);
    // 正解カードに隠れないよう、星座が画面の上寄りに来るようにする
    const shift = (state.view.fov * H / Math.max(W, H)) * 0.2;
    animateView(aa.az, Math.max(-10, Math.min(80, aa.alt - shift)));
  }

  let viewAnim = null;
  function animateView(az, alt) {
    viewAnim = { fromAz: state.view.az, fromAlt: state.view.alt, toAz: az, toAlt: alt, t0: performance.now(), dur: 700 };
  }
  function updateViewAnim() {
    if (!viewAnim) return;
    const k = Math.min(1, (performance.now() - viewAnim.t0) / viewAnim.dur);
    const e = 1 - Math.pow(1 - k, 3);
    state.view.az = A.norm360(viewAnim.fromAz + angleDiff(viewAnim.toAz, viewAnim.fromAz) * e);
    state.view.alt = viewAnim.fromAlt + (viewAnim.toAlt - viewAnim.fromAlt) * e;
    if (k >= 1) viewAnim = null;
  }

  function positionText(con) {
    const v = conCenterEnu(con, sky.lst);
    const aa = A.enuToAltAz(v);
    return `${A.dirName(aa.az)}の空・高さ ${Math.round(aa.alt)}°`;
  }

  function showSolvedCard(score) {
    const rd = state.round;
    const con = rd.con;
    state.screen = 'solved';
    $('solvedTitle').textContent = rd.gaveUp ? 'こたえ' : 'みつけた！';
    $('solvedName').textContent = con.name;
    $('solvedMeta').textContent = `${con.season}の星座 ・ いま ${positionText(con)}`;
    $('solvedDesc').textContent = con.desc;
    const bright = con.stars.filter((s) => s.mag < 2.6).map((s) => s.name);
    $('solvedStars').textContent = bright.length ? `明るい星: ${bright.join('、')}` : '';
    $('solvedScore').textContent = rd.gaveUp
      ? '0 点'
      : `${score} 点（${Math.round(elapsedSec())}秒・ミス${rd.misses}・ヒント${rd.hints}）`;
    drawShape($('solvedShape'), con, 'sky', { lineColor: 'rgba(255, 214, 120, 0.9)' });
    $('btnNext').textContent = state.roundIndex + 1 < state.rounds.length ? 'つぎの星座へ' : '結果を見る';
    showOverlay('solved');
  }

  function nextRound() {
    state.roundIndex++;
    if (state.roundIndex < state.rounds.length) {
      showOverlay(null);
      startRound();
    } else {
      showResult();
    }
  }

  function showResult() {
    state.screen = 'result';
    state.round = null;
    document.body.classList.remove('playing');
    const best = loadSave().best || 0;
    const isBest = state.totalScore > best;
    if (isBest) writeSave({ best: state.totalScore });
    $('resultScore').textContent = `${state.totalScore} 点`;
    $('resultBest').textContent = isBest ? '🎉 自己ベスト更新！' : `自己ベスト: ${best} 点`;
    const list = $('resultList');
    list.innerHTML = '';
    state.history.forEach((h) => {
      const li = document.createElement('li');
      li.innerHTML = `<span>${h.con.name}</span><span>${h.gaveUp ? 'ギブアップ' : h.score + '点'}</span>`;
      list.appendChild(li);
    });
    showOverlay('result');
  }

  function useHint() {
    const rd = state.round;
    if (!rd || rd.solvedAt) return;
    rd.hints++;
    // 画面の外なら矢印で方向を教える
    state.hintArrowUntil = performance.now() + 3500;
    // まだ見つけていない星を1つ光らせる (いちばん明るい星から)
    const rest = rd.con.catIdx.filter((i) => !rd.found.has(i)).sort((a, b) => catMag[a] - catMag[b]);
    if (rest.length) state.effects.push({ idx: rest[0], kind: 'hint', t: performance.now(), dur: 3000 });
    updateTask();
  }

  function giveUp() {
    const rd = state.round;
    if (!rd || rd.solvedAt) return;
    solveRound(true);
  }

  function quitToTitle() {
    state.round = null;
    state.screen = 'title';
    document.body.classList.remove('playing');
    refreshTitle();
    showOverlay('title');
  }

  // ---------------------------------------------------------------
  // HUD
  // ---------------------------------------------------------------
  function updateTask() {
    const rd = state.round;
    if (!rd) return;
    $('taskProgress').textContent = `${rd.found.size} / ${rd.targetSet.size} 個`;
    $('roundLabel').textContent = `${state.roundIndex + 1} / ${state.rounds.length} 問`;
    $('scoreLabel').textContent = `${state.totalScore} 点`;
    $('missLabel').textContent = rd.misses ? `ミス ${rd.misses}` : '';
  }

  function fmtTime(ms) {
    const d = new Date(ms);
    const p = (n) => String(n).padStart(2, '0');
    return `${d.getFullYear()}/${p(d.getMonth() + 1)}/${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`;
  }

  let lastHud = 0;
  function updateHud(now) {
    if (now - lastHud < 200) return;
    lastHud = now;
    const t = elapsedSec();
    $('timerLabel').textContent = state.round ? `${Math.floor(t / 60)}:${String(Math.floor(t % 60)).padStart(2, '0')}` : '';
    const latS = `${state.lat >= 0 ? '北緯' : '南緯'}${Math.abs(state.lat).toFixed(1)}°`;
    const timeS = fmtTime(simNow()) + (state.timeOffset ? '（設定時刻）' : '');
    $('infoLoc').textContent = `📍${state.locLabel}（${latS}）`;
    $('infoTime').textContent = `🕘${timeS}`;
    $('infoDir').textContent = `🧭${A.dirName(state.view.az)}・高さ${Math.round(state.view.alt)}°`;
    const sunAlt = sky.sun ? sky.sun.alt : -90;
    const banner = $('dayBanner');
    if (sunAlt > -6) {
      banner.hidden = false;
      banner.textContent = sunAlt > 0 ? '☀️ いまは昼間です。本当は星は見えませんが、星の位置を表示しています' : '🌇 薄明るい時間です。明るい星だけが見えるころです';
    } else {
      banner.hidden = true;
    }
  }

  // ---------------------------------------------------------------
  // オーバーレイ・設定
  // ---------------------------------------------------------------
  function showOverlay(name) {
    ['title', 'solved', 'result', 'settings', 'zukan'].forEach((n) => {
      $(n).hidden = n !== name;
    });
  }

  function refreshTitle() {
    $('locStatus').textContent = state.locStatus;
    computeSky();
    const vis = visibleConstellations();
    const el = $('visibleList');
    el.innerHTML = '';
    if (vis.length === 0) {
      el.textContent = 'いまは地平線の上に出ている星座がありません';
    } else {
      vis.forEach((c) => {
        const s = document.createElement('span');
        s.className = 'chip';
        s.textContent = c.name;
        el.appendChild(s);
      });
    }
    const objs = [];
    if (sky.moon.alt > 0) objs.push('月');
    sky.planets.forEach((p) => { if (p.alt > 0) objs.push(p.name); });
    $('visiblePlanets').textContent = objs.length ? `月・惑星: ${objs.join('、')}` : '';
    $('titleMsg').textContent = '';
    document.querySelectorAll('[data-diff]').forEach((b) => b.classList.toggle('active', b.dataset.diff === state.difficulty));
    $('bestLabel').textContent = loadSave().best ? `自己ベスト ${loadSave().best} 点` : '';
  }

  function openSettings() {
    $('setLat').value = state.lat.toFixed(3);
    $('setLon').value = state.lon.toFixed(3);
    const d = new Date(simNow());
    const p = (n) => String(n).padStart(2, '0');
    $('setTime').value = `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
    settingsReturn = state.screen;
    showOverlay('settings');
  }
  let settingsReturn = 'title';

  function closeSettings(apply) {
    if (apply) {
      const lat = parseFloat($('setLat').value), lon = parseFloat($('setLon').value);
      if (!isNaN(lat) && !isNaN(lon) && (Math.abs(lat - state.lat) > 1e-4 || Math.abs(lon - state.lon) > 1e-4)) {
        const preset = PRESETS.find((pp) => Math.abs(pp.lat - lat) < 1e-3 && Math.abs(pp.lon - lon) < 1e-3);
        setLocation(lat, lon, preset ? preset.label : '指定した場所');
        state.locStatus = `${state.locLabel}の空を表示しています`;
      }
      const tv = $('setTime').value;
      if (tv) {
        const ms = new Date(tv).getTime();
        if (!isNaN(ms) && Math.abs(ms - simNow()) > 60000) state.timeOffset = ms - Date.now();
      }
    }
    if (settingsReturn === 'title') { refreshTitle(); showOverlay('title'); }
    else if (settingsReturn === 'solved') showOverlay('solved');
    else if (settingsReturn === 'result') showOverlay('result');
    else showOverlay(null);
  }

  function openZukan() {
    const grid = $('zukanGrid');
    grid.innerHTML = '';
    const zukan = loadSave().zukan || {};
    const lst = A.localSiderealDeg(A.julianDate(simNow()), state.lon);
    let count = 0;
    CONS.forEach((con) => {
      const found = !!zukan[con.id];
      if (found) count++;
      // この緯度から見えるか (いちばん高く上ったときの高度)
      const maxAlt = Math.min(...con.stars.map((s) => 90 - Math.abs(state.lat - s.dec)));
      const card = document.createElement('div');
      card.className = 'zcard' + (found ? ' found' : '');
      const cv = document.createElement('canvas');
      cv.width = 160; cv.height = 120;
      drawShape(cv, con, 'chart', found ? { lineColor: 'rgba(255,214,120,0.85)' } : { lines: false, starColor: 'rgba(255,255,255,0.35)' });
      const name = document.createElement('div');
      name.className = 'zname';
      name.textContent = found ? con.name : '？？？';
      const sub = document.createElement('div');
      sub.className = 'zsub';
      const nowAlt = conMinAlt(con, lst);
      sub.textContent = maxAlt <= 0 ? 'この場所からは見えない' : nowAlt > 5 ? `いま見える（${con.season}）` : `${con.season}の星座`;
      card.append(cv, name, sub);
      grid.appendChild(card);
    });
    $('zukanCount').textContent = `${count} / ${CONS.length}`;
    showOverlay('zukan');
  }

  // ---------------------------------------------------------------
  // 効果音 (Web Audio)
  // ---------------------------------------------------------------
  const sound = (() => {
    let ac = null;
    function ensure() {
      if (state.muted) return null;
      if (!ac) {
        try { ac = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) { return null; }
      }
      if (ac.state === 'suspended') ac.resume();
      return ac;
    }
    function tone(freq, dur, type, vol, delay) {
      const a = ensure();
      if (!a) return;
      const t0 = a.currentTime + (delay || 0);
      const o = a.createOscillator(), g = a.createGain();
      o.type = type || 'sine';
      o.frequency.value = freq;
      g.gain.setValueAtTime(0, t0);
      g.gain.linearRampToValueAtTime(vol || 0.15, t0 + 0.01);
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
      o.connect(g).connect(a.destination);
      o.start(t0); o.stop(t0 + dur + 0.05);
    }
    const scale = [523, 587, 659, 784, 880, 1047, 1175, 1319, 1568, 1760, 2093, 2349, 2637, 3136];
    return {
      unlock: ensure,
      note: (n) => tone(scale[Math.min(n - 1, scale.length - 1)], 0.5, 'sine', 0.14),
      miss: () => tone(150, 0.2, 'square', 0.05),
      fanfare: () => [784, 988, 1175, 1568].forEach((f, i) => tone(f, 0.6, 'triangle', 0.1, i * 0.11)),
    };
  })();

  // ---------------------------------------------------------------
  // ボタン
  // ---------------------------------------------------------------
  function bind(id, fn) { $(id).addEventListener('click', fn); }

  bind('btnStart', async () => {
    sound.unlock();
    await requestOrientationPermission();
    startGame();
  });
  document.querySelectorAll('[data-diff]').forEach((b) => b.addEventListener('click', () => {
    state.difficulty = b.dataset.diff;
    writeSave({ difficulty: state.difficulty });
    refreshTitle();
  }));
  bind('btnHint', useHint);
  bind('btnGiveUp', giveUp);
  bind('btnNext', nextRound);
  bind('btnAgain', () => { sound.unlock(); startGame(); });
  bind('btnToTitle', quitToTitle);
  bind('btnQuit', quitToTitle);
  bind('btnFollow', async () => {
    await requestOrientationPermission();
    setFollow(!state.follow);
  });
  bind('btnZoomIn', () => setFov(state.view.fov / 1.25));
  bind('btnZoomOut', () => setFov(state.view.fov * 1.25));
  bind('btnSettings', openSettings);
  bind('btnTitleSettings', openSettings);
  bind('btnSettingsOk', () => closeSettings(true));
  bind('btnSettingsCancel', () => closeSettings(false));
  bind('btnGeo', () => {
    if (!navigator.geolocation) return;
    $('geoStatus').textContent = '取得中…';
    navigator.geolocation.getCurrentPosition((pos) => {
      $('setLat').value = pos.coords.latitude.toFixed(3);
      $('setLon').value = pos.coords.longitude.toFixed(3);
      setLocation(pos.coords.latitude, pos.coords.longitude, '現在地');
      state.locStatus = '現在地の空を表示しています';
      $('geoStatus').textContent = '現在地を取得しました';
    }, () => { $('geoStatus').textContent = '取得できませんでした'; }, { timeout: 10000 });
  });
  bind('btnNow', () => {
    state.timeOffset = 0;
    const d = new Date();
    const p = (n) => String(n).padStart(2, '0');
    $('setTime').value = `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
  });
  bind('btnZukan', openZukan);
  bind('btnZukanClose', () => { refreshTitle(); showOverlay('title'); });
  bind('btnMute', () => {
    state.muted = !state.muted;
    writeSave({ muted: state.muted });
    $('btnMute').textContent = state.muted ? '🔇' : '🔊';
  });
  $('btnMute').textContent = state.muted ? '🔇' : '🔊';

  const presetSel = $('setPreset');
  PRESETS.forEach((pp, k) => {
    const o = document.createElement('option');
    o.value = k; o.textContent = pp.label;
    presetSel.appendChild(o);
  });
  presetSel.addEventListener('change', () => {
    const pp = PRESETS[presetSel.value];
    if (!pp) return;
    $('setLat').value = pp.lat; $('setLon').value = pp.lon;
  });

  // ---------------------------------------------------------------
  // 起動
  // ---------------------------------------------------------------
  if (saved.loc) {
    state.lat = saved.loc.lat; state.lon = saved.loc.lon; state.locLabel = saved.loc.label || '前回の場所';
  }
  setupOrientation();
  requestLocation();
  computeSky();
  refreshTitle();
  showOverlay('title');

  function loop(t) {
    updateViewAnim();
    updateFollow();
    render(t);
    updateHud(t);
    requestAnimationFrame(loop);
  }
  requestAnimationFrame(loop);

  // テスト・デバッグ用
  window.__seiza = { state, CONS, scrX, scrY, scrVis, setLocation, startGame, centerOn, visibleConstellations, refreshTitle };
})();
