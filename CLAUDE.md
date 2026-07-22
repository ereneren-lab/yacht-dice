# CLAUDE.md — 주사위 골목 (Dice Alley)

Claude Code가 매 세션 시작 시 읽는 프로젝트 안내서. 아키텍처·워크플로·**반복해서 터진 함정**을 담았다.

## 프로젝트 개요

브라우저 보드게임 허브. 게임 5종이 각각 **단일 HTML 파일**로 존재하고, **Node.js WebSocket 서버**(`server.js`) 하나가 정적 파일 서빙 + 온라인 멀티플레이(방/로비/권위 엔진)를 담당한다. 설치 없이 링크로 친구를 부르는 게 핵심.

- 배포: GitHub `ereneren-lab/yacht-dice` → **Render 자동 빌드** (`https://yacht-dice-jxva.onrender.com`)
- 데스크톱 앱: `electron/`은 **Render URL을 loadURL**한다 (로컬 파일 아님). 즉 **배포해야 Electron에도 반영됨**.

## 게임과 파일

| 게임 | HTML | 엔진 파일 (서버용) | HTML 내 인라인 사본 |
|------|------|--------------------|---------------------|
| 윷놀이 | `public/yut.html` | `public/yut-core.js` | yut.html 526행~ |
| 요트 다이스 | `public/yacht.html` | `public/game-core.js` | yacht.html 658행~ |
| 너클본즈 | `public/kb.html` | `public/kb-core.js` | kb.html 485행~ |
| 라이어 다이스 | `public/ld.html` | `public/ld-core.js` | ld.html 448행~ |
| 좌·중·우(LCR) | `public/lcr.html` | `public/lcr-core.js` | lcr.html 308행~ |
| 허브 | `public/index.html` | — | — |

서버는 게임 엔진을 `require`해서 방마다 인스턴스 1개를 돌린다(권위 서버). 클라는 상태 스냅샷을 받아 렌더만 한다.

## ⚠️ 엔진 이중 구조 (제일 중요) — 윷만이 아니라 **5종 전부**

**모든 게임 엔진은 `*-core.js`(서버가 `require`)와 해당 HTML 안 인라인 사본(브라우저용) 두 곳에 동일하게 존재한다.** 한쪽만 고치면 로컬/온라인 동작이 갈린다(드리프트).

**✅ 단일 소스화 완료 — 엔진은 `*-core.js`만 고치고 `npm run build`.** 빌드 스크립트(`scripts/build-inline.js`)가 core를 각 HTML의 `<!-- CORE:x START -->`~`<!-- CORE:x END -->` 마커 사이에 자동 주입한다. **HTML의 CORE 마커 블록은 직접 손대지 말 것**(빌드가 덮어씀). UI·렌더 등 엔진이 아닌 코드는 마커 바깥에서 평소처럼 HTML을 고친다.

- HTML은 `<script src="*-core.js">`로 불러오지 **않는다.** core 파일 내용이 UMD 래퍼째로 통째로 붙여넣어져 있다 (외부 파일 없이도 페이지가 동작하도록 한 의도적 복사).
- UMD 래퍼가 Node에선 `module.exports`, 브라우저에선 `window.YutCore` / `LCRCore` 등으로 갈라주므로 **같은 소스를 양쪽에 그대로** 쓸 수 있다.
- `lcr`의 인라인 사본은 과거 한 줄로 압축한 다른 포맷이었으나, **빌드 도입 시 core 원본으로 정규화**되어 이제 5종 모두 core와 동일 포맷이다.

동기화 확인법 — **`npm run check:drift`** (커밋/배포 전 실행, 5종 OK 확인 · 드리프트면 exit 1). 아래는 그 내부 로직(수동 대조용):
```bash
node -e 'const fs=require("fs");const s=x=>x.replace(/\/\*[\s\S]*?\*\//g,"").replace(/\/\/.*$/gm,"").replace(/\s+/g,"");
for(const[n,c,h]of[["yut","yut-core.js","yut.html"],["kb","kb-core.js","kb.html"],["ld","ld-core.js","ld.html"],["lcr","lcr-core.js","lcr.html"],["yacht","game-core.js","yacht.html"]])
console.log(n, s(fs.readFileSync("public/"+h,"utf8")).includes(s(fs.readFileSync("public/"+c,"utf8")))?"OK":"DRIFT")'
```

> 빌드/검사 스크립트: `scripts/build-inline.js`(core→HTML 주입), `scripts/check-drift.js`(드리프트 검사). `package.json`의 `npm run build` / `npm run check:drift`. 빌드는 멱등(같은 입력이면 재실행해도 변화 없음).

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

### 실제 브라우저 테스트 (`scripts/browser-test/`) — 이게 핵심
jsdom은 **DOM 구조와 서버**는 잡지만 **"클릭 → 화면 전환"과 연출은 못 잡는다.** 아래 함정들이 전부 그 사각지대에서 터졌다.
**Playwright MCP 없이도 된다** — Playwright가 받아둔 크로미움 캐시를 `ws`로 CDP 직접 제어한다(새 의존성 0).

```bash
node server.js                                  # 먼저 서버
node scripts/browser-test/verify-fx.js          # 자동 단언(출발칸 잔상·페이드·reduced-motion·예외)
node scripts/browser-test/capture.js hold       # 연출을 눈으로 — out/*.png
node scripts/browser-test/verify-online.js      # 탭 2개 = 사람 2명(채팅 왕복·자리 소유권·재접속)
```

**연출을 검증할 땐 `scripts/browser-test/README.md`를 먼저 읽을 것.** 특히 아래 #7.
자세한 사용법·구성·걸렸던 함정 전부 거기 있다.

### 배포
```bash
npm run build         # 엔진(*-core.js)을 고쳤다면 먼저 HTML에 동기화
npm run check:drift   # 5종 OK 확인 (드리프트면 커밋 금지)
git add -A && git commit -m "..." && git push
# → Render 자동 빌드 (몇 분) → Electron 재시작 시 반영
```

## 🕳️ 반복해서 터진 함정 (같은 실수 금지)

1. **`display:block`이 grid를 덮어씀** — `#game`은 CSS에서 `display:grid`(3단 레이아웃)인데, 게임 표시 시 `$('game').style.display='block'`으로 인라인 지정하면 grid가 무력화돼 세로로 쌓인다. → **`'grid'`로 표시**하거나, 안에 별도 grid 컨테이너를 둘 것(lcr/ld/kb는 후자 방식).

2. **미정의 함수가 render를 조용히 죽임** — `_emit(){ try{this.onState()}catch(e){} }`가 render 에러를 삼킨다. render 중간에서 미정의 함수(예: 과거의 `canAct`)를 호출하면 **그 지점 이후 코드(게이지·턴정보·버튼)가 전부 실행 안 되는데 에러는 안 보인다.** 화면 앞부분은 이미 그려진 뒤라 "게임은 되는데 일부만 안 됨"으로 나타난다. → `_emit` catch에 `console.error` 넣어 숨은 에러를 드러낼 것.

3. **"게임 종료 → 로비" 전환** — 서버는 판 종료 시 `room.phase='lobby'`로 바꿔 lobby 메시지를 보낸다. 클라 lobby 핸들러에 "게임 중이면 lobby 무시" 로직이 있는데, 이게 **판 종료 신호까지 막는다.** → `m.room.phase==='lobby'`면 게임 화면 정리 후 로비로 전환하는 분기를 **먼저** 둘 것. (yut/kb/ld/lcr 모두 이 버그가 있었음, yacht만 정상이었음.)

4. **레티나 좁은 폭** — macOS 레티나에서 CSS 뷰포트가 창의 절반(~496px)으로 잡혀 모바일 레이아웃으로 떨어진다. 3단(≥781px) / 2단(481–780px) / 1단(≤480px) 3단계 반응형으로 대응.

5. **컨테이너 리셋 시 node_modules 소실** — 헤드리스 검증용 `jsdom`, `ws`가 사라지면 `npm install jsdom ws`로 재설치. 실행은 `NODE_PATH`를 인라인 지정.

6. **애니 경로 ≠ 최종 위치 = 스냅(윷)** — 이동 연출은 "경로(중간 칸들)"를 따라 말을 미끄러뜨린 뒤 최종 위치에 정착시킨다. **경로 생성과 최종 위치 계산이 서로 다른 규칙을 쓰면** 말이 A로 애니메이션됐다가 B로 툭 순간이동(스냅)한다. 실제로 터진 예: 최종 위치 `step()`은 "출발칸이 모서리(5·10·22)일 때만 꺾기"인데, 경로를 `step()` **한 칸씩 반복**으로 만들면 **지나가는 모서리마다 꺾어** 지름길로 새버렸다(→ 목적지와 불일치 → 스냅). → 경로 생성기(`buildPath`)를 최종 계산과 **같은 route 선택 규칙**으로 만들고, **`buildPath` 마지막 칸 ≡ `step()` 최종 위치**를 전 조합 테스트로 보장할 것. `_shiftGroup`(부스터·후퇴)도 같은 `buildPath`를 써서 규칙을 통일한다. 헤드리스로 잡는 법: 풀게임 시뮬에서 (잡기·늪·이벤트 제외한) 순수 이동의 `lastMovePath.path` 마지막 칸과 말의 실제 `node/route`를 대조 → 불일치 0이어야 함.

7. **헤드리스는 모션이 꺼진 채로 돈다 — 연출 검증의 최대 함정** — 헤드리스 크로미움은 `prefers-reduced-motion` 기본값이 **`reduce`**다. 그래서 `FX_REDUCED()` 가드에 걸려 **모든 연출이 생략된 화면**이 나오는데, 겉으론 에러도 없고 게임도 정상이라 **"연출 코드가 안 돈다"를 코드 버그로 오진**하게 된다. (실제로 트레일도 기존 착지 먼지도 0개로 나와서 한참 헤맸다.) → CDP `Emulation.setEmulatedMedia`로 `no-preference`를 **명시**할 것. `scripts/browser-test/cdp.js`의 `page.setMotion(true)`가 이걸 처리하고, `setMotion(false)`로 두면 거꾸로 접근성(reduce) 경로를 검증할 수 있다.
   그리고 연출은 **수백 ms 만에 사라진다.** 그냥 스크린샷 찍으면 못 잡는다:
   - 잔상은 JS 타이머(`setTimeout ... remove()`)로 지워지므로 **CSS transition을 늘려도 소용없다.** 생성 순간 복제본을 남기거나(`capture.js hold`) 스크린캐스트로 프레임을 받아야(`film`) 한다.
   - **판을 축소한 몽타주로는 옅은 연출을 판정할 수 없다** — 지름 2px짜리 α.22 점은 뭉개져 "안 보인다"로 오판한다. 농도 판정은 원본 해상도로.
   - **나무판 위에서 밝은 갈색은 안 보인다.** `rgba(150,120,80,.14)`로 넣었다가 사실상 비가시였고, `rgba(90,66,40,.22)`(어두운 갈색)로 바꿔서야 은은하게 보였다. 새 연출 색은 `capture.js alpha`로 후보를 늘어놓고 고를 것.

8. **방/자리(pid)는 탭 단위다** — 방 코드·pid를 `localStorage`에만 두면 같은 브라우저의 다른 탭이 join하며 값을 덮어써, 먼저 있던 탭이 새로고침(모바일 복귀)할 때 **남의 자리로 rejoin**해 서로 끊는 루프에 빠진다. → 5종 모두 `sessionStorage`(탭 전용) 우선 읽기/쓰기(`seatGet/seatSet/seatDel`, 요트는 `SEAT`)를 쓰고, `localStorage`에는 허브 '이어하기' 배너용으로 함께 남긴다. 회귀 테스트: `npm run test:online2p`.

## 코딩 규칙

- 응답·주석은 한국어. 사용자(재성)는 틀리면 바로 지적함 — 정확성 우선.
- 테마 시스템: `localStorage` `alley_theme` + `data-theme` 속성. 테마별 CSS 변수(`--brass` 등).
- 온라인 action 형식: `wsSend({t:'action', a:{type:'throw', power}})` — 서버가 `m.a`를 엔진 `action(pid, a)`로 전달.
- 버전은 `package.json`. 변경 시 올릴 것.
