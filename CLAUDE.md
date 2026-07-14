# CLAUDE.md — 주사위 골목 (Dice Alley)

Claude Code가 매 세션 시작 시 읽는 프로젝트 안내서. 아키텍처·워크플로·**반복해서 터진 함정**을 담았다.

## 프로젝트 개요

브라우저 보드게임 허브. 게임 5종이 각각 **단일 HTML 파일**로 존재하고, **Node.js WebSocket 서버**(`server.js`) 하나가 정적 파일 서빙 + 온라인 멀티플레이(방/로비/권위 엔진)를 담당한다. 설치 없이 링크로 친구를 부르는 게 핵심.

- 배포: GitHub `ereneren-lab/yacht-dice` → **Render 자동 빌드** (`https://yacht-dice-jxva.onrender.com`)
- 데스크톱 앱: `electron/`은 **Render URL을 loadURL**한다 (로컬 파일 아님). 즉 **배포해야 Electron에도 반영됨**.

## 게임과 파일

| 게임 | HTML | 엔진 |
|------|------|------|
| 윷놀이 | `public/yut.html` | `public/yut-core.js` **+ HTML 인라인 (이중)** |
| 요트 다이스 | `public/yacht.html` | `public/game-core.js` |
| 너클본즈 | `public/kb.html` | `public/kb-core.js` |
| 라이어 다이스 | `public/ld.html` | `public/ld-core.js` |
| 좌·중·우(LCR) | `public/lcr.html` | `public/lcr-core.js` |
| 허브 | `public/index.html` | — |

서버는 게임 엔진을 `require`해서 방마다 인스턴스 1개를 돌린다(권위 서버). 클라는 상태 스냅샷을 받아 렌더만 한다.

## ⚠️ 엔진 이중 구조 (제일 중요)

**윷 엔진은 `yut-core.js`(서버용 UMD)와 `yut.html` 안 인라인(브라우저용) 두 곳에 동일하게 존재한다.** 엔진 로직을 고칠 때 **반드시 두 곳 다** 수정해야 한다. 한쪽만 고치면 로컬/온라인 동작이 갈린다.

> 개선 아이디어: 빌드 스크립트로 `yut-core.js`를 HTML에 자동 주입해 단일 소스화 (아직 미구현).

## 개발 워크플로

### 로컬 실행
```bash
npm install
node server.js      # http://localhost:3000
```

### 검증 (실제 브라우저 없이)
1. **문법**: 각 `<script>` 블록을 추출해 `node --check`
2. **로드**: jsdom으로 HTML 로드 — 아래 스텁 필요
   - `AudioContext`/`webkitAudioContext`, `WebSocket`, `navigator.vibrate`, `requestAnimationFrame`, `navigator.serviceWorker`, `performance.now`
3. **서버 e2e**: `ws`로 실제 서버 띄우고 create→join→start→action 흐름 확인

### 실제 브라우저 테스트 (Playwright MCP) — 이게 핵심
헤드리스(jsdom/ws)는 **DOM 구조와 서버**는 잡지만 **"클릭 → 화면 전환" 흐름은 못 잡는다.** 아래 함정들이 전부 그 사각지대에서 터졌다. Playwright로 실제 크로미움을 띄워 **게임 시작 → 던지기 → 이동 → 판 종료 → 로비 복귀 → 재시작**을 직접 클릭하며 검증할 것.

### 배포
```bash
git add -A && git commit -m "..." && git push
# → Render 자동 빌드 (몇 분) → Electron 재시작 시 반영
```

## 🕳️ 반복해서 터진 함정 (같은 실수 금지)

1. **`display:block`이 grid를 덮어씀** — `#game`은 CSS에서 `display:grid`(3단 레이아웃)인데, 게임 표시 시 `$('game').style.display='block'`으로 인라인 지정하면 grid가 무력화돼 세로로 쌓인다. → **`'grid'`로 표시**하거나, 안에 별도 grid 컨테이너를 둘 것(lcr/ld/kb는 후자 방식).

2. **미정의 함수가 render를 조용히 죽임** — `_emit(){ try{this.onState()}catch(e){} }`가 render 에러를 삼킨다. render 중간에서 미정의 함수(예: 과거의 `canAct`)를 호출하면 **그 지점 이후 코드(게이지·턴정보·버튼)가 전부 실행 안 되는데 에러는 안 보인다.** 화면 앞부분은 이미 그려진 뒤라 "게임은 되는데 일부만 안 됨"으로 나타난다. → `_emit` catch에 `console.error` 넣어 숨은 에러를 드러낼 것.

3. **"게임 종료 → 로비" 전환** — 서버는 판 종료 시 `room.phase='lobby'`로 바꿔 lobby 메시지를 보낸다. 클라 lobby 핸들러에 "게임 중이면 lobby 무시" 로직이 있는데, 이게 **판 종료 신호까지 막는다.** → `m.room.phase==='lobby'`면 게임 화면 정리 후 로비로 전환하는 분기를 **먼저** 둘 것. (yut/kb/ld/lcr 모두 이 버그가 있었음, yacht만 정상이었음.)

4. **레티나 좁은 폭** — macOS 레티나에서 CSS 뷰포트가 창의 절반(~496px)으로 잡혀 모바일 레이아웃으로 떨어진다. 3단(≥781px) / 2단(481–780px) / 1단(≤480px) 3단계 반응형으로 대응.

5. **컨테이너 리셋 시 node_modules 소실** — 헤드리스 검증용 `jsdom`, `ws`가 사라지면 `npm install jsdom ws`로 재설치. 실행은 `NODE_PATH`를 인라인 지정.

## 코딩 규칙

- 응답·주석은 한국어. 사용자(재성)는 틀리면 바로 지적함 — 정확성 우선.
- 테마 시스템: `localStorage` `alley_theme` + `data-theme` 속성. 테마별 CSS 변수(`--brass` 등).
- 온라인 action 형식: `wsSend({t:'action', a:{type:'throw', power}})` — 서버가 `m.a`를 엔진 `action(pid, a)`로 전달.
- 버전은 `package.json`. 변경 시 올릴 것.
