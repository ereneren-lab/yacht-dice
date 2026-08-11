#!/bin/bash
# 맥 배포본(.dmg) 만들기 — 서명·공증까지. (npm run dist:mac)
#
# 왜 이 스크립트가 있나 (2026-08-11)
#   electron-builder는 **자격증명이 없으면 조용히 서명·공증을 건너뛴다.** 그러면 겉보기엔 성공했는데
#   받는 사람 맥에서는 아예 안 열리는 DMG가 나온다. 실제로 그 DMG를 친구에게 줄 뻔했다.
#   그래서 만들기 전에 준비물을 눈으로 확인하고, 없으면 무엇이 없는지 먼저 말한다.
set -e
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

MISSING=0
say() { printf '  %s\n' "$1"; }

echo "▶ 준비물 확인"

# ① Developer ID Application 인증서 (로그인 키체인)
if security find-identity -v -p codesigning 2>/dev/null | grep -q "Developer ID Application"; then
  ID=$(security find-identity -v -p codesigning | grep "Developer ID Application" | head -1 | sed 's/.*"\(.*\)"/\1/')
  say "✅ 인증서: $ID"
else
  say "❌ 'Developer ID Application' 인증서가 키체인에 없다"
  say "   Xcode → Settings → Accounts → (계정 선택) → Manage Certificates → + → Developer ID Application"
  MISSING=1
fi

# ② 공증 자격증명 — 앱 암호 방식 또는 API 키 방식
if [ -n "$APPLE_ID" ] && [ -n "$APPLE_APP_SPECIFIC_PASSWORD" ]; then
  say "✅ 공증 자격증명: APPLE_ID ($APPLE_ID)"
elif [ -n "$APPLE_API_KEY" ] && [ -n "$APPLE_API_KEY_ID" ] && [ -n "$APPLE_API_ISSUER" ]; then
  say "✅ 공증 자격증명: App Store Connect API 키"
else
  say "❌ 공증 자격증명이 없다 — 둘 중 하나를 환경변수로 준다"
  say "   (쉬운 쪽) export APPLE_ID='애플ID' APPLE_APP_SPECIFIC_PASSWORD='앱-암호'"
  say "            앱 암호는 appleid.apple.com → 로그인 및 보안 → 앱 암호 에서 만든다"
  say "   (권장)   export APPLE_API_KEY=... APPLE_API_KEY_ID=... APPLE_API_ISSUER=..."
  MISSING=1
fi

# ③ 공증 도구
if xcrun notarytool --version >/dev/null 2>&1; then
  say "✅ notarytool $(xcrun notarytool --version 2>&1 | head -1)"
else
  say "❌ notarytool이 없다 → xcode-select --install"
  MISSING=1
fi

if [ "$MISSING" != "0" ]; then
  echo
  echo "❌ 준비가 덜 됐다. 이대로 만들면 **서명·공증 없이** 조용히 통과하고,"
  echo "   받는 사람 맥에서는 열리지 않는 DMG가 나온다. 위 항목을 채운 뒤 다시 실행할 것."
  echo "   그냥 로컬에서 써 볼 거면 DMG 말고 'npm run app'을 쓰면 된다."
  exit 1
fi

echo "▶ 빌드 (서명 → 공증 → 스테이플. 공증은 애플 서버가 처리해 몇 분 걸린다)"
npx electron-builder --mac

DMG=$(ls -t "$ROOT"/dist/*.dmg 2>/dev/null | head -1)
if [ -n "$DMG" ]; then
  echo "▶ 결과 확인"
  # 공증까지 제대로 됐으면 Gatekeeper가 accepted를 준다
  if spctl -a -vvv --type install "$DMG" 2>&1 | grep -q "accepted"; then
    echo "  ✅ Gatekeeper: accepted — 받는 사람이 그냥 열 수 있다"
  else
    echo "  ⚠️ Gatekeeper가 아직 accepted가 아니다:"
    spctl -a -vvv --type install "$DMG" 2>&1 | sed 's/^/     /' | head -4
  fi
  echo "  📦 $DMG"
fi
