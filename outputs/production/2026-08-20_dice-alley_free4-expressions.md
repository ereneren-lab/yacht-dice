# 무료 4종 확대 — dog · sheep · cow · horse (2026-08-20)

pig 6표정이 실기기 검증까지 끝났다(`cheer` 히어로 눈으로 확인 · `sad`/`angry` 발화 확인).
같은 파이프라인을 나머지 무료 4종에 돌린다.

## ⚠️ 먼저 알아야 할 것 — 기본 얼굴도 새로 뽑아야 한다

`pig.png`는 **8/18에 새 스타일로 교체됐다**(#29 — 파란 데님·반질 3D). 나머지 4종은 **7/21~22 것 그대로**다.
나란히 놓으면 pig만 다르게 보인다. 그래서 이번엔 **표정 6장 + 기본 얼굴 1장**을 같이 뽑는다.

→ 캐릭터당 **3번 생성**(기본 1 + 3-업 시트 2) × 4종 = **12번**.

## 뽑는 법

**레퍼런스로 `public/img/pig.png`를 매번 첨부한다.** 그게 지금의 정본 스타일이다.
(⚠️ `ART_BRIEF.md`의 `--ar 1:1 --style raw`는 미드저니 플래그다. ChatGPT에선 무시되니 빼고 쓴다.)

### 공통 앞머리 — 3번 모두 이 블록으로 시작

```
Match the art style of the attached reference image exactly. That style is:
soft 3D render with a smooth glossy vinyl-toy look, rounded chibi proportions with a big head,
big glossy expressive eyes with two catchlights, warm soft global illumination with the key light
from the upper left, subtle rim light, no hard outlines, clean readable silhouette at small sizes,
front three-quarter view, bust framing centered, transparent background, square-ish canvas, high resolution.

Do NOT use: pixel art, hard black outline, cel shading, flat vector, sticker cutout edge,
text, watermark, busy background, multiple different characters, photorealistic human.

The character:
```

### ① 기본 얼굴 (캐릭터당 1장)

공통 앞머리 + **캐릭터 설명**(아래) + `calm friendly idle expression, gentle closed smile`

### ② 표정 3-업 시트 A (캐릭터당 1장)

공통 앞머리 + 캐릭터 설명 + 아래:

```
character expression sheet: three identical busts side by side,
same character, same scale, same camera, same lighting, evenly spaced with clear gaps between them,
(1) sparkling star-shaped eyes, triumphant proud grin,
(2) wide open O mouth, big round shocked eyes, startled,
(3) beaming happy smile, closed ^^ curved eyes, joyful
```

### ③ 표정 3-업 시트 B (캐릭터당 1장)

공통 앞머리 + 캐릭터 설명 + 아래:

```
character expression sheet: three identical busts side by side,
same character, same scale, same camera, same lighting, evenly spaced with clear gaps between them,
(1) teary droopy sad eyes, small frown, dejected,
(2) angry pouty frown with furrowed brows and a small red anger vein, arms crossed,
(3) both arms raised cheering, huge joyful open smile, star-shaped eyes
```

## 캐릭터 설명 (시그니처 컬러 유지 — 30px에서 서로를 가르는 건 색이다)

| id | 설명 | 대표색 |
|---|---|---|
| `dog` | `friendly shiba-inu puppy, tan and cream fur, floppy ears, red collar with a little golden bell` | 탄/크림 |
| `sheep` | `fluffy cream-white sheep, curly soft wool, tiny nub horns` | 크림 |
| `cow` | `black-and-white spotted baby calf, pink snout, small horns` | 흑백 |
| `horse` | `small brown pony, dark flowing mane, sturdy cute stance` | 브라운 |

pig가 옷(파란 데님·빨간 반다나)을 입었으니, 4종도 **작은 소품 하나씩**(개=방울 목걸이, 양=스카프,
소=워낭, 말=갈기 끈) 정도는 좋다. 다만 **얼굴을 가리면 안 된다** — 원형 크롭에 얼굴이 중앙 원(지름 ~88%) 안에.

## ⚠️ 지난번에 데인 것 둘

1. **배경을 검정으로 두지 말 것.** 저승사자 때 검은 옷과 검은 배경을 못 갈라 통째로 버렸다.
   투명이 안 되면 중간 회색처럼 캐릭터에 없는 색으로.
2. **시트 폭은 균등할 필요 없다.** 알파로 덩어리를 찾아 자른다(pig 때 593·627·697로 제각각이었다).
   다만 **얼굴 사이가 붙으면** 한 덩어리로 잡히니 **사이를 띄워** 달라고 프롬프트에 넣었다.

## 도착 후 (내가 함)

`art-src/`에 올려주면:
1. 알파로 시트 슬라이스 → 표정별 낱장
2. `process-char-art.py --bg none` → `public/img/{id}.png` · `{id}_{emotion}.png` (400px 정사각)
3. 32px 원형에서 6표정이 서로 구분되는지 대조
4. 커밋 → 배포 → 실기기에서 발화 확인

**코드 변경은 없다.** 파일 이름만 맞으면 자동으로 잡히고, 없으면 조용히 기본 얼굴로 폴백한다.
회귀 검사(`npm run test:face`)의 커버리지가 1/18 → 5/18로 저절로 올라간다.
