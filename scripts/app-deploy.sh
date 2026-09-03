#!/bin/bash
# 앱 APK를 빌드해 폰에 설치한다 — 동기화 → 빌드 → 설치 → 실행.
#   npm run app:deploy
#
# 🟢 2026-09-03 원격 로드(코드푸시) 복귀: capacitor.config.json에 server.url=github.io를 **다시 넣었다**.
#   앱은 라이브 웹을 원격 로드하므로 **콘텐츠는 Pages 배포(pages.yml)가 즉시 반영**한다 — APK 재설치 불필요.
#   오프라인은 서비스워커 캐시가 맡는다(첫 온라인 실행 후). #23에서 검증됐던 모델이다.
#   ⚠️ 이 디버그 APK/셸을 다시 만들어야 하는 건 **네이티브가 바뀔 때뿐**(권한·플러그인·아이콘/이름).
#   · 이 스크립트 = 개발/사이드로드용 **디버그 APK**. · 스토어 제출용 서명 AAB는 `npm run app:release`.
#   · 1일차(한 번도 온라인 안 한 기기)까지 오프라인을 보장하려면 정식 라이브업데이트(@capgo)가 다음 선택지다.
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
