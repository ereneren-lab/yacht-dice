# 딱세판만 — 로컬/AI 결과 화면 재초대 CTA 구현 명세

- 작성: creative-producer · 2026-08-11
- 근거 전략: `outputs/strategy/2026-08-11_dice-alley_core-journey-ux.md` §9-5(신규 제안, 사용자 승인 완료) · §10-3 항목 8 · §13 리스크
- 근거 아키텍처: `CLAUDE.dice-alley.md`(net.js·host-link.js·tutorial.js 주입 방식, 함정 목록)
- 표기: **[코드]** 오늘(8/11) `public/` 직접 읽어 확인 · **[제안]** 판단·권고(승인 필요) · **[확인필요]** 이번 조사로 확정 못함 · **[미확정]** 결정 대기
- 이 문서의 성격: **명세 + 신규 파일 초안까지만.** 기존 게임 HTML/JS는 이 작업에서 편집하지 않았다(제약 조건 준수). 실제 10개 게임 배선은 Orchestrator가 검증(문법·드리프트·레이아웃·`test:hostlink`)과 함께 별도로 진행한다.

---

## 0. 브리프 전제 재확인 — 착수 전 정정 사항

브리프 §6이 파일럿 예시로 "net.js 공용을 쓰는 kb"를 들었는데, **코드로 확인한 결과 이는 틀렸다.** `kb.html`은 `NET.ui.mount`/`NET.init`을 쓰지 않는 **인라인 구현**이다(§1 표 참고). net.js를 쓰는 건 카드 4종(섯다·인디언포커·원카드·도둑잡기)뿐이다. 이 정정을 반영해 §6 파일럿 권고를 다시 짰다(net.js 대표는 **onecard**로 교체).

또한 조사 중 **이 작업 범위 밖의 새 함정을 하나 발견**했다 — 요트의 "위장 모드"(엑셀/포토샵 흉내, `isDisguise()`)가 켜져 있으면 컬러 배너 CTA가 위장을 깬다. §7-5에서 다룬다.

---

## 1. 제작 목표

로컬/AI 대전이 끝난 결과 화면에 "친구랑 하면 더 재밌어요 · 🔗 친구랑 하기" CTA를 붙여, 이 서비스의 핵심 가치(친구와 하기)를 아직 안 써본 사람에게 재초대 신호를 준다. **이번 산출물의 목표는 그 CTA를 실제로 배선하는 것이 아니라, 10개 게임에 동일하게 안전히 적용할 수 있는 정확한 명세와 공용 모듈을 만드는 것**이다.

---

## 2. 적용 전략

전략 문서 §7 원칙 4·5("이미 있는 걸 먼저 다듬는다", "모든 플레이의 끝은 초대의 시작일 수 있다")를 따라 **새 기능을 최소한의 새 코드로** 만든다.

- 재초대 진입은 새 로직을 만들지 않고 **이미 검증된 `?host=1` + `host-link.js`**(허브 "🔗 친구와 하기"가 쓰는 것과 동일, `npm run test:hostlink`가 10종 검증)를 재사용한다.
- 트리거는 게임마다 다른 내부 함수를 부르지 않고, **10개 게임에 공통으로 존재하는 유일한 신호**(결과 오버레이의 class 토글)만 관찰한다.
- 색은 `--brand-gold` 계열만 사용(요트는 아직 이 토큰으로 이관되지 않아 `--accent` 폴백을 둔다 — §5-4).

---

## 3. 크리에이티브 방향

- 톤: 강요가 아니라 제안. "지금 좋았죠? 이거 하나 더 있어요" 수준의 낮은 압력.
- 위치: 결과가 이미 다 보인 다음, 기존 액션 버튼들(다시 하기/골목으로) **아래에 이어지는 한 줄** — 새로운 화면이나 팝업이 아니다.
- 시각: 점선 구분선으로 "이건 결과가 아니라 다음 제안"이라는 걸 구분하되, 카드를 새로 만들지 않는다(레이아웃 침습 최소화).
- 노출 조건: **로컬/AI 대전에서만.** 온라인 대전 직후에는 이미 친구와 하는 중이므로 뜨지 않는다(§4).

---

## 4. 대상 게임 확정 — 온라인 구현 방식 표 [코드]

브리프가 지정한 온라인 10종을 `public/*.html`에서 직접 grep해 확인했다. 하우스 상대 3종(블랙잭·바카라·하이로우)은 상대가 딜러라 애초에 대상에서 제외(브리프 지침대로).

| # | 게임 | 온라인 구현 | 온라인 판별 변수[코드] | 결과 오버레이 id/클래스[코드] | 활성 클래스 |
|---|---|---|---|---|---|
| 1 | 너클본즈(kb) | **인라인** | `const online = () => mode==='online'` (함수) | `#resultOv` → `.sheet` → `.result` | `.on` |
| 2 | 라이어 다이스(ld) | **인라인** | `let online` (변수) | `#resultOv` → `.sheet` → `.result` | `.on` |
| 3 | 좌·중·우(lcr) | **인라인** | `let online` (변수) | `#resultOv` → `.sheet` → `.result` | `.on` |
| 4 | 윷놀이(yut) | **인라인** | `let online` (변수) | `#resultOv` → `.sheet` → `.result` | `.on` |
| 5 | 요트 다이스(yacht) | **인라인** | `const isOnline = () => MODE==='online'` (함수) | `#overlay` → `.result` | `.show` |
| 6 | 알까기(alkkagi) | **인라인** | `let online` (변수) | `#resOv` → `.resbox` | `.on` |
| 7 | 섯다(seotda) | **net.js 공용** | `let online` (변수, 게임 자체 로컬 플래그 — `NET.online`과 별개로 동기화) | `#resultOv` → `.sheetbox` | `.on` |
| 8 | 인디언 포커(indianpoker) | **net.js 공용** | `let online` (변수) | `#resultOv` → `.card` | `.on` |
| 9 | 원카드(onecard) | **net.js 공용** | `let online` (변수) | `#resultOv` → `.card` | `.on` |
| 10 | 도둑잡기(oldmaid) | **net.js 공용** | `let online` (변수) | `#resultOv` → `.card` | `.on` |

**정정**: `CLAUDE.dice-alley.md`의 "net.js 공용 4종" 서술과 정확히 일치(섯다·인디언·원카드·도둑잡기). 나머지 6종(kb 포함)은 전부 인라인이다. 브리프의 "kb=net.js" 전제는 틀렸다(§0).

**공통점 확인[코드]**: 10종 전부 판이 끝나면 결과 엘리먼트에 **활성 클래스를 `classList.add()`로 붙인다** — 함수 이름(`showResult`)도 다르고 온라인/로컬 판정 변수의 형태(변수 vs 함수)도 다르지만, **class 토글만은 예외 없이 공통**이다. 이게 §7의 트리거 설계 근거다.

---

## 5. 로컬 vs 온라인 판별 방법

### 5-1. 게임별 판별식

§4 표의 "온라인 판별 변수" 열이 그대로 판별식이다. 정리하면 두 형태뿐이다.

- **변수형**(8종: ld·lcr·yut·alkkagi·seotda·indianpoker·onecard·oldmaid): 최상위 `let online = false/true`. 온라인 방에 `create`/`join`/재접속(`rejoin`)이 성공하면 `true`, 로비를 나가거나 로컬로 되돌아가면 `false`.
- **함수형**(2종: kb·yacht): `online()`/`isOnline()`이 내부 상태(`mode`/`MODE`)를 읽어 반환.

두 형태 모두 **판이 끝나 결과 오버레이가 뜨는 시점에 이미 정확한 값**을 가진다 — net.js 4종도 온라인 대국이 끝나면 `#resultOv`가 잠깐 뜨지만(§4-2), 그 순간에도 로컬 `online` 변수는 이미 `true`이므로 오판 위험이 없다[코드 확인, `seotda.html:1783` `showResult()`가 `online` 변수 변경 이후에 호출됨].

### 5-2. net.js 4종 — 온라인 대국도 잠깐 같은 오버레이를 스친다 [코드 확인]

net.js의 함정 #3 처리(`gameEnd`를 `lobby`보다 먼저 호출)와 무관하게, **핸드/판이 끝나는 순간엔 로컬 엔진 스냅샷도 `phase==='gameover'`가 되어 `showResult()`가 호출**된다(`seotda.html:1747`). 그 직후 서버가 `lobby` 메시지를 보내면 `leaveOnlineGame()`이 오버레이를 내린다. 즉 온라인 대국에서도 결과 오버레이의 활성 클래스가 **아주 짧게** 켜졌다 꺼진다.

이게 문제가 안 되는 이유: CTA는 클래스가 켜질 때마다 `onlineFn()`을 다시 확인하는데, 이 순간엔 `online`이 이미 `true`이므로 CTA는 뜨지 않는다. **"결과 화면이 떴다"와 "CTA를 보여줄지"를 같은 타이밍에, 매번 새로 판정**하는 설계이기 때문에 타이밍 경합이 없다(§7 참고).

### 5-3. 예외 — 요트의 위장 모드 [코드 확인, 이번 조사에서 신규 발견]

요트만 있는 특수 상태: `data-theme="excel"`/`"photoshop"`일 때 `isDisguise()`가 `true`를 반환한다(`yacht.html:1876`, `window.__isDisguise`로 전역 노출됨). 이건 회사·학교에서 몰래 플레이하기 위한 위장 기능으로, 결과 화면도 일부러 밋밋하게 만든다(`yacht.html:635` 주석 "우승 순간에도 축포·화려한 결과창 대신 밋밋한 대화상자"). **로컬이라도 위장 모드 중엔 컬러 CTA 배너를 절대 띄우면 안 된다** — 위장이 깨진다. §7-5·§9에서 처리.

---

## 6. 온라인 초대 진입 방식 — `?host=1` 재사용 [제안, 채택]

**검토한 대안**

| 방식 | 설명 | 판정 |
|---|---|---|
| A. `location.href = 현재경로 + '?host=1'`로 재진입 | 페이지를 새로 로드하면 `host-link.js`가 그 게임의 온라인 열기→방 만들기 버튼을 순서대로 눌러준다(`npm run test:hostlink`가 10종 검증 완료) | **채택** |
| B. 이미 로드된 페이지에서 바로 온라인 전환 | 게임마다 "온라인 열기" 함수/버튼이 다르다(`switchOnline()`/`$('onlineBtn').onclick`/`$('tabOnline')` 등, `host-link.js` 주석에 이미 정리돼 있음) — 이걸 이 모듈이 또 알아야 하면 host-link.js와 같은 매핑을 두 곳에 유지하게 된다 | 기각 |

**채택 이유**: A는 이미 존재하고 이미 테스트된 경로를 **그대로** 쓴다. 새 매핑 테이블을 만들지 않으므로 host-link.js가 나중에 게임을 추가/변경해도 CTA 쪽 코드를 안 고쳐도 된다(단일 소스). 페이지 새로고침이 발생하지만, **결과 화면에 도달했다는 건 이미 그 판이 끝났다는 뜻**이라 잃을 로컬 상태가 없다(다시 하기/골목으로 버튼도 어차피 그 판을 끝낸다).

구현: CTA 버튼은 `<a href="{location.pathname}?host=1">`(진짜 링크 — 새 탭/가운데 클릭도 자연스럽게 동작). `host-link.js`는 `?room=`이 없고 `?host=1`일 때만 동작하므로(`host-link.js:25`) 충돌 없음.

---

## 7. 공용 모듈 설계 — `public/invite-cta.js` [신규 파일, 작성 완료]

tutorial.js·net.js와 같은 패턴 — **마크업·CSS를 스스로 주입**하고, 게임은 한 줄만 호출한다. 파일: `public/invite-cta.js`(`window.INVITECTA`).

### 7-1. 트리거 — "결과 오버레이의 class 토글"이 가장 안전한 이유

10개 게임을 조사하며 트리거 후보를 세 개 검토했다.

| 후보 | 설명 | 판정 |
|---|---|---|
| **A. 게임이 명시적으로 `INVITECTA.show()` 호출** | 각 `showResult()` 함수 끝에 한 줄 추가 | 기각 — 함수 이름·내부 분기가 게임마다 다 달라서(`showResult`가 10곳 각각 별도 구현) 10곳을 개별로 찾아 고쳐야 하고, 온라인/로컬 분기를 빠뜨리기 쉽다(§0에서 지적한 것과 같은 종류의 실수 위험) |
| **B. MutationObserver로 `body.ingame` 관찰** | `analytics.js`가 게임 시작 감지에 이미 쓰는 방식 | 기각 — "판이 시작했다"는 잡지만 "결과가 떴다"는 못 잡는다. 결과 오버레이는 `ingame`이 유지된 채로도 뜬다(다시 하기 전까지 게임 화면 자체는 안 사라짐) |
| **C. 결과 오버레이 엘리먼트의 class 속성 변화 관찰** | `classList.add('on'/'show')` | **채택** — §4 표에서 확인했듯 10종 **전부**가 이 방식으로 결과를 보여준다. 게임 로직을 전혀 안 건드리고, 함수 이름도 몰라도 된다 |

**결론**: C가 유일하게 "게임마다 다른 부분(함수 이름·판정 로직)"을 몰라도 되는 트리거다. `analytics.js`가 이미 같은 철학(`body.ingame` class 관찰)으로 게임 시작을 잡고 있으므로, 이 프로젝트에 이미 있는 관용구를 결과 감지에도 그대로 확장하는 셈이다.

### 7-2. 왜 완전 무배선(zero-touch)이 아니라 "한 줄 호출"인가

class 토글은 게임이 안 건드려도 자동으로 관찰되지만, **어떤 엘리먼트를(`resultSel`), 어떤 클래스를(`activeClass`), 어디에 CTA를 붙일지(`mountSel`), 지금 온라인인지 어떻게 아는지(`online` 게터)는 게임마다 다르다**(§4 표). 이 4가지는 게임 코드 안에서만 정확히 알 수 있으므로, 완전 자동화 대신 **설정을 한 줄로 넘기는** tutorial.js식 절충을 택했다. 이러면:
- 새 게임이 추가돼도 이 파일은 안 바뀐다(설정만 새로 넘기면 됨).
- 게임 쪽 변경은 **호출 한 줄**뿐이라 리뷰·회귀가 쉽다(§8의 diff가 그 근거).

### 7-3. 호출 시점 — 왜 `</title>` 직후가 아니라 "메인 스크립트 맨 끝"인가

tutorial.js는 `</title>` 직후에 `TUT.init(...)`을 호출하도록 안내한다(계측 보류 주석 블록에 안 갇히려고). `invite-cta.js`도 **스크립트 로드**는 같은 자리에 하되, **`INVITECTA.watch(...)` 호출은 게임의 메인 `<script>` 맨 끝**에 둬야 한다. 이유:

- `online`(또는 `mode`)이 그 게임 메인 스크립트의 최상위 `let`/`const`인데, CLAUDE.dice-alley.md 함정 #18이 지적하듯 **TDZ(선언 전 참조) 문제**가 있다. `online:()=>online()`처럼 화살표 함수로 감싸 넘기면, 실제 평가는 CTA가 뜨는 시점(스크립트 실행이 이미 끝난 뒤)까지 미뤄지므로 안전하다 — 단, **호출 코드 자체는 `online`/`mode` 선언 이후 줄에 있어야** 그 클로저가 올바른 변수를 캡처한다.
- 이렇게 하면 게임 스크립트 파일 하나에 두 줄만 추가된다: 상단에 `<script src="invite-cta.js">` 한 줄(로드), 맨 끝에 `INVITECTA.watch({...})` 한 줄(설정).

### 7-4. 마운트 위치 — 게임별 앵커 셀렉터 [코드 확인]

기존 버튼 컨테이너 안에 **마지막 자식으로 추가**한다(새 오버레이·새 카드를 만들지 않는다 — §9 함정 회피 원칙).

| 게임 | `mountSel` | 근거[코드] |
|---|---|---|
| kb | `#resultBtns` | `kb.html:985` |
| ld | `#resultBtns` | `ld.html:799` |
| lcr | `#resultBtns` | `lcr.html:730` |
| yut | `#resultBtns` | `yut.html:1568` |
| yacht | `#resultBtns` | `yacht.html:1379` |
| alkkagi | `#resOv .btns` | `alkkagi.html:584`(컨테이너에 id가 없어 후손 셀렉터로 특정) |
| seotda | `#resultOv .sheetbox` | `seotda.html:552`(버튼이 컨테이너 없이 낱개로 있어 박스 자체에 append) |
| indianpoker | `#resultOv .card` | `indianpoker.html:408` |
| onecard | `#resultOv .card` | `onecard.html:429` |
| oldmaid | `#resultOv .card` | `oldmaid.html:419` |

### 7-5. 안전장치 두 가지

1. **`disguise` 게터** — 요트에만 해당(§5-3). `disguise:()=>window.__isDisguise&&window.__isDisguise()`를 넘기면 위장 모드 중엔 CTA가 절대 안 뜬다. 이건 이번 조사에서 새로 발견한 함정이라 `CLAUDE.dice-alley.md`에 반영할 것을 Orchestrator에게 제안한다(§10).
2. **`ensureScrollable` 게터(선택)** — §9-2에서 다룬다. 결과 오버레이 3종(요트·알까기·섯다)이 원래 overflow 보호가 없어, CTA가 늘어난 만큼 화면 밖으로 잘릴 위험이 있다. 이 옵션을 넘기면 CTA가 뜨는 **순간에만** 그 오버레이 wrapper에 `overflow-y:auto`를 인라인으로 걸어준다(원본 CSS 파일은 안 건드림).

### 7-6. 실패 격리

`invite-cta.js` 전체가 하나의 `try/catch`로 감싸여 있고(파일 참고), `watch()` 안의 각 단계도 개별로 감싼다. **필수 설정(`game`, `mountSel`)이 없거나 대상 엘리먼트를 못 찾으면 조용히 아무 일도 안 한다** — host-link.js와 같은 "실패해도 게임은 원래대로"라는 원칙을 그대로 따른다.

---

## 8. 파일럿 권고

### 8-1. 대상 — 정정된 두 게임

브리프의 "net.js 공용 vs 인라인" 의도를 살리되, §0의 정정을 반영해 다음 둘을 권고한다.

| 구분 | 게임 | 선정 이유 |
|---|---|---|
| **인라인 대표** | **kb (너클본즈)** | `online`이 함수형(`online()`)이라 변수형 8종과 다른 패턴을 동시에 검증할 수 있다. 결과 오버레이가 이미 overflow 보호(`overflow-y:auto`, `kb.html:422`)가 있어 레이아웃 위험이 낮다. `#resultBtns` id가 있어 `mountSel`이 명확하다. |
| **net.js 대표** | **onecard (원카드)** | net.js 4종 중 섯다를 제외한 3종(인디언·원카드·도둑잡기)이 마크업이 완전히 동일(`.card`, overflow 보호 있음)해서 셋 중 아무거나 대표성이 같다. 원카드가 가장 대중적이라 실사용 신호를 보기 좋다. |

**제외 이유(섯다)**: 같은 net.js 그룹이지만 결과 오버레이(`.sheetbox`)가 overflow 보호가 없다(§9-2). 파일럿에서 검증할 두 축(온라인 구현 방식)과 무관한 별개 리스크(레이아웃)를 같이 섞으면 실패 원인을 특정하기 어려워진다 — 섯다는 2차 확산에서 `ensureScrollable`과 함께 다룬다.

### 8-2. 정확한 변경 목록 (게임당)

**kb.html**
1. `</title>` 직후: `<script src="invite-cta.js"></script>` 한 줄 추가(tutorial.js 스크립트 태그 옆).
2. 메인 스크립트 맨 끝, `const online = () => mode==='online';` 선언 이후 아무 지점에:
   ```html
   <script>try{ INVITECTA.watch({
     game:'kb', gname:'너클본즈',
     resultSel:'#resultOv', activeClass:'on', mountSel:'#resultBtns',
     online: ()=>online()
   }); }catch(e){}</script>
   ```
3. 그 외 변경 없음. CORE 마커 블록은 건드리지 않음(엔진 무관 작업).

**onecard.html**
1. `</title>` 직후: `<script src="invite-cta.js"></script>`.
2. 메인 스크립트 맨 끝, `let online=false;` 선언 이후:
   ```html
   <script>try{ INVITECTA.watch({
     game:'onecard', gname:'원카드',
     resultSel:'#resultOv', activeClass:'on', mountSel:'#resultOv .card',
     online: ()=>online
   }); }catch(e){}</script>
   ```
3. 그 외 변경 없음.

### 8-3. 파일럿 검증 절차 (Orchestrator 단계 제안)

1. `node --check`로 추가한 `<script>` 블록 문법 확인(이미 `invite-cta.js` 자체는 이번 작업에서 확인 완료 — §11).
2. `npm run check:drift` — CORE 마커 밖 작업이라 영향 없어야 함, 회귀 확인용.
3. 실제 브라우저(CDP)로 로컬 대전 1판 완주 → 결과 화면에 CTA가 뜨는지, 클릭 시 `?host=1`로 이동해 방이 만들어지는지(`npm run test:hostlink`와 같은 판정 방식 — `{ns}_room` 생성 여부).
4. 온라인 대전 1판 완주 → 결과 화면에 CTA가 **안** 뜨는지(§5-2 시나리오).
5. 384×748(Galaxy A16 웹뷰 기준, `CLAUDE.dice-alley.md` 함정 21) 뷰포트에서 CTA 추가 후에도 기존 버튼(다시 하기 등)이 가려지거나 화면 밖으로 밀리지 않는지.
6. 통과하면 나머지 8종(ld·lcr·yut·yacht·alkkagi·indianpoker·oldmaid·섯다)으로 확산.

---

## 9. 함정 회피 원칙

`CLAUDE.dice-alley.md`의 기존 함정을 CTA 설계에 대조한 결과.

### 9-1. 무관하다고 판단한 함정 (근거와 함께)

- **함정 #3(판 종료→로비 전환)**: CTA는 `phase` 메시지 처리에 전혀 관여하지 않는다 — class 토글만 본다. net.js의 `onGameEnd`가 `onLobby`보다 먼저 불리는 기존 순서를 그대로 신뢰한다.
- **함정 #9(sticky는 마지막 자식이면 무효), #21~24(셋업 레이아웃/버튼 가시성/`fit-setup.js`)**: 전부 `position:sticky`/`fixed`를 쓰는 요소나 **셋업 화면**의 문제다. CTA는 `position` 지정이 없는 일반 흐름(in-flow) 블록이고, 셋업이 아니라 **결과 화면**에 붙는다. `fit-setup.js`가 보는 대상(`#startBtn`/`createBtn`/`createRoom`/`startOnline`)과도 겹치지 않는다.

### 9-2. 직접 관련된 함정 — 21-c와 같은 계열, 대응 필요

**발견[코드]**: 결과 오버레이의 overflow 보호 여부를 10종 전부 확인했다.

| 오버레이 wrapper | overflow 보호 | 해당 게임 |
|---|---|---|
| `.ov{overflow-y:auto;align-items:flex-start}` | ✅ 있음 | kb·ld·lcr·yut |
| `.card{max-height:90vh;overflow-y:auto}`(내부 박스) | ✅ 있음 | indianpoker·onecard·oldmaid |
| `.overlay{align-items:center}`(보호 없음) | ⚠️ **없음** | **yacht** |
| `.result{align-items:center}`(보호 없음) | ⚠️ **없음** | **alkkagi** |
| `.sheet{align-items:center}`(보호 없음) | ⚠️ **없음** | **섯다** |

**판정**: 함정 21-c("`position:fixed`+flex 중앙정렬 오버레이는 내용이 커지면 잘린 채 스크롤도 안 된다")와 정확히 같은 패턴이 3종에 잠재해 있다. CTA로 늘어나는 높이는 크지 않지만(약 60~70px 예상 — 캡션 한 줄 + 버튼 44px), 화면이 짧은 기기(384×748)에서 이미 결과 정보가 많은 판(예: 요트 5인전 랭킹)이라면 위험이 실재한다.

**대응**: `invite-cta.js`의 `ensureScrollable` 옵션(§7-5)으로 CTA가 뜨는 순간에만 방어적으로 `overflow-y:auto`를 건다. 단, **이건 임시방편이지 근본 처방이 아니다** — 함정 21-c의 원칙대로 "판정은 실기기에서, 처방은 원본 CSS 수정"이 정석이다. 이 3종(요트·알까기·섯다)은 파일럿에서 제외했고(§8-1), 2차 확산 시 **384×748 실측 후** 필요하면 해당 게임의 `.overlay`/`.result`/`.sheet` CSS에 직접 `overflow-y:auto`를 추가하는 별도 작업으로 분리할 것을 제안한다[제안, Orchestrator 판단 필요].

### 9-3. 신규 발견 — 요트 위장 모드 (§5-3 재정리)

기존 함정 목록엔 없던 새 케이스다. 컬러풀한 재초대 배너가 엑셀/포토샵 위장 화면에 뜨면 위장의 존재 의미가 없어진다. `disguise` 게터(§7-5)로 원천 차단한다. **CLAUDE.dice-alley.md에 함정 #35로 등록할 것을 제안**한다(Orchestrator 최종 반영 판단).

### 9-4. 색 토큰

CTA는 `--brand-gold`(1차 행동) 계열만 쓴다. 다만 **요트는 아직 이 토큰명으로 이관되지 않았다**(`--accent`/`--accent-ink`만 있음, §5-4 확인) — `invite-cta.js`의 CSS는 `var(--brand-gold, var(--accent, #d9a441))` 폴백 체인을 써서 요트에서도 깨지지 않게 했다(파일 참고). 이건 디자인 토큰스펙 문서가 이미 지적한 "요트 전용 주의"(`design-tokens-spec.md:165`)와 같은 문제라, CTA 쪽에서 임시로 흡수했을 뿐 근본 처방(요트의 토큰 이관)은 이 문서 범위 밖이다.

---

## 10. 계측 (선택 — 제안)

- **이미 자동으로 잡히는 부분**: CTA 클릭 → `?host=1` 재진입 → `host-link.js`가 방을 만들면 `{t:'create'}` 소켓 메시지가 나가고, `analytics.js`가 이미 이걸 엿들어 **'방만들기'** 이벤트를 자동으로 쏜다(`analytics.js:155-181`, 이번 작업에서 코드 확인). **CTA 전용 배선을 안 해도 방 생성까지는 계측이 이어진다.**
- **CTA 자체의 클릭률을 별도로 보려면**: `invite-cta.js`가 이미 `AL.ev('재초대_클릭', {게임: gname})`를 클릭 시점에 시도한다(`window.AL` 없으면 조용히 무시 — 계측 미로드 페이지에서도 안전). GoatCounter는 속성을 못 붙이므로 실제로는 `재초대_클릭-{게임명}` 형태로 잡힌다(`analytics.js`의 `evName()` 규칙과 동일).
- **왜 필요한가**: '방만들기' 총량만으로는 그게 허브 타일 클릭에서 온 건지 이 CTA에서 온 건지 구분이 안 된다. `재초대_클릭` 이벤트가 있어야 "결과 화면 CTA가 실제로 성장에 기여하는지"를 나중에 답할 수 있다(전략 문서 §12 성공 기준의 마지막 항목과 직결).
- 계측이 꺼져 있어도(analytics.js 자체가 로드 안 되는 페이지) `window.AL` 체크로 안전하게 무시된다 — 계측을 깨지 않는다(제약 조건 충족).

---

## 11. 검수 결과 (자체 검수 — `public/invite-cta.js`)

- **문법**: `node --check public/invite-cta.js` 통과.
- **엔진/빌드 영향**: `*-core.js`·`scripts/build-inline.js`·`scripts/check-drift.js` 어느 것도 참조·수정하지 않음. `npm run build` 미실행(제약 조건 준수).
- **기존 파일 미편집 확인**: 이번 작업에서 `public/` 아래 새로 만든 파일은 `invite-cta.js` 하나뿐. `kb.html`/`onecard.html` 등 게임 파일은 **읽기만** 했고 편집하지 않았다.
- **목표 적합성**: §9-5 전략이 요구한 "로컬/AI 결과 화면에만, 이미 있는 인프라(host-link.js) 재사용, 문구 고정"을 그대로 만족.
- **실패 격리**: 전체 `try/catch` + 설정 미비 시 조용히 no-op — host-link.js와 동일한 안전 철학.
- **접근성**: CTA 버튼은 실제 `<a>` 태그(스크린리더가 링크로 인식, 가운데 클릭/새 탭 지원), `min-height:44px`(탭 타깃 기준 충족, 함정 #21 실측치와 동일 기준), `:focus-visible` 아웃라인 명시.
- **테마 대응**: 라이트(한지)·다크 2종(에스프레소·흑임자) 전부 CSS 변수만 참조해 하드코딩 HEX 없음(요트 폴백 제외).
- **미실행 검증**: 실제 브라우저 렌더링·클릭 흐름은 이번 작업에서 실행하지 않았다(제약 조건상 게임 파일에 아직 배선되지 않아 실행할 대상이 없음) — §8-3의 파일럿 절차에서 최초 실행 검증 필요.

---

## 12. 미확정 사항

- **[결정 필요]** 요트·알까기·섯다(overflow 미보호 3종)의 CTA 적용을 "런타임 방어(`ensureScrollable`)만으로 확산"할지, "원본 CSS에 `overflow-y:auto`를 먼저 추가하는 선행 작업 후 확산"할지 — Orchestrator 판단 필요(§9-2).
- **[결정 필요]** 요트 위장 모드 예외를 `CLAUDE.dice-alley.md`에 함정 #35로 정식 등록할지(§9-3).
- **[확인필요]** `mountSel` 셀렉터(§7-4)는 코드 읽기로 확정했으나, 실제 DOM에 CTA를 붙였을 때의 시각적 간격·정렬은 실기기 스크린샷으로 아직 확인 못함 — 파일럿 1단계(§8-3)에서 확인.
- **[확인필요]** `location.pathname + '?host=1'`이 Capacitor 앱(APK) 웹뷰에서도 동일하게 동작하는지 — `host-link.js` 자체는 이미 앱에서도 쓰이는 파일이라 위험은 낮다고 보이나 이번 작업에서 앱 환경 실측은 안 함.
- **[미확정]** CTA 문구를 게임명 포함 형태(예: "너클본즈, 친구랑 하면 더 재밌어요")로 바꿀지 — 전략 문서가 준 고정 문구를 그대로 채택했고, 게임명 삽입은 유지보수 비용 대비 효과가 불확실해 이번엔 보류(전략 문서 §9-2의 "게임별 매력 포인트" 논의와 같은 종류의 트레이드오프).

---

## 13. 다음 제작 단계

1. Orchestrator가 §8-2의 정확한 변경 목록대로 **kb.html·onecard.html에 직접 배선**.
2. §8-3 검증 절차 실행(문법·드리프트·온라인/로컬 분기·384×748 레이아웃).
3. 통과 시 나머지 8종(ld·lcr·yut·yacht·alkkagi·indianpoker·oldmaid·섯다)에 §7-4 표의 게임별 `mountSel`·`online` 게터로 동일 패턴 확산 — 요트는 `disguise` 게터 필수 추가, 요트·알까기·섯다는 §9-2의 `ensureScrollable` 처리(또는 선행 CSS 수정) 필요.
4. 확산 완료 후 `npm run check:drift` 최종 확인 + 실기기(Galaxy A16, 384×748) 결과 화면 스크린샷 대조.
5. §12 미확정 사항 중 "요트 함정 #35 등록 여부"를 `CLAUDE.dice-alley.md`에 반영할지 최종 결정.
6. (승인 시) 전략 문서 §12 성공 기준의 "로컬/AI 대전 종료 후 재초대 버튼 클릭률"을 GoatCounter 표본이 쌓인 뒤 측정.
