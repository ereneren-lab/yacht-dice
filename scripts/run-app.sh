#!/bin/bash
# 데스크톱 창으로 띄운다 (npm run app). 이 맥에서 두 번 발목을 잡은 것을 미리 치운다.
#
# 왜 이 스크립트가 필요한가 (2026-08-11에 반나절 걸려 알아낸 것)
#   ① **npm의 Electron 압축 해제가 이 맥에서 실패한다.**
#      `node_modules/electron/dist/`에 LICENSE·version 세 파일만 남고 Electron.app이 안 들어온다.
#      캐시를 지우고 다시 받아도 같다. `unzip`으로 직접 풀면 239MB가 멀쩡히 들어온다.
#   ② **서명 없는 실행 파일은 실행하는 순간 시스템이 죽이고 지운다.**
#      압축만 풀고 두면 멀쩡한데, 한 번 실행하면 실행 파일이 통째로 사라진다(실측).
#      자체 서명(ad-hoc)을 붙이면 지워지지 않고 정상 실행된다. 개발자 계정은 필요 없다.
#
# 둘 다 조용히 실패해서 "앱이 안 켜진다"로만 보인다. 그래서 여기서 미리 확인하고 고친다.
# 정상인 환경(다른 맥·CI)에서는 아무 일도 하지 않고 그냥 실행한다.
set -e
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
APP="$ROOT/node_modules/electron/dist/Electron.app"
BIN="$APP/Contents/MacOS/Electron"

if [ "$(uname)" = "Darwin" ]; then
  # ① 실행 파일이 없으면 내려받은 zip에서 직접 푼다
  if [ ! -x "$BIN" ]; then
    VER=$(node -p "require('$ROOT/node_modules/electron/package.json').version" 2>/dev/null || echo '')
    ZIP=$(ls "$HOME/Library/Caches/electron/"*/electron-v${VER}-darwin-*.zip 2>/dev/null | head -1)
    if [ -n "$ZIP" ]; then
      echo "▶ Electron 실행 파일이 없다 — zip에서 직접 푼다 (npm 압축 해제가 이 맥에서 실패한다)"
      rm -rf "$APP"
      unzip -q -o "$ZIP" -d "$ROOT/node_modules/electron/dist/"
    else
      echo "❌ Electron도 없고 받아둔 zip도 없다 → npm i electron 먼저"; exit 1
    fi
  fi

  # ② 서명이 유효하지 않으면 자체 서명을 붙인다 (안 붙이면 실행 즉시 지워진다)
  if ! codesign --verify --deep --strict "$APP" >/dev/null 2>&1; then
    echo "▶ 자체 서명(ad-hoc)을 붙인다 — 안 붙이면 실행하는 순간 시스템이 지운다"
    # --deep은 순서를 못 지켜 자주 실패한다 → 깊은 것부터 하나씩
    find "$APP" -type d \( -name '*.framework' -o -name '*.app' \) -print0 2>/dev/null \
      | xargs -0 -I{} sh -c 'codesign --force --sign - --timestamp=none "{}" >/dev/null 2>&1 || true'
    codesign --force --deep --sign - --timestamp=none "$APP" >/dev/null 2>&1 || true
    codesign --verify --deep --strict "$APP" >/dev/null 2>&1 \
      && echo "   서명 완료" || echo "   ⚠️ 서명 검증 실패 — 그래도 실행은 해본다"
  fi
fi

[ "$1" = "--check" ] && { echo "✅ 준비 끝 (실행은 건너뛴다)"; exit 0; }

# 앱은 자기 서버를 3000에 띄운다. 이미 `node server.js`가 떠 있으면 그걸 그대로 쓴다(같은 public/이라 무방).
exec "$ROOT/node_modules/.bin/electron" "$ROOT/electron/main.js" "$@"
