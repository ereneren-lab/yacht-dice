# 표정 시트 — 파일럿 브리프 (2026-08-18)

> 목적: 표정 아트 **파이프라인·룩을 먼저 검증**한다. 18종×6표정(108장)을 몰아 뽑기 전에,
> **무료 5종 × 3표정 = 15장**으로 실기기에서 "이벤트에 얼굴이 바뀐다"를 확인한다.
> 좋으면 나머지 표정·캐릭터로 확대. (스펙 원본: `ART_BRIEF.md`)

## 왜 이 3표정·5종인가

코드는 **윷놀이에 이미 배선**돼 있고(배포됨), 아트가 없으면 조용히 기본 얼굴로 폴백한다.
파일럿은 **윷에서 실제로 터지는 이벤트 3개**에 딱 맞춘다 — 그래야 끝까지 검증된다:

| 이벤트 | 감정 | 파일명 |
|---|---|---|
| 윷/모 (한 번 더!) | `star` 의기양양(별눈, 반짝) | `{id}_star.png` |
| 빽도 (뒤로!) | `surprise` 놀람(입 O, 눈 크게) | `{id}_surprise.png` |
| 잡음 (상대 말 잡기) | `happy` 신남(활짝 웃음 ^^) | `{id}_happy.png` |

`{id}` = 무료 5종: **`pig` `dog` `sheep` `cow` `horse`** (윷은 이 5종만 쓴다).
→ 15장: `pig_star.png` … `horse_happy.png`.

---

## 뽑는 법 — 두 갈래 (B 권장)

### B. 캐릭터당 3-업 시트 (5번 생성, 일관성 ↑ — 권장)
한 캐릭터의 3표정을 **한 이미지**로 뽑으면 같은 얼굴·조명·스케일이 저절로 맞는다. 슬라이싱은 내가 한다.

```
[아래 캐릭터 설명], character expression sheet: three identical busts side by side, same character same scale same camera same lighting,
(1) sparkling star-shaped eyes triumphant proud grin,
(2) wide open O mouth big round shocked eyes startled,
(3) beaming happy smile closed ^^ curved eyes joyful,
[아래 스타일 접미사]
```
→ 5장(pig/dog/sheep/cow/horse 각 3-업)만 주면, 내가 잘라서 15개 파일로 만든다.

### A. 표정마다 따로 (15번 생성 — 가장 단순, 대신 얼굴이 조금씩 흔들릴 수 있음)
`[캐릭터 설명] + [표정 구절 1개] + [스타일 접미사]`로 15장.

---

## 캐릭터 설명 (5종)
- **pig**: `chubby pink piglet, rosy cheeks, tiny round snout, small ears`
- **dog**: `friendly shiba-inu puppy, tan and cream fur, floppy ears, red collar with a little golden bell`
- **sheep**: `fluffy cream-white sheep, curly soft wool, tiny nub horns`
- **cow**: `black-and-white spotted baby calf, pink snout, small horns`
- **horse**: `small brown pony, dark flowing mane, sturdy cute stance`

## 표정 구절 (파일럿 3)
- **star**: `sparkling star-shaped eyes, triumphant proud grin`
- **surprise**: `wide open O mouth, big round shocked eyes, startled`
- **happy**: `beaming happy smile, closed ^^ curved eyes, joyful`

## 스타일 접미사 (모든 프롬프트 뒤에 — 기존 초상과 같아야 함)
```
cute chibi mascot, soft 3D render, smooth rounded vinyl-toy clay look, big glossy expressive eyes,
subtle rim light, warm soft global illumination, thick clean silhouette, front three-quarter view,
bust framing centered, plain transparent background, premium mobile game character, studio lighting,
high detail --ar 1:1 --style raw
```
## 네거티브
```
text, watermark, signature, extra limbs, deformed, photorealistic human, harsh shadows,
busy background, low contrast, flat lighting
```
⚠️ **시그니처 컬러 유지**: 돼지=핑크·개=탄/크림·양=크림·소=흑백·말=브라운. 원형 크롭이라 얼굴이 중앙 원(지름 ~88%) 안에 들게.

---

## 도착 후 처리 (내가 함)
1. 시트면 표정별로 슬라이스.
2. `python3 scripts/process-char-art.py <입력.png> public/img/{id}_{emotion}.png`
   (배경 제거 + 정사각 + 400px — 기존 초상과 동일 규격). **철자 그대로**여야 코드가 찾는다.
3. 커밋 → 배포. 파일이 도착한 캐릭터·표정만 살아나고, 없는 건 기본 얼굴 그대로(무해).

## 실기기 검증
윷 한 판 → 윷/모(별눈) · 빽도(놀람) · 잡음(신남)에서 **좌측 큰 캐릭터 카드**의 얼굴이 바뀌는지.
됐으면 → 나머지 3표정(`sad` 잡힘·`angry` 당함·`cheer` 우승) + 카드게임(섯다·인디언 승리 시 `cheer`/`sad`) + 13종 확대.

## 최소 시작
룩만 먼저 보고 싶으면 **pig 3-업 1장**만 줘도 된다 — 돼지로 플레이하면 세 이벤트 다 검증된다.
