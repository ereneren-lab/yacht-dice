# 상점 13종 표정 — 프롬프트와 순서 (2026-08-20)

무료 5종(pig·dog·sheep·cow·horse)이 **베이스 + 6표정**으로 끝났다. 남은 건 상점 13종이다.

## 먼저 알아야 할 것 셋 — 여기서 판단이 갈린다

### ① 베이스는 **다시 안 뽑아도 된다** (무료 4종 때와 다르다)

무료 4종은 pig만 8/18에 새 스타일로 가서 나란히 놓으면 혼자 달라 보였다 — 그래서 베이스까지 다시 뽑았다.
상점 13종은 눈으로 대조해 보니 **이미 pig와 같은 반질 3D 계열**이다(8/04 5종·8/11 8종 모두).
→ **표정만 뽑는다.** 그리고 이게 프롬프트를 훨씬 쉽게 만든다 ↓

### ② 레퍼런스로 **그 캐릭터 자신의 그림**을 첨부한다

무료 4종 때는 베이스를 새로 만드는 중이라 `pig.png`를 붙였다. 이번엔 베이스가 이미 정본이니
**자기 자신을 붙이는 게 가장 강한 앵커**다. 스타일뿐 아니라 뿔 개수·소품·색까지 자동으로 맞는다.

| 대상 | 붙일 파일 |
|---|---|
| 8/11 8종 (윷가락·복주머니·청사초롱·장승·해태·산신령·청룡·저승사자) | `public/img/{id}_full.png` |
| 8/04 5종 (호랑이·토끼·곰·여우·도깨비) | `public/img/{id}.png` |

### ③ ⚠️ 표정이 뜨는 게임은 **윷놀이 하나뿐이다**

`reactImg`를 부르는 파일은 `yut.html`이 유일하다. 13종을 다 뽑아도 **다른 12게임에선 안 보인다.**
78장을 뽑기 전에 이걸 알고 시작하는 게 낫다.

→ 표정의 가치를 늘리는 더 싼 길이 하나 있다: **카드게임에 승/패 표정을 배선**하는 것(코드 작업, 아트 0장).
   그러면 지금 있는 무료 5종 표정부터 12게임에서 살아난다. 아트를 더 뽑을지는 그 다음에 정해도 된다.
   (이건 제안일 뿐이고, 상점 13종을 그냥 진행해도 무방하다. 아래 프롬프트는 그대로 쓸 수 있다.)

## 뽑는 순서 — 3파(총 34장). 어느 파에서 멈춰도 깨지지 않는다

아트가 없는 표정은 `chars.js`의 `reactImg`가 **조용히 베이스로 폴백**한다. 그래서 중간에 멈춰도 안전하다.

| 파 | 무엇 | 장수 | 왜 이 순서 |
|---|---|---|---|
| 1파 | 시트 A — `star`·`surprise`·`happy` | 13 | 판 위에서 가장 자주 뜨는 셋(윷·모 / 빽도 / 잡음) |
| 2파 | 시트 B — `sad`·`angry`·`cheer` | 13 | 여기까지면 6표정 완비 — 무료 5종과 동급 |
| 3파 | `cheer` **전신 낱장** — 8/11 8종만 | 8 | 우승 화면 프레이밍 튐 제거(아래 설명) |

### 3파가 왜 따로인가 — 실측한 문제

윷 결과 화면의 우승자는 **전신 그림(`_full`)을 110px쯤으로 크게** 띄운다(`yut.html:3344`).
그리고 `cheer` 아트가 있으면 그 얼굴로 **영구 교체**한다(`yut.html:3348`).

문제는 `_cheer.png`가 판 위 말(15~37px)용이라 **얼굴만 바짝 잘린 판본**이라는 것이다.
실제로 겹쳐 보니 산신령·복주머니는 **전신 → 얼굴 클로즈업**으로 확 튄다. 청룡·저승사자는 덜하다.

→ 그 8종만 `cheer`를 **전신 프레이밍으로 한 장 더** 뽑는다. 그 한 장에서 전신본과 잘린 본을
   `--bust --tight`로 **둘 다 뽑아낼 수 있어** 실제 생성은 8번이면 된다.
   (코드 쪽 폴백은 내가 넣는다: `_cheer_full` → `_cheer` → 베이스.)
   3파를 건너뛰면 그 8종은 우승 화면에서 얼굴이 확대되는 정도이고, **깨지지는 않는다.**

---

## 공통 앞머리 — 세 파 모두 이 블록으로 시작

```
Match the attached reference image exactly: the same character, same species and design,
same colors, same costume and props, same art style. This is that character's official art.

The style is: soft 3D render with a smooth glossy vinyl-toy look, rounded chibi proportions
with a big head, big glossy expressive eyes with two catchlights, warm soft global illumination
with the key light from the upper left, subtle rim light, no hard outlines, clean readable
silhouette at small sizes, front three-quarter view, transparent background, high resolution.

Do NOT change: species, horn count, hair, costume, accessories, palette.
Do NOT use: pixel art, hard black outline, cel shading, flat vector, sticker cutout edge,
text, watermark, busy background, multiple different characters, photorealistic human.

Only the facial expression and pose change.
```

## 1파 — 시트 A (캐릭터당 1장 · 13장)

공통 앞머리 + **아래 시트 지시** + 해당 캐릭터의 **표정 힌트**(다음 절 표)

```
character expression sheet: three identical busts of this same character side by side,
same scale, same camera, same lighting,
LARGE EMPTY GAPS between them — the three figures must not touch or overlap at all,
(1) sparkling star-shaped eyes, triumphant proud grin,
(2) wide open O mouth, big round shocked eyes, startled,
(3) beaming happy smile, closed ^^ curved eyes, joyful
```

## 2파 — 시트 B (캐릭터당 1장 · 13장)

공통 앞머리 + 아래 + 표정 힌트

```
character expression sheet: three identical busts of this same character side by side,
same scale, same camera, same lighting,
LARGE EMPTY GAPS between them — the three figures must not touch or overlap at all,
(1) teary droopy sad eyes, small frown, dejected,
(2) angry pouty frown with furrowed brows and a small red anger vein, arms crossed,
(3) both arms raised cheering, huge joyful open smile, star-shaped eyes
```

## 3파 — cheer 전신 낱장 (8/11 8종만 · 8장)

공통 앞머리 + 아래. **시트가 아니라 한 장짜리**이고, **잘리지 않은 전신**이어야 한다.

```
a single full-body illustration of this character, whole body visible including feet/base
and all props, nothing cropped off, centered with a small margin on all sides,
celebrating: both arms raised cheering, huge joyful open smile, star-shaped sparkling eyes
```

---

## 캐릭터별 표정 힌트 — 얼굴이 없는 것들이 문제다

**8/11 8종 중 넷은 사물이다**(윷가락·복주머니·청사초롱·장승). 사물에 "화난 표정"을 시키면
모델이 캐릭터를 사람으로 바꿔 버리거나 표정을 아예 무시한다. **무엇으로 감정을 표현할지 지정**한다.

| id | 이름 | 프롬프트에 이어 붙일 표정 힌트 |
|---|---|---|
| `tiger` | 호랑이 | *(불필요 — 얼굴이 있다)* |
| `rabbit` | 토끼 | `the long upright ear reacts to the emotion — perked up when excited, drooping when sad` |
| `bear` | 곰 | *(불필요)* |
| `fox` | 여우 | `the bushy tail reacts — puffed up when startled, curled low when dejected` |
| `dokkaebi` | 도깨비 | *(불필요)* |
| `yutgarak` | 윷가락 | `the face is carved into the upper wooden stick; express emotion with the carved eyes and mouth and by how the two sticks lean — tumbling apart when startled, slumped when sad` |
| `bokjumeoni` | 복주머니 | `the round face is on the crimson pouch body; the two golden tassels act like arms/hair — flying up when excited, hanging limp when sad` |
| `chorong` | 청사초롱 | `the face is lit from inside by the candle; the inner flame reacts — flaring bright when excited, guttering low and dim when sad, flickering red when angry` |
| `jangseung` | 장승 | `it is a carved wooden post with no arms; express emotion only with the bulging round eyes, carved eyebrows and the wide red-painted mouth` |
| `haetae` | 해태 | `the copper-red curly mane reacts — bristling when angry, flattened when dejected` |
| `sansin` | 산신령 | `the long white beard and bushy eyebrows carry the emotion; keep the beard covering half his face` |
| `yong` | 청룡 | `the long whiskers and the coiled serpentine body carry the emotion — whiskers streaming up when excited, drooping when sad` |
| `jeoseung` | 저승사자 | `keep him cool and understated — small shifts: the gat hat tilting, one eyebrow raised, the smirk widening. never loud or goofy` |

**캐릭터별 추가 네거티브**는 8/11 문서(`2026-08-11_dice-alley_character-set-3.md` 4절)를 그대로 쓴다.
특히 `dokkaebi`에는 `japanese oni, red demon skin, tiger-skin loincloth, scary, horror`를 꼭 넣는다.

---

## ⚠️ 지금까지 데인 것 넷 (8/18·8/20 실측)

1. **배경을 검정으로 두지 말 것.** 저승사자 때 검은 옷과 검은 배경을 못 갈라 통째로 버렸다.
   투명이 안 되면 중간 회색처럼 캐릭터에 없는 색으로. (`--bg none`이 알파를 그대로 믿는다.)
2. **시트에서 얼굴이 붙으면 알파 덩어리가 둘로만 잡힌다.** 8/20에 8장 중 2장이 그랬다.
   그래서 위 프롬프트에 `LARGE EMPTY GAPS … must not touch or overlap`를 넣었다.
   그래도 붙으면 — 폭이 배가 되는 덩어리 **안에서 가장 성긴 열**을 찾아 가른다(내가 처리한다).
   제대로 갈렸는지는 **결과 폭이 고른가(±10%)**로 확인한다.
3. **시트 폭은 균등할 필요 없다.** 알파로 찾으므로 제각각이어도 된다(pig 때 593·627·697).
4. **얼굴이 원형 크롭 밖으로 나가면 안 된다.** 판 위 말은 원형으로 잘린다 — 얼굴이 중앙 원(지름 ~88%) 안에.

## 도착 후 (내가 함)

`art-src/2026-08-2X_shop13/raw/{id}_sheetA.png` 식으로 넣어 주면:

1. 알파로 시트 슬라이스 → 표정별 낱장
2. `process-char-art.py --bg none` → `public/img/{id}_{emotion}.png` (400px 정사각)
   3파 전신본은 `--bust --tight`로 잘린 판본까지 같이 뽑는다
3. 32px 원형에서 6표정이 서로 구분되는지 대조
4. `npm run test:face` 커버리지 확인(5/18 → …/18) · `check:drift` · 커밋 · 배포
5. 라이브 브라우저에서 스왑·렌더 전수 확인(무료 5종 때 30/30으로 했던 그 검사)

**코드 변경은 3파의 `_cheer_full` 폴백 한 줄뿐이다.** 나머지는 파일 이름만 맞으면 자동으로 잡힌다.

## 전제·미확정

- 전제: 상점 13종의 베이스 스타일이 pig와 붙는다고 판단했다(눈 대조). 1파 3장을 먼저 받아
  기존 베이스와 나란히 놓고 확인한 뒤 나머지를 뽑는 것이 안전하다 — 8/11에도 그렇게 했다.
- 미확정: 표정을 카드게임에 배선할지(위 ③). 배선하면 이 13종의 가치가 12게임으로 퍼진다.
- 미확정: 실사용자가 아직 0명이라 **어느 상점 캐릭터가 인기인지 데이터가 없다.**
  우선순위를 데이터로 정할 수 없어 위 순서는 "표정이 뜨는 빈도"로만 정했다.
