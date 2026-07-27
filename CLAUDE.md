# CLAUDE.md — 주사위 골목 (Dice Alley)

Claude Code가 매 세션 시작 시 읽는 프로젝트 안내서. 아키텍처·워크플로·**반복해서 터진 함정**을 담았다.

## 프로젝트 개요

브라우저 보드게임 허브. 게임 5종이 각각 **단일 HTML 파일**로 존재하고, **Node.js WebSocket 서버**(`server.js`) 하나가 정적 파일 서빙 + 온라인 멀티플레이(방/로비/권위 엔진)를 담당한다. 설치 없이 링크로 친구를 부르는 게 핵심.

- 배포: GitHub `ereneren-lab/yacht-dice` → **Render 자동 빌드** (`https://yacht-dice-jxva.onrender.com`)
- 데스크톱 앱: `electron/`은 **Render URL을 loadURL**한다 (로컬 파일 아님). 즉 **배포해야 Electron에도 반영됨**.

## 게임과 파일

| 게임 | HTML | 엔진 파일 | 온라인 |
|------|------|-----------|--------|
| 윷놀이 | `public/yut.html` | `public/yut-core.js` | ✅ |
| 요트 다이스 | `public/yacht.html` | `public/game-core.js` | ✅ |
| 너클본즈 | `public/kb.html` | `public/kb-core.js` | ✅ |
| 라이어 다이스 | `public/ld.html` | `public/ld-core.js` | ✅ |
| 좌·중·우(LCR) | `public/lcr.html` | `public/lcr-core.js` | ✅ |
| 알까기 | `public/alkkagi.html` | `public/alkkagi-core.js` | ✅ |
| 섯다 | `public/seotda.html` | `public/seotda-core.js` | — (로컬/AI) |
| 인디언 포커 | `public/indianpoker.html` | `public/indianpoker-core.js` | — (로컬/AI · v1.232 코어 분리) |
| 원카드 | `public/onecard.html` | `public/onecard-core.js` | — (로컬/AI · v1.233 코어 분리) |
| 도둑잡기 | `public/oldmaid.html` | `public/oldmaid-core.js` | — (로컬/AI · v1.234 코어 분리) |
| 카드 3종 | `blackjack`·`baccarat`·`highlow`.html | (코어 없음 — HTML 안) | — |
| 허브 | `public/index.html` | — | — |

서버는 게임 엔진을 `require`해서 방마다 인스턴스 1개를 돌린다(권위 서버). 클라는 상태 스냅샷을 받아 렌더만 한다.

## ⚠️ 엔진 이중 구조 (제일 중요) — 코어가 있는 **10종 전부**

**코어가 있는 게임 엔진은 `*-core.js`(서버가 `require`)와 해당 HTML 안 인라인 사본(브라우저용) 두 곳에 동일하게 존재한다.** 한쪽만 고치면 로컬/온라인 동작이 갈린다(드리프트).

**✅ 단일 소스화 완료 — 엔진은 `*-core.js`만 고치고 `npm run build`.** 빌드 스크립트(`scripts/build-inline.js`)가 core를 각 HTML의 `<!-- CORE:x START -->`~`<!-- CORE:x END -->` 마커 사이에 자동 주입한다. **HTML의 CORE 마커 블록은 직접 손대지 말 것**(빌드가 덮어씀). UI·렌더 등 엔진이 아닌 코드는 마커 바깥에서 평소처럼 HTML을 고친다.

- HTML은 `<script src="*-core.js">`로 불러오지 **않는다.** core 파일 내용이 UMD 래퍼째로 통째로 붙여넣어져 있다 (외부 파일 없이도 페이지가 동작하도록 한 의도적 복사).
- UMD 래퍼가 Node에선 `module.exports`, 브라우저에선 `window.YutCore` / `LCRCore` 등으로 갈라주므로 **같은 소스를 양쪽에 그대로** 쓸 수 있다.
- `lcr`의 인라인 사본은 과거 한 줄로 압축한 다른 포맷이었으나, **빌드 도입 시 core 원본으로 정규화**되어 이제 5종 모두 core와 동일 포맷이다.

동기화 확인법 — **`npm run check:drift`** (커밋/배포 전 실행, **10종** OK 확인 · 드리프트면 exit 1).
게임을 새로 코어 분리하면 `scripts/build-inline.js`의 `MAP`과 `scripts/check-drift.js`의 `CASES` **양쪽에** 추가해야 한다(한쪽만 넣으면 검사에서 조용히 빠진다).
⚠️ CORE 마커는 START/END **사이에 최소 한 줄**이 있어야 정규식이 잡는다 — 두 줄을 붙여 넣으면 "마커 없음"으로 실패한다.

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
node scripts/browser-test/verify-analytics.js   # 계측 퍼널 30개 단언 (~4분)
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

## 📊 계측 (Plausible · 2026-07-22 도입)

**왜 있나.** 22일 넘게 라이브였는데 방문자 수를 한 번도 모른 적이 없었다.
"게임이 별로인가"와 "아무도 온 적이 없나"를 구분하려고 넣었다.
목적·실험 설계는 `유입실험_계획.md`.

| 이벤트 | 언제 | 어디에 박혔나 |
|---|---|---|
| pageview | 자동 (UTM 자동 수집) | 각 HTML `<head>` |
| `허브_카드클릭` | 허브에서 게임 카드 클릭 | `index.html` 하단 위임 리스너 |
| `게임시작` | 판이 깔린 순간 · **페이지당 1회** | 아래 참고 |
| `1판완료` | 전적이 오르는 그 자리 | 5종 `Stats.record`의 `games++` 직전 |

- 구현: **`public/analytics.js`** (`window.AL`). 쿠키·localStorage 미사용 → **동의 배너 불필요**.
- **`게임시작`은 게임 로직을 안 건드린다.** 윷·너클본즈·라이어·좌중우는 판이 깔릴 때
  `body`에 `ingame`이 붙는데, analytics.js가 그걸 MutationObserver로 관찰한다.
  **요트만 `ingame`을 안 써서** `yacht.html`에서 `AL.start()`를 직접 부른다.
  → 새 게임을 추가하면 `ingame`을 붙이거나 `AL.start()`를 직접 부를 것.
- `AL.start()`는 **멱등**이다. 로비 복귀 후 재시작해도 페이지당 1회만 센다.
- 호출부는 전부 `try{window.AL&&AL...}catch(e){}`로 감쌌다.
  **계측이 게임을 죽이면 안 된다** — Plausible이 차단돼도 게임은 정상 동작한다.
- 로컬(localhost)에선 Plausible이 이벤트를 버리므로 analytics.js가 콘솔에 `[AL] ...`을 찍는다.
  `verify-analytics.js`가 그 줄을 읽어 단언한다.
- ⚠️ `{게임}` 같은 커스텀 속성은 Plausible 요금제에 따라 대시보드에서 안 보일 수 있다.
  **게임별 구분은 페이지 주소로도 나오므로** 속성은 보너스다.

**검증 상태 (정직하게).** `verify-analytics.js` 30개 단언 통과.
`게임시작`·`허브_카드클릭`은 실제 브라우저에서 발화를 봤다.
**`1판완료`은 정적 배선 단언까지만 검증됐다** — `AL.done`이 `games++` 바로 앞에 있음은
보장되나 실제 발화를 브라우저에서 보지는 못했다(`--full` 미완성, 아래 함정 참고).
→ **배포 후 Plausible 대시보드에서 `1판완료`이 실제로 찍히는지 한 번 눈으로 확인할 것.**

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

8. **방/자리(pid)는 탭 단위다** — 방 코드·pid를 `localStorage`에만 두면 같은 브라우저의 다른 탭이 join하며 값을 덮어써, 먼저 있던 탭이 새로고침(모바일 복귀)할 때 **남의 자리로 rejoin**해 서로 끊는 루프에 빠진다. → 5종 모두 `sessionStorage`(탭 전용) 우선 읽기/쓰기(`seatGet/seatSet/seatDel`, 요트는 `SEAT`)를 쓰고, `localStorage`에는 허브 '이어하기' 배너용으로 함께 남긴다. **새 탭(초대 링크로 방금 연 탭)은 sessionStorage가 비어 localStorage로 폴백**하므로 여기서도 자리를 뺏을 수 있다 → 부트에서 `BroadcastChannel('alley_seat')`로 "이 자리 쓰는 탭 있냐"를 묻고(250ms) 있으면 자동 rejoin을 포기한다(v1.155). 회귀 테스트: `npm run test:online2p`.

8. **`max-width` 기반 압축은 가로 회전(landscape)에서 통째로 무력해진다 (v1.227)** — 폰을 돌리면 **폭이 640~844px로 커지고 높이가 360~390px로 줄어든다.** 그러면 `@media (max-width:480px)`에 넣어둔 '높이 확보용' 압축이 전부 빠지면서, 정작 높이가 가장 부족한 순간에 압축이 사라진다. 실제로 세로에선 넘침 0인데 가로에서 요트 +749 · 너클본즈 +322 · 라이어 +313 · 윷 +300px가 났다. → **높이를 확보하는 규칙은 `max-height`/`orientation:landscape`로 걸 것.** 같은 구멍이 481~780px 구간(2단)에도 있다 — `≤480`의 압축도, `≥781`의 가로 배치도 못 받는 구간이라 가장 심하게 넘친다. 검사: **`npm run audit:ux`** (13게임 × 8뷰포트 × 셋업/룰오버레이/인게임/룰접근/가로잘림).

8-b. **가로에서는 `min-width` 규칙이 거꾸로 해를 끼친다 (v1.228)** — 함정 8이 "`max-width` 압축이 안 걸린다"였다면, 그 반대도 있다. 요트의 `.turnbanner.big`은 `@media(min-width:701px)`에서 켜지는 **큰 캐릭터 배너(아바타 100px · `min-height:178px`)** 인데, 가로 폰은 폭이 844px이라 이게 켜진다 — **세로 공간은 390px뿐인데.** 실제로 요트 가로 넘침 460px 중 178px이 이 배너였다. → 가로 블록에서 `min-width`로 켜지는 '넓으니까 크게' 규칙들을 되돌릴 것. 그리고 **`.turnbanner`(한 클래스)로는 `.turnbanner.big`(두 클래스)을 못 이긴다** — 같은 특이도로 써야 먹는다.

9. **`position:sticky`는 요소가 컨테이너의 마지막 자식이면 아무 일도 안 한다** — 위로 움직일 여유가 0이기 때문. 요트·섯다 셋업의 '시작' 버튼에 sticky가 걸려 있었는데도 짧은 화면에서 **화면 밖으로 나가 게임을 시작조차 못 했다.** → 래퍼를 고정하거나(`#helpOv .btns`가 쓰는 방식) `position:fixed`를 쓸 것. `#setup`처럼 판이 깔리면 `display:none`되는 컨테이너 안에 두면 게임 화면에 남지 않는다.

10. **`body{overflow-x:hidden}`은 가로로 잘린 버튼을 숨긴다** — 페이지 넘침 수치(hOver)로는 절대 안 잡힌다. 너클본즈 상단바의 '?'(규칙) 버튼이 그렇게 조용히 사라져 있었다(right=396 / 화면 360). `audit:ux`의 ⑤ 항목이 버튼 rect를 직접 봐서 잡는다.

11. **HTML `style` 속성이 두 개면 뒤쪽은 무시된다** — `#rollWrap`이 `style="max-width…"` … `style="display:none"`이라 `display:none`이 안 먹고 셋업 화면 뒤에 버튼이 떠 있었다. 그리고 **JS가 인라인 `display`를 넣는 요소는 일반 CSS로 못 숨긴다** → `!important`가 필요하다(`#kbMode`).

12. **CSS 미디어 블록을 기본 규칙보다 앞에 두면 기본 규칙이 이긴다** — 특이도가 같으면 나중에 오는 쪽이 이기므로, `.arena{flex-direction:column}`이 파일 뒤에 있어서 앞선 미디어 쿼리의 `row`가 덮였다. 에러도 안 나고 "왜 안 먹지"로만 나타난다. → 오버라이드 블록은 **기본 정의 뒤에** 둘 것.

13. **CDP 테스트에서 게임의 `S`(상태) 변수를 못 읽을 수 있다** — IIFE 안에 있으면 `Runtime.evaluate`로 접근이 안 된다(ld·lcr이 그렇고, 섯다는 된다). 이걸 "기능이 안 된다"로 오진하기 쉽다. → **DOM으로 단언할 것.** 사용자가 실제로 보는 것을 검증하는 게 더 정직하다.

14. **`serialize(viewerPid)`가 가리는 대상은 게임마다 다르다 (v1.232)** — 라이어·섯다는 '남'을 가리지만
   **인디언 포커는 '보는 사람 자신'을 가린다**(남의 카드는 다 보이고 내 것만 안 보이는 게임). 다른 코어를 복사해
   `s !== vseat`를 그대로 쓰면 **게임이 통째로 뒤집힌다** — 그런데 화면은 멀쩡해 보여서 눈치채기 어렵다.
   → 새 게임의 코어를 만들 땐 "이 게임에서 **누가 무엇을 볼 수 없나**"를 먼저 한 줄로 적고 시작할 것.
   회귀 단언: 판 중(`phase==='bet'`)에 `serialize(나).myCard`가 null이고 `players[상대].card`는 non-null.

15. **첫 방문 오버레이가 자동 테스트를 깨뜨린다** — 튜토리얼·규칙이 처음 방문에 자동으로 떠서 시작 버튼 클릭을 막는다. 감사·테스트는 시작 전에 `TUT.close()` + `#helpClose/#rulesClose`를 먼저 눌러야 한다.

16. **게임에 새 '선택 단계'를 넣으면 e2e 드라이버가 조용히 굳는다** — v1.160이 "여러 끗수가
   남았을 때 판에서 목적지 고르기"(`.stepghost`)를 추가했는데 `yut-drive.js`의
   `resolveDirection`은 옛 지름길 오버레이(`#dirSt`)만 알았다. 그 결과 드라이버가 말을 누른 뒤
   아무것도 고르지 않아 게임이 "어디로 갈지 골라주세요"에서 멈췄다.
   **실측: 8분 동안 진행 1턴 / 대기 942회.** 실패가 아니라 **침묵**으로 나타난다 —
   단언이 깨지는 게 아니라 게임이 진행되지 않은 채 시간만 흐른다.
   (다행히 `verify-fx.js`는 이 경우를 `skip()`으로 "판정 불가"라고 찍고 **종료코드 2**를 낸다.
   통과로 위장되지는 않는다. 새 테스트를 쓸 때도 이 구분을 반드시 따라할 것 —
   "표본을 못 모은 것"과 "단언이 깨진 것"은 다른 사건이다.)
   → **플레이 흐름에 새 인터랙션 단계를 추가하면 `yut-drive.js`를 같이 고칠 것.**
   드라이버 수정 후에는 "실제로 몇 턴이 진행됐는지"를 로그로 확인할 것(0턴 통과 방지).

17. **장시간 CDP 세션은 끊긴다 — 재시도를 반드시 감쌀 것** — 윷을 몇 분 이상 연속으로 돌리면
   `"CDP 소켓이 끊겼다"` / `"브라우저 프로세스 종료"`로 크로미움이 죽는다.
   `verify-fx.js`가 이미 이유를 적어뒀다: **이 환경은 메모리가 빠듯하다.**
   그래서 `verify-fx.js`는 `run()`을 try/catch로 감싸 4초 쉬고 **1회 재시도**한다.
   → **풀게임을 도는 새 테스트를 쓸 땐 이 재시도 래퍼를 그대로 복사할 것.**
   래퍼 없이 짜서 3회 연속 죽고 "원인 미규명"으로 오진한 적 있다(2026-07-22).

18. **최상위 `let`/`const`는 `window`에 안 올라간다 — CDP 드라이버가 조용히 굳는다 (v1.233)** —
   함정 #13의 짝이다. #13이 "IIFE 안이라 못 읽는다"였다면 이건 **IIFE 밖인데도 `window`엔 없다**는 것.
   클래식 스크립트 최상위의 `let S`는 전역 **렉시컬** 환경에 들어가 `window.S`가 **undefined**다
   (`var`였다면 올라간다). 그래서 `if(!window.S) return;`로 시작하는 드라이버는 **매 틱 즉시 빠져나가**
   아무것도 안 한 채 시간만 흘린다 — 원카드 완주 테스트가 6조합 × 60초를 그렇게 날렸다.
   화면은 멀쩡히 "내 차례"를 그리고 있어서 **게임 버그로 오진하기 딱 좋다.**
   → CDP에서 페이지 변수를 볼 땐 **`typeof X !== 'undefined'`로 맨 이름을 참조**할 것
   (`window.X`가 아니라). 기존 테스트들이 `var _S=(typeof S!=='undefined')?S:null;`를 쓰는 게 이 이유다.
   그리고 함정 #16대로 **"실제로 몇 턴 진행됐는지"를 반드시 로그로 남길 것** — 0턴이면 통과가 아니다.

19. **엔진이 setTimeout으로 진행하면 헤드리스 시뮬이 '교착'으로 오진된다 (v1.234)** —
   도둑잡기 엔진은 뽑기 → (뜸) → 짝 판정 → (뜸) → 다음 차례를 타이머로 잇는데, 시뮬의
   **동기 while 루프는 이벤트 루프를 안 놔주므로 그 타이머가 영영 안 돈다.** 짝이 안 버려지고
   턴이 안 넘어가서 겉보기엔 완벽한 '엔진 교착'인데, **엔진은 멀쩡하고 하네스가 문제**였다.
   (v1.232에도 같은 계열의 함정이 있었다 — 그땐 `destroy()`를 안 불러서 끝난 판이 계속 돌았다.)
   → 연출용 딜레이는 `_after(ms, fn)`처럼 **ms가 0 이하면 동기 실행**하도록 두고,
   시뮬은 `pairMs:0, stepMs:0`으로 엔진을 통째로 동기로 돌릴 것. 하네스를 비트는 것보다
   엔진을 테스트 가능하게 만드는 쪽이 낫다.

## 📖 튜토리얼 (공용 모듈 · v1.227)

13게임 전부 단계별 튜토리얼이 있다. 4종(kb·ld·lcr·섯다)은 **자체 구현**을, 나머지 9종은 **공용 모듈**을 쓴다.

- 모듈: `public/tutorial.js` (`window.TUT`). 마크업·CSS를 스스로 주입하고, 상단바(`.topbar`/`.kbtop`)에 📖 버튼을 자동 장착한다.
- 붙이는 법 — 게임 HTML의 **`</title>` 직후**에 두 줄:
  ```html
  <script src="tutorial.js"></script>
  <script>try{TUT.init({game:'yut',steps:[{art:'🎲',title:'…',body:'…'}]})}catch(e){}</script>
  ```
  ⚠️ **`</title>` 직후여야 한다** — 13개 HTML 모두 `analytics.js`가 '계측 보류' 주석 블록 안에 있어서, 그 뒤에 스크립트를 넣으면 주석에 갇혀 **조용히 로드되지 않는다**(pace.js가 실제로 그랬다).
- 단계 내용은 `scripts/add-tutorials.js`에 모여 있다(멱등 — 다시 돌려도 중복 삽입 안 됨).
- 첫 방문 1회만 자동 오픈(`alley_tut_<game>`), `body.ingame`이면 안 뜬다. 검사: **`npm run test:tutorial`**

## 🎁 아이템전 (10종)

| 게임 | 아이템 | 액션 |
|---|---|---|
| 너클본즈 | 🔄 다시 굴리기 | `{type:'reroll'}` |
| 요트 | 🎲 한 번 더 | `{type:'extra'}` |
| 윷놀이 | 🛡 방어막 · 🔄 재던지기 · 👊 밀치기 | `{type:'useItem',item}` (기존 `itemBattle`) |
| 라이어 | 👁 훔쳐보기 | `{type:'peek'}` |
| 좌·중·우 | 🛡 칩 지키기 | `{type:'shield'}` (굴리기 **전** 예약) |
| 섯다 | 🃏 한 장 다시 | `{type:'redraw',idx}` (로컬 전용) |
| 알까기 | 🎯 한 번 더 튕기기 | `{type:'extraShot'}` (조준 **전** 예약) |
| 인디언 포커 | 🔍 내 카드 보기 | `{type:'peek'}` (내 차례 · 한 판 1회 · 로컬 전용) |
| 원카드 | 🛡 공격 막기 | `{type:'shield'}` (공격이 쌓였을 때만 · 카드를 안 먹고 넘김) |
| 도둑잡기 | 👀 살짝 보기 | `{type:'peek'}` (뽑기 **전** · 상대 패의 조커 자리를 나에게만) |

**규칙(재성님 지시)**: 아이템은 **아이템전에서만** · **전원 같은 개수**(엔진이 지급) · 상점에서 개수 판매 금지 · **AI도 반드시 쓴다.**
- 윷은 별도 아이템을 추가하지 않았다 — 이미 아이템전이 있어서 같은 이름 두 시스템이 되면 헷갈린다. 대신 **AI가 `useItem`을 한 번도 부르지 않던 공정성 버그**를 고쳤다(v1.227).
- 라이어는 훔쳐본 눈을 `serialize(viewerPid)`의 `peeked`에 실어 보내고, `aiDecide`가 그걸 '아는 눈'으로 쓴다 → **AI 전용 분기 없이** 판단이 정확해진다. `myPeeks`는 **보는 사람 것만** 실어야 한다(남의 것이 섞이면 그게 정보 누출).
- 인디언 포커는 **숨김정보가 거꾸로**다(남의 카드는 다 보이고 내 것만 안 보임) → 아이템도 '내 카드 보기'다.
  아이템을 쓰면 상대 카드가 전부 보이는 이 게임에선 **승패가 사실상 확정**되므로, 판당 1회·게임당 2개로 묶었다.
  `estimateWin(seen, my, opp)`이 `my!=null`이면 0.97/0.03을 돌려주고 AI는 기존 판단 트리를 그대로 쓴다(아이템 전용 분기 없음).
- 검사: `npm run test:items`(kb·요트) · `npm run test:items:more`(라이어·좌중우·섯다·알까기·인디언) · `npm run test:items:online`

## 코딩 규칙

- 응답·주석은 한국어. 사용자(재성)는 틀리면 바로 지적함 — 정확성 우선.
- 테마 시스템: `localStorage` `alley_theme` + `data-theme` 속성. 테마별 CSS 변수(`--brass` 등).
- 온라인 action 형식: `wsSend({t:'action', a:{type:'throw', power}})` — 서버가 `m.a`를 엔진 `action(pid, a)`로 전달.
- 버전은 `package.json`. 변경 시 올릴 것.
