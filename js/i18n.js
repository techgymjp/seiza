// 日本語 / 英語の切りかえ
(function () {
  'use strict';

  const STORAGE_KEY = 'seiza-mitsuke-v1';

  const STR = {
    ja: {
      appTitle: '星座みつけ',
      lead: 'いま、あなたのいる場所の夜空から<br>お題の星座をさがして、星をなぞろう！',
      visibleHead: 'いま地平線の上に出ている星座',
      noVisible: 'いまは地平線の上に出ている星座がありません',
      noVisibleStart: 'いまの時刻・場所では地平線の上に出ている星座がありません。⚙ で時刻を変えてみてください。',
      moonPlanets: '月・惑星: {list}',
      listSep: '、',
      diff_easy: 'かんたん', diff_normal: 'ふつう', diff_hard: 'むずかしい',
      start: 'スタート',
      zukan: '📖 ずかん',
      placeTime: '⚙️ 場所・時刻',
      best: '自己ベスト {n} 点',
      howtoTitle: 'あそびかた',
      howto: [
        '「◯◯座 をさがして」とお題が出ます。左上の図がその星座の形です。',
        '夜空からその星座を見つけたら、星を指（マウス）でなぞってみよう。なぞった星と星が線で結ばれます。',
        'お題の星座の星を<strong>全部</strong>なぞったら正解！星座絵が浮かび上がります。',
        'スマホでは、2本指で動かすと空を見回せます。ピンチで拡大縮小。',
        'パソコンでは、なにもないところをドラッグすると空を見回せます。ホイールで拡大縮小。',
        'スマホでは、スタートしたときに向いている方角の空から始まります。',
        '星空・太陽・月・惑星は、いまの時刻と場所にあわせて計算しています。',
        'ちがう星をなぞるとミス。💡ヒントを押すと、その星座のところまで空が動いて、まだ見つけていない星が光ります。🏳️でこたえを見られます。',
        '右上のコンパスで、いま見ている方角がわかります。',
      ],
      langButton: '🌐 English',
      findIt: 'をさがして',
      progress: '{a} / {b} 個',
      round: '{a} / {b} 問',
      points: '{n} 点',
      miss: 'ミス {n}',
      hint: '💡ヒント',
      t_zoomOut: '広く見る', t_zoomIn: '大きく見る', t_hint: 'ヒント', t_giveUp: 'こたえを見る',
      t_settings: '場所と時刻', t_bgm: 'BGM', t_bgmOff: 'BGMをとめる', t_bgmOn: 'BGMをながす',
      t_mute: '効果音', t_quit: 'タイトルへ', t_compass: '見ている方角', t_sky: '星空', t_shape: '星座の形',
      found: 'みつけた！',
      answer: 'こたえ',
      solvedMeta: '{season}の星座 ・ いま {pos}',
      position: '{dir}の空・高さ {alt}°',
      brightStars: '明るい星: {list}',
      scoreDetail: '{n} 点（{sec}秒・ミス{miss}・ヒント{hint}）',
      zeroPoints: '0 点',
      nextCon: 'つぎの星座へ',
      seeResult: '結果を見る',
      result: 'けっか',
      newBest: '🎉 自己ベスト更新！',
      bestIs: '自己ベスト: {n} 点',
      gaveUp: 'ギブアップ',
      again: 'もういちど',
      toTitle: 'タイトルへ',
      settingsTitle: '場所と時刻',
      choosePlace: '場所をえらぶ',
      choosePlaceholder: '— えらんでください —',
      lat: '緯度', lon: '経度',
      getLocation: '📍 現在地を取得',
      dateTime: '日時',
      resetTime: '🕘 いまの時刻にもどす',
      cancel: 'キャンセル',
      ok: 'OK',
      zukanTitle: '星座ずかん',
      close: 'とじる',
      notVisibleHere: 'この場所からは見えない',
      visibleNow: 'いま見える（{season}）',
      seasonCon: '{season}の星座',
      unknown: '？？？',
      latN: '北緯', latS: '南緯',
      setTimeMark: '（設定時刻）',
      viewDir: '{dir}・高さ{alt}°',
      loc_default: '東京（仮）',
      loc_current: '現在地',
      loc_custom: '指定した場所',
      loc_previous: '前回の場所',
      st_locating: '位置情報を取得しています…',
      st_noGeo: 'この端末では位置情報が使えないため、東京の空を表示しています',
      st_current: '現在地の空を表示しています',
      st_failed: '位置情報を取得できなかったため、東京の空を表示しています（⚙で変更できます）',
      st_place: '{place}の空を表示しています',
      geo_getting: '取得中…',
      geo_ok: '現在地を取得しました',
      geo_fail: '取得できませんでした',
      sun: '太陽', moon: '月',
      season: { 冬: '冬', 春: '春', 夏: '夏', 秋: '秋', 一年中: '一年中' },
    },
    en: {
      appTitle: 'Star Finder',
      lead: 'Find the constellation in the night sky<br>above you right now, and trace its stars!',
      visibleHead: 'Constellations above the horizon now',
      noVisible: 'No constellations are above the horizon right now',
      noVisibleStart: 'No constellations are above the horizon at this time and place. Try changing the time with ⚙.',
      moonPlanets: 'Moon & planets: {list}',
      listSep: ', ',
      diff_easy: 'Easy', diff_normal: 'Normal', diff_hard: 'Hard',
      start: 'Start',
      zukan: '📖 Collection',
      placeTime: '⚙️ Place & time',
      best: 'Best score {n}',
      howtoTitle: 'How to play',
      howto: [
        'You will be asked to "Find" a constellation. The picture at the top left shows its shape.',
        'When you spot it in the sky, trace its stars with your finger (or mouse). The stars you trace are joined with lines.',
        'Trace <strong>all</strong> of its stars to get it right! The constellation figure will appear.',
        'On a phone, move two fingers to look around the sky. Pinch to zoom.',
        'On a computer, drag an empty part of the sky to look around. Use the mouse wheel to zoom.',
        'On a phone, the game starts with the part of the sky your phone is facing.',
        'The stars, Sun, Moon and planets are calculated for your current time and place.',
        'Tracing a wrong star counts as a miss. 💡Hint moves the sky to the constellation and makes a star you have not found yet blink. 🏳️ shows the answer.',
        'The compass at the top right shows which direction you are looking.',
      ],
      langButton: '🌐 日本語',
      findIt: 'Find it in the sky',
      progress: '{a} / {b} stars',
      round: 'Round {a} / {b}',
      points: '{n} pts',
      miss: 'Miss {n}',
      hint: '💡Hint',
      t_zoomOut: 'Zoom out', t_zoomIn: 'Zoom in', t_hint: 'Hint', t_giveUp: 'Show the answer',
      t_settings: 'Place and time', t_bgm: 'Music', t_bgmOff: 'Stop music', t_bgmOn: 'Play music',
      t_mute: 'Sound effects', t_quit: 'Back to title', t_compass: 'Viewing direction', t_sky: 'Starry sky', t_shape: 'Constellation shape',
      found: 'Found it!',
      answer: 'Answer',
      solvedMeta: '{season} constellation · now {pos}',
      position: 'in the {dir} sky, {alt}° high',
      brightStars: 'Bright stars: {list}',
      scoreDetail: '{n} pts ({sec}s · {miss} misses · {hint} hints)',
      zeroPoints: '0 pts',
      nextCon: 'Next constellation',
      seeResult: 'See results',
      result: 'Results',
      newBest: '🎉 New best score!',
      bestIs: 'Best score: {n}',
      gaveUp: 'Gave up',
      again: 'Play again',
      toTitle: 'Back to title',
      settingsTitle: 'Place and time',
      choosePlace: 'Choose a place',
      choosePlaceholder: '— Select —',
      lat: 'Latitude', lon: 'Longitude',
      getLocation: '📍 Use my location',
      dateTime: 'Date and time',
      resetTime: '🕘 Back to the current time',
      cancel: 'Cancel',
      ok: 'OK',
      zukanTitle: 'Constellation collection',
      close: 'Close',
      notVisibleHere: 'Not visible from here',
      visibleNow: 'Visible now ({season})',
      seasonCon: '{season} constellation',
      unknown: '???',
      latN: 'Lat ', latS: 'Lat ',
      setTimeMark: ' (set time)',
      viewDir: '{dir}, {alt}° high',
      loc_default: 'Tokyo (default)',
      loc_current: 'Your location',
      loc_custom: 'Chosen place',
      loc_previous: 'Last place',
      st_locating: 'Getting your location…',
      st_noGeo: 'Location is not available on this device, so the sky over Tokyo is shown',
      st_current: 'Showing the sky above your location',
      st_failed: 'Could not get your location, so the sky over Tokyo is shown (change it with ⚙)',
      st_place: 'Showing the sky over {place}',
      geo_getting: 'Getting location…',
      geo_ok: 'Got your location',
      geo_fail: 'Could not get your location',
      sun: 'Sun', moon: 'Moon',
      season: { 冬: 'Winter', 春: 'Spring', 夏: 'Summer', 秋: 'Autumn', 一年中: 'All-year' },
    },
  };

  const DIR16 = {
    ja: ['北', '北北東', '北東', '東北東', '東', '東南東', '南東', '南南東', '南', '南南西', '南西', '西南西', '西', '西北西', '北西', '北北西'],
    en: ['N', 'NNE', 'NE', 'ENE', 'E', 'ESE', 'SE', 'SSE', 'S', 'SSW', 'SW', 'WSW', 'W', 'WNW', 'NW', 'NNW'],
  };
  const DIR8 = {
    ja: ['北', '北東', '東', '南東', '南', '南西', '西', '北西'],
    en: ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'],
  };
  const PLANETS = {
    ja: { mercury: '水星', venus: '金星', mars: '火星', jupiter: '木星', saturn: '土星' },
    en: { mercury: 'Mercury', venus: 'Venus', mars: 'Mars', jupiter: 'Jupiter', saturn: 'Saturn' },
  };
  const PRESETS_EN = ['Sapporo', 'Tokyo', 'Osaka', 'Fukuoka', 'Naha', 'Singapore', 'Sydney', 'London', 'New York'];

  // 星座の英語データ (stars は constellations.js の stars と同じ順番)
  const CON_EN = {
    orion: {
      name: 'Orion',
      desc: 'Look for the three stars in a row: Orion\'s Belt. Red Betelgeuse and blue-white Rigel, two first-magnitude stars, make this hunter the star of the winter sky.',
      stars: ['Betelgeuse', 'Bellatrix', 'Meissa', 'Alnitak', 'Alnilam', 'Mintaka', 'Saiph', 'Rigel'],
    },
    taurus: {
      name: 'Taurus',
      desc: 'The V-shaped group of stars is the bull\'s face, and red Aldebaran is its eye. The Pleiades star cluster is close by.',
      stars: ['Aldebaran', 'θ Tauri', 'γ Tauri', 'δ Tauri', 'ε Tauri', 'Elnath', 'ζ Tauri', 'λ Tauri', 'Pleiades'],
    },
    gemini: {
      name: 'Gemini',
      desc: 'Castor and Pollux, shining side by side, are the heads of the twins. The two brothers are holding hands.',
      stars: ['Castor', 'Pollux', 'τ Geminorum', 'Mebsuta', 'Tejat', 'Wasat', 'Alhena'],
    },
    canismajor: {
      name: 'Canis Major',
      desc: 'Home of Sirius, the brightest star in the night sky. Follow the line of Orion\'s Belt to find it.',
      stars: ['Sirius', 'Mirzam', 'ο² Canis Majoris', 'Wezen', 'Adhara', 'Aludra', 'Furud'],
    },
    leo: {
      name: 'Leo',
      desc: 'A backwards question mark called the Sickle forms the lion\'s head. Regulus, just below it, is the lion\'s heart.',
      stars: ['Regulus', 'η Leonis', 'Algieba', 'Adhafera', 'Rasalas', 'ε Leonis', 'Zosma', 'Chertan', 'Denebola'],
    },
    ursamajor: {
      name: 'Ursa Major (Big Dipper)',
      desc: 'Seven stars form the Big Dipper. Extend the two stars at the end of the bowl about five times to find Polaris, the North Star.',
      stars: ['Dubhe', 'Merak', 'Phecda', 'Megrez', 'Alioth', 'Mizar', 'Alkaid'],
    },
    ursaminor: {
      name: 'Ursa Minor',
      desc: 'A little dipper. The star at the tip of its tail is Polaris, the North Star, which barely moves and always stays in the northern sky.',
      stars: ['Polaris (North Star)', 'δ Ursae Minoris', 'ε Ursae Minoris', 'ζ Ursae Minoris', 'η Ursae Minoris', 'Pherkad', 'Kochab'],
    },
    crux: {
      name: 'Crux (Southern Cross)',
      desc: 'The smallest constellation, shining as a cross in the southern sky. In Japan it can only be seen from the far south, such as Okinawa.',
      stars: ['Acrux', 'Gacrux', 'Mimosa', 'δ Crucis', 'ε Crucis'],
    },
    lyra: {
      name: 'Lyra',
      desc: 'Bright white Vega is the Weaver Princess star of the Tanabata legend. The small parallelogram is the body of the lyre (harp).',
      stars: ['Vega', 'ε Lyrae', 'ζ Lyrae', 'δ Lyrae', 'Sulafat', 'Sheliak'],
    },
    aquila: {
      name: 'Aquila',
      desc: 'Altair is the Cowherd star of the Tanabata legend. It faces Vega in Lyra across the Milky Way.',
      stars: ['Altair', 'Tarazed', 'Alshain', 'ζ Aquilae', 'δ Aquilae', 'λ Aquilae', 'θ Aquilae'],
    },
    cygnus: {
      name: 'Cygnus',
      desc: 'Its big cross shape is also called the Northern Cross. Deneb, at the swan\'s tail, is one corner of the Summer Triangle.',
      stars: ['Deneb', 'Sadr', 'η Cygni', 'Albireo', 'δ Cygni', 'κ Cygni', 'Gienah', 'ζ Cygni'],
    },
    scorpius: {
      name: 'Scorpius',
      desc: 'A large scorpion curving like the letter S. Its red heart, Antares, means "rival of Mars".',
      stars: ['Acrab', 'Dschubba', 'π Scorpii', 'σ Scorpii', 'Antares', 'τ Scorpii', 'ε Scorpii', 'μ Scorpii', 'ζ Scorpii', 'η Scorpii', 'Sargas', 'ι Scorpii', 'κ Scorpii', 'Shaula'],
    },
    sagittarius: {
      name: 'Sagittarius',
      desc: 'A centaur and master archer. Its brightest stars look like a teapot.',
      stars: ['Alnasl', 'Kaus Media', 'Kaus Australis', 'Kaus Borealis', 'φ Sagittarii', 'Nunki', 'τ Sagittarii', 'Ascella'],
    },
    pegasus: {
      name: 'Pegasus',
      desc: 'The winged horse. Four stars of its body form a big square called the Great Square of Pegasus.',
      stars: ['Markab', 'Scheat', 'Alpheratz', 'Algenib', 'Homam', 'θ Pegasi', 'Enif', 'Matar', 'λ Pegasi'],
    },
    cassiopeia: {
      name: 'Cassiopeia',
      desc: 'Shaped like the letter W. It sits across from the Big Dipper and also helps you find Polaris.',
      stars: ['Caph', 'Schedar', 'γ Cassiopeiae', 'Ruchbah', 'Segin'],
    },
  };

  function detect() {
    try {
      const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
      if (saved.lang === 'ja' || saved.lang === 'en') return saved.lang;
    } catch (e) { /* 保存がなくても動く */ }
    const langs = navigator.languages && navigator.languages.length ? navigator.languages : [navigator.language || 'ja'];
    return String(langs[0] || 'ja').toLowerCase().startsWith('ja') ? 'ja' : 'en';
  }

  const I = {
    lang: detect(),
    t(key, vars) {
      let s = STR[I.lang][key];
      if (s == null) s = STR.ja[key];
      if (typeof s !== 'string') return s;
      if (vars) Object.keys(vars).forEach((k) => { s = s.split('{' + k + '}').join(vars[k]); });
      return s;
    },
    season(jaSeason) { return STR[I.lang].season[jaSeason] || jaSeason; },
    conName(con) { return I.lang === 'en' && CON_EN[con.id] ? CON_EN[con.id].name : con.name; },
    conDesc(con) { return I.lang === 'en' && CON_EN[con.id] ? CON_EN[con.id].desc : con.desc; },
    starName(con, k) { return I.lang === 'en' && CON_EN[con.id] ? CON_EN[con.id].stars[k] : con.stars[k].name; },
    planetName(id) { return PLANETS[I.lang][id] || id; },
    dir16(az) { return DIR16[I.lang][Math.round((((az % 360) + 360) % 360) / 22.5) % 16]; },
    dir8Labels() { return DIR8[I.lang]; },
    presetLabel(i, ja) { return I.lang === 'en' ? PRESETS_EN[i] || ja : ja; },
    setLang(lang) {
      I.lang = lang;
      try {
        const cur = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
        cur.lang = lang;
        localStorage.setItem(STORAGE_KEY, JSON.stringify(cur));
      } catch (e) { /* 保存できなくても切りかえはできる */ }
    },
    // HTML の data-i18n などを書きかえる
    applyStatic() {
      document.documentElement.lang = I.lang;
      document.title = I.t('appTitle');
      document.querySelectorAll('[data-i18n]').forEach((el) => { el.textContent = I.t(el.dataset.i18n); });
      document.querySelectorAll('[data-i18n-html]').forEach((el) => { el.innerHTML = I.t(el.dataset.i18nHtml); });
      document.querySelectorAll('[data-i18n-title]').forEach((el) => { el.title = I.t(el.dataset.i18nTitle); });
      document.querySelectorAll('[data-i18n-aria]').forEach((el) => { el.setAttribute('aria-label', I.t(el.dataset.i18nAria)); });
      const ul = document.getElementById('howtoList');
      if (ul) ul.innerHTML = I.t('howto').map((h) => `<li>${h}</li>`).join('');
      // コンパスの文字
      const c = document.querySelectorAll('#compassDial text');
      const d = DIR8[I.lang];
      if (c.length === 4) { c[0].textContent = d[0]; c[1].textContent = d[2]; c[2].textContent = d[4]; c[3].textContent = d[6]; }
    },
  };

  window.I18N = I;
})();
