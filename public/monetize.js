/* monetize.js — 수익화 심(seam): 광고 + 프리미엄(광고 제거). window.MZ.
 *
 * 철학은 analytics.js와 같다: 수익화가 게임을 죽이면 안 된다. 호출부는 전부 try/catch.
 * Plausible/AdMob이 차단돼도 게임은 정상 동작한다.
 *
 * 광고 경로
 *  - 네이티브 앱(Capacitor + @capacitor-community/admob) → 실제 AdMob.
 *    지금은 구글 공식 '테스트 광고 ID'로만 뜬다(수익 0, 테스트 광고). 실출시 전 AD_IDS 교체.
 *  - 웹 → #mz-banner 슬롯. 실제 AdSense 클라이언트(WEB_ADSENSE)를 넣기 전엔 숨김
 *    (프리뷰: localhost 또는 ?adpreview=1 일 때만 자리표시자 노출).
 *  - 프리미엄이면 모든 광고 no-op.
 *
 * 프리미엄(광고 제거)
 *  - 지금은 localStorage 플래그. 실출시 전 스토어 IAP(네이티브)·결제(웹)를 buyPremium에 연결.
 *
 * ⚠️ 실출시 전에 바꿔야 하는 것 (아래 TODO 검색):
 *   1) AD_IDS = 네 AdMob 앱/광고단위 ID
 *   2) WEB_ADSENSE = 웹 AdSense 클라이언트/슬롯
 *   3) buyPremium/restorePremium = 실제 결제 연결
 *   4) 네이티브 매니페스트의 AdMob App ID (AndroidManifest / Info.plist)
 */
(function () {
  'use strict';

  var LS_PREMIUM = 'alley_premium';

  // ⚑ 광고 마스터 스위치 — 지금은 OFF.
  // 사용자 결정(2026-07-24): "수익화 연결 이전에 사람들이 플레이할 게임을 먼저."
  // 배너가 세로 공간(폰에서 52px)을 뺏고 광고 SDK가 렌더러를 함께 쓰므로,
  // 게임 최적화가 끝날 때까지 끈다. 다시 켤 땐 여기와 MainActivity의
  // AD_INSET_DP(웹뷰 하단 인셋)를 **함께** 되돌릴 것.
  var ADS_ENABLED = false;

  // TODO(실결제): 구글 공식 테스트 ID — 실출시 전 네 AdMob ID로 교체.
  var TEST = true;
  var AD_IDS = {
    appId:        { android: 'ca-app-pub-3940256099942544~3347511713', ios: 'ca-app-pub-3940256099942544~1458002511' },
    banner:       { android: 'ca-app-pub-3940256099942544/6300978111', ios: 'ca-app-pub-3940256099942544/2934735716' },
    interstitial: { android: 'ca-app-pub-3940256099942544/1033173712', ios: 'ca-app-pub-3940256099942544/4411468910' }
  };
  // TODO(실결제): 웹 AdSense — client('ca-pub-...')·slot 넣으면 웹 배너가 실제 광고로 렌더.
  var WEB_ADSENSE = { client: '', slot: '' };

  function ls(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }
  function lss(k, v) { try { localStorage.setItem(k, v); } catch (e) { } }
  function native() { try { return !!(window.Capacitor && Capacitor.isNativePlatform && Capacitor.isNativePlatform()); } catch (e) { return false; } }
  function platform() { try { return (window.Capacitor && Capacitor.getPlatform) ? Capacitor.getPlatform() : 'web'; } catch (e) { return 'web'; } }
  function admob() { try { return (window.Capacitor && Capacitor.Plugins && Capacitor.Plugins.AdMob) || null; } catch (e) { return null; } }
  function adId(kind) { var p = platform() === 'ios' ? 'ios' : 'android'; return (AD_IDS[kind] || {})[p]; }
  function webPreview() {
    try {
      if (WEB_ADSENSE.client) return true;
      if (location.hostname === 'localhost' || location.hostname === '127.0.0.1') return true;
      if (/[?&]adpreview=1\b/.test(location.search)) return true;
    } catch (e) { }
    return false;
  }

  var _inited = false, _bannerShown = false;

  var MZ = {
    TEST: TEST,
    isNative: native(),
    platform: platform(),
    onPremium: null, // 페이지가 UI 갱신용으로 붙일 수 있는 훅: onPremium(true)

    isPremium: function () { return ls(LS_PREMIUM) === '1'; },

    // 프리미엄 상태를 body.premium으로 반영 → CSS가 웹 광고 슬롯을 숨긴다.
    _reflect: function () { try { document.body.classList.toggle('premium', MZ.isPremium()); } catch (e) { } },

    // AdMob 초기화(네이티브 1회) + 프리미엄 반영. 실패해도 조용히.
    init: async function () {
      MZ._reflect();
      if (_inited) return; _inited = true;
      try {
        if (!ADS_ENABLED) return;   // 광고 OFF면 SDK도 띄우지 않는다(렌더러 부하 제거)
        var A = admob();
        if (native() && A) await A.initialize({ initializeForTesting: TEST });
      } catch (e) { }
    },

    // 하단 배너 노출. 프리미엄이면 숨기고 끝.
    banner: async function () {
      try {
        if (!ADS_ENABLED || MZ.isPremium()) { MZ.hideBanner(); return; }
        var A = admob();
        if (native() && A) {
          if (_bannerShown) return;
          await A.showBanner({ adId: adId('banner'), position: 'BOTTOM_CENTER', margin: 0, isTesting: TEST });
          _bannerShown = true;
        } else {
          var el = document.getElementById('mz-banner');
          if (el) el.hidden = !webPreview(); // AdSense 미설정 프로덕션 웹엔 빈 박스 안 띄움
        }
      } catch (e) { }
    },
    hideBanner: async function () {
      try {
        var A = admob();
        if (native() && A) { await A.hideBanner(); _bannerShown = false; }
        var el = document.getElementById('mz-banner'); if (el) el.hidden = true;
      } catch (e) { }
    },

    // 전면 광고(예: 게임 종료 후). 프리미엄이면 no-op. 웹은 아직 no-op.
    interstitial: async function () {
      try {
        if (!ADS_ENABLED || MZ.isPremium()) return;
        var A = admob();
        if (native() && A) {
          await A.prepareInterstitial({ adId: adId('interstitial'), isTesting: TEST });
          await A.showInterstitial();
        }
      } catch (e) { }
    },

    // 프리미엄(광고 제거) 구매. 지금은 로컬 플래그. 실출시 전 아래 TODO를 실결제로.
    buyPremium: async function () {
      try {
        // TODO(실결제): 네이티브 = @capacitor-community/in-app-purchases 상품 구매 →
        //   영수증 검증 성공 시에만 _setPremium(true). 웹 = 결제 페이지(Stripe 등).
        MZ._setPremium(true);
        return true;
      } catch (e) { return false; }
    },
    restorePremium: async function () {
      try { /* TODO(실결제): 스토어 구매 복원 성공 시 _setPremium(true) */ return MZ.isPremium(); } catch (e) { return false; }
    },

    _setPremium: function (on) {
      lss(LS_PREMIUM, on ? '1' : '0');
      MZ._reflect();
      if (on) MZ.hideBanner();
      try { if (typeof MZ.onPremium === 'function') MZ.onPremium(!!on); } catch (e) { }
    }
  };

  window.MZ = MZ;
  // 부트: 초기화(프리미엄 반영 + AdMob init). 배너는 노출을 원하는 페이지(허브)가 직접 MZ.banner() 호출.
  function boot() { try { MZ.init(); } catch (e) { } }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot); else boot();
})();
