#!/bin/bash
# 스토어용 **릴리스 AAB**를 만든다 (번들 모드 · 서명 필요).
#   npm run app:release
#
# 준비물
#   · android/keystore.properties  — 키스토어 경로·비번 (keystore.properties.example 참고, gitignore됨)
#   · 없으면 **서명 안 된 AAB**가 나온다 → Play 업로드 불가. 릴리스엔 반드시 있어야 한다.
#
# 이건 app-deploy.sh(개발 사이드로드용 디버그 APK)와 다르다 — 이쪽은 **스토어 제출용 서명 AAB**다.
set -e
ROOT="$(cd "$(dirname "$0")/.." && pwd)"

echo "▶ 드리프트 검사 (코어 ↔ HTML 인라인 사본)"
node "$ROOT/scripts/check-drift.js" >/dev/null || { echo "❌ 어긋남 — 'npm run build' 먼저"; exit 1; }

echo "▶ 번들 모드 확인"
if grep -q '"url"' "$ROOT/capacitor.config.json"; then
  echo "❌ capacitor.config.json에 server.url이 있다 — 원격 로드(OTA)라 번들이 안 된다. url을 빼야 스토어용 번들이 된다."
  exit 1
fi

echo "▶ 서명 설정 확인"
if [ ! -f "$ROOT/android/keystore.properties" ]; then
  echo "⚠️  android/keystore.properties 없음 → **서명 안 된 AAB**가 나온다(Play 업로드 불가)."
  echo "    keystore.properties.example를 복사해 채우고, 키스토어를 만든 뒤 다시 실행할 것."
fi

echo "▶ 웹 자산을 앱으로 동기화 (public/ → android)"
( cd "$ROOT" && npx cap sync android )

echo "▶ 릴리스 AAB 빌드 (첫 실행은 몇 분)"
( cd "$ROOT/android" && ./gradlew bundleRelease --no-daemon -q )

AAB="$ROOT/android/app/build/outputs/bundle/release/app-release.aab"
if [ -f "$AAB" ]; then
  SIZE=$(ls -lh "$AAB" | awk '{print $5}')
  VER=$(grep -oE 'versionName "[^"]+"' "$ROOT/android/app/build.gradle" | head -1 | sed 's/versionName //;s/"//g')
  echo "✅ AAB 생성: $AAB ($SIZE, v$VER)"
  echo "   → Play Console에 이 파일을 업로드한다. (첫 업로드 전 앱 등록·스토어 등록정보·콘텐츠 등급·개인정보 URL 필요)"
else
  echo "❌ AAB가 안 생겼다 — 위 gradle 로그 확인."
  exit 1
fi
