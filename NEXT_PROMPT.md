# 다음 작업 프롬프트 — 주사위 골목

> 새 세션에 이 파일을 참조로 붙여 이어가면 됩니다. `CLAUDE.md`는 세션 시작 시 자동 로드(아키텍처·함정).

---

## 현재 상태 (2026-07-21 기준)

- 위치: **`~/yacht-dice`** 가 유일한 저장소. 버전 **v1.153.0**, `main` 푸시·Render 배포 완료.
- ⚠️ **디렉토리 정리됨**: 예전에 있던 `~/Desktop/yacht-dice`(낡은 사본)는 **이번 세션에 삭제**했다. 이제 `~/yacht-dice` 하나뿐. (과거 핸드오프의 "Desktop 사본 주의"는 무효)
- 미커밋: `scripts/online-test.js`(사용자 것) — **건드리지 말 것.**

## 이번 세션에 한 것 (v1.142 → v1.153)

윷·요트 "넷마블/한게임급 고도화" 방향으로 진행. 핵심은 **실제 3D 캐릭터 아트 도입**.

| 버전 | 내용 |
|------|------|
| v1.142~143 | **선 뽑기 이해도** — 라운드 결과를 페이싱(엔진 setTimeout, 일반 2.0s/동점 2.8s)으로 화면에 남겨 보이게, "동점 재대결" 명시, 확정 순서/재대결 분리 |
| v1.144 | 윷 **무대 배경** — 검은 void → 따뜻한 조명(등불·후광·상 반사·벽 비네트, 전부 정적) |
| v1.145 | 던지기 결과 오버레이 톤다운(도·개·걸 작게) + 선 뽑기 우측 열 중복 정리 |
| v1.146 | **첫 판 인터랙티브 튜토리얼**(코치마크 3스텝, 1회성 `yut_tut`) |
| v1.147 | 결과 화면 **우승자 히어로**(실제 우승 캐릭터를 유광·왕관·컨페티로) |
| v1.148 | **레벨·타이틀 진행**(XP=15+승25+잡기, 10단계, 셋업 레벨바 + 결과 성장박스 레벨업) — 아트 불필요 메타 |
| v1.149 | **무대 배경 4종 확산**(kb·ld·lcr·yacht, 조크 테마 excel·photoshop 제외) |
| — | **`ART_BRIEF.md`** 추가(발주 브리프 + AI 프롬프트) |
| v1.150 | **캐릭터 3D 아트 교체 5종** — 평면 PNG → 소프트 3D 마스코트(돼지·개·양·소·말). 파일명 동일(`img/{동물}.png`)이라 코드 변경 0 |
| v1.151 | **칭호 장착**(레벨 해금 타이틀 선택 → 인게임 카드 표시, `yut_title`) |
| v1.152 | 윷 **빽도 첫 진입 규칙** — 판에 말 없을 때 빽도 → 낙 대신 **출발점(node 0)에 서기**, 이후 도~모로 전진 |
| v1.153 | 요트 UX 3건 — 반응/말풍선 위치(점수판 꼭대기 → 큰 턴카드), 내 차례 박스 축소(244→178px), 채팅 씹힘(throttle·드롭 제거 → 즉시 표시·전송) |

또: `cdp.js`에 **`--mute-audio`** 추가(검증 중 소리 안 나게).

## 🔴 다음 최우선 — 캐릭터 표정 시트 (사용자가 생성 중)

**v1.150에서 캐릭터를 3D로 교체했고, 코드에 표정 리액션 훅이 이미 있다**(잡음/완주/늪 등). 사용자가 **표정 변형 6종 × 5동물 = 30장**을 같은 스타일로 생성해서 줄 예정. 오면:

1. **처리**: `python3 scripts/process-char-art.py <생성본> public/img/pig_happy.png` (배경 자동 제거 + 리사이즈 + 양자화). ← 이번 세션에 만든 재사용 스크립트.
2. **연결**: 리액션 발생 지점에서 `ANIMAL_IMG[type]` 대신 표정 이미지로 스왑. 표정↔상황 매핑:
   - `happy` 잡음·완주 / `sad` 잡힘·패배 / `surprise` 늪·빽도 / `angry` 당함 / `star` 윷·모·승리 / `cheer` 최종 우승 히어로
   - 파일명 규칙: `pig_idle.png`(=현재 pig.png), `pig_happy.png`, `pig_sad.png` …
3. 리액션 훅 위치: yut.html의 `reactPiece`/`_emote`(판 위 말), `renderResHero`(우승), 캐릭터 카드(`renderCharCards`), floatReaction 등. **표정 이미지 스왑 + 원위치 복귀** 방식이 깔끔.

> 스타일/프레이밍/배경 프롬프트는 `ART_BRIEF.md`에 다 있음.

## 그 밖의 대기/다음 후보

1. **말(horse) bust 재생성** — 5종 중 말만 원본이 전신이라 자동 크롭(상단 60%)으로 얼굴이 조금 작다. 사용자가 상반신으로 재생성하면 `process-char-art.py`로 교체(이번엔 `--bust` 없이). 지금도 무난.
2. **캐릭터 스킨/상점** — 스킨 아트(한복·왕관 등 코스튬)가 오면 상점 UI + 장착 + 레벨 해금 붙이기. 레벨/칭호 시스템(v1.148·1.151)에 연결. 아트 없이는 칭호 장착까지가 한계(이미 함).
3. **채팅 2인 실측** — 송신 씹힘은 고쳐 단일 클라 검증됨. 실제 2명 주고받기 라이브 확인 권장(수신 경로는 원래 정상).
4. **kb·ld·lcr 캐릭터 업그레이드** — 이들은 자체 아바타(이모지 등) 사용. 윷·요트가 화려해진 만큼 상대적으로 밋밋. 3D 캐릭터/폴리시 확산 여지.
5. **인게임 메타 연동 5종** — 레벨/XP 연출을 윷 외 게임에도.

## 🎨 아트 후처리 파이프라인 (이번 세션 신설)

`scripts/process-char-art.py` — 생성본을 게임 PNG로. **핵심 교훈:**
- ChatGPT/DALL·E "투명"은 **거짓**(RGB에 밝은 체커보드가 구워짐). 코너 flood-fill로 제거.
- 배경 체커 = 무채색(`max-min<8`), 캐릭터 밝은 부위(양털·소흰색) = 따뜻한 색조(`max-min≥15`) → `isbg = min>225 and max-min<8`로 정확히 구분.
- 트림→정사각(여백 14%)→400px→FASTOCTREE 256색 양자화(엣지 alpha 보존, ~25KB, 원본 평면 수준 무게).
- 전신 소스는 `--bust 0.60`으로 상반신 크롭.

## 🔑 브라우저 자동 검증 (`scripts/browser-test/`)

Playwright 크로미움 캐시를 `ws`로 CDP 직접 제어(새 의존성 0). **연출·레이아웃은 반드시 눈으로.**
```bash
node server.js                                   # 먼저 서버(또는 ensureServer가 알아서)
node scripts/browser-test/verify-fx.js           # 자동 단언
node scripts/browser-test/capture.js hold        # 연출 눈으로 → out/*.png
```
- **`cdp.js`에 `--mute-audio`·`page.setMotion(true)` 있음.** 헤드리스 기본 `prefers-reduced-motion:reduce`라 안 켜면 연출 전부 생략된 화면을 본다(오진 주의, CLAUDE.md #7).
- 게임 상태 `S`는 IIFE 스코프 → DOM으로 판정. 윷 던지기는 `mousedown`→대기→`window` `mouseup`.
- **closure 함수 검증 팁**: 임시 시임 `try{window.__x=fn}catch(_){}` `/* TEMP-... */` 넣고 테스트, **커밋 전 `perl -0pi -e` 로 제거**(이번 세션에 여러 번 씀).
- yut 외 게임 조작은 헬퍼가 없어 CDP 직접(`page.eval`로 버튼 클릭). yacht: `#tabOnline`→`#createRoom`→`#addAiBtn`→`#startOnline`.

## 반드시 지킬 규칙

- **엔진 이중구조**: 엔진 로직은 `public/*-core.js`만 고치고 `npm run build`. HTML `<!-- CORE:x -->` 마커 안은 직접 수정 금지. UI·CSS·연출은 마커 바깥 HTML 직접 수정.
- 엔진 바꿨으면 `buildPath↔step`, `simStep↔step` 일치 확인(v1.152 빽도가 이 3곳 동시 수정 사례).
- **모션은 reduced-motion에서 생략.** `FX_REDUCED()`는 yut에만 있음 — 다른 게임은 `matchMedia` 직접.
- **정적 연출(무대·볼륨·그림자)은 reduced에서도 유지**(모션 아님).
- **과하지 않게.** v1.127에서 "정신없다" 피드백으로 연출을 걷어낸 이력 존중 — 표현은 판에 흩뿌리지 말고 큰 카드/캐릭터에 집중.
- 검증: `npm run check:drift` → `<script>` 파싱 → 연출이면 캡처로 눈으로.
- 응답·주석 한국어, 정확성 우선(재성은 틀리면 바로 지적). 작업마다 `package.json` 버전↑, 커밋 끝에 `Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>`.
- **푸시=배포. 사용자 확인받고.** (이번 세션은 각 기능마다 확인 후 푸시)

## 프로젝트 빠른 참조

- 로컬: `node server.js` → localhost:3000 · 배포: `git push` → Render(`yacht-dice-jxva.onrender.com`) → Electron이 그 URL 로드
- 게임: yut/yacht/kb/ld/lcr `.html` + 각 `*-core.js`(엔진) + `index.html`(허브)
- 문서: `CLAUDE.md`(아키텍처·함정), `ART_BRIEF.md`(아트 발주), `scripts/browser-test/README.md`(검증)
- 상태 키(localStorage, yut): `yut_stats`(games/wins/xp…), `yut_title`(칭호), `yut_tut`(튜토리얼 봄), `yut_char`, `alley_theme`
