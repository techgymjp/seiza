// 天文計算ユーティリティ
// 座標系: 赤道座標は J2000 (恒星カタログに合わせる)、地平座標は ENU (東, 北, 上) の単位ベクトル
(function () {
  const D2R = Math.PI / 180;
  const R2D = 180 / Math.PI;
  const OBLIQUITY = 23.43928 * D2R;

  const norm360 = (x) => ((x % 360) + 360) % 360;

  function julianDate(ms) {
    return ms / 86400000 + 2440587.5;
  }

  // 地方恒星時（度）
  function localSiderealDeg(jd, lonDeg) {
    const gmst = 280.46061837 + 360.98564736629 * (jd - 2451545.0);
    return norm360(gmst + lonDeg);
  }

  // 赤道座標 (度) -> 地平座標の ENU ベクトル
  function equToEnu(raDeg, decDeg, lstDeg, latDeg) {
    const H = (lstDeg - raDeg) * D2R;
    const d = decDeg * D2R;
    const p = latDeg * D2R;
    const sd = Math.sin(d), cd = Math.cos(d), sp = Math.sin(p), cp = Math.cos(p);
    const sH = Math.sin(H), cH = Math.cos(H);
    return [-cd * sH, cp * sd - sp * cd * cH, sp * sd + cp * cd * cH];
  }

  function enuToAltAz(v) {
    const alt = Math.asin(Math.max(-1, Math.min(1, v[2]))) * R2D;
    const az = norm360(Math.atan2(v[0], v[1]) * R2D);
    return { alt, az };
  }

  function altAzToEnu(altDeg, azDeg) {
    const a = altDeg * D2R, z = azDeg * D2R;
    return [Math.cos(a) * Math.sin(z), Math.cos(a) * Math.cos(z), Math.sin(a)];
  }

  // 黄道直交座標 -> 赤経・赤緯 (度)
  function eclToEqu(x, y, z) {
    const ye = y * Math.cos(OBLIQUITY) - z * Math.sin(OBLIQUITY);
    const ze = y * Math.sin(OBLIQUITY) + z * Math.cos(OBLIQUITY);
    const r = Math.sqrt(x * x + ye * ye + ze * ze);
    return { ra: norm360(Math.atan2(ye, x) * R2D), dec: Math.asin(ze / r) * R2D, dist: r };
  }

  function solveKepler(Mdeg, e) {
    const M = Mdeg * D2R;
    let E = M + e * Math.sin(M);
    for (let i = 0; i < 8; i++) E -= (E - e * Math.sin(E) - M) / (1 - e * Math.cos(E));
    return E;
  }

  // JPL 近似軌道要素 (Standish, 1800-2050年で有効)
  // [a, e, I, L, 近日点経度, 昇交点黄経] とその世紀あたりの変化量
  const ELEMENTS = {
    mercury: [[0.38709927, 0.20563593, 7.00497902, 252.2503235, 77.45779628, 48.33076593],
      [0.00000037, 0.00001906, -0.00594749, 149472.67411175, 0.16047689, -0.12534081]],
    venus: [[0.72333566, 0.00677672, 3.39467605, 181.9790995, 131.60246718, 76.67984255],
      [0.0000039, -0.00004107, -0.0007889, 58517.81538729, 0.00268329, -0.27769418]],
    earth: [[1.00000261, 0.01671123, -0.00001531, 100.46457166, 102.93768193, 0],
      [0.00000562, -0.00004392, -0.01294668, 35999.37244981, 0.32327364, 0]],
    mars: [[1.52371034, 0.0933941, 1.84969142, -4.55343205, -23.94362959, 49.55953891],
      [0.00001847, 0.00007882, -0.00813131, 19140.30268499, 0.44441088, -0.29257343]],
    jupiter: [[5.202887, 0.04838624, 1.30439695, 34.39644051, 14.72847983, 100.47390909],
      [-0.00011607, -0.00013253, -0.00183714, 3034.74612775, 0.21252668, 0.20469106]],
    saturn: [[9.53667594, 0.05386179, 2.48599187, 49.95424423, 92.59887831, 113.66242448],
      [-0.0012506, -0.00050991, 0.00193609, 1222.49362201, -0.41897216, -0.28867794]],
  };

  function heliocentric(name, T) {
    const [el0, rate] = ELEMENTS[name];
    const [a, e, I, L, wbar, O] = el0.map((v, i) => v + rate[i] * T);
    const w = (wbar - O) * D2R;
    const M = norm360(L - wbar);
    const E = solveKepler(M, e);
    const xp = a * (Math.cos(E) - e);
    const yp = a * Math.sqrt(1 - e * e) * Math.sin(E);
    const cO = Math.cos(O * D2R), sO = Math.sin(O * D2R);
    const cw = Math.cos(w), sw = Math.sin(w);
    const cI = Math.cos(I * D2R), sI = Math.sin(I * D2R);
    return [
      (cw * cO - sw * sO * cI) * xp + (-sw * cO - cw * sO * cI) * yp,
      (cw * sO + sw * cO * cI) * xp + (-sw * sO + cw * cO * cI) * yp,
      sw * sI * xp + cw * sI * yp,
    ];
  }

  const PLANETS = [
    { id: 'mercury', name: '水星', color: '#c9b9a6', size: 3 },
    { id: 'venus', name: '金星', color: '#fff6d8', size: 5 },
    { id: 'mars', name: '火星', color: '#ff8a5c', size: 4 },
    { id: 'jupiter', name: '木星', color: '#ffe3b0', size: 5 },
    { id: 'saturn', name: '土星', color: '#f3d98b', size: 4 },
  ];

  // 太陽・惑星の赤経赤緯 (J2000)
  function solarSystem(jd) {
    const T = (jd - 2451545.0) / 36525;
    const earth = heliocentric('earth', T);
    const sun = eclToEqu(-earth[0], -earth[1], -earth[2]);
    const planets = PLANETS.map((p) => {
      const h = heliocentric(p.id, T);
      const pos = eclToEqu(h[0] - earth[0], h[1] - earth[1], h[2] - earth[2]);
      return Object.assign({}, p, pos);
    });
    return { sun, planets };
  }

  // 月の位置 (Schlyter の簡易式, 精度 0.1〜0.2 度程度)
  function moon(jd) {
    const d = jd - 2451543.5;
    const N = 125.1228 - 0.0529538083 * d;
    const i = 5.1454;
    const w = 318.0634 + 0.1643573223 * d;
    const a = 60.2666;
    const e = 0.0549;
    const M = norm360(115.3654 + 13.0649929509 * d);
    const Ms = norm360(356.047 + 0.9856002585 * d);
    const ws = 282.9404 + 4.70935e-5 * d;
    const Ls = norm360(ws + Ms);
    const E = solveKepler(M, e);
    const xv = a * (Math.cos(E) - e);
    const yv = a * Math.sqrt(1 - e * e) * Math.sin(E);
    const v = Math.atan2(yv, xv) * R2D;
    let r = Math.sqrt(xv * xv + yv * yv);
    const cN = Math.cos(N * D2R), sN = Math.sin(N * D2R);
    const cvw = Math.cos((v + w) * D2R), svw = Math.sin((v + w) * D2R);
    const ci = Math.cos(i * D2R), si = Math.sin(i * D2R);
    const xh = r * (cN * cvw - sN * svw * ci);
    const yh = r * (sN * cvw + cN * svw * ci);
    const zh = r * svw * si;
    let lon = Math.atan2(yh, xh) * R2D;
    let lat = Math.atan2(zh, Math.sqrt(xh * xh + yh * yh)) * R2D;
    const Lm = norm360(N + w + M);
    const D = Lm - Ls;
    const F = Lm - N;
    const s = (x) => Math.sin(x * D2R);
    lon += -1.274 * s(M - 2 * D) + 0.658 * s(2 * D) - 0.186 * s(Ms) - 0.059 * s(2 * M - 2 * D)
      - 0.057 * s(M - 2 * D + Ms) + 0.053 * s(M + 2 * D) + 0.046 * s(2 * D - Ms) + 0.041 * s(M - Ms)
      - 0.035 * s(D) - 0.031 * s(M + Ms) - 0.015 * s(2 * F - 2 * D) + 0.011 * s(M - 4 * D);
    lat += -0.173 * s(F - 2 * D) - 0.055 * s(M - F - 2 * D) - 0.046 * s(M + F - 2 * D)
      + 0.033 * s(F + 2 * D) + 0.017 * s(2 * M + F);
    r += -0.58 * Math.cos((M - 2 * D) * D2R) - 0.46 * Math.cos(2 * D * D2R);
    // 当日分点 -> J2000 へ歳差補正 (黄経のみ)
    lon -= 0.0139697 * (d / 365.25);
    const cl = Math.cos(lat * D2R);
    const pos = eclToEqu(cl * Math.cos(lon * D2R), cl * Math.sin(lon * D2R), Math.sin(lat * D2R));
    // 太陽との離角から月齢・満ち欠け
    const elong = norm360(lon - (Ls - 0.0139697 * (d / 365.25)));
    return { ra: pos.ra, dec: pos.dec, distEarthRadii: r, elong };
  }

  const DIRS = ['北', '北北東', '北東', '東北東', '東', '東南東', '南東', '南南東', '南', '南南西', '南西', '西南西', '西', '西北西', '北西', '北北西'];
  function dirName(az) {
    return DIRS[Math.round(norm360(az) / 22.5) % 16];
  }
  const DIRS8 = ['北', '北東', '東', '南東', '南', '南西', '西', '北西'];
  function dirName8(az) {
    return DIRS8[Math.round(norm360(az) / 45) % 8];
  }

  window.Astro = {
    D2R, R2D, norm360, julianDate, localSiderealDeg, equToEnu, enuToAltAz, altAzToEnu,
    solarSystem, moon, dirName, dirName8,
  };
})();
