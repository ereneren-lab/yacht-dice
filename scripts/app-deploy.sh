#!/bin/bash
# 폰에 최신 게임을 올린다 — 동기화 → 빌드 → 설치 → 실행을 한 번에.
#   npm run app:deploy
#
# 앱은 Render를 보지 않고 public/을 APK 안에 담아 쓴다(capacitor.config.json의 webDir).
# 그래서 게임을 고쳐도 다시 빌드해 넣기 전엔 폰에 반영되지 않는다. 그 한 줄이 이 스크립트다.
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

# 앱 번들만 Plausible 스크립트를 localhost 허용판으로 바꾼다.
#   앱 자산은 https://localhost로 뜨는데, 기본 script.js는 localhost면 "Ignoring Event: localhost"를
#   찍고 전부 버린다 → 앱 사용이 계측에 하나도 안 잡힌다(2026-08-11 실측).
#   ⚠️ public/ 원본은 건드리지 않는다. 웹까지 local판을 쓰면 개발 중 브라우징이 실서비스 숫자에 섞인다.
echo "▶ 앱 번들 계측 보정 (script.js → script.local.js)"
ASSETS="$ROOT/android/app/src/main/assets/public"
BEFORE=$(grep -rl "plausible.io/js/script.js" "$ASSETS" 2>/dev/null | wc -l | tr -d ' ')
if [ "$BEFORE" != "0" ]; then
  grep -rl "plausible.io/js/script.js" "$ASSETS" | while read -r f; do
    sed -i '' 's#plausible.io/js/script.js#plausible.io/js/script.local.js#g' "$f"
  done
fi
AFTER=$(grep -rl "plausible.io/js/script.local.js" "$ASSETS" 2>/dev/null | wc -l | tr -d ' ')
echo "   $BEFORE개 파일 → local판 $AFTER개"
[ "$AFTER" = "0" ] && echo "   ⚠️ 하나도 안 바뀌었다 — 앱 사용은 계측에 안 잡힌다(치명적이진 않다)"

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
