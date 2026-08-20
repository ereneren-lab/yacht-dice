# 상점 13종 표정 — 낱장 프롬프트 78개 (2026-08-20)

> 이 문서는 `scripts/gen-expression-prompts.py`가 찍어낸다. **여기를 직접 고치지 말고**
> 스크립트를 고쳐 다시 찍을 것 — 78개의 공통 부분이 갈리면 그림이 갈린다.

> 판단 근거·처리 절차는 `2026-08-20_dice-alley_shop13-expressions.md`에 있다.

## 매번 지킬 것 두 가지

1. **레퍼런스로 그 캐릭터 자신의 그림을 첨부한다.** 아래 각 프롬프트에 붙일 파일이 적혀 있다.
2. **파일 이름을 프롬프트 제목 그대로** 저장한다(`{id}_{emotion}.png`). 이름이 곧 배선이다.

| 파 | 표정 | 왜 이 순서 |
|---|---|---|
| 1 | `cheer` (환호) | 우승 화면에서 110px로 **크게** 뜨고 영구 교체된다 — 한 장당 값이 가장 크다 |
| 2 | `star` (별눈) | 윷·모를 던질 때. 한 판에 가장 자주 뜬다 |
| 3 | `happy` (기쁨) | 상대 말을 잡았을 때 — 윷에서 제일 신나는 순간 |
| 4 | `surprise` (놀람) | 빽도 |
| 5 | `sad` (슬픔) | 내 말이 잡혔을 때 |
| 6 | `angry` (화남) | 함정(늪)에 빠졌을 때 |

어느 파에서 멈춰도 깨지지 않는다 — 없는 표정은 `reactImg`가 조용히 베이스로 폴백한다.

---

# 1파 — `cheer` (환호) · 13장

우승 화면에서 110px로 **크게** 뜨고 영구 교체된다 — 한 장당 값이 가장 크다

## `tiger_cheer.png` — 호랑이

첨부: `public/img/tiger.png` · **상반신으로**

```
Match the attached reference image exactly: the same character, the same species and design,
the same colors, the same costume and props, the same art style. That image is this character's
official art. Only the facial expression and the pose change.

Style: soft 3D render with a smooth glossy vinyl-toy look, rounded chibi proportions with a big head,
big glossy expressive eyes with two catchlights, warm soft global illumination with the key light from
the upper left, subtle rim light, no hard outlines, clean readable silhouette at small sizes,
front three-quarter view, transparent background, high resolution.

The character: a playful young Korean tiger cub, warm orange fur with soft black stripes, cream muzzle and belly, round cheeks, one ear flicked back, tiny fangs.

Expression: both arms raised high cheering, a huge joyful open smile, sparkling star-shaped eyes.

Framing: bust framing, head and upper body, centered, the same crop as the reference image. Keep the face inside the central circle (about 88% of the width) — this art gets cropped into a circle.

Do NOT change the species, horn count, hair, costume, accessories or palette.
Do NOT use: pixel art, hard black outline, cel shading, flat vector, sticker cutout edge, text,
watermark, busy background, more than one character, photorealistic human.
```

## `rabbit_cheer.png` — 토끼

첨부: `public/img/rabbit.png` · **상반신으로**

```
Match the attached reference image exactly: the same character, the same species and design,
the same colors, the same costume and props, the same art style. That image is this character's
official art. Only the facial expression and the pose change.

Style: soft 3D render with a smooth glossy vinyl-toy look, rounded chibi proportions with a big head,
big glossy expressive eyes with two catchlights, warm soft global illumination with the key light from
the upper left, subtle rim light, no hard outlines, clean readable silhouette at small sizes,
front three-quarter view, transparent background, high resolution.

The character: a soft white-and-grey rabbit, one long ear upright and the other folded, pink inner ears, a twitching nose.
The long upright ear carries the emotion — perked up and quivering when excited, drooping when dejected.

Expression: both arms raised high cheering, a huge joyful open smile, sparkling star-shaped eyes.

Framing: bust framing, head and upper body, centered, the same crop as the reference image. Keep the face inside the central circle (about 88% of the width) — this art gets cropped into a circle.

Do NOT change the species, horn count, hair, costume, accessories or palette.
Do NOT use: pixel art, hard black outline, cel shading, flat vector, sticker cutout edge, text,
watermark, busy background, more than one character, photorealistic human.
```

## `bear_cheer.png` — 곰

첨부: `public/img/bear.png` · **상반신으로**

```
Match the attached reference image exactly: the same character, the same species and design,
the same colors, the same costume and props, the same art style. That image is this character's
official art. Only the facial expression and the pose change.

Style: soft 3D render with a smooth glossy vinyl-toy look, rounded chibi proportions with a big head,
big glossy expressive eyes with two catchlights, warm soft global illumination with the key light from
the upper left, subtle rim light, no hard outlines, clean readable silhouette at small sizes,
front three-quarter view, transparent background, high resolution.

The character: a chubby honey-brown bear cub, small round ears, a broad soft muzzle, gentle sleepy-warm eyes.

Expression: both arms raised high cheering, a huge joyful open smile, sparkling star-shaped eyes.

Framing: bust framing, head and upper body, centered, the same crop as the reference image. Keep the face inside the central circle (about 88% of the width) — this art gets cropped into a circle.

Do NOT change the species, horn count, hair, costume, accessories or palette.
Do NOT use: pixel art, hard black outline, cel shading, flat vector, sticker cutout edge, text,
watermark, busy background, more than one character, photorealistic human.
```

## `fox_cheer.png` — 여우

첨부: `public/img/fox.png` · **상반신으로**

```
Match the attached reference image exactly: the same character, the same species and design,
the same colors, the same costume and props, the same art style. That image is this character's
official art. Only the facial expression and the pose change.

Style: soft 3D render with a smooth glossy vinyl-toy look, rounded chibi proportions with a big head,
big glossy expressive eyes with two catchlights, warm soft global illumination with the key light from
the upper left, subtle rim light, no hard outlines, clean readable silhouette at small sizes,
front three-quarter view, transparent background, high resolution.

The character: a sleek red-orange fox, white cheek fur and chest, tall pointed ears, narrow clever eyes, a bushy tail curling up behind.
The bushy tail carries the emotion — puffed up when startled, curled low and tight when dejected.

Expression: both arms raised high cheering, a huge joyful open smile, sparkling star-shaped eyes.

Framing: bust framing, head and upper body, centered, the same crop as the reference image. Keep the face inside the central circle (about 88% of the width) — this art gets cropped into a circle.

Do NOT change the species, horn count, hair, costume, accessories or palette.
Do NOT use: pixel art, hard black outline, cel shading, flat vector, sticker cutout edge, text,
watermark, busy background, more than one character, photorealistic human.
```

## `dokkaebi_cheer.png` — 도깨비

첨부: `public/img/dokkaebi.png` · **상반신으로**

```
Match the attached reference image exactly: the same character, the same species and design,
the same colors, the same costume and props, the same art style. That image is this character's
official art. Only the facial expression and the pose change.

Style: soft 3D render with a smooth glossy vinyl-toy look, rounded chibi proportions with a big head,
big glossy expressive eyes with two catchlights, warm soft global illumination with the key light from
the upper left, subtle rim light, no hard outlines, clean readable silhouette at small sizes,
front three-quarter view, transparent background, high resolution.

The character: a friendly Korean dokkaebi goblin, a single small horn on the forehead, warm teal-green skin, wild dark hair, round mischievous eyes, a tiny wooden club (bangmangi) resting on one shoulder.

Expression: both arms raised high cheering, a huge joyful open smile, sparkling star-shaped eyes.

Framing: bust framing, head and upper body, centered, the same crop as the reference image. Keep the face inside the central circle (about 88% of the width) — this art gets cropped into a circle.

Do NOT change the species, horn count, hair, costume, accessories or palette.
Do NOT use: pixel art, hard black outline, cel shading, flat vector, sticker cutout edge, text,
watermark, busy background, more than one character, photorealistic human, japanese oni, red demon skin, tiger-skin loincloth, two horns, scary, horror.
```

## `yutgarak_cheer.png` — 윷가락

첨부: `public/img/yutgarak_full.png` · **전신으로**

```
Match the attached reference image exactly: the same character, the same species and design,
the same colors, the same costume and props, the same art style. That image is this character's
official art. Only the facial expression and the pose change.

Style: soft 3D render with a smooth glossy vinyl-toy look, rounded chibi proportions with a big head,
big glossy expressive eyes with two catchlights, warm soft global illumination with the key light from
the upper left, subtle rim light, no hard outlines, clean readable silhouette at small sizes,
front three-quarter view, transparent background, high resolution.

The character: two rounded wooden yut sticks as one cheerful mascot, pale birch wood with visible warm grain, the flat side painted with a bold red X mark, a small friendly face carved into the upper stick.
The face is carved into the upper wooden stick. It has no arms — express the emotion with the carved eyes and mouth and with how the two sticks lean against each other.

Expression: the two sticks fly apart into a joyful V shape mid-tumble, the carved face beaming with a huge open smile and sparkling star-shaped eyes.

Framing: a single full-body illustration. The whole body must be visible including the feet or base and every prop, nothing cropped off, centered with a small even margin on all sides. Keep the face clearly readable.

Do NOT change the species, horn count, hair, costume, accessories or palette.
Do NOT use: pixel art, hard black outline, cel shading, flat vector, sticker cutout edge, text,
watermark, busy background, more than one character, photorealistic human, plain object, product photo, no face, still life, human hands.
```

## `bokjumeoni_cheer.png` — 복주머니

첨부: `public/img/bokjumeoni_full.png` · **전신으로**

```
Match the attached reference image exactly: the same character, the same species and design,
the same colors, the same costume and props, the same art style. That image is this character's
official art. Only the facial expression and the pose change.

Style: soft 3D render with a smooth glossy vinyl-toy look, rounded chibi proportions with a big head,
big glossy expressive eyes with two catchlights, warm soft global illumination with the key light from
the upper left, subtle rim light, no hard outlines, clean readable silhouette at small sizes,
front three-quarter view, transparent background, high resolution.

The character: a plump crimson silk lucky pouch mascot, a gold embroidered longevity pattern, the drawstring gathered at the top like a topknot, two golden tassels swinging to one side, a round happy face on the pouch body.
The face is on the crimson pouch body. The two golden tassels act as its arms — they carry the emotion.

Expression: both golden tassels flung straight up like raised arms, a huge joyful open smile, sparkling star-shaped eyes.

Framing: a single full-body illustration. The whole body must be visible including the feet or base and every prop, nothing cropped off, centered with a small even margin on all sides. Keep the face clearly readable.

Do NOT change the species, horn count, hair, costume, accessories or palette.
Do NOT use: pixel art, hard black outline, cel shading, flat vector, sticker cutout edge, text,
watermark, busy background, more than one character, photorealistic human, plain object, product photo, no face, still life, human hands.
```

## `chorong_cheer.png` — 청사초롱

첨부: `public/img/chorong_full.png` · **전신으로**

```
Match the attached reference image exactly: the same character, the same species and design,
the same colors, the same costume and props, the same art style. That image is this character's
official art. Only the facial expression and the pose change.

Style: soft 3D render with a smooth glossy vinyl-toy look, rounded chibi proportions with a big head,
big glossy expressive eyes with two catchlights, warm soft global illumination with the key light from
the upper left, subtle rim light, no hard outlines, clean readable silhouette at small sizes,
front three-quarter view, transparent background, high resolution.

The character: a traditional Korean wedding lantern mascot, a hexagonal frame with blue and red silk panels, a warm candle glow from inside lighting its own face, a small wooden carrying handle tilted, a tiny flame flickering.
Its face is lit from inside by the candle, and it has no arms. The inner flame carries the emotion — flaring bright and tall when excited, guttering low and dim when dejected, burning sharp red when angry.

Expression: the inner flame flares up bright and tall, the whole lantern tilting back with a huge joyful open smile and sparkling star-shaped eyes.

Framing: a single full-body illustration. The whole body must be visible including the feet or base and every prop, nothing cropped off, centered with a small even margin on all sides. Keep the face clearly readable.

Do NOT change the species, horn count, hair, costume, accessories or palette.
Do NOT use: pixel art, hard black outline, cel shading, flat vector, sticker cutout edge, text,
watermark, busy background, more than one character, photorealistic human, plain object, product photo, no face, still life, human hands, paper lantern festival.
```

## `jangseung_cheer.png` — 장승

첨부: `public/img/jangseung_full.png` · **전신으로**

```
Match the attached reference image exactly: the same character, the same species and design,
the same colors, the same costume and props, the same art style. That image is this character's
official art. Only the facial expression and the pose change.

Style: soft 3D render with a smooth glossy vinyl-toy look, rounded chibi proportions with a big head,
big glossy expressive eyes with two catchlights, warm soft global illumination with the key light from
the upper left, subtle rim light, no hard outlines, clean readable silhouette at small sizes,
front three-quarter view, transparent background, high resolution.

The character: a friendly Korean village guardian totem post, weathered mossy grey-green wood, comically bulging round eyes, a wide red-painted grinning mouth with two blunt teeth, carved eyebrows, gentle rather than fearsome.
It is a carved wooden post with no arms and no legs. Express the emotion ONLY with the bulging round eyes, the carved eyebrows and the wide red-painted mouth, plus how the whole post tilts.

Expression: no arms — the whole post tilting back in celebration, the bulging eyes wide with joy, the wide red mouth thrown open in a shout, sparkling star highlights in the eyes.

Framing: a single full-body illustration. The whole body must be visible including the feet or base and every prop, nothing cropped off, centered with a small even margin on all sides. Keep the face clearly readable.

Do NOT change the species, horn count, hair, costume, accessories or palette.
Do NOT use: pixel art, hard black outline, cel shading, flat vector, sticker cutout edge, text,
watermark, busy background, more than one character, photorealistic human, native american totem pole, tiki mask, scary, horror, human hands.
```

## `haetae_cheer.png` — 해태

첨부: `public/img/haetae_full.png` · **전신으로**

```
Match the attached reference image exactly: the same character, the same species and design,
the same colors, the same costume and props, the same art style. That image is this character's
official art. Only the facial expression and the pose change.

Style: soft 3D render with a smooth glossy vinyl-toy look, rounded chibi proportions with a big head,
big glossy expressive eyes with two catchlights, warm soft global illumination with the key light from
the upper left, subtle rim light, no hard outlines, clean readable silhouette at small sizes,
front three-quarter view, transparent background, high resolution.

The character: a young Korean haetae guardian beast, golden fur with a copper-red mane in tight curls, a single small horn on the forehead, a scaled collar, round proud eyes.
The copper-red curly mane carries the emotion — bristling out when angry, flattened down when dejected.

Expression: both arms raised high cheering, a huge joyful open smile, sparkling star-shaped eyes.

Framing: a single full-body illustration. The whole body must be visible including the feet or base and every prop, nothing cropped off, centered with a small even margin on all sides. Keep the face clearly readable.

Do NOT change the species, horn count, hair, costume, accessories or palette.
Do NOT use: pixel art, hard black outline, cel shading, flat vector, sticker cutout edge, text,
watermark, busy background, more than one character, photorealistic human, stone statue, temple lion statue, chinese guardian lion, jade sculpture.
```

## `sansin_cheer.png` — 산신령

첨부: `public/img/sansin_full.png` · **전신으로**

```
Match the attached reference image exactly: the same character, the same species and design,
the same colors, the same costume and props, the same art style. That image is this character's
official art. Only the facial expression and the pose change.

Style: soft 3D render with a smooth glossy vinyl-toy look, rounded chibi proportions with a big head,
big glossy expressive eyes with two catchlights, warm soft global illumination with the key light from
the upper left, subtle rim light, no hard outlines, clean readable silhouette at small sizes,
front three-quarter view, transparent background, high resolution.

The character: a tiny kind Korean mountain spirit grandfather, a flowing white beard covering half his face, a jade-green traditional robe, bushy white eyebrows, warm crinkled eyes, a small gnarled wooden staff.
The long white beard and the bushy eyebrows carry the emotion. Keep the beard covering half of his face — that is his silhouette.

Expression: both arms raised high cheering, a huge joyful open smile, sparkling star-shaped eyes.

Framing: a single full-body illustration. The whole body must be visible including the feet or base and every prop, nothing cropped off, centered with a small even margin on all sides. Keep the face clearly readable.

Do NOT change the species, horn count, hair, costume, accessories or palette.
Do NOT use: pixel art, hard black outline, cel shading, flat vector, sticker cutout edge, text,
watermark, busy background, more than one character, photorealistic human, wizard, gandalf, chinese immortal, robe with stars, pointed hat.
```

## `yong_cheer.png` — 청룡

첨부: `public/img/yong_full.png` · **전신으로**

```
Match the attached reference image exactly: the same character, the same species and design,
the same colors, the same costume and props, the same art style. That image is this character's
official art. Only the facial expression and the pose change.

Style: soft 3D render with a smooth glossy vinyl-toy look, rounded chibi proportions with a big head,
big glossy expressive eyes with two catchlights, warm soft global illumination with the key light from
the upper left, subtle rim light, no hard outlines, clean readable silhouette at small sizes,
front three-quarter view, transparent background, high resolution.

The character: a small friendly east-asian blue dragon, deep azure scales with a silver belly, deer-like antlers, long flowing whiskers caught in the wind, round bright eyes, a serpentine body coiled compactly.
The long whiskers and the coiled serpentine body carry the emotion — whiskers streaming upward when excited, drooping when dejected.

Expression: both arms raised high cheering, a huge joyful open smile, sparkling star-shaped eyes.

Framing: a single full-body illustration. The whole body must be visible including the feet or base and every prop, nothing cropped off, centered with a small even margin on all sides. Keep the face clearly readable.

Do NOT change the species, horn count, hair, costume, accessories or palette.
Do NOT use: pixel art, hard black outline, cel shading, flat vector, sticker cutout edge, text,
watermark, busy background, more than one character, photorealistic human, western dragon, bat wings, fire breathing, four-legged lizard.
```

## `jeoseung_cheer.png` — 저승사자

첨부: `public/img/jeoseung_full.png` · **전신으로**

```
Match the attached reference image exactly: the same character, the same species and design,
the same colors, the same costume and props, the same art style. That image is this character's
official art. Only the facial expression and the pose change.

Style: soft 3D render with a smooth glossy vinyl-toy look, rounded chibi proportions with a big head,
big glossy expressive eyes with two catchlights, warm soft global illumination with the key light from
the upper left, subtle rim light, no hard outlines, clean readable silhouette at small sizes,
front three-quarter view, transparent background, high resolution.

The character: a stylish Korean grim reaper as a cute mascot, a wide black gat hat tilted to one side, an ink-black traditional dopo robe, a pale calm face, half-lidded cool eyes, a faint smirk, not scary at all.
Keep him COOL and understated — he never goes loud or goofy. Show the emotion in small shifts: the gat hat tilting further, one eyebrow raised, the smirk widening or flattening.

Expression: one hand raised in a small cool victory gesture rather than both arms flailing, the smirk widened into a rare open smile, a single sparkle in one eye, the gat hat tilted back.

Framing: a single full-body illustration. The whole body must be visible including the feet or base and every prop, nothing cropped off, centered with a small even margin on all sides. Keep the face clearly readable.

Do NOT change the species, horn count, hair, costume, accessories or palette.
Do NOT use: pixel art, hard black outline, cel shading, flat vector, sticker cutout edge, text,
watermark, busy background, more than one character, photorealistic human, western grim reaper, skull face, scythe, hooded cloak, horror, dark background.
The background must be fully transparent (or a plain mid-grey if transparency is not possible) — never black, so the black hat and robe stay separable.
```

---

# 2파 — `star` (별눈) · 13장

윷·모를 던질 때. 한 판에 가장 자주 뜬다

## `tiger_star.png` — 호랑이

첨부: `public/img/tiger.png` · **상반신으로**

```
Match the attached reference image exactly: the same character, the same species and design,
the same colors, the same costume and props, the same art style. That image is this character's
official art. Only the facial expression and the pose change.

Style: soft 3D render with a smooth glossy vinyl-toy look, rounded chibi proportions with a big head,
big glossy expressive eyes with two catchlights, warm soft global illumination with the key light from
the upper left, subtle rim light, no hard outlines, clean readable silhouette at small sizes,
front three-quarter view, transparent background, high resolution.

The character: a playful young Korean tiger cub, warm orange fur with soft black stripes, cream muzzle and belly, round cheeks, one ear flicked back, tiny fangs.

Expression: sparkling star-shaped eyes, a triumphant proud grin, chin lifted.

Framing: bust framing, head and upper body, centered, the same crop as the reference image. Keep the face inside the central circle (about 88% of the width) — this art gets cropped into a circle.

Do NOT change the species, horn count, hair, costume, accessories or palette.
Do NOT use: pixel art, hard black outline, cel shading, flat vector, sticker cutout edge, text,
watermark, busy background, more than one character, photorealistic human.
```

## `rabbit_star.png` — 토끼

첨부: `public/img/rabbit.png` · **상반신으로**

```
Match the attached reference image exactly: the same character, the same species and design,
the same colors, the same costume and props, the same art style. That image is this character's
official art. Only the facial expression and the pose change.

Style: soft 3D render with a smooth glossy vinyl-toy look, rounded chibi proportions with a big head,
big glossy expressive eyes with two catchlights, warm soft global illumination with the key light from
the upper left, subtle rim light, no hard outlines, clean readable silhouette at small sizes,
front three-quarter view, transparent background, high resolution.

The character: a soft white-and-grey rabbit, one long ear upright and the other folded, pink inner ears, a twitching nose.
The long upright ear carries the emotion — perked up and quivering when excited, drooping when dejected.

Expression: sparkling star-shaped eyes, a triumphant proud grin, chin lifted.

Framing: bust framing, head and upper body, centered, the same crop as the reference image. Keep the face inside the central circle (about 88% of the width) — this art gets cropped into a circle.

Do NOT change the species, horn count, hair, costume, accessories or palette.
Do NOT use: pixel art, hard black outline, cel shading, flat vector, sticker cutout edge, text,
watermark, busy background, more than one character, photorealistic human.
```

## `bear_star.png` — 곰

첨부: `public/img/bear.png` · **상반신으로**

```
Match the attached reference image exactly: the same character, the same species and design,
the same colors, the same costume and props, the same art style. That image is this character's
official art. Only the facial expression and the pose change.

Style: soft 3D render with a smooth glossy vinyl-toy look, rounded chibi proportions with a big head,
big glossy expressive eyes with two catchlights, warm soft global illumination with the key light from
the upper left, subtle rim light, no hard outlines, clean readable silhouette at small sizes,
front three-quarter view, transparent background, high resolution.

The character: a chubby honey-brown bear cub, small round ears, a broad soft muzzle, gentle sleepy-warm eyes.

Expression: sparkling star-shaped eyes, a triumphant proud grin, chin lifted.

Framing: bust framing, head and upper body, centered, the same crop as the reference image. Keep the face inside the central circle (about 88% of the width) — this art gets cropped into a circle.

Do NOT change the species, horn count, hair, costume, accessories or palette.
Do NOT use: pixel art, hard black outline, cel shading, flat vector, sticker cutout edge, text,
watermark, busy background, more than one character, photorealistic human.
```

## `fox_star.png` — 여우

첨부: `public/img/fox.png` · **상반신으로**

```
Match the attached reference image exactly: the same character, the same species and design,
the same colors, the same costume and props, the same art style. That image is this character's
official art. Only the facial expression and the pose change.

Style: soft 3D render with a smooth glossy vinyl-toy look, rounded chibi proportions with a big head,
big glossy expressive eyes with two catchlights, warm soft global illumination with the key light from
the upper left, subtle rim light, no hard outlines, clean readable silhouette at small sizes,
front three-quarter view, transparent background, high resolution.

The character: a sleek red-orange fox, white cheek fur and chest, tall pointed ears, narrow clever eyes, a bushy tail curling up behind.
The bushy tail carries the emotion — puffed up when startled, curled low and tight when dejected.

Expression: sparkling star-shaped eyes, a triumphant proud grin, chin lifted.

Framing: bust framing, head and upper body, centered, the same crop as the reference image. Keep the face inside the central circle (about 88% of the width) — this art gets cropped into a circle.

Do NOT change the species, horn count, hair, costume, accessories or palette.
Do NOT use: pixel art, hard black outline, cel shading, flat vector, sticker cutout edge, text,
watermark, busy background, more than one character, photorealistic human.
```

## `dokkaebi_star.png` — 도깨비

첨부: `public/img/dokkaebi.png` · **상반신으로**

```
Match the attached reference image exactly: the same character, the same species and design,
the same colors, the same costume and props, the same art style. That image is this character's
official art. Only the facial expression and the pose change.

Style: soft 3D render with a smooth glossy vinyl-toy look, rounded chibi proportions with a big head,
big glossy expressive eyes with two catchlights, warm soft global illumination with the key light from
the upper left, subtle rim light, no hard outlines, clean readable silhouette at small sizes,
front three-quarter view, transparent background, high resolution.

The character: a friendly Korean dokkaebi goblin, a single small horn on the forehead, warm teal-green skin, wild dark hair, round mischievous eyes, a tiny wooden club (bangmangi) resting on one shoulder.

Expression: sparkling star-shaped eyes, a triumphant proud grin, chin lifted.

Framing: bust framing, head and upper body, centered, the same crop as the reference image. Keep the face inside the central circle (about 88% of the width) — this art gets cropped into a circle.

Do NOT change the species, horn count, hair, costume, accessories or palette.
Do NOT use: pixel art, hard black outline, cel shading, flat vector, sticker cutout edge, text,
watermark, busy background, more than one character, photorealistic human, japanese oni, red demon skin, tiger-skin loincloth, two horns, scary, horror.
```

## `yutgarak_star.png` — 윷가락

첨부: `public/img/yutgarak_full.png` · **전신으로**

```
Match the attached reference image exactly: the same character, the same species and design,
the same colors, the same costume and props, the same art style. That image is this character's
official art. Only the facial expression and the pose change.

Style: soft 3D render with a smooth glossy vinyl-toy look, rounded chibi proportions with a big head,
big glossy expressive eyes with two catchlights, warm soft global illumination with the key light from
the upper left, subtle rim light, no hard outlines, clean readable silhouette at small sizes,
front three-quarter view, transparent background, high resolution.

The character: two rounded wooden yut sticks as one cheerful mascot, pale birch wood with visible warm grain, the flat side painted with a bold red X mark, a small friendly face carved into the upper stick.
The face is carved into the upper wooden stick. It has no arms — express the emotion with the carved eyes and mouth and with how the two sticks lean against each other.

Expression: sparkling star-shaped eyes, a triumphant proud grin, chin lifted.

Framing: a single full-body illustration. The whole body must be visible including the feet or base and every prop, nothing cropped off, centered with a small even margin on all sides. Keep the face clearly readable.

Do NOT change the species, horn count, hair, costume, accessories or palette.
Do NOT use: pixel art, hard black outline, cel shading, flat vector, sticker cutout edge, text,
watermark, busy background, more than one character, photorealistic human, plain object, product photo, no face, still life, human hands.
```

## `bokjumeoni_star.png` — 복주머니

첨부: `public/img/bokjumeoni_full.png` · **전신으로**

```
Match the attached reference image exactly: the same character, the same species and design,
the same colors, the same costume and props, the same art style. That image is this character's
official art. Only the facial expression and the pose change.

Style: soft 3D render with a smooth glossy vinyl-toy look, rounded chibi proportions with a big head,
big glossy expressive eyes with two catchlights, warm soft global illumination with the key light from
the upper left, subtle rim light, no hard outlines, clean readable silhouette at small sizes,
front three-quarter view, transparent background, high resolution.

The character: a plump crimson silk lucky pouch mascot, a gold embroidered longevity pattern, the drawstring gathered at the top like a topknot, two golden tassels swinging to one side, a round happy face on the pouch body.
The face is on the crimson pouch body. The two golden tassels act as its arms — they carry the emotion.

Expression: sparkling star-shaped eyes, a triumphant proud grin, chin lifted.

Framing: a single full-body illustration. The whole body must be visible including the feet or base and every prop, nothing cropped off, centered with a small even margin on all sides. Keep the face clearly readable.

Do NOT change the species, horn count, hair, costume, accessories or palette.
Do NOT use: pixel art, hard black outline, cel shading, flat vector, sticker cutout edge, text,
watermark, busy background, more than one character, photorealistic human, plain object, product photo, no face, still life, human hands.
```

## `chorong_star.png` — 청사초롱

첨부: `public/img/chorong_full.png` · **전신으로**

```
Match the attached reference image exactly: the same character, the same species and design,
the same colors, the same costume and props, the same art style. That image is this character's
official art. Only the facial expression and the pose change.

Style: soft 3D render with a smooth glossy vinyl-toy look, rounded chibi proportions with a big head,
big glossy expressive eyes with two catchlights, warm soft global illumination with the key light from
the upper left, subtle rim light, no hard outlines, clean readable silhouette at small sizes,
front three-quarter view, transparent background, high resolution.

The character: a traditional Korean wedding lantern mascot, a hexagonal frame with blue and red silk panels, a warm candle glow from inside lighting its own face, a small wooden carrying handle tilted, a tiny flame flickering.
Its face is lit from inside by the candle, and it has no arms. The inner flame carries the emotion — flaring bright and tall when excited, guttering low and dim when dejected, burning sharp red when angry.

Expression: sparkling star-shaped eyes, a triumphant proud grin, chin lifted.

Framing: a single full-body illustration. The whole body must be visible including the feet or base and every prop, nothing cropped off, centered with a small even margin on all sides. Keep the face clearly readable.

Do NOT change the species, horn count, hair, costume, accessories or palette.
Do NOT use: pixel art, hard black outline, cel shading, flat vector, sticker cutout edge, text,
watermark, busy background, more than one character, photorealistic human, plain object, product photo, no face, still life, human hands, paper lantern festival.
```

## `jangseung_star.png` — 장승

첨부: `public/img/jangseung_full.png` · **전신으로**

```
Match the attached reference image exactly: the same character, the same species and design,
the same colors, the same costume and props, the same art style. That image is this character's
official art. Only the facial expression and the pose change.

Style: soft 3D render with a smooth glossy vinyl-toy look, rounded chibi proportions with a big head,
big glossy expressive eyes with two catchlights, warm soft global illumination with the key light from
the upper left, subtle rim light, no hard outlines, clean readable silhouette at small sizes,
front three-quarter view, transparent background, high resolution.

The character: a friendly Korean village guardian totem post, weathered mossy grey-green wood, comically bulging round eyes, a wide red-painted grinning mouth with two blunt teeth, carved eyebrows, gentle rather than fearsome.
It is a carved wooden post with no arms and no legs. Express the emotion ONLY with the bulging round eyes, the carved eyebrows and the wide red-painted mouth, plus how the whole post tilts.

Expression: sparkling star-shaped eyes, a triumphant proud grin, chin lifted.

Framing: a single full-body illustration. The whole body must be visible including the feet or base and every prop, nothing cropped off, centered with a small even margin on all sides. Keep the face clearly readable.

Do NOT change the species, horn count, hair, costume, accessories or palette.
Do NOT use: pixel art, hard black outline, cel shading, flat vector, sticker cutout edge, text,
watermark, busy background, more than one character, photorealistic human, native american totem pole, tiki mask, scary, horror, human hands.
```

## `haetae_star.png` — 해태

첨부: `public/img/haetae_full.png` · **전신으로**

```
Match the attached reference image exactly: the same character, the same species and design,
the same colors, the same costume and props, the same art style. That image is this character's
official art. Only the facial expression and the pose change.

Style: soft 3D render with a smooth glossy vinyl-toy look, rounded chibi proportions with a big head,
big glossy expressive eyes with two catchlights, warm soft global illumination with the key light from
the upper left, subtle rim light, no hard outlines, clean readable silhouette at small sizes,
front three-quarter view, transparent background, high resolution.

The character: a young Korean haetae guardian beast, golden fur with a copper-red mane in tight curls, a single small horn on the forehead, a scaled collar, round proud eyes.
The copper-red curly mane carries the emotion — bristling out when angry, flattened down when dejected.

Expression: sparkling star-shaped eyes, a triumphant proud grin, chin lifted.

Framing: a single full-body illustration. The whole body must be visible including the feet or base and every prop, nothing cropped off, centered with a small even margin on all sides. Keep the face clearly readable.

Do NOT change the species, horn count, hair, costume, accessories or palette.
Do NOT use: pixel art, hard black outline, cel shading, flat vector, sticker cutout edge, text,
watermark, busy background, more than one character, photorealistic human, stone statue, temple lion statue, chinese guardian lion, jade sculpture.
```

## `sansin_star.png` — 산신령

첨부: `public/img/sansin_full.png` · **전신으로**

```
Match the attached reference image exactly: the same character, the same species and design,
the same colors, the same costume and props, the same art style. That image is this character's
official art. Only the facial expression and the pose change.

Style: soft 3D render with a smooth glossy vinyl-toy look, rounded chibi proportions with a big head,
big glossy expressive eyes with two catchlights, warm soft global illumination with the key light from
the upper left, subtle rim light, no hard outlines, clean readable silhouette at small sizes,
front three-quarter view, transparent background, high resolution.

The character: a tiny kind Korean mountain spirit grandfather, a flowing white beard covering half his face, a jade-green traditional robe, bushy white eyebrows, warm crinkled eyes, a small gnarled wooden staff.
The long white beard and the bushy eyebrows carry the emotion. Keep the beard covering half of his face — that is his silhouette.

Expression: sparkling star-shaped eyes, a triumphant proud grin, chin lifted.

Framing: a single full-body illustration. The whole body must be visible including the feet or base and every prop, nothing cropped off, centered with a small even margin on all sides. Keep the face clearly readable.

Do NOT change the species, horn count, hair, costume, accessories or palette.
Do NOT use: pixel art, hard black outline, cel shading, flat vector, sticker cutout edge, text,
watermark, busy background, more than one character, photorealistic human, wizard, gandalf, chinese immortal, robe with stars, pointed hat.
```

## `yong_star.png` — 청룡

첨부: `public/img/yong_full.png` · **전신으로**

```
Match the attached reference image exactly: the same character, the same species and design,
the same colors, the same costume and props, the same art style. That image is this character's
official art. Only the facial expression and the pose change.

Style: soft 3D render with a smooth glossy vinyl-toy look, rounded chibi proportions with a big head,
big glossy expressive eyes with two catchlights, warm soft global illumination with the key light from
the upper left, subtle rim light, no hard outlines, clean readable silhouette at small sizes,
front three-quarter view, transparent background, high resolution.

The character: a small friendly east-asian blue dragon, deep azure scales with a silver belly, deer-like antlers, long flowing whiskers caught in the wind, round bright eyes, a serpentine body coiled compactly.
The long whiskers and the coiled serpentine body carry the emotion — whiskers streaming upward when excited, drooping when dejected.

Expression: sparkling star-shaped eyes, a triumphant proud grin, chin lifted.

Framing: a single full-body illustration. The whole body must be visible including the feet or base and every prop, nothing cropped off, centered with a small even margin on all sides. Keep the face clearly readable.

Do NOT change the species, horn count, hair, costume, accessories or palette.
Do NOT use: pixel art, hard black outline, cel shading, flat vector, sticker cutout edge, text,
watermark, busy background, more than one character, photorealistic human, western dragon, bat wings, fire breathing, four-legged lizard.
```

## `jeoseung_star.png` — 저승사자

첨부: `public/img/jeoseung_full.png` · **전신으로**

```
Match the attached reference image exactly: the same character, the same species and design,
the same colors, the same costume and props, the same art style. That image is this character's
official art. Only the facial expression and the pose change.

Style: soft 3D render with a smooth glossy vinyl-toy look, rounded chibi proportions with a big head,
big glossy expressive eyes with two catchlights, warm soft global illumination with the key light from
the upper left, subtle rim light, no hard outlines, clean readable silhouette at small sizes,
front three-quarter view, transparent background, high resolution.

The character: a stylish Korean grim reaper as a cute mascot, a wide black gat hat tilted to one side, an ink-black traditional dopo robe, a pale calm face, half-lidded cool eyes, a faint smirk, not scary at all.
Keep him COOL and understated — he never goes loud or goofy. Show the emotion in small shifts: the gat hat tilting further, one eyebrow raised, the smirk widening or flattening.

Expression: sparkling star-shaped eyes, a triumphant proud grin, chin lifted.

Framing: a single full-body illustration. The whole body must be visible including the feet or base and every prop, nothing cropped off, centered with a small even margin on all sides. Keep the face clearly readable.

Do NOT change the species, horn count, hair, costume, accessories or palette.
Do NOT use: pixel art, hard black outline, cel shading, flat vector, sticker cutout edge, text,
watermark, busy background, more than one character, photorealistic human, western grim reaper, skull face, scythe, hooded cloak, horror, dark background.
The background must be fully transparent (or a plain mid-grey if transparency is not possible) — never black, so the black hat and robe stay separable.
```

---

# 3파 — `happy` (기쁨) · 13장

상대 말을 잡았을 때 — 윷에서 제일 신나는 순간

## `tiger_happy.png` — 호랑이

첨부: `public/img/tiger.png` · **상반신으로**

```
Match the attached reference image exactly: the same character, the same species and design,
the same colors, the same costume and props, the same art style. That image is this character's
official art. Only the facial expression and the pose change.

Style: soft 3D render with a smooth glossy vinyl-toy look, rounded chibi proportions with a big head,
big glossy expressive eyes with two catchlights, warm soft global illumination with the key light from
the upper left, subtle rim light, no hard outlines, clean readable silhouette at small sizes,
front three-quarter view, transparent background, high resolution.

The character: a playful young Korean tiger cub, warm orange fur with soft black stripes, cream muzzle and belly, round cheeks, one ear flicked back, tiny fangs.

Expression: a beaming happy smile with closed ^^ curved eyes, joyful and relaxed.

Framing: bust framing, head and upper body, centered, the same crop as the reference image. Keep the face inside the central circle (about 88% of the width) — this art gets cropped into a circle.

Do NOT change the species, horn count, hair, costume, accessories or palette.
Do NOT use: pixel art, hard black outline, cel shading, flat vector, sticker cutout edge, text,
watermark, busy background, more than one character, photorealistic human.
```

## `rabbit_happy.png` — 토끼

첨부: `public/img/rabbit.png` · **상반신으로**

```
Match the attached reference image exactly: the same character, the same species and design,
the same colors, the same costume and props, the same art style. That image is this character's
official art. Only the facial expression and the pose change.

Style: soft 3D render with a smooth glossy vinyl-toy look, rounded chibi proportions with a big head,
big glossy expressive eyes with two catchlights, warm soft global illumination with the key light from
the upper left, subtle rim light, no hard outlines, clean readable silhouette at small sizes,
front three-quarter view, transparent background, high resolution.

The character: a soft white-and-grey rabbit, one long ear upright and the other folded, pink inner ears, a twitching nose.
The long upright ear carries the emotion — perked up and quivering when excited, drooping when dejected.

Expression: a beaming happy smile with closed ^^ curved eyes, joyful and relaxed.

Framing: bust framing, head and upper body, centered, the same crop as the reference image. Keep the face inside the central circle (about 88% of the width) — this art gets cropped into a circle.

Do NOT change the species, horn count, hair, costume, accessories or palette.
Do NOT use: pixel art, hard black outline, cel shading, flat vector, sticker cutout edge, text,
watermark, busy background, more than one character, photorealistic human.
```

## `bear_happy.png` — 곰

첨부: `public/img/bear.png` · **상반신으로**

```
Match the attached reference image exactly: the same character, the same species and design,
the same colors, the same costume and props, the same art style. That image is this character's
official art. Only the facial expression and the pose change.

Style: soft 3D render with a smooth glossy vinyl-toy look, rounded chibi proportions with a big head,
big glossy expressive eyes with two catchlights, warm soft global illumination with the key light from
the upper left, subtle rim light, no hard outlines, clean readable silhouette at small sizes,
front three-quarter view, transparent background, high resolution.

The character: a chubby honey-brown bear cub, small round ears, a broad soft muzzle, gentle sleepy-warm eyes.

Expression: a beaming happy smile with closed ^^ curved eyes, joyful and relaxed.

Framing: bust framing, head and upper body, centered, the same crop as the reference image. Keep the face inside the central circle (about 88% of the width) — this art gets cropped into a circle.

Do NOT change the species, horn count, hair, costume, accessories or palette.
Do NOT use: pixel art, hard black outline, cel shading, flat vector, sticker cutout edge, text,
watermark, busy background, more than one character, photorealistic human.
```

## `fox_happy.png` — 여우

첨부: `public/img/fox.png` · **상반신으로**

```
Match the attached reference image exactly: the same character, the same species and design,
the same colors, the same costume and props, the same art style. That image is this character's
official art. Only the facial expression and the pose change.

Style: soft 3D render with a smooth glossy vinyl-toy look, rounded chibi proportions with a big head,
big glossy expressive eyes with two catchlights, warm soft global illumination with the key light from
the upper left, subtle rim light, no hard outlines, clean readable silhouette at small sizes,
front three-quarter view, transparent background, high resolution.

The character: a sleek red-orange fox, white cheek fur and chest, tall pointed ears, narrow clever eyes, a bushy tail curling up behind.
The bushy tail carries the emotion — puffed up when startled, curled low and tight when dejected.

Expression: a beaming happy smile with closed ^^ curved eyes, joyful and relaxed.

Framing: bust framing, head and upper body, centered, the same crop as the reference image. Keep the face inside the central circle (about 88% of the width) — this art gets cropped into a circle.

Do NOT change the species, horn count, hair, costume, accessories or palette.
Do NOT use: pixel art, hard black outline, cel shading, flat vector, sticker cutout edge, text,
watermark, busy background, more than one character, photorealistic human.
```

## `dokkaebi_happy.png` — 도깨비

첨부: `public/img/dokkaebi.png` · **상반신으로**

```
Match the attached reference image exactly: the same character, the same species and design,
the same colors, the same costume and props, the same art style. That image is this character's
official art. Only the facial expression and the pose change.

Style: soft 3D render with a smooth glossy vinyl-toy look, rounded chibi proportions with a big head,
big glossy expressive eyes with two catchlights, warm soft global illumination with the key light from
the upper left, subtle rim light, no hard outlines, clean readable silhouette at small sizes,
front three-quarter view, transparent background, high resolution.

The character: a friendly Korean dokkaebi goblin, a single small horn on the forehead, warm teal-green skin, wild dark hair, round mischievous eyes, a tiny wooden club (bangmangi) resting on one shoulder.

Expression: a beaming happy smile with closed ^^ curved eyes, joyful and relaxed.

Framing: bust framing, head and upper body, centered, the same crop as the reference image. Keep the face inside the central circle (about 88% of the width) — this art gets cropped into a circle.

Do NOT change the species, horn count, hair, costume, accessories or palette.
Do NOT use: pixel art, hard black outline, cel shading, flat vector, sticker cutout edge, text,
watermark, busy background, more than one character, photorealistic human, japanese oni, red demon skin, tiger-skin loincloth, two horns, scary, horror.
```

## `yutgarak_happy.png` — 윷가락

첨부: `public/img/yutgarak_full.png` · **전신으로**

```
Match the attached reference image exactly: the same character, the same species and design,
the same colors, the same costume and props, the same art style. That image is this character's
official art. Only the facial expression and the pose change.

Style: soft 3D render with a smooth glossy vinyl-toy look, rounded chibi proportions with a big head,
big glossy expressive eyes with two catchlights, warm soft global illumination with the key light from
the upper left, subtle rim light, no hard outlines, clean readable silhouette at small sizes,
front three-quarter view, transparent background, high resolution.

The character: two rounded wooden yut sticks as one cheerful mascot, pale birch wood with visible warm grain, the flat side painted with a bold red X mark, a small friendly face carved into the upper stick.
The face is carved into the upper wooden stick. It has no arms — express the emotion with the carved eyes and mouth and with how the two sticks lean against each other.

Expression: a beaming happy smile with closed ^^ curved eyes, joyful and relaxed.

Framing: a single full-body illustration. The whole body must be visible including the feet or base and every prop, nothing cropped off, centered with a small even margin on all sides. Keep the face clearly readable.

Do NOT change the species, horn count, hair, costume, accessories or palette.
Do NOT use: pixel art, hard black outline, cel shading, flat vector, sticker cutout edge, text,
watermark, busy background, more than one character, photorealistic human, plain object, product photo, no face, still life, human hands.
```

## `bokjumeoni_happy.png` — 복주머니

첨부: `public/img/bokjumeoni_full.png` · **전신으로**

```
Match the attached reference image exactly: the same character, the same species and design,
the same colors, the same costume and props, the same art style. That image is this character's
official art. Only the facial expression and the pose change.

Style: soft 3D render with a smooth glossy vinyl-toy look, rounded chibi proportions with a big head,
big glossy expressive eyes with two catchlights, warm soft global illumination with the key light from
the upper left, subtle rim light, no hard outlines, clean readable silhouette at small sizes,
front three-quarter view, transparent background, high resolution.

The character: a plump crimson silk lucky pouch mascot, a gold embroidered longevity pattern, the drawstring gathered at the top like a topknot, two golden tassels swinging to one side, a round happy face on the pouch body.
The face is on the crimson pouch body. The two golden tassels act as its arms — they carry the emotion.

Expression: a beaming happy smile with closed ^^ curved eyes, joyful and relaxed.

Framing: a single full-body illustration. The whole body must be visible including the feet or base and every prop, nothing cropped off, centered with a small even margin on all sides. Keep the face clearly readable.

Do NOT change the species, horn count, hair, costume, accessories or palette.
Do NOT use: pixel art, hard black outline, cel shading, flat vector, sticker cutout edge, text,
watermark, busy background, more than one character, photorealistic human, plain object, product photo, no face, still life, human hands.
```

## `chorong_happy.png` — 청사초롱

첨부: `public/img/chorong_full.png` · **전신으로**

```
Match the attached reference image exactly: the same character, the same species and design,
the same colors, the same costume and props, the same art style. That image is this character's
official art. Only the facial expression and the pose change.

Style: soft 3D render with a smooth glossy vinyl-toy look, rounded chibi proportions with a big head,
big glossy expressive eyes with two catchlights, warm soft global illumination with the key light from
the upper left, subtle rim light, no hard outlines, clean readable silhouette at small sizes,
front three-quarter view, transparent background, high resolution.

The character: a traditional Korean wedding lantern mascot, a hexagonal frame with blue and red silk panels, a warm candle glow from inside lighting its own face, a small wooden carrying handle tilted, a tiny flame flickering.
Its face is lit from inside by the candle, and it has no arms. The inner flame carries the emotion — flaring bright and tall when excited, guttering low and dim when dejected, burning sharp red when angry.

Expression: a beaming happy smile with closed ^^ curved eyes, joyful and relaxed.

Framing: a single full-body illustration. The whole body must be visible including the feet or base and every prop, nothing cropped off, centered with a small even margin on all sides. Keep the face clearly readable.

Do NOT change the species, horn count, hair, costume, accessories or palette.
Do NOT use: pixel art, hard black outline, cel shading, flat vector, sticker cutout edge, text,
watermark, busy background, more than one character, photorealistic human, plain object, product photo, no face, still life, human hands, paper lantern festival.
```

## `jangseung_happy.png` — 장승

첨부: `public/img/jangseung_full.png` · **전신으로**

```
Match the attached reference image exactly: the same character, the same species and design,
the same colors, the same costume and props, the same art style. That image is this character's
official art. Only the facial expression and the pose change.

Style: soft 3D render with a smooth glossy vinyl-toy look, rounded chibi proportions with a big head,
big glossy expressive eyes with two catchlights, warm soft global illumination with the key light from
the upper left, subtle rim light, no hard outlines, clean readable silhouette at small sizes,
front three-quarter view, transparent background, high resolution.

The character: a friendly Korean village guardian totem post, weathered mossy grey-green wood, comically bulging round eyes, a wide red-painted grinning mouth with two blunt teeth, carved eyebrows, gentle rather than fearsome.
It is a carved wooden post with no arms and no legs. Express the emotion ONLY with the bulging round eyes, the carved eyebrows and the wide red-painted mouth, plus how the whole post tilts.

Expression: a beaming happy smile with closed ^^ curved eyes, joyful and relaxed.

Framing: a single full-body illustration. The whole body must be visible including the feet or base and every prop, nothing cropped off, centered with a small even margin on all sides. Keep the face clearly readable.

Do NOT change the species, horn count, hair, costume, accessories or palette.
Do NOT use: pixel art, hard black outline, cel shading, flat vector, sticker cutout edge, text,
watermark, busy background, more than one character, photorealistic human, native american totem pole, tiki mask, scary, horror, human hands.
```

## `haetae_happy.png` — 해태

첨부: `public/img/haetae_full.png` · **전신으로**

```
Match the attached reference image exactly: the same character, the same species and design,
the same colors, the same costume and props, the same art style. That image is this character's
official art. Only the facial expression and the pose change.

Style: soft 3D render with a smooth glossy vinyl-toy look, rounded chibi proportions with a big head,
big glossy expressive eyes with two catchlights, warm soft global illumination with the key light from
the upper left, subtle rim light, no hard outlines, clean readable silhouette at small sizes,
front three-quarter view, transparent background, high resolution.

The character: a young Korean haetae guardian beast, golden fur with a copper-red mane in tight curls, a single small horn on the forehead, a scaled collar, round proud eyes.
The copper-red curly mane carries the emotion — bristling out when angry, flattened down when dejected.

Expression: a beaming happy smile with closed ^^ curved eyes, joyful and relaxed.

Framing: a single full-body illustration. The whole body must be visible including the feet or base and every prop, nothing cropped off, centered with a small even margin on all sides. Keep the face clearly readable.

Do NOT change the species, horn count, hair, costume, accessories or palette.
Do NOT use: pixel art, hard black outline, cel shading, flat vector, sticker cutout edge, text,
watermark, busy background, more than one character, photorealistic human, stone statue, temple lion statue, chinese guardian lion, jade sculpture.
```

## `sansin_happy.png` — 산신령

첨부: `public/img/sansin_full.png` · **전신으로**

```
Match the attached reference image exactly: the same character, the same species and design,
the same colors, the same costume and props, the same art style. That image is this character's
official art. Only the facial expression and the pose change.

Style: soft 3D render with a smooth glossy vinyl-toy look, rounded chibi proportions with a big head,
big glossy expressive eyes with two catchlights, warm soft global illumination with the key light from
the upper left, subtle rim light, no hard outlines, clean readable silhouette at small sizes,
front three-quarter view, transparent background, high resolution.

The character: a tiny kind Korean mountain spirit grandfather, a flowing white beard covering half his face, a jade-green traditional robe, bushy white eyebrows, warm crinkled eyes, a small gnarled wooden staff.
The long white beard and the bushy eyebrows carry the emotion. Keep the beard covering half of his face — that is his silhouette.

Expression: a beaming happy smile with closed ^^ curved eyes, joyful and relaxed.

Framing: a single full-body illustration. The whole body must be visible including the feet or base and every prop, nothing cropped off, centered with a small even margin on all sides. Keep the face clearly readable.

Do NOT change the species, horn count, hair, costume, accessories or palette.
Do NOT use: pixel art, hard black outline, cel shading, flat vector, sticker cutout edge, text,
watermark, busy background, more than one character, photorealistic human, wizard, gandalf, chinese immortal, robe with stars, pointed hat.
```

## `yong_happy.png` — 청룡

첨부: `public/img/yong_full.png` · **전신으로**

```
Match the attached reference image exactly: the same character, the same species and design,
the same colors, the same costume and props, the same art style. That image is this character's
official art. Only the facial expression and the pose change.

Style: soft 3D render with a smooth glossy vinyl-toy look, rounded chibi proportions with a big head,
big glossy expressive eyes with two catchlights, warm soft global illumination with the key light from
the upper left, subtle rim light, no hard outlines, clean readable silhouette at small sizes,
front three-quarter view, transparent background, high resolution.

The character: a small friendly east-asian blue dragon, deep azure scales with a silver belly, deer-like antlers, long flowing whiskers caught in the wind, round bright eyes, a serpentine body coiled compactly.
The long whiskers and the coiled serpentine body carry the emotion — whiskers streaming upward when excited, drooping when dejected.

Expression: a beaming happy smile with closed ^^ curved eyes, joyful and relaxed.

Framing: a single full-body illustration. The whole body must be visible including the feet or base and every prop, nothing cropped off, centered with a small even margin on all sides. Keep the face clearly readable.

Do NOT change the species, horn count, hair, costume, accessories or palette.
Do NOT use: pixel art, hard black outline, cel shading, flat vector, sticker cutout edge, text,
watermark, busy background, more than one character, photorealistic human, western dragon, bat wings, fire breathing, four-legged lizard.
```

## `jeoseung_happy.png` — 저승사자

첨부: `public/img/jeoseung_full.png` · **전신으로**

```
Match the attached reference image exactly: the same character, the same species and design,
the same colors, the same costume and props, the same art style. That image is this character's
official art. Only the facial expression and the pose change.

Style: soft 3D render with a smooth glossy vinyl-toy look, rounded chibi proportions with a big head,
big glossy expressive eyes with two catchlights, warm soft global illumination with the key light from
the upper left, subtle rim light, no hard outlines, clean readable silhouette at small sizes,
front three-quarter view, transparent background, high resolution.

The character: a stylish Korean grim reaper as a cute mascot, a wide black gat hat tilted to one side, an ink-black traditional dopo robe, a pale calm face, half-lidded cool eyes, a faint smirk, not scary at all.
Keep him COOL and understated — he never goes loud or goofy. Show the emotion in small shifts: the gat hat tilting further, one eyebrow raised, the smirk widening or flattening.

Expression: a beaming happy smile with closed ^^ curved eyes, joyful and relaxed.

Framing: a single full-body illustration. The whole body must be visible including the feet or base and every prop, nothing cropped off, centered with a small even margin on all sides. Keep the face clearly readable.

Do NOT change the species, horn count, hair, costume, accessories or palette.
Do NOT use: pixel art, hard black outline, cel shading, flat vector, sticker cutout edge, text,
watermark, busy background, more than one character, photorealistic human, western grim reaper, skull face, scythe, hooded cloak, horror, dark background.
The background must be fully transparent (or a plain mid-grey if transparency is not possible) — never black, so the black hat and robe stay separable.
```

---

# 4파 — `surprise` (놀람) · 13장

빽도

## `tiger_surprise.png` — 호랑이

첨부: `public/img/tiger.png` · **상반신으로**

```
Match the attached reference image exactly: the same character, the same species and design,
the same colors, the same costume and props, the same art style. That image is this character's
official art. Only the facial expression and the pose change.

Style: soft 3D render with a smooth glossy vinyl-toy look, rounded chibi proportions with a big head,
big glossy expressive eyes with two catchlights, warm soft global illumination with the key light from
the upper left, subtle rim light, no hard outlines, clean readable silhouette at small sizes,
front three-quarter view, transparent background, high resolution.

The character: a playful young Korean tiger cub, warm orange fur with soft black stripes, cream muzzle and belly, round cheeks, one ear flicked back, tiny fangs.

Expression: a wide open O mouth, big round shocked eyes, eyebrows shot up, startled and leaning back.

Framing: bust framing, head and upper body, centered, the same crop as the reference image. Keep the face inside the central circle (about 88% of the width) — this art gets cropped into a circle.

Do NOT change the species, horn count, hair, costume, accessories or palette.
Do NOT use: pixel art, hard black outline, cel shading, flat vector, sticker cutout edge, text,
watermark, busy background, more than one character, photorealistic human.
```

## `rabbit_surprise.png` — 토끼

첨부: `public/img/rabbit.png` · **상반신으로**

```
Match the attached reference image exactly: the same character, the same species and design,
the same colors, the same costume and props, the same art style. That image is this character's
official art. Only the facial expression and the pose change.

Style: soft 3D render with a smooth glossy vinyl-toy look, rounded chibi proportions with a big head,
big glossy expressive eyes with two catchlights, warm soft global illumination with the key light from
the upper left, subtle rim light, no hard outlines, clean readable silhouette at small sizes,
front three-quarter view, transparent background, high resolution.

The character: a soft white-and-grey rabbit, one long ear upright and the other folded, pink inner ears, a twitching nose.
The long upright ear carries the emotion — perked up and quivering when excited, drooping when dejected.

Expression: a wide open O mouth, big round shocked eyes, eyebrows shot up, startled and leaning back.

Framing: bust framing, head and upper body, centered, the same crop as the reference image. Keep the face inside the central circle (about 88% of the width) — this art gets cropped into a circle.

Do NOT change the species, horn count, hair, costume, accessories or palette.
Do NOT use: pixel art, hard black outline, cel shading, flat vector, sticker cutout edge, text,
watermark, busy background, more than one character, photorealistic human.
```

## `bear_surprise.png` — 곰

첨부: `public/img/bear.png` · **상반신으로**

```
Match the attached reference image exactly: the same character, the same species and design,
the same colors, the same costume and props, the same art style. That image is this character's
official art. Only the facial expression and the pose change.

Style: soft 3D render with a smooth glossy vinyl-toy look, rounded chibi proportions with a big head,
big glossy expressive eyes with two catchlights, warm soft global illumination with the key light from
the upper left, subtle rim light, no hard outlines, clean readable silhouette at small sizes,
front three-quarter view, transparent background, high resolution.

The character: a chubby honey-brown bear cub, small round ears, a broad soft muzzle, gentle sleepy-warm eyes.

Expression: a wide open O mouth, big round shocked eyes, eyebrows shot up, startled and leaning back.

Framing: bust framing, head and upper body, centered, the same crop as the reference image. Keep the face inside the central circle (about 88% of the width) — this art gets cropped into a circle.

Do NOT change the species, horn count, hair, costume, accessories or palette.
Do NOT use: pixel art, hard black outline, cel shading, flat vector, sticker cutout edge, text,
watermark, busy background, more than one character, photorealistic human.
```

## `fox_surprise.png` — 여우

첨부: `public/img/fox.png` · **상반신으로**

```
Match the attached reference image exactly: the same character, the same species and design,
the same colors, the same costume and props, the same art style. That image is this character's
official art. Only the facial expression and the pose change.

Style: soft 3D render with a smooth glossy vinyl-toy look, rounded chibi proportions with a big head,
big glossy expressive eyes with two catchlights, warm soft global illumination with the key light from
the upper left, subtle rim light, no hard outlines, clean readable silhouette at small sizes,
front three-quarter view, transparent background, high resolution.

The character: a sleek red-orange fox, white cheek fur and chest, tall pointed ears, narrow clever eyes, a bushy tail curling up behind.
The bushy tail carries the emotion — puffed up when startled, curled low and tight when dejected.

Expression: a wide open O mouth, big round shocked eyes, eyebrows shot up, startled and leaning back.

Framing: bust framing, head and upper body, centered, the same crop as the reference image. Keep the face inside the central circle (about 88% of the width) — this art gets cropped into a circle.

Do NOT change the species, horn count, hair, costume, accessories or palette.
Do NOT use: pixel art, hard black outline, cel shading, flat vector, sticker cutout edge, text,
watermark, busy background, more than one character, photorealistic human.
```

## `dokkaebi_surprise.png` — 도깨비

첨부: `public/img/dokkaebi.png` · **상반신으로**

```
Match the attached reference image exactly: the same character, the same species and design,
the same colors, the same costume and props, the same art style. That image is this character's
official art. Only the facial expression and the pose change.

Style: soft 3D render with a smooth glossy vinyl-toy look, rounded chibi proportions with a big head,
big glossy expressive eyes with two catchlights, warm soft global illumination with the key light from
the upper left, subtle rim light, no hard outlines, clean readable silhouette at small sizes,
front three-quarter view, transparent background, high resolution.

The character: a friendly Korean dokkaebi goblin, a single small horn on the forehead, warm teal-green skin, wild dark hair, round mischievous eyes, a tiny wooden club (bangmangi) resting on one shoulder.

Expression: a wide open O mouth, big round shocked eyes, eyebrows shot up, startled and leaning back.

Framing: bust framing, head and upper body, centered, the same crop as the reference image. Keep the face inside the central circle (about 88% of the width) — this art gets cropped into a circle.

Do NOT change the species, horn count, hair, costume, accessories or palette.
Do NOT use: pixel art, hard black outline, cel shading, flat vector, sticker cutout edge, text,
watermark, busy background, more than one character, photorealistic human, japanese oni, red demon skin, tiger-skin loincloth, two horns, scary, horror.
```

## `yutgarak_surprise.png` — 윷가락

첨부: `public/img/yutgarak_full.png` · **전신으로**

```
Match the attached reference image exactly: the same character, the same species and design,
the same colors, the same costume and props, the same art style. That image is this character's
official art. Only the facial expression and the pose change.

Style: soft 3D render with a smooth glossy vinyl-toy look, rounded chibi proportions with a big head,
big glossy expressive eyes with two catchlights, warm soft global illumination with the key light from
the upper left, subtle rim light, no hard outlines, clean readable silhouette at small sizes,
front three-quarter view, transparent background, high resolution.

The character: two rounded wooden yut sticks as one cheerful mascot, pale birch wood with visible warm grain, the flat side painted with a bold red X mark, a small friendly face carved into the upper stick.
The face is carved into the upper wooden stick. It has no arms — express the emotion with the carved eyes and mouth and with how the two sticks lean against each other.

Expression: a wide open O mouth, big round shocked eyes, eyebrows shot up, startled and leaning back.

Framing: a single full-body illustration. The whole body must be visible including the feet or base and every prop, nothing cropped off, centered with a small even margin on all sides. Keep the face clearly readable.

Do NOT change the species, horn count, hair, costume, accessories or palette.
Do NOT use: pixel art, hard black outline, cel shading, flat vector, sticker cutout edge, text,
watermark, busy background, more than one character, photorealistic human, plain object, product photo, no face, still life, human hands.
```

## `bokjumeoni_surprise.png` — 복주머니

첨부: `public/img/bokjumeoni_full.png` · **전신으로**

```
Match the attached reference image exactly: the same character, the same species and design,
the same colors, the same costume and props, the same art style. That image is this character's
official art. Only the facial expression and the pose change.

Style: soft 3D render with a smooth glossy vinyl-toy look, rounded chibi proportions with a big head,
big glossy expressive eyes with two catchlights, warm soft global illumination with the key light from
the upper left, subtle rim light, no hard outlines, clean readable silhouette at small sizes,
front three-quarter view, transparent background, high resolution.

The character: a plump crimson silk lucky pouch mascot, a gold embroidered longevity pattern, the drawstring gathered at the top like a topknot, two golden tassels swinging to one side, a round happy face on the pouch body.
The face is on the crimson pouch body. The two golden tassels act as its arms — they carry the emotion.

Expression: a wide open O mouth, big round shocked eyes, eyebrows shot up, startled and leaning back.

Framing: a single full-body illustration. The whole body must be visible including the feet or base and every prop, nothing cropped off, centered with a small even margin on all sides. Keep the face clearly readable.

Do NOT change the species, horn count, hair, costume, accessories or palette.
Do NOT use: pixel art, hard black outline, cel shading, flat vector, sticker cutout edge, text,
watermark, busy background, more than one character, photorealistic human, plain object, product photo, no face, still life, human hands.
```

## `chorong_surprise.png` — 청사초롱

첨부: `public/img/chorong_full.png` · **전신으로**

```
Match the attached reference image exactly: the same character, the same species and design,
the same colors, the same costume and props, the same art style. That image is this character's
official art. Only the facial expression and the pose change.

Style: soft 3D render with a smooth glossy vinyl-toy look, rounded chibi proportions with a big head,
big glossy expressive eyes with two catchlights, warm soft global illumination with the key light from
the upper left, subtle rim light, no hard outlines, clean readable silhouette at small sizes,
front three-quarter view, transparent background, high resolution.

The character: a traditional Korean wedding lantern mascot, a hexagonal frame with blue and red silk panels, a warm candle glow from inside lighting its own face, a small wooden carrying handle tilted, a tiny flame flickering.
Its face is lit from inside by the candle, and it has no arms. The inner flame carries the emotion — flaring bright and tall when excited, guttering low and dim when dejected, burning sharp red when angry.

Expression: a wide open O mouth, big round shocked eyes, eyebrows shot up, startled and leaning back.

Framing: a single full-body illustration. The whole body must be visible including the feet or base and every prop, nothing cropped off, centered with a small even margin on all sides. Keep the face clearly readable.

Do NOT change the species, horn count, hair, costume, accessories or palette.
Do NOT use: pixel art, hard black outline, cel shading, flat vector, sticker cutout edge, text,
watermark, busy background, more than one character, photorealistic human, plain object, product photo, no face, still life, human hands, paper lantern festival.
```

## `jangseung_surprise.png` — 장승

첨부: `public/img/jangseung_full.png` · **전신으로**

```
Match the attached reference image exactly: the same character, the same species and design,
the same colors, the same costume and props, the same art style. That image is this character's
official art. Only the facial expression and the pose change.

Style: soft 3D render with a smooth glossy vinyl-toy look, rounded chibi proportions with a big head,
big glossy expressive eyes with two catchlights, warm soft global illumination with the key light from
the upper left, subtle rim light, no hard outlines, clean readable silhouette at small sizes,
front three-quarter view, transparent background, high resolution.

The character: a friendly Korean village guardian totem post, weathered mossy grey-green wood, comically bulging round eyes, a wide red-painted grinning mouth with two blunt teeth, carved eyebrows, gentle rather than fearsome.
It is a carved wooden post with no arms and no legs. Express the emotion ONLY with the bulging round eyes, the carved eyebrows and the wide red-painted mouth, plus how the whole post tilts.

Expression: a wide open O mouth, big round shocked eyes, eyebrows shot up, startled and leaning back.

Framing: a single full-body illustration. The whole body must be visible including the feet or base and every prop, nothing cropped off, centered with a small even margin on all sides. Keep the face clearly readable.

Do NOT change the species, horn count, hair, costume, accessories or palette.
Do NOT use: pixel art, hard black outline, cel shading, flat vector, sticker cutout edge, text,
watermark, busy background, more than one character, photorealistic human, native american totem pole, tiki mask, scary, horror, human hands.
```

## `haetae_surprise.png` — 해태

첨부: `public/img/haetae_full.png` · **전신으로**

```
Match the attached reference image exactly: the same character, the same species and design,
the same colors, the same costume and props, the same art style. That image is this character's
official art. Only the facial expression and the pose change.

Style: soft 3D render with a smooth glossy vinyl-toy look, rounded chibi proportions with a big head,
big glossy expressive eyes with two catchlights, warm soft global illumination with the key light from
the upper left, subtle rim light, no hard outlines, clean readable silhouette at small sizes,
front three-quarter view, transparent background, high resolution.

The character: a young Korean haetae guardian beast, golden fur with a copper-red mane in tight curls, a single small horn on the forehead, a scaled collar, round proud eyes.
The copper-red curly mane carries the emotion — bristling out when angry, flattened down when dejected.

Expression: a wide open O mouth, big round shocked eyes, eyebrows shot up, startled and leaning back.

Framing: a single full-body illustration. The whole body must be visible including the feet or base and every prop, nothing cropped off, centered with a small even margin on all sides. Keep the face clearly readable.

Do NOT change the species, horn count, hair, costume, accessories or palette.
Do NOT use: pixel art, hard black outline, cel shading, flat vector, sticker cutout edge, text,
watermark, busy background, more than one character, photorealistic human, stone statue, temple lion statue, chinese guardian lion, jade sculpture.
```

## `sansin_surprise.png` — 산신령

첨부: `public/img/sansin_full.png` · **전신으로**

```
Match the attached reference image exactly: the same character, the same species and design,
the same colors, the same costume and props, the same art style. That image is this character's
official art. Only the facial expression and the pose change.

Style: soft 3D render with a smooth glossy vinyl-toy look, rounded chibi proportions with a big head,
big glossy expressive eyes with two catchlights, warm soft global illumination with the key light from
the upper left, subtle rim light, no hard outlines, clean readable silhouette at small sizes,
front three-quarter view, transparent background, high resolution.

The character: a tiny kind Korean mountain spirit grandfather, a flowing white beard covering half his face, a jade-green traditional robe, bushy white eyebrows, warm crinkled eyes, a small gnarled wooden staff.
The long white beard and the bushy eyebrows carry the emotion. Keep the beard covering half of his face — that is his silhouette.

Expression: a wide open O mouth, big round shocked eyes, eyebrows shot up, startled and leaning back.

Framing: a single full-body illustration. The whole body must be visible including the feet or base and every prop, nothing cropped off, centered with a small even margin on all sides. Keep the face clearly readable.

Do NOT change the species, horn count, hair, costume, accessories or palette.
Do NOT use: pixel art, hard black outline, cel shading, flat vector, sticker cutout edge, text,
watermark, busy background, more than one character, photorealistic human, wizard, gandalf, chinese immortal, robe with stars, pointed hat.
```

## `yong_surprise.png` — 청룡

첨부: `public/img/yong_full.png` · **전신으로**

```
Match the attached reference image exactly: the same character, the same species and design,
the same colors, the same costume and props, the same art style. That image is this character's
official art. Only the facial expression and the pose change.

Style: soft 3D render with a smooth glossy vinyl-toy look, rounded chibi proportions with a big head,
big glossy expressive eyes with two catchlights, warm soft global illumination with the key light from
the upper left, subtle rim light, no hard outlines, clean readable silhouette at small sizes,
front three-quarter view, transparent background, high resolution.

The character: a small friendly east-asian blue dragon, deep azure scales with a silver belly, deer-like antlers, long flowing whiskers caught in the wind, round bright eyes, a serpentine body coiled compactly.
The long whiskers and the coiled serpentine body carry the emotion — whiskers streaming upward when excited, drooping when dejected.

Expression: a wide open O mouth, big round shocked eyes, eyebrows shot up, startled and leaning back.

Framing: a single full-body illustration. The whole body must be visible including the feet or base and every prop, nothing cropped off, centered with a small even margin on all sides. Keep the face clearly readable.

Do NOT change the species, horn count, hair, costume, accessories or palette.
Do NOT use: pixel art, hard black outline, cel shading, flat vector, sticker cutout edge, text,
watermark, busy background, more than one character, photorealistic human, western dragon, bat wings, fire breathing, four-legged lizard.
```

## `jeoseung_surprise.png` — 저승사자

첨부: `public/img/jeoseung_full.png` · **전신으로**

```
Match the attached reference image exactly: the same character, the same species and design,
the same colors, the same costume and props, the same art style. That image is this character's
official art. Only the facial expression and the pose change.

Style: soft 3D render with a smooth glossy vinyl-toy look, rounded chibi proportions with a big head,
big glossy expressive eyes with two catchlights, warm soft global illumination with the key light from
the upper left, subtle rim light, no hard outlines, clean readable silhouette at small sizes,
front three-quarter view, transparent background, high resolution.

The character: a stylish Korean grim reaper as a cute mascot, a wide black gat hat tilted to one side, an ink-black traditional dopo robe, a pale calm face, half-lidded cool eyes, a faint smirk, not scary at all.
Keep him COOL and understated — he never goes loud or goofy. Show the emotion in small shifts: the gat hat tilting further, one eyebrow raised, the smirk widening or flattening.

Expression: a wide open O mouth, big round shocked eyes, eyebrows shot up, startled and leaning back.

Framing: a single full-body illustration. The whole body must be visible including the feet or base and every prop, nothing cropped off, centered with a small even margin on all sides. Keep the face clearly readable.

Do NOT change the species, horn count, hair, costume, accessories or palette.
Do NOT use: pixel art, hard black outline, cel shading, flat vector, sticker cutout edge, text,
watermark, busy background, more than one character, photorealistic human, western grim reaper, skull face, scythe, hooded cloak, horror, dark background.
The background must be fully transparent (or a plain mid-grey if transparency is not possible) — never black, so the black hat and robe stay separable.
```

---

# 5파 — `sad` (슬픔) · 13장

내 말이 잡혔을 때

## `tiger_sad.png` — 호랑이

첨부: `public/img/tiger.png` · **상반신으로**

```
Match the attached reference image exactly: the same character, the same species and design,
the same colors, the same costume and props, the same art style. That image is this character's
official art. Only the facial expression and the pose change.

Style: soft 3D render with a smooth glossy vinyl-toy look, rounded chibi proportions with a big head,
big glossy expressive eyes with two catchlights, warm soft global illumination with the key light from
the upper left, subtle rim light, no hard outlines, clean readable silhouette at small sizes,
front three-quarter view, transparent background, high resolution.

The character: a playful young Korean tiger cub, warm orange fur with soft black stripes, cream muzzle and belly, round cheeks, one ear flicked back, tiny fangs.

Expression: teary droopy sad eyes, a small frown, shoulders slumped, dejected.

Framing: bust framing, head and upper body, centered, the same crop as the reference image. Keep the face inside the central circle (about 88% of the width) — this art gets cropped into a circle.

Do NOT change the species, horn count, hair, costume, accessories or palette.
Do NOT use: pixel art, hard black outline, cel shading, flat vector, sticker cutout edge, text,
watermark, busy background, more than one character, photorealistic human.
```

## `rabbit_sad.png` — 토끼

첨부: `public/img/rabbit.png` · **상반신으로**

```
Match the attached reference image exactly: the same character, the same species and design,
the same colors, the same costume and props, the same art style. That image is this character's
official art. Only the facial expression and the pose change.

Style: soft 3D render with a smooth glossy vinyl-toy look, rounded chibi proportions with a big head,
big glossy expressive eyes with two catchlights, warm soft global illumination with the key light from
the upper left, subtle rim light, no hard outlines, clean readable silhouette at small sizes,
front three-quarter view, transparent background, high resolution.

The character: a soft white-and-grey rabbit, one long ear upright and the other folded, pink inner ears, a twitching nose.
The long upright ear carries the emotion — perked up and quivering when excited, drooping when dejected.

Expression: teary droopy sad eyes, a small frown, shoulders slumped, dejected.

Framing: bust framing, head and upper body, centered, the same crop as the reference image. Keep the face inside the central circle (about 88% of the width) — this art gets cropped into a circle.

Do NOT change the species, horn count, hair, costume, accessories or palette.
Do NOT use: pixel art, hard black outline, cel shading, flat vector, sticker cutout edge, text,
watermark, busy background, more than one character, photorealistic human.
```

## `bear_sad.png` — 곰

첨부: `public/img/bear.png` · **상반신으로**

```
Match the attached reference image exactly: the same character, the same species and design,
the same colors, the same costume and props, the same art style. That image is this character's
official art. Only the facial expression and the pose change.

Style: soft 3D render with a smooth glossy vinyl-toy look, rounded chibi proportions with a big head,
big glossy expressive eyes with two catchlights, warm soft global illumination with the key light from
the upper left, subtle rim light, no hard outlines, clean readable silhouette at small sizes,
front three-quarter view, transparent background, high resolution.

The character: a chubby honey-brown bear cub, small round ears, a broad soft muzzle, gentle sleepy-warm eyes.

Expression: teary droopy sad eyes, a small frown, shoulders slumped, dejected.

Framing: bust framing, head and upper body, centered, the same crop as the reference image. Keep the face inside the central circle (about 88% of the width) — this art gets cropped into a circle.

Do NOT change the species, horn count, hair, costume, accessories or palette.
Do NOT use: pixel art, hard black outline, cel shading, flat vector, sticker cutout edge, text,
watermark, busy background, more than one character, photorealistic human.
```

## `fox_sad.png` — 여우

첨부: `public/img/fox.png` · **상반신으로**

```
Match the attached reference image exactly: the same character, the same species and design,
the same colors, the same costume and props, the same art style. That image is this character's
official art. Only the facial expression and the pose change.

Style: soft 3D render with a smooth glossy vinyl-toy look, rounded chibi proportions with a big head,
big glossy expressive eyes with two catchlights, warm soft global illumination with the key light from
the upper left, subtle rim light, no hard outlines, clean readable silhouette at small sizes,
front three-quarter view, transparent background, high resolution.

The character: a sleek red-orange fox, white cheek fur and chest, tall pointed ears, narrow clever eyes, a bushy tail curling up behind.
The bushy tail carries the emotion — puffed up when startled, curled low and tight when dejected.

Expression: teary droopy sad eyes, a small frown, shoulders slumped, dejected.

Framing: bust framing, head and upper body, centered, the same crop as the reference image. Keep the face inside the central circle (about 88% of the width) — this art gets cropped into a circle.

Do NOT change the species, horn count, hair, costume, accessories or palette.
Do NOT use: pixel art, hard black outline, cel shading, flat vector, sticker cutout edge, text,
watermark, busy background, more than one character, photorealistic human.
```

## `dokkaebi_sad.png` — 도깨비

첨부: `public/img/dokkaebi.png` · **상반신으로**

```
Match the attached reference image exactly: the same character, the same species and design,
the same colors, the same costume and props, the same art style. That image is this character's
official art. Only the facial expression and the pose change.

Style: soft 3D render with a smooth glossy vinyl-toy look, rounded chibi proportions with a big head,
big glossy expressive eyes with two catchlights, warm soft global illumination with the key light from
the upper left, subtle rim light, no hard outlines, clean readable silhouette at small sizes,
front three-quarter view, transparent background, high resolution.

The character: a friendly Korean dokkaebi goblin, a single small horn on the forehead, warm teal-green skin, wild dark hair, round mischievous eyes, a tiny wooden club (bangmangi) resting on one shoulder.

Expression: teary droopy sad eyes, a small frown, shoulders slumped, dejected.

Framing: bust framing, head and upper body, centered, the same crop as the reference image. Keep the face inside the central circle (about 88% of the width) — this art gets cropped into a circle.

Do NOT change the species, horn count, hair, costume, accessories or palette.
Do NOT use: pixel art, hard black outline, cel shading, flat vector, sticker cutout edge, text,
watermark, busy background, more than one character, photorealistic human, japanese oni, red demon skin, tiger-skin loincloth, two horns, scary, horror.
```

## `yutgarak_sad.png` — 윷가락

첨부: `public/img/yutgarak_full.png` · **전신으로**

```
Match the attached reference image exactly: the same character, the same species and design,
the same colors, the same costume and props, the same art style. That image is this character's
official art. Only the facial expression and the pose change.

Style: soft 3D render with a smooth glossy vinyl-toy look, rounded chibi proportions with a big head,
big glossy expressive eyes with two catchlights, warm soft global illumination with the key light from
the upper left, subtle rim light, no hard outlines, clean readable silhouette at small sizes,
front three-quarter view, transparent background, high resolution.

The character: two rounded wooden yut sticks as one cheerful mascot, pale birch wood with visible warm grain, the flat side painted with a bold red X mark, a small friendly face carved into the upper stick.
The face is carved into the upper wooden stick. It has no arms — express the emotion with the carved eyes and mouth and with how the two sticks lean against each other.

Expression: the two sticks slumped over sideways, the carved eyes drooping and teary, the mouth a small frown.

Framing: a single full-body illustration. The whole body must be visible including the feet or base and every prop, nothing cropped off, centered with a small even margin on all sides. Keep the face clearly readable.

Do NOT change the species, horn count, hair, costume, accessories or palette.
Do NOT use: pixel art, hard black outline, cel shading, flat vector, sticker cutout edge, text,
watermark, busy background, more than one character, photorealistic human, plain object, product photo, no face, still life, human hands.
```

## `bokjumeoni_sad.png` — 복주머니

첨부: `public/img/bokjumeoni_full.png` · **전신으로**

```
Match the attached reference image exactly: the same character, the same species and design,
the same colors, the same costume and props, the same art style. That image is this character's
official art. Only the facial expression and the pose change.

Style: soft 3D render with a smooth glossy vinyl-toy look, rounded chibi proportions with a big head,
big glossy expressive eyes with two catchlights, warm soft global illumination with the key light from
the upper left, subtle rim light, no hard outlines, clean readable silhouette at small sizes,
front three-quarter view, transparent background, high resolution.

The character: a plump crimson silk lucky pouch mascot, a gold embroidered longevity pattern, the drawstring gathered at the top like a topknot, two golden tassels swinging to one side, a round happy face on the pouch body.
The face is on the crimson pouch body. The two golden tassels act as its arms — they carry the emotion.

Expression: both tassels hanging limp and still, teary droopy eyes, the pouch body sagging.

Framing: a single full-body illustration. The whole body must be visible including the feet or base and every prop, nothing cropped off, centered with a small even margin on all sides. Keep the face clearly readable.

Do NOT change the species, horn count, hair, costume, accessories or palette.
Do NOT use: pixel art, hard black outline, cel shading, flat vector, sticker cutout edge, text,
watermark, busy background, more than one character, photorealistic human, plain object, product photo, no face, still life, human hands.
```

## `chorong_sad.png` — 청사초롱

첨부: `public/img/chorong_full.png` · **전신으로**

```
Match the attached reference image exactly: the same character, the same species and design,
the same colors, the same costume and props, the same art style. That image is this character's
official art. Only the facial expression and the pose change.

Style: soft 3D render with a smooth glossy vinyl-toy look, rounded chibi proportions with a big head,
big glossy expressive eyes with two catchlights, warm soft global illumination with the key light from
the upper left, subtle rim light, no hard outlines, clean readable silhouette at small sizes,
front three-quarter view, transparent background, high resolution.

The character: a traditional Korean wedding lantern mascot, a hexagonal frame with blue and red silk panels, a warm candle glow from inside lighting its own face, a small wooden carrying handle tilted, a tiny flame flickering.
Its face is lit from inside by the candle, and it has no arms. The inner flame carries the emotion — flaring bright and tall when excited, guttering low and dim when dejected, burning sharp red when angry.

Expression: the inner flame gutters low and dim, the face barely lit, teary droopy eyes, the lantern hanging low.

Framing: a single full-body illustration. The whole body must be visible including the feet or base and every prop, nothing cropped off, centered with a small even margin on all sides. Keep the face clearly readable.

Do NOT change the species, horn count, hair, costume, accessories or palette.
Do NOT use: pixel art, hard black outline, cel shading, flat vector, sticker cutout edge, text,
watermark, busy background, more than one character, photorealistic human, plain object, product photo, no face, still life, human hands, paper lantern festival.
```

## `jangseung_sad.png` — 장승

첨부: `public/img/jangseung_full.png` · **전신으로**

```
Match the attached reference image exactly: the same character, the same species and design,
the same colors, the same costume and props, the same art style. That image is this character's
official art. Only the facial expression and the pose change.

Style: soft 3D render with a smooth glossy vinyl-toy look, rounded chibi proportions with a big head,
big glossy expressive eyes with two catchlights, warm soft global illumination with the key light from
the upper left, subtle rim light, no hard outlines, clean readable silhouette at small sizes,
front three-quarter view, transparent background, high resolution.

The character: a friendly Korean village guardian totem post, weathered mossy grey-green wood, comically bulging round eyes, a wide red-painted grinning mouth with two blunt teeth, carved eyebrows, gentle rather than fearsome.
It is a carved wooden post with no arms and no legs. Express the emotion ONLY with the bulging round eyes, the carved eyebrows and the wide red-painted mouth, plus how the whole post tilts.

Expression: no arms — the whole post leaning over sadly, the bulging eyes teary and droopy, the red mouth turned down.

Framing: a single full-body illustration. The whole body must be visible including the feet or base and every prop, nothing cropped off, centered with a small even margin on all sides. Keep the face clearly readable.

Do NOT change the species, horn count, hair, costume, accessories or palette.
Do NOT use: pixel art, hard black outline, cel shading, flat vector, sticker cutout edge, text,
watermark, busy background, more than one character, photorealistic human, native american totem pole, tiki mask, scary, horror, human hands.
```

## `haetae_sad.png` — 해태

첨부: `public/img/haetae_full.png` · **전신으로**

```
Match the attached reference image exactly: the same character, the same species and design,
the same colors, the same costume and props, the same art style. That image is this character's
official art. Only the facial expression and the pose change.

Style: soft 3D render with a smooth glossy vinyl-toy look, rounded chibi proportions with a big head,
big glossy expressive eyes with two catchlights, warm soft global illumination with the key light from
the upper left, subtle rim light, no hard outlines, clean readable silhouette at small sizes,
front three-quarter view, transparent background, high resolution.

The character: a young Korean haetae guardian beast, golden fur with a copper-red mane in tight curls, a single small horn on the forehead, a scaled collar, round proud eyes.
The copper-red curly mane carries the emotion — bristling out when angry, flattened down when dejected.

Expression: teary droopy sad eyes, a small frown, shoulders slumped, dejected.

Framing: a single full-body illustration. The whole body must be visible including the feet or base and every prop, nothing cropped off, centered with a small even margin on all sides. Keep the face clearly readable.

Do NOT change the species, horn count, hair, costume, accessories or palette.
Do NOT use: pixel art, hard black outline, cel shading, flat vector, sticker cutout edge, text,
watermark, busy background, more than one character, photorealistic human, stone statue, temple lion statue, chinese guardian lion, jade sculpture.
```

## `sansin_sad.png` — 산신령

첨부: `public/img/sansin_full.png` · **전신으로**

```
Match the attached reference image exactly: the same character, the same species and design,
the same colors, the same costume and props, the same art style. That image is this character's
official art. Only the facial expression and the pose change.

Style: soft 3D render with a smooth glossy vinyl-toy look, rounded chibi proportions with a big head,
big glossy expressive eyes with two catchlights, warm soft global illumination with the key light from
the upper left, subtle rim light, no hard outlines, clean readable silhouette at small sizes,
front three-quarter view, transparent background, high resolution.

The character: a tiny kind Korean mountain spirit grandfather, a flowing white beard covering half his face, a jade-green traditional robe, bushy white eyebrows, warm crinkled eyes, a small gnarled wooden staff.
The long white beard and the bushy eyebrows carry the emotion. Keep the beard covering half of his face — that is his silhouette.

Expression: teary droopy sad eyes, a small frown, shoulders slumped, dejected.

Framing: a single full-body illustration. The whole body must be visible including the feet or base and every prop, nothing cropped off, centered with a small even margin on all sides. Keep the face clearly readable.

Do NOT change the species, horn count, hair, costume, accessories or palette.
Do NOT use: pixel art, hard black outline, cel shading, flat vector, sticker cutout edge, text,
watermark, busy background, more than one character, photorealistic human, wizard, gandalf, chinese immortal, robe with stars, pointed hat.
```

## `yong_sad.png` — 청룡

첨부: `public/img/yong_full.png` · **전신으로**

```
Match the attached reference image exactly: the same character, the same species and design,
the same colors, the same costume and props, the same art style. That image is this character's
official art. Only the facial expression and the pose change.

Style: soft 3D render with a smooth glossy vinyl-toy look, rounded chibi proportions with a big head,
big glossy expressive eyes with two catchlights, warm soft global illumination with the key light from
the upper left, subtle rim light, no hard outlines, clean readable silhouette at small sizes,
front three-quarter view, transparent background, high resolution.

The character: a small friendly east-asian blue dragon, deep azure scales with a silver belly, deer-like antlers, long flowing whiskers caught in the wind, round bright eyes, a serpentine body coiled compactly.
The long whiskers and the coiled serpentine body carry the emotion — whiskers streaming upward when excited, drooping when dejected.

Expression: teary droopy sad eyes, a small frown, shoulders slumped, dejected.

Framing: a single full-body illustration. The whole body must be visible including the feet or base and every prop, nothing cropped off, centered with a small even margin on all sides. Keep the face clearly readable.

Do NOT change the species, horn count, hair, costume, accessories or palette.
Do NOT use: pixel art, hard black outline, cel shading, flat vector, sticker cutout edge, text,
watermark, busy background, more than one character, photorealistic human, western dragon, bat wings, fire breathing, four-legged lizard.
```

## `jeoseung_sad.png` — 저승사자

첨부: `public/img/jeoseung_full.png` · **전신으로**

```
Match the attached reference image exactly: the same character, the same species and design,
the same colors, the same costume and props, the same art style. That image is this character's
official art. Only the facial expression and the pose change.

Style: soft 3D render with a smooth glossy vinyl-toy look, rounded chibi proportions with a big head,
big glossy expressive eyes with two catchlights, warm soft global illumination with the key light from
the upper left, subtle rim light, no hard outlines, clean readable silhouette at small sizes,
front three-quarter view, transparent background, high resolution.

The character: a stylish Korean grim reaper as a cute mascot, a wide black gat hat tilted to one side, an ink-black traditional dopo robe, a pale calm face, half-lidded cool eyes, a faint smirk, not scary at all.
Keep him COOL and understated — he never goes loud or goofy. Show the emotion in small shifts: the gat hat tilting further, one eyebrow raised, the smirk widening or flattening.

Expression: teary droopy sad eyes, a small frown, shoulders slumped, dejected.

Framing: a single full-body illustration. The whole body must be visible including the feet or base and every prop, nothing cropped off, centered with a small even margin on all sides. Keep the face clearly readable.

Do NOT change the species, horn count, hair, costume, accessories or palette.
Do NOT use: pixel art, hard black outline, cel shading, flat vector, sticker cutout edge, text,
watermark, busy background, more than one character, photorealistic human, western grim reaper, skull face, scythe, hooded cloak, horror, dark background.
The background must be fully transparent (or a plain mid-grey if transparency is not possible) — never black, so the black hat and robe stay separable.
```

---

# 6파 — `angry` (화남) · 13장

함정(늪)에 빠졌을 때

## `tiger_angry.png` — 호랑이

첨부: `public/img/tiger.png` · **상반신으로**

```
Match the attached reference image exactly: the same character, the same species and design,
the same colors, the same costume and props, the same art style. That image is this character's
official art. Only the facial expression and the pose change.

Style: soft 3D render with a smooth glossy vinyl-toy look, rounded chibi proportions with a big head,
big glossy expressive eyes with two catchlights, warm soft global illumination with the key light from
the upper left, subtle rim light, no hard outlines, clean readable silhouette at small sizes,
front three-quarter view, transparent background, high resolution.

The character: a playful young Korean tiger cub, warm orange fur with soft black stripes, cream muzzle and belly, round cheeks, one ear flicked back, tiny fangs.

Expression: an angry pouty frown with furrowed brows and a small red anger vein, arms crossed.

Framing: bust framing, head and upper body, centered, the same crop as the reference image. Keep the face inside the central circle (about 88% of the width) — this art gets cropped into a circle.

Do NOT change the species, horn count, hair, costume, accessories or palette.
Do NOT use: pixel art, hard black outline, cel shading, flat vector, sticker cutout edge, text,
watermark, busy background, more than one character, photorealistic human.
```

## `rabbit_angry.png` — 토끼

첨부: `public/img/rabbit.png` · **상반신으로**

```
Match the attached reference image exactly: the same character, the same species and design,
the same colors, the same costume and props, the same art style. That image is this character's
official art. Only the facial expression and the pose change.

Style: soft 3D render with a smooth glossy vinyl-toy look, rounded chibi proportions with a big head,
big glossy expressive eyes with two catchlights, warm soft global illumination with the key light from
the upper left, subtle rim light, no hard outlines, clean readable silhouette at small sizes,
front three-quarter view, transparent background, high resolution.

The character: a soft white-and-grey rabbit, one long ear upright and the other folded, pink inner ears, a twitching nose.
The long upright ear carries the emotion — perked up and quivering when excited, drooping when dejected.

Expression: an angry pouty frown with furrowed brows and a small red anger vein, arms crossed.

Framing: bust framing, head and upper body, centered, the same crop as the reference image. Keep the face inside the central circle (about 88% of the width) — this art gets cropped into a circle.

Do NOT change the species, horn count, hair, costume, accessories or palette.
Do NOT use: pixel art, hard black outline, cel shading, flat vector, sticker cutout edge, text,
watermark, busy background, more than one character, photorealistic human.
```

## `bear_angry.png` — 곰

첨부: `public/img/bear.png` · **상반신으로**

```
Match the attached reference image exactly: the same character, the same species and design,
the same colors, the same costume and props, the same art style. That image is this character's
official art. Only the facial expression and the pose change.

Style: soft 3D render with a smooth glossy vinyl-toy look, rounded chibi proportions with a big head,
big glossy expressive eyes with two catchlights, warm soft global illumination with the key light from
the upper left, subtle rim light, no hard outlines, clean readable silhouette at small sizes,
front three-quarter view, transparent background, high resolution.

The character: a chubby honey-brown bear cub, small round ears, a broad soft muzzle, gentle sleepy-warm eyes.

Expression: an angry pouty frown with furrowed brows and a small red anger vein, arms crossed.

Framing: bust framing, head and upper body, centered, the same crop as the reference image. Keep the face inside the central circle (about 88% of the width) — this art gets cropped into a circle.

Do NOT change the species, horn count, hair, costume, accessories or palette.
Do NOT use: pixel art, hard black outline, cel shading, flat vector, sticker cutout edge, text,
watermark, busy background, more than one character, photorealistic human.
```

## `fox_angry.png` — 여우

첨부: `public/img/fox.png` · **상반신으로**

```
Match the attached reference image exactly: the same character, the same species and design,
the same colors, the same costume and props, the same art style. That image is this character's
official art. Only the facial expression and the pose change.

Style: soft 3D render with a smooth glossy vinyl-toy look, rounded chibi proportions with a big head,
big glossy expressive eyes with two catchlights, warm soft global illumination with the key light from
the upper left, subtle rim light, no hard outlines, clean readable silhouette at small sizes,
front three-quarter view, transparent background, high resolution.

The character: a sleek red-orange fox, white cheek fur and chest, tall pointed ears, narrow clever eyes, a bushy tail curling up behind.
The bushy tail carries the emotion — puffed up when startled, curled low and tight when dejected.

Expression: an angry pouty frown with furrowed brows and a small red anger vein, arms crossed.

Framing: bust framing, head and upper body, centered, the same crop as the reference image. Keep the face inside the central circle (about 88% of the width) — this art gets cropped into a circle.

Do NOT change the species, horn count, hair, costume, accessories or palette.
Do NOT use: pixel art, hard black outline, cel shading, flat vector, sticker cutout edge, text,
watermark, busy background, more than one character, photorealistic human.
```

## `dokkaebi_angry.png` — 도깨비

첨부: `public/img/dokkaebi.png` · **상반신으로**

```
Match the attached reference image exactly: the same character, the same species and design,
the same colors, the same costume and props, the same art style. That image is this character's
official art. Only the facial expression and the pose change.

Style: soft 3D render with a smooth glossy vinyl-toy look, rounded chibi proportions with a big head,
big glossy expressive eyes with two catchlights, warm soft global illumination with the key light from
the upper left, subtle rim light, no hard outlines, clean readable silhouette at small sizes,
front three-quarter view, transparent background, high resolution.

The character: a friendly Korean dokkaebi goblin, a single small horn on the forehead, warm teal-green skin, wild dark hair, round mischievous eyes, a tiny wooden club (bangmangi) resting on one shoulder.

Expression: an angry pouty frown with furrowed brows and a small red anger vein, arms crossed.

Framing: bust framing, head and upper body, centered, the same crop as the reference image. Keep the face inside the central circle (about 88% of the width) — this art gets cropped into a circle.

Do NOT change the species, horn count, hair, costume, accessories or palette.
Do NOT use: pixel art, hard black outline, cel shading, flat vector, sticker cutout edge, text,
watermark, busy background, more than one character, photorealistic human, japanese oni, red demon skin, tiger-skin loincloth, two horns, scary, horror.
```

## `yutgarak_angry.png` — 윷가락

첨부: `public/img/yutgarak_full.png` · **전신으로**

```
Match the attached reference image exactly: the same character, the same species and design,
the same colors, the same costume and props, the same art style. That image is this character's
official art. Only the facial expression and the pose change.

Style: soft 3D render with a smooth glossy vinyl-toy look, rounded chibi proportions with a big head,
big glossy expressive eyes with two catchlights, warm soft global illumination with the key light from
the upper left, subtle rim light, no hard outlines, clean readable silhouette at small sizes,
front three-quarter view, transparent background, high resolution.

The character: two rounded wooden yut sticks as one cheerful mascot, pale birch wood with visible warm grain, the flat side painted with a bold red X mark, a small friendly face carved into the upper stick.
The face is carved into the upper wooden stick. It has no arms — express the emotion with the carved eyes and mouth and with how the two sticks lean against each other.

Expression: the two sticks pressed tightly together, the carved brows furrowed low, the carved mouth a hard scowl, a small red anger vein.

Framing: a single full-body illustration. The whole body must be visible including the feet or base and every prop, nothing cropped off, centered with a small even margin on all sides. Keep the face clearly readable.

Do NOT change the species, horn count, hair, costume, accessories or palette.
Do NOT use: pixel art, hard black outline, cel shading, flat vector, sticker cutout edge, text,
watermark, busy background, more than one character, photorealistic human, plain object, product photo, no face, still life, human hands.
```

## `bokjumeoni_angry.png` — 복주머니

첨부: `public/img/bokjumeoni_full.png` · **전신으로**

```
Match the attached reference image exactly: the same character, the same species and design,
the same colors, the same costume and props, the same art style. That image is this character's
official art. Only the facial expression and the pose change.

Style: soft 3D render with a smooth glossy vinyl-toy look, rounded chibi proportions with a big head,
big glossy expressive eyes with two catchlights, warm soft global illumination with the key light from
the upper left, subtle rim light, no hard outlines, clean readable silhouette at small sizes,
front three-quarter view, transparent background, high resolution.

The character: a plump crimson silk lucky pouch mascot, a gold embroidered longevity pattern, the drawstring gathered at the top like a topknot, two golden tassels swinging to one side, a round happy face on the pouch body.
The face is on the crimson pouch body. The two golden tassels act as its arms — they carry the emotion.

Expression: the two golden tassels crossed in front of the pouch like folded arms, a pouty furrowed frown, a small red anger vein.

Framing: a single full-body illustration. The whole body must be visible including the feet or base and every prop, nothing cropped off, centered with a small even margin on all sides. Keep the face clearly readable.

Do NOT change the species, horn count, hair, costume, accessories or palette.
Do NOT use: pixel art, hard black outline, cel shading, flat vector, sticker cutout edge, text,
watermark, busy background, more than one character, photorealistic human, plain object, product photo, no face, still life, human hands.
```

## `chorong_angry.png` — 청사초롱

첨부: `public/img/chorong_full.png` · **전신으로**

```
Match the attached reference image exactly: the same character, the same species and design,
the same colors, the same costume and props, the same art style. That image is this character's
official art. Only the facial expression and the pose change.

Style: soft 3D render with a smooth glossy vinyl-toy look, rounded chibi proportions with a big head,
big glossy expressive eyes with two catchlights, warm soft global illumination with the key light from
the upper left, subtle rim light, no hard outlines, clean readable silhouette at small sizes,
front three-quarter view, transparent background, high resolution.

The character: a traditional Korean wedding lantern mascot, a hexagonal frame with blue and red silk panels, a warm candle glow from inside lighting its own face, a small wooden carrying handle tilted, a tiny flame flickering.
Its face is lit from inside by the candle, and it has no arms. The inner flame carries the emotion — flaring bright and tall when excited, guttering low and dim when dejected, burning sharp red when angry.

Expression: the inner flame burns a sharp hot red, the lit face pulled into a furrowed pouty frown, a small red anger vein.

Framing: a single full-body illustration. The whole body must be visible including the feet or base and every prop, nothing cropped off, centered with a small even margin on all sides. Keep the face clearly readable.

Do NOT change the species, horn count, hair, costume, accessories or palette.
Do NOT use: pixel art, hard black outline, cel shading, flat vector, sticker cutout edge, text,
watermark, busy background, more than one character, photorealistic human, plain object, product photo, no face, still life, human hands, paper lantern festival.
```

## `jangseung_angry.png` — 장승

첨부: `public/img/jangseung_full.png` · **전신으로**

```
Match the attached reference image exactly: the same character, the same species and design,
the same colors, the same costume and props, the same art style. That image is this character's
official art. Only the facial expression and the pose change.

Style: soft 3D render with a smooth glossy vinyl-toy look, rounded chibi proportions with a big head,
big glossy expressive eyes with two catchlights, warm soft global illumination with the key light from
the upper left, subtle rim light, no hard outlines, clean readable silhouette at small sizes,
front three-quarter view, transparent background, high resolution.

The character: a friendly Korean village guardian totem post, weathered mossy grey-green wood, comically bulging round eyes, a wide red-painted grinning mouth with two blunt teeth, carved eyebrows, gentle rather than fearsome.
It is a carved wooden post with no arms and no legs. Express the emotion ONLY with the bulging round eyes, the carved eyebrows and the wide red-painted mouth, plus how the whole post tilts.

Expression: no arms — the carved eyebrows driven down hard, the bulging eyes narrowed, the red mouth pulled into a scowl, a small red anger vein.

Framing: a single full-body illustration. The whole body must be visible including the feet or base and every prop, nothing cropped off, centered with a small even margin on all sides. Keep the face clearly readable.

Do NOT change the species, horn count, hair, costume, accessories or palette.
Do NOT use: pixel art, hard black outline, cel shading, flat vector, sticker cutout edge, text,
watermark, busy background, more than one character, photorealistic human, native american totem pole, tiki mask, scary, horror, human hands.
```

## `haetae_angry.png` — 해태

첨부: `public/img/haetae_full.png` · **전신으로**

```
Match the attached reference image exactly: the same character, the same species and design,
the same colors, the same costume and props, the same art style. That image is this character's
official art. Only the facial expression and the pose change.

Style: soft 3D render with a smooth glossy vinyl-toy look, rounded chibi proportions with a big head,
big glossy expressive eyes with two catchlights, warm soft global illumination with the key light from
the upper left, subtle rim light, no hard outlines, clean readable silhouette at small sizes,
front three-quarter view, transparent background, high resolution.

The character: a young Korean haetae guardian beast, golden fur with a copper-red mane in tight curls, a single small horn on the forehead, a scaled collar, round proud eyes.
The copper-red curly mane carries the emotion — bristling out when angry, flattened down when dejected.

Expression: an angry pouty frown with furrowed brows and a small red anger vein, arms crossed.

Framing: a single full-body illustration. The whole body must be visible including the feet or base and every prop, nothing cropped off, centered with a small even margin on all sides. Keep the face clearly readable.

Do NOT change the species, horn count, hair, costume, accessories or palette.
Do NOT use: pixel art, hard black outline, cel shading, flat vector, sticker cutout edge, text,
watermark, busy background, more than one character, photorealistic human, stone statue, temple lion statue, chinese guardian lion, jade sculpture.
```

## `sansin_angry.png` — 산신령

첨부: `public/img/sansin_full.png` · **전신으로**

```
Match the attached reference image exactly: the same character, the same species and design,
the same colors, the same costume and props, the same art style. That image is this character's
official art. Only the facial expression and the pose change.

Style: soft 3D render with a smooth glossy vinyl-toy look, rounded chibi proportions with a big head,
big glossy expressive eyes with two catchlights, warm soft global illumination with the key light from
the upper left, subtle rim light, no hard outlines, clean readable silhouette at small sizes,
front three-quarter view, transparent background, high resolution.

The character: a tiny kind Korean mountain spirit grandfather, a flowing white beard covering half his face, a jade-green traditional robe, bushy white eyebrows, warm crinkled eyes, a small gnarled wooden staff.
The long white beard and the bushy eyebrows carry the emotion. Keep the beard covering half of his face — that is his silhouette.

Expression: an angry pouty frown with furrowed brows and a small red anger vein, arms crossed.

Framing: a single full-body illustration. The whole body must be visible including the feet or base and every prop, nothing cropped off, centered with a small even margin on all sides. Keep the face clearly readable.

Do NOT change the species, horn count, hair, costume, accessories or palette.
Do NOT use: pixel art, hard black outline, cel shading, flat vector, sticker cutout edge, text,
watermark, busy background, more than one character, photorealistic human, wizard, gandalf, chinese immortal, robe with stars, pointed hat.
```

## `yong_angry.png` — 청룡

첨부: `public/img/yong_full.png` · **전신으로**

```
Match the attached reference image exactly: the same character, the same species and design,
the same colors, the same costume and props, the same art style. That image is this character's
official art. Only the facial expression and the pose change.

Style: soft 3D render with a smooth glossy vinyl-toy look, rounded chibi proportions with a big head,
big glossy expressive eyes with two catchlights, warm soft global illumination with the key light from
the upper left, subtle rim light, no hard outlines, clean readable silhouette at small sizes,
front three-quarter view, transparent background, high resolution.

The character: a small friendly east-asian blue dragon, deep azure scales with a silver belly, deer-like antlers, long flowing whiskers caught in the wind, round bright eyes, a serpentine body coiled compactly.
The long whiskers and the coiled serpentine body carry the emotion — whiskers streaming upward when excited, drooping when dejected.

Expression: an angry pouty frown with furrowed brows and a small red anger vein, arms crossed.

Framing: a single full-body illustration. The whole body must be visible including the feet or base and every prop, nothing cropped off, centered with a small even margin on all sides. Keep the face clearly readable.

Do NOT change the species, horn count, hair, costume, accessories or palette.
Do NOT use: pixel art, hard black outline, cel shading, flat vector, sticker cutout edge, text,
watermark, busy background, more than one character, photorealistic human, western dragon, bat wings, fire breathing, four-legged lizard.
```

## `jeoseung_angry.png` — 저승사자

첨부: `public/img/jeoseung_full.png` · **전신으로**

```
Match the attached reference image exactly: the same character, the same species and design,
the same colors, the same costume and props, the same art style. That image is this character's
official art. Only the facial expression and the pose change.

Style: soft 3D render with a smooth glossy vinyl-toy look, rounded chibi proportions with a big head,
big glossy expressive eyes with two catchlights, warm soft global illumination with the key light from
the upper left, subtle rim light, no hard outlines, clean readable silhouette at small sizes,
front three-quarter view, transparent background, high resolution.

The character: a stylish Korean grim reaper as a cute mascot, a wide black gat hat tilted to one side, an ink-black traditional dopo robe, a pale calm face, half-lidded cool eyes, a faint smirk, not scary at all.
Keep him COOL and understated — he never goes loud or goofy. Show the emotion in small shifts: the gat hat tilting further, one eyebrow raised, the smirk widening or flattening.

Expression: the half-lidded eyes narrowed to a cold flat stare, the smirk gone, one eyebrow twitching, the gat hat pulled low — icy rather than loud.

Framing: a single full-body illustration. The whole body must be visible including the feet or base and every prop, nothing cropped off, centered with a small even margin on all sides. Keep the face clearly readable.

Do NOT change the species, horn count, hair, costume, accessories or palette.
Do NOT use: pixel art, hard black outline, cel shading, flat vector, sticker cutout edge, text,
watermark, busy background, more than one character, photorealistic human, western grim reaper, skull face, scythe, hooded cloak, horror, dark background.
The background must be fully transparent (or a plain mid-grey if transparency is not possible) — never black, so the black hat and robe stay separable.
```

---

