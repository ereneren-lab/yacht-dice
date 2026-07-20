# 브라우저 검증 도구

실제 크로미움을 헤드리스로 띄워 **연출·레이아웃·클릭 흐름**을 검증한다.
jsdom은 DOM 구조와 문법만 잡지 화면은 못 잡는다 — 여기가 그 사각지대를 메운다.

## 준비

새 의존성 없다. `ws`(이미 있음)만 쓰고, 브라우저는 이 순서로 찾는다:

1. Playwright 캐시 `~/Library/Caches/ms-playwright/chromium*` (버전 폴더명 무관하게 탐색)
2. 없으면 `/Applications/Google Chrome.app`

둘 다 없으면 `npx playwright install chromium`.

## 실행

```bash
npm run test:fx              # 자동 단언 (통과/실패)
npm run capture hold         # 잔상 고정 캡처 → out/trail-hold.png
npm run capture film         # 이동 구간 몽타주 → out/trail-film.png
npm run capture alpha        # 색·농도 비교 → out/trail-alpha.png
```

서버는 **안 떠 있으면 알아서 띄우고 끝나면 정리한다**(직접 띄워둔 서버는 건드리지 않는다).
`YUT_URL` 로 대상 주소를 바꿀 수 있다(기본 `http://localhost:3000/yut.html`).

윷 결과가 랜덤이라 `capture`가 가끔 "잔상이 충분한 이동을 못 만났다"로 끝난다 — 그냥 다시 실행하면 된다.

## ⚠️ 반드시 알아야 할 함정

**헤드리스 크로미움은 `prefers-reduced-motion` 기본값이 `reduce`다.**
이걸 켜주지 않으면 `FX_REDUCED()` 가드에 걸려 **모든 연출이 생략된 화면**을 보게 된다.
"연출이 안 보인다"를 코드 버그로 오진하기 딱 좋다 — 실제로 한 번 겪었다.
`cdp.js`의 `page.setMotion(true)`가 `Emulation.setEmulatedMedia`로 이걸 처리하며,
`setMotion(false)`로 두면 접근성(reduce) 경로 자체를 검증할 수 있다.

그 밖에 걸렸던 것들:

- **게임 상태 `S`는 IIFE 스코프**라 `window.S`로 못 읽는다. 상태 판정은 전부 DOM으로.
- **던지기는 `click()`이 안 먹는다.** `mousedown` → 대기 → `window`에 `mouseup`(파워 게이지).
- **연출은 수백 ms 만에 사라진다.** `spawnTrail`은 540ms 뒤 JS 타이머로 노드를 지우므로,
  CSS transition을 늘려봐야 소용없다. 복제본을 남기거나(`capture.js hold`)
  스크린캐스트로 프레임을 받아야(`film`) 한다.
- **판을 축소한 몽타주로는 옅은 연출을 판정할 수 없다.** 지름 2px짜리 α.22 점은 뭉개진다.
  농도 판정은 원본 해상도(`hold`)로 할 것.
- **게임 시작 직후 VS 인트로**가 판을 6초쯤 가린다. `startGame()`이 대기해 준다.
- Playwright 번들 ffmpeg는 `--disable-everything` 빌드라 **PNG 디코더가 없다.**
  이미지 합성은 브라우저 캔버스로 한다.
- **타이밍에 의존하는 단언은 넣지 말 것.** 잔상 opacity를 `450ms에 <0.15`로 단언했더니
  `setTimeout` 지터와 "측정 시점엔 이미 remove된 표본" 탓에 실행마다 통과/실패가 갈렸다.
  플래키한 단언은 없느니만 못하므로 수치는 **보고만** 하고 판단은 사람이 한다.
- **업힌 말 그룹은 좌표가 ±13px씩 벌어진다.** 잔상 위치를 말 하나의 transform으로 잡으면
  그룹 이동에서 어긋난다 — 칸 중심(그룹 평균)을 기준으로 할 것.

## 구성

| 파일 | 역할 |
|------|------|
| `cdp.js` | CDP 드라이버 (goto/eval/click/shot/record/setMotion) |
| `yut-drive.js` | 윷 조작 (게이지 던지기·말 선택·방향 선택·DOM 상태 판정) |
| `verify-fx.js` | 자동 단언 — 출발칸 잔상·reduced-motion·콘솔 예외 (페이드 수치는 보고만) |
| `capture.js` | 눈으로 볼 캡처 (hold / film / alpha) |

다른 게임(요트·너클본즈·라이어·좌중우)으로 넓히려면 `yut-drive.js`를 본떠
게임별 조작 헬퍼를 만들고 `cdp.js`는 그대로 재사용하면 된다.
