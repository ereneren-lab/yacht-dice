#!/bin/bash
# 앱 APK를 빌드해 폰에 설치한다 — 동기화 → 빌드 → 설치 → 실행.
#   npm run app:deploy
#
# 🟢 2026-08-30 번들 전환(스토어 출시 준비, PR #39): capacitor.config.json에서 server.url을 **뺐다**.
#   이제 `cap sync`가 웹 자산(public/)을 **APK 안에 구워** 넣는다 → 앱은 오프라인에서도 열린다.
#   (한동안 OTA(server.url=github.io 원격 로드)였으나, Play 심사·오프라인 때문에 번들로 되돌렸다.)
#   ⚠️ 그래서 **콘텐츠를 고치면 이 스크립트로 APK를 다시 만들어야** 폰에 반영된다(OTA 아님).
#   · 이 스크립트 = 개발/사이드로드용 **디버그 APK**. · 스토어 제출용 서명 AAB는 `npm run app:release`.
#   · 콘텐츠 자동 업데이트가 다시 필요하면 정식 OTA(@capgo)를 얹는 게 다음 선택지다.
#
# 준비물: USB 연결 + USB 디버깅 허용.
#   ⚠️ 삼성 '자동 차단'(설정→보안 및 개인정보 보호)이 켜져 있으면 설치가 막힌다 → 끌 것.
set -e

export JAVA_HOME="${JAVA_HOME:-/opt/homebrew/opt/openjdk@17/libexec/openjdk.jdk/Contents/Home}"
export PATH="$PATH:$HOME/Library/Android/sdk/platform-tools"
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
APK="$ROOT/android/app/build/outputs/apk/debug/app-debug.apk"
PKG="com.jaesung.yachtdice"

if ! command -v adb >/dev/null; then echo "❌ adb를 못 찾음 — Android SDK platform-tools 확인"; exit 1; fi

DEV=$(adb devices | awk 'NR>1 && $2=="device" {print $1; exit}')
if [ -z "$DEV" ]; then
  echo "❌ 연결된 기기가 없다."
  echo "   · USB 연결 확인 · 폰에서 'USB 디버깅 허용' 승인"
  echo "   · 삼성 '자동 차단'이 켜져 있으면 승인 창 자체가 안 뜬다 → 끌 것"
  adb devices
  exit 1
fi
echo "📱 기기: $DEV"

# 엔진(*-core.js)을 고쳤다면 HTML 인라인 사본과 어긋난 채로 폰에 들어간다 → 먼저 막는다
echo "▶ 드리프트 검사"
node "$ROOT/scripts/check-drift.js" >/dev/null || { echo "❌ 코어와 HTML이 어긋남 — 'npm run build' 먼저"; exit 1; }

echo "▶ 웹 자산 동기화"
( cd "$ROOT" && npx cap sync android >/dev/null )

# (2026-08-11) 예전엔 여기서 앱 번들의 Plausible 스크립트를 local판으로 바꿔 넣었다.
# GoatCounter로 옮기면서 필요 없어졌다 — count.js를 `allow_local:true`로 실어서
# 앱(https://localhost)이 통째로 빠지는 일이 없고, 개발 트래픽은 analytics.js의 문지기가 막는다.

echo "▶ APK 빌드 (첫 실행은 몇 분 걸린다)"
( cd "$ROOT/android" && ./gradlew assembleDebug --no-daemon -q )

echo "▶ 설치"
adb -s "$DEV" install -r "$APK" | tail -1

echo "▶ 실행"
adb -s "$DEV" shell am force-stop "$PKG"
adb -s "$DEV" shell am start -n "$PKG/.MainActivity" >/dev/null

SIZE=$(ls -lh "$APK" | awk '{print $5}')
VER=$(node -p "require('$ROOT/package.json').version")
echo "✅ v$VER 올림 ($SIZE)"
