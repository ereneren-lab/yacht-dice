/**
 * 캐릭터 아바타 공용 모듈 — window.CHARS
 *
 * 왜 있나 (2026-08-04)
 *   `public/img/`에 직접 만든 소프트 3D 마스코트 5종이 있는데 **윷놀이에서만** 썼다.
 *   나머지 12게임은 전부 키보드 이모지를 아바타로 썼다 — 누구나 공짜로 칠 수 있는 것이라
 *   우리 것이 아니고, 상점에서 팔 수도 없다(그래서 이모지 아바타 팩 판매를 중단했다).
 *   이 모듈은 그 5종을 **13게임 공용 아바타**로 만든다.
 *
 * 5종은 임의로 고른 동물이 아니다 — 윷의 끗수 **도·개·걸·윷·모** 그 자체다.
 *   도=돼지 · 개=개 · 걸=양 · 윷=소 · 모=말. 캐릭터가 게임 규칙에서 나왔다.
 *
 * 설계의 핵심 — **이미지가 글자 크기를 따라간다**
 *   게임들은 아바타를 `el.textContent = p.avatar`처럼 **글자로** 그리고, 크기는 CSS `font-size`로 준다.
 *   그래서 `.chav`를 `width:1em;height:1em`으로 두면, 기존 CSS를 한 줄도 안 고치고
 *   이모지 자리에 그대로 갈아끼울 수 있다. (px로 고정하면 13게임 CSS를 다 손봐야 한다.)
 *
 * 저장값
 *   `alley_avatar`에 이모지('🎲') 또는 캐릭터 id('pig')가 들어간다. 둘 다 유효하다.
 *   ⚠️ 서버는 예전부터 캐릭터 id 5종만 정식으로 인정한다(server.js). 이모지를 보내면
 *      기본 아바타로 대체된다 — 즉 **온라인에서 이모지 아바타는 원래 안 지켜졌다.**
 *      캐릭터를 쓰면 그 문제도 같이 없어진다.
 */
(function (global) {
  'use strict';

  /* 기본 5종은 **윷의 도개걸윷모**라 무료다. 규칙에서 나온 세트를 잠그면 '기본을 뺏겼다'가 된다.
     파는 것은 그 계보 **밖**에서 온다(2026-08-04). shop 필드가 있으면 상점에서 사야 열린다. */
  var LIST = [
    { id: 'pig',   kr: '돼지', yut: '도', img: 'img/pig.png' },
    { id: 'dog',   kr: '개',   yut: '개', img: 'img/dog.png' },
    { id: 'sheep', kr: '양',   yut: '걸', img: 'img/sheep.png' },
    { id: 'cow',   kr: '소',   yut: '윷', img: 'img/cow.png' },
    { id: 'horse', kr: '말',   yut: '모', img: 'img/horse.png' },
    // ── 상점 캐릭터 (2026-08-04)
    { id: 'tiger',    kr: '호랑이', img: 'img/tiger.png',    shop: 'char_tiger' },
    { id: 'rabbit',   kr: '토끼',   img: 'img/rabbit.png',   shop: 'char_rabbit' },
    { id: 'bear',     kr: '곰',     img: 'img/bear.png',     shop: 'char_bear' },
    { id: 'fox',      kr: '여우',   img: 'img/fox.png',      shop: 'char_fox' },
    { id: 'dokkaebi', kr: '도깨비', img: 'img/dokkaebi.png', shop: 'char_dokkaebi' },
    /* ── 상점 캐릭터 2차 (2026-08-11) — 짐승 얼굴 밖으로.
       `full`은 **자르지 않은 전체 그림**이다. img는 판 위 말(15~37px)에서 얼굴이 보이게
       바짝 자른 판본이라 다리·소품이 잘려 있다. 결과창 우승자(96~124px)·VS 인트로(74~132px)처럼
       크게 보여주는 자리는 full을 쓴다 — 안 그러면 큰 화면에서 잘린 그림을 보게 된다.
       full이 없는 캐릭터(기존 10종)는 img로 떨어진다.
       기존 10종이 전부 네발짐승이고 색이 따뜻한 쪽에 몰려 있었다. 이 8종은
       ① 짐승이 아닌 실루엣(사물·사람)과 ② 안 쓰인 색(먹·옥·금·진홍·청)으로 갈랐다.
       근거·프롬프트: outputs/production/2026-08-11_dice-alley_character-set-3.md */
    { id: 'yutgarak',   kr: '윷가락',   img: 'img/yutgarak.png', full: 'img/yutgarak_full.png',   shop: 'char_yutgarak' },
    { id: 'bokjumeoni', kr: '복주머니', img: 'img/bokjumeoni.png', full: 'img/bokjumeoni_full.png', shop: 'char_bokjumeoni' },
    { id: 'chorong',    kr: '청사초롱', img: 'img/chorong.png', full: 'img/chorong_full.png',    shop: 'char_chorong' },
    { id: 'jangseung',  kr: '장승',     img: 'img/jangseung.png', full: 'img/jangseung_full.png',  shop: 'char_jangseung' },
    { id: 'haetae',     kr: '해태',     img: 'img/haetae.png', full: 'img/haetae_full.png',     shop: 'char_haetae' },
    { id: 'sansin',     kr: '산신령',   img: 'img/sansin.png', full: 'img/sansin_full.png',     shop: 'char_sansin' },
    { id: 'yong',       kr: '청룡',     img: 'img/yong.png', full: 'img/yong_full.png',       shop: 'char_yong' },
    { id: 'jeoseung',   kr: '저승사자', img: 'img/jeoseung.png', full: 'img/jeoseung_full.png',   shop: 'char_jeoseung' }
  ];

  var BY_ID = {};
  for (var i = 0; i < LIST.length; i++) BY_ID[LIST[i].id] = LIST[i];

  var CSS =
    /* 1em 정사각 — 부모의 font-size를 그대로 따른다(위 '설계의 핵심' 참고).
       vertical-align은 이모지 기준선과 눈으로 맞춘 값이다. */
    '.chav{width:1em;height:1em;object-fit:contain;vertical-align:-.16em;' +
    'border-radius:50%;image-rendering:auto;flex:none;display:inline-block}' +
    /* 원형으로 잘리므로 배경이 비치면 지저분하다 — 살짝 안쪽으로 눌러 담는다 */
    '.chav.pad{padding:.04em;box-sizing:border-box}';

  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  var CHARS = {
    LIST: LIST,
    /** 전부 (상점 진열용) */
    all: function () { return LIST.slice(); },
    /** 산 사람인가 — shop 필드가 없으면 무료라 항상 true.
     *  ⚠️ shop.js가 없는 페이지에서도 죽으면 안 된다 → 없으면 '아직 안 산 것'으로 본다. */
    owned: function (id) {
      var c = BY_ID[id]; if (!c) return false;
      if (!c.shop) return true;
      try { return !!(window.SHOP && SHOP.owned(c.shop)); } catch (e) { return false; }
    },
    /** 고를 수 있는 것만 — 아바타 피커는 이걸 쓴다(안 산 캐릭터는 안 보인다) */
    ids: function () { return LIST.filter(function (c) { return CHARS.owned(c.id); }).map(function (c) { return c.id; }); },
    get: function (id) { return BY_ID[id] || null; },
    /** 캐릭터 id인가 (이모지·빈값이면 false) */
    is: function (v) { return !!(v && BY_ID[v]); },

    /** 사람이 읽는 이름 — 캐릭터면 '돼지', 이모지면 그대로 */
    label: function (v) { return CHARS.is(v) ? BY_ID[v].kr : (v || ''); },

    /** 아바타 한 칸의 HTML. 캐릭터면 <img>, 아니면 이모지 글자 그대로.
     *  크기는 **주지 않는다** — 부모 font-size를 따르는 게 이 모듈의 요점이다.
     *  cls로 추가 클래스를 붙일 수 있다. */
    html: function (v, cls) {
      var c = BY_ID[v];
      if (!c) return esc(v);
      /* loading="lazy" — 접혀 있는 곳(허브 프로필의 아바타 칩 등)의 그림은 펼칠 때 받는다.
         ⚠️ `display:none` 안에 있어도 **일반 <img>는 그냥 받는다.** 그래서 허브가 열릴 때마다
            쓰지도 않는 칩 5장(~175KB)을 받고 있었다. 콜드스타트 12.95초짜리 서비스에선 그냥 낭비다.
         보이는 자리(인게임 아바타)는 lazy여도 즉시 받으므로 손해가 없다. */
      return '<img class="chav' + (cls ? ' ' + esc(cls) : '') + '" src="' + c.img +
             '" alt="' + esc(c.kr) + '" loading="lazy" decoding="async" draggable="false">';
    },

    /** 기존 `el.textContent = av` 를 그대로 대체하는 헬퍼.
     *  이모지면 textContent로 넣어 XSS 여지를 아예 없애고, 캐릭터일 때만 innerHTML을 쓴다. */
    into: function (el, v, cls) {
      if (!el) return;
      if (CHARS.is(v)) el.innerHTML = CHARS.html(v, cls);
      else el.textContent = (v == null ? '' : String(v));
    },

    /* ── 표정(감정) 변형 ─────────────────────────────────────────
       기본 초상 밖에 `img/{id}_{emotion}.png`를 둔다(happy·sad·surprise·angry·star·cheer).
       ⚠️ 아트가 **아직 없을 수 있다.** 그래서 파일 존재를 한 번 확인(probe)하고 캐시한다 —
          없으면 조용히 기본 이미지를 유지한다(코드가 아트를 앞서 배포돼도 무해, 도착하면 자동으로 산다).
       스펙·감정 매핑: ART_BRIEF.md. 파일럿 검증 후 18종×6표정으로 확대. */
    faceSrc: function (id, emotion) { return 'img/' + id + '_' + emotion + '.png'; },
    /** el(<img>)을 잠깐 그 표정으로 바꾼다(ms 뒤 원래대로). 파일 없으면 아무 일도 안 한다. */
    reactImg: function (el, id, emotion, ms) {
      if (!el || !CHARS.is(id) || !emotion) return;
      var key = id + '_' + emotion, path = CHARS.faceSrc(id, emotion);
      var swap = function () {
        var base = el.getAttribute('data-base') || el.src;
        el.setAttribute('data-base', base);
        el.src = path;
        clearTimeout(el._faceT);
        el._faceT = setTimeout(function () {
          var b = el.getAttribute('data-base'); if (b) { el.src = b; el.removeAttribute('data-base'); }
        }, ms || 1200);
      };
      if (CHARS._faceOk[key] === true) return swap();
      if (CHARS._faceOk[key] === false) return;      // 없는 걸 안다 → 그대로
      var probe = new Image();
      probe.onload = function () { CHARS._faceOk[key] = probe.naturalWidth > 0; if (CHARS._faceOk[key]) swap(); };
      probe.onerror = function () { CHARS._faceOk[key] = false; };
      probe.src = path;
    },
    _faceOk: {},

    /** 캔버스용 — 미리 불러둔 <img>. 아직 안 떴으면 null.
     *  ⚠️ 캔버스는 `fillText`로 이모지를 그린다. 이미지는 그 방식으로 못 그린다(글자가 아니니까).
     *     결과 화면·순위표가 캔버스인 게임(라이어·좌중우·요트)이 있어서 이 경로가 꼭 필요하다. */
    image: function (id) {
      var c = BY_ID[id]; if (!c) return null;
      if (!c._img) {
        var im = new Image(); im.src = c.img; c._img = im;
      }
      return (c._img.complete && c._img.naturalWidth > 0) ? c._img : null;
    },

    /** 캔버스에 아바타 하나를 **중앙 정렬**로 그린다.
     *  기존 `ctx.fillText(av, x, y)` 자리를 그대로 대체한다 — size는 그 자리의 font 크기(px).
     *  캐릭터인데 이미지가 아직 안 떴으면 이름 첫 글자 대신 이모지 폴백을 그려 빈칸을 만들지 않는다. */
    draw: function (ctx, v, x, y, size) {
      var im = CHARS.image(v);
      if (im) {
        var s = size || 40;
        ctx.drawImage(im, x - s / 2, y - s / 2, s, s);
        return true;
      }
      ctx.fillText(CHARS.is(v) ? '🎲' : (v || '🎲'), x, y);
      return false;
    },

    /** 여러 개를 미리 받아둔다 — 캔버스로 그릴 참가자들이 정해졌을 때 부르면 폴백이 안 보인다 */
    preload: function (ids) {
      (ids || []).forEach(function (v) { if (CHARS.is(v)) CHARS.image(v); });
    },

    /** 저장된 내 아바타 (없으면 '') */
    mine: function () {
      try { return localStorage.getItem('alley_avatar') || ''; } catch (e) { return ''; }
    },
    setMine: function (v) {
      try {
        if (v) localStorage.setItem('alley_avatar', v);
        else localStorage.removeItem('alley_avatar');
      } catch (e) {}
    }
  };

  function boot() {
    try {
      if (!document.getElementById('charsStyle')) {
        var st = document.createElement('style');
        st.id = 'charsStyle'; st.textContent = CSS;
        (document.head || document.documentElement).appendChild(st);
      }
      /* 미리 받는 건 **내 아바타 하나만.**
         ⚠️ 처음엔 전부(LIST 전체) 미리 받았는데, 캐릭터가 5종에서 10종으로 늘면서
            **모든 페이지가 열릴 때마다 332KB를 받게** 됐다. 허브는 그중 한 장도 안 쓰는데도.
            콜드스타트가 12.95초인 서비스에서 이건 그냥 낭비다.
         나머지는 `image()`가 필요할 때 만든다(= 처음 그리는 순간 로드 시작).
         ⚠️ 캔버스는 그 한 프레임 동안 이모지 폴백이 나온다 — 결과 화면을 한 번만 그리는 게임
            (좌·중·우)에서는 내 것 말고 남의 캐릭터가 폴백으로 보일 수 있다.
            그 자리가 문제가 되면 판이 시작될 때 `CHARS.preload(참가자 아바타들)`를 부를 것. */
      var mine = CHARS.mine();
      if (CHARS.is(mine)) CHARS.image(mine);
    } catch (e) {}
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();

  global.CHARS = CHARS;
})(typeof window !== 'undefined' ? window : this);
