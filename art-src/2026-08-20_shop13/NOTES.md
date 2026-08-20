# 상점 13종 표정 — 원본 (2026-08-20~)

낱장 프롬프트: `outputs/production/2026-08-20_dice-alley_shop13-prompts.md`
(생성기 `scripts/gen-expression-prompts.py` — 문서를 고치지 말고 스크립트를 고쳐 다시 찍는다)

파일명은 `{id}_{emotion}.png`. **이름이 곧 배선이다.**

## 1파 `cheer/` — **13/13 완료** (1차 9장 + 재생성 4장)

| id | 판정 | 왜 |
|---|---|---|
| `tiger` `fox` `bokjumeoni` `haetae` `sansin` `yong` | ✅ 1차 | 베이스와 같은 캐릭터, 표정 명확 |
| `dokkaebi` | ✅ 1차 | 뿔·초록 피부·방망이 유지. 조끼가 붉은색→푸른 도포로 바뀌었으나 알아볼 수 있어 통과 |
| `yutgarak` | ✅ 1차 | 빨간 머리띠·나무 발이 빠졌으나 얼굴·붉은 X 유지 |
| `jangseung` | ✅ 1차 | 갓·나뭇가지가 빠졌으나 눈·붉은 입·이끼 기둥 유지 |
| `rabbit` | ❌→✅ | 1차: 금색 나비넥타이가 빠졌다. 2차: 회백색 털 + 나비넥타이 복원 |
| `bear` | ❌→✅ | 1차: 베이스엔 없는 **빨간 스카프**가 생겼다. 2차: 목장식 없음 |
| `chorong` | ❌→✅ | 1차: 팔다리 없는 유리 랜턴이 됐다. 2차: 사각 몸통·팔·다리·몸통 얼굴 복원 |
| `jeoseung` | ❌→✅ | 1차: 활짝 웃고 등불이 사라졌다. 2차: 다문 미소 + 파란 영혼등 유지 |

**2차 4장은 원본 고해상도(1024~1536px)를 레퍼런스로 붙여 뽑았다.** 1차는 `public/img/`의 400px을 썼다.
레퍼런스 의존도가 높은 캐릭터(초롱의 몸통 형태, 저승사자의 등불)는 큰 레퍼런스가 확실히 낫다.

### ⚠️ 1차 토끼가 어긋난 진짜 이유는 프롬프트가 아니었다

`public/img/rabbit.png` **자체가 깨져 있었다.** 얼굴·볼·가슴의 흰 털 자리가 투명이었다
(구멍 42.0% → 54.5%). 배경 제거기의 `isbg`(`min>225 AND max-min<8`)가 **회백색 무채색 털**을
배경으로 보고 파먹은 것이다. 흰 원형 아바타 위라 흰 구멍이 안 보여 8/04부터 3주를 살아 있었다.

그리고 나는 그 구멍을 **어두운 배경에 얹어 보고 '검은 마스크 무늬'로 오독**해서,
프롬프트에 "black mask" 라고 적었다. 그대로 갔으면 **버그를 아트에 영구히 새길 뻔했다.**

→ 원본에서 `--bg none`으로 다시 뽑아 고쳤다(구멍 42.1% — 원본과 일치).
→ **캐릭터 설명을 쓸 때는 밝은 배경과 어두운 배경 **둘 다**에 얹어 본다.**
   한쪽에서만 보면 알파 구멍과 검은 무늬를 구별할 수 없다.

## ⚠️ 4장이 왜 어긋났나 — 원인은 프롬프트 쪽이다

**캐릭터 설명을 `public/img/`의 실제 그림이 아니라 그 그림을 만든 옛 프롬프트에서 베꼈다.**
`ART_BRIEF.md`·`2026-08-11_..._character-set-3.md`의 문장을 그대로 옮겼는데,
**납품된 그림이 이미 그 문장에서 드리프트해 있었다** — 토끼엔 없던 나비넥타이가 생겼고,
곰엔 있다던 스카프가 없었고, 청사초롱은 둥근 등이 아니라 팔다리 달린 사각 몸통이 됐다.

레퍼런스 이미지를 붙여도 소용없었다. **텍스트와 이미지가 싸우면 모델은 텍스트를 따른다.**
그래서 내 텍스트가 그림을 옛 프롬프트 쪽으로 되돌려 버렸다.

고친 것 둘 (`gen-expression-prompts.py`):
1. 13종 설명을 **실제 PNG를 보고 다시 썼다.** 어긋났던 넷은 빠진 소품을 대문자로 못박고
   네거티브에 반대 항목을 넣었다(`rabbit`엔 `plain all-white rabbit, no bow tie`, `bear`엔 `red scarf` …).
2. 공통 앞머리에 한 줄: `If anything in the text below disagrees with the attached image, FOLLOW THE IMAGE.`

**다음에 새 표정을 뽑을 때도 설명은 그림을 보고 쓴다.** 옛 문서를 베끼지 않는다.

## 처리 (기록 — 다음 파에도 같은 값을 쓴다)

원본 파라미터는 `2026-08-11_set3-korean-folklore/NOTES.md`에 있는 값을 그대로 따른다.
베이스와 프레이밍이 어긋나면 스왑할 때 그림이 튄다.

```bash
# 8/04 5종(tiger·rabbit·bear·fox·dokkaebi) — 이미 상반신
python3 scripts/process-char-art.py cheer/{id}_cheer.png public/img/{id}_cheer.png --bg none

# 8/11 8종 — 전신으로 뽑아 두 판본을 다 뽑는다
python3 scripts/process-char-art.py cheer/{id}_cheer.png public/img/{id}_cheer_full.png --bg none
python3 scripts/process-char-art.py cheer/{id}_cheer.png public/img/{id}_cheer.png --bg none --bust 0.62
#   ⚠️ chorong만 --bust 0.72
```

## `cheer`는 판 위에 안 뜬다 — 우승 화면 전용이다

`reactCard`가 쏘는 표정은 `star`·`surprise`·`happy`·`sad`·`angry` 다섯뿐이다.
`cheer`는 결과 화면 우승자(`resHero`, 96~124px)에서 **영구 교체**로만 쓴다.

그래서 8/11 8종은 히어로가 `{id}_cheer_full.png`를 먼저 찾도록 `yut.html`에 폴백을 넣었다
(`_cheer_full` → `_cheer` → 베이스). `{id}_cheer.png`(잘린 판본)는 지금은 안 쓰이지만,
나중에 카드게임에 `cheer`를 배선하면 그때 살아난다.
