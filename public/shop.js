/**
 * 상점(SHOP) — 통합 코인(AW)으로 사는 꾸미기 아이템과 인벤토리.
 *
 * 원칙
 *  - **이미 무료로 쓰던 건 잠그지 않는다.** 상점은 새 항목만 판다(기존 테마·아바타는 그대로).
 *  - 산 물건은 인벤토리(alley_inv)에 남고, 슬롯마다 하나씩 장착한다.
 *  - 주사위 스킨은 CSS 변수(--die/--die2/--pip)만 덮어쓴다 → 5개 주사위 게임에 한 번에 먹는다.
 *  - 효과가 없는 물건은 팔지 않는다. (게임 내 아이템은 밸런스 개입이라 온라인 합의가 필요 —
 *    지금은 카탈로그에 없다.)
 */
(function (global) {
  var KEY = 'alley_inv';

  var CATALOG = [
    // ── 주사위 스킨 (슬롯: dice) — 5개 주사위 게임에 공통 적용
    { id:'dice_ebony',  slot:'dice',   name:'흑단 주사위', icon:'🎲', price:3000,  desc:'검은 나뭇결에 흰 눈',      vars:{'--die':'#2c2622','--die2':'#1c1815','--pip':'#f2e9d8'} },
    { id:'dice_ivory',  slot:'dice',   name:'상아 주사위', icon:'🎲', price:5000,  desc:'매끈한 아이보리',          vars:{'--die':'#f7f1e2','--die2':'#e6dcc6','--pip':'#4a3a24'} },
    { id:'dice_celadon',slot:'dice',   name:'청자 주사위', icon:'🎲', price:8000,  desc:'은은한 청록 유약',          vars:{'--die':'#cfe3dd','--die2':'#a9c8c0','--pip':'#1f3b36'} },
    { id:'dice_gold',   slot:'dice',   name:'황금 주사위', icon:'🎲', price:20000, desc:'골목의 자랑',              vars:{'--die':'#f2cf6a','--die2':'#d3a634','--pip':'#3b2a08'} },
    // ── 아바타 팩 (슬롯 없음 · 사면 허브 아바타 목록이 늘어난다)
    { id:'pack_animal', slot:'pack',   name:'동물 아바타 팩', icon:'🐯', price:4000, desc:'🐯 🐰 🐻 🦊 🐼 🐸', avatars:['🐯','🐰','🐻','🦊','🐼','🐸'] },
    { id:'pack_ghost',  slot:'pack',   name:'요괴 아바타 팩', icon:'👹', price:6000, desc:'👹 👺 👻 💀 🦇 🕯️', avatars:['👹','👺','👻','💀','🦇','🕯️'] },
    { id:'pack_lucky',  slot:'pack',   name:'행운 아바타 팩', icon:'🍀', price:9000, desc:'🍀 🌙 ⭐ 🔥 💎 🪙', avatars:['🍀','🌙','⭐','🔥','💎','🪙'] },
    // ── 칭호 (슬롯: title) — 이름 옆에 붙는다
    { id:'title_boss',  slot:'title',  name:'골목대장', icon:'🏮', price:10000, desc:'이름 옆에 «골목대장»' },
    { id:'title_streak',slot:'title',  name:'연승왕',   icon:'🔥', price:15000, desc:'이름 옆에 «연승왕»' },
    { id:'title_risk',  slot:'title',  name:'한탕주의', icon:'💣', price:7000,  desc:'이름 옆에 «한탕주의»' }
  ];

  function read() {
    try {
      var d = JSON.parse(localStorage.getItem(KEY)) || {};
      if (!Array.isArray(d.owned)) d.owned = [];
      if (!d.equip || typeof d.equip !== 'object') d.equip = {};
      /* 소모품은 판매를 내렸다(v1.238에 판매·사용 코드 제거). 이 필드는 지우지 않는다 —
         예전에 산 사람의 잔여 개수를 아래 refundConsumables()가 읽어 코인으로 돌려줘야 한다. */
      if (!d.use || typeof d.use !== 'object') d.use = {};
      return d;
    } catch (e) { return { owned: [], equip: {}, use: {} }; }
  }
  function write(d) {
    try { localStorage.setItem(KEY, JSON.stringify(d)); } catch (e) {}
    try { global.dispatchEvent(new CustomEvent('invchange', { detail: d })); } catch (e) {}
    apply();
    return d;
  }

  /* 2026-07-26: 소모품 판매를 내렸다.
     아이템은 '아이템전'에서 엔진이 전원에게 같은 개수를 주는 방식으로 바뀌었다 —
     돈 주고 개수를 늘리면 그 순간 공정한 판이 아니게 된다.
     이미 산 사람에게는 산 값(개당 1,600코인)으로 되돌려준다. */
  (function refundConsumables(){
    try{
      var d = read(), n = 0, k;
      for (k in d.use) n += d.use[k] | 0;
      if (!n) return;
      d.use = {};
      try{ localStorage.setItem(KEY, JSON.stringify(d)); }catch(e){}
      if (global.AW) AW.add(n * 1600);
    }catch(e){}
  })();

  var SHOP = {
    CATALOG: CATALOG,
    item: function (id) { for (var i = 0; i < CATALOG.length; i++) if (CATALOG[i].id === id) return CATALOG[i]; return null; },
    inv: read,
    owned: function (id) { return read().owned.indexOf(id) >= 0; },
    equipped: function (slot) { return read().equip[slot] || ''; },

    /** 구매. 코인이 모자라거나 이미 있으면 사유를 돌려준다. */
    buy: function (id) {
      var it = SHOP.item(id);
      if (!it) return { ok: false, why: '없는 물건' };
      if (SHOP.owned(id)) return { ok: false, why: '이미 가지고 있어' };
      var coin = global.AW ? AW.get() : 0;
      if (coin < it.price) return { ok: false, why: '코인이 ' + (it.price - coin).toLocaleString() + ' 모자라' };
      if (global.AW) AW.add(-it.price);
      var d = read();
      d.owned.push(id);
      if (it.slot === 'dice' || it.slot === 'title') d.equip[it.slot] = id;   // 사면 바로 장착
      write(d);
      return { ok: true, item: it };
    },

    /** 슬롯에 장착(같은 걸 다시 누르면 해제) */
    equip: function (id) {
      var it = SHOP.item(id);
      if (!it || !SHOP.owned(id) || it.slot === 'pack') return false;
      var d = read();
      d.equip[it.slot] = (d.equip[it.slot] === id) ? '' : id;
      write(d);
      return true;
    },

    /** 산 아바타 팩이 풀어준 이모지 전부 */
    unlockedAvatars: function () {
      var d = read(), out = [];
      for (var i = 0; i < CATALOG.length; i++) {
        var it = CATALOG[i];
        if (it.avatars && d.owned.indexOf(it.id) >= 0) out = out.concat(it.avatars);
      }
      return out;
    },

    /** 장착한 칭호 이름('골목대장' 등). 없으면 빈 문자열 */
    title: function () {
      var it = SHOP.item(SHOP.equipped('title'));
      return it ? it.name : '';
    }
  };

  /** 장착 효과를 문서에 반영 — 주사위 스킨은 CSS 변수 덮어쓰기 하나로 5게임에 먹는다 */
  function apply() {
    try {
      var it = SHOP.item(SHOP.equipped('dice'));
      var root = document.documentElement;
      ['--die', '--die2', '--pip'].forEach(function (v) { root.style.removeProperty(v); });
      if (it && it.vars) for (var k in it.vars) root.style.setProperty(k, it.vars[k]);
    } catch (e) {}
  }
  SHOP.apply = apply;

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', apply);
  else apply();

  global.SHOP = SHOP;
})(typeof window !== 'undefined' ? window : this);
