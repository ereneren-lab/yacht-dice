# 주사위 골목 — 아트 발주 브리프 (Art Commission Brief)

넷마블/한게임급 룩앤필의 결정적 격차는 **아트 프로덕션**(전문 캐릭터·표정·배경·스킨)이다.
이 문서는 그걸 발주하기 위한 **일러스트레이터용 브리프**와 **AI 이미지 생성용 프롬프트**를 한 곳에 담았다.
에셋이 들어오면 코드 연동(교체·표정 시스템·스킨 UI·배경 레이어)은 이쪽에서 붙인다.

> 현재 에셋: 5종 동물 마스코트가 **128×128 평면 PNG 한 장씩**(돼지·개·양·소·말).
> 귀엽지만 ①입체감 없음 ②표정 1종 ③배경 없음 ④스킨 없음 → 아래가 그 4개를 메운다.
> 파일: `public/img/{pig,dog,sheep,cow,horse}.png`

---

## 0. 우선순위 (이 순서로 발주 권장)

| 순위 | 항목 | 왜 |
|---|---|---|
| 1 | **캐릭터 리마스터 + 표정 시트** (5종) | 체감 임팩트 1위. 코드에 표정 훅 이미 있음(잡음/완주/늪 리액션) — 표정만 오면 바로 살아남 |
| 2 | **배경/무대 아트** (2~3종) | 지금은 CSS 조명뿐. 실제 테마 배경이 오면 '무대'가 완성됨 |
| 3 | **스킨/코스튬** (동물별 3~5종) | 메타 경제(상점)의 판매 상품. 레벨/타이틀 시스템은 이미 코드에 있음 → 스킨이 오면 상점 연결 |

---

## 1. 스타일 방향 (하나 선택 — **A 추천**)

### A. 소프트 3D 렌더 마스코트 (추천)
- 둥근 비닐토이/클레이 질감, 부드러운 전역조명(GI), 은은한 림라이트, 살짝 광택.
- 참고 톤: 요트 게임의 여우 아바타 방향이 이미 이쪽(입체 이모지풍). 이걸 5종 일관되게.
- 장점: 평면 대비 즉시 "프리미엄 모바일게임" 느낌. 정적 이미지라 코드 연동 단순(그냥 교체).

### B. 고품질 2D + 파츠 분리 (리깅용)
- 2D 일러스트를 유지하되 **머리/눈/입/팔/다리를 레이어 분리**한 PSD로 납품 → Live2D/Spine 리깅.
- 장점: 관절/표정 애니의 최고 품질. 단점: 리깅 파이프라인 필요, 비용↑.

> **추천: A로 가되, "표정 시트"를 함께 받는다.** 코드에 이미 표정 이벤트 훅이 있어 표정 교체만으로 생동감이 크게 오른다.

---

## 2. 캐릭터 세트 스펙 (5종 공통)

- **일관성 필수**: 5종 모두 같은 카메라(정면 3/4), 같은 조명(키라이트 좌상단), 같은 프레이밍(상반신 bust, 원형 아바타 안전영역), **투명 배경**, 정사각 캔버스.
- **해상도**: 1024×1024 이상 PNG(투명) + 소스(PSD 또는 Blender). sRGB.
- **원형 크롭 대응**: 현재 UI가 원형으로 자름 → 얼굴/상반신이 중앙 원(지름 약 88%) 안에 들어오게, 가장자리 여백 확보.
- **시그니처 컬러 유지**: 돼지=핑크, 개=탄/크림, 양=크림, 소=흑백, 말=브라운. 말 테두리에 플레이어색 링이 얹히므로 실루엣이 명확해야 함.

### 납품물 (동물당)
1. **기본(idle)** 1장 — 차분한 평상시 표정
2. **표정 시트 6종** — 코드의 리액션과 1:1 매칭:
   - `happy` 신남(활짝 웃음, ^^ 눈) — 완주/잡음
   - `sad` 시무룩(눈물 그렁, 처진 눈) — 잡힘/패배
   - `surprise` 놀람(입 O, 눈 크게) — 늪/빽도
   - `angry` 약오름(볼 부풀림, 씩씩) — 상대에게 당함
   - `star` 의기양양(별 눈, 반짝) — 윷/모/승리
   - `cheer` 환호(만세 포즈) — 최종 우승 히어로
3. (스타일 B 선택 시) 파츠 분리 PSD
4. **파일명 규칙**: `pig_idle.png`, `pig_happy.png`, `pig_sad.png` … (동물 5 × 표정 7 = 35장)

---

## 3. AI 생성 프롬프트 (Midjourney / SDXL 계열)

> **팁**: 일관성을 위해 ①같은 스타일 접미사 고정 ②같은 `--seed` 또는 스타일 레퍼런스 사용
> ③**현재 PNG를 이미지 프롬프트(--iref / img2img)로 첨부**해 캐릭터 정체성 유지.

### 공통 스타일 접미사 (모든 프롬프트 뒤에 붙임)
```
cute chibi mascot, soft 3D render, smooth rounded vinyl-toy clay look, big glossy expressive eyes,
subtle rim light, warm soft global illumination, thick clean silhouette, front three-quarter view,
bust framing centered, plain transparent background, premium mobile game character, studio lighting,
high detail --ar 1:1 --style raw
```

### 네거티브 (SDXL) / 피할 것
```
text, watermark, signature, extra limbs, deformed, photorealistic human, harsh shadows,
busy background, low contrast, flat lighting, multiple characters
```

### 동물별 프롬프트 (idle)
- **돼지 pig**: `chubby happy pink piglet, rosy cheeks, tiny round snout, small ears, calm friendly smile,`
- **개 dog**: `friendly shiba-inu puppy, tan and cream fur, floppy ears, red collar with a little golden bell, tongue slightly out, cheerful,`
- **양 sheep**: `fluffy cream-white sheep, curly soft wool, tiny nub horns, gentle sleepy eyes, cozy,`
- **소 cow**: `black-and-white spotted baby calf, pink snout, small horns, big curious eyes,`
- **말 horse**: `small brown pony, dark flowing mane, gentle warm eyes, sturdy cute stance,`

### 표정 변형 (idle 프롬프트에서 표정 구절만 교체)
- happy: `beaming happy smile, closed ^^ curved eyes, joyful`
- sad: `teary droopy sad eyes, small frown, dejected`
- surprise: `wide open O mouth, big round shocked eyes, startled`
- angry: `puffed cheeks, annoyed pouty frown, little anger vein`
- star: `sparkling star-shaped eyes, triumphant proud grin`
- cheer: `arms raised celebrating, huge joyful open smile, confetti hint`

> 표정 시트를 한 장으로 받고 싶으면: `expression sheet, 6 poses in a grid, same character, consistent style, [위 6개 표정 나열]`

---

## 4. 배경 / 무대 아트

지금은 CSS 조명(등불+비네트)뿐. 실제 배경 아트로 '무대'를 완성.

- **컨셉**: 아늑한 한국 뒷골목 놀이방 / 상(床) 위 윷판 씬. 따뜻한 등불·나무 질감·은은한 보케.
- **납품**: 가로 16:9 + 세로 9:16 각 1장(반응형), 2560px 이상. 중앙은 판/보드가 얹히므로 **비워두고**(피사계심도로 흐리게), 가장자리에 분위기.
- **시즌 변형(선택)**: 추석 보름달, 설날 한지·복주머니, 밤 주막(등불).
- **테마 대응**: 에스프레소(따뜻)/흑임자(차분 다크)/한지(밝은 한지) 3종에 맞는 톤. (조크 테마 excel·photoshop은 배경 제외)

### AI 프롬프트 (배경)
```
cozy warm Korean game-house interior at night, wooden table top viewpoint, soft paper-lantern glow,
shallow depth of field, bokeh, empty warm-lit center for a game board, subtle wood grain,
inviting board-game atmosphere, no people, no text, cinematic soft lighting --ar 16:9
```

---

## 5. 스킨 / 코스튬 (메타 경제 상품)

레벨/타이틀 시스템은 이미 코드에 있음(v1.148). 스킨이 오면 **상점 + 장착 UI**를 붙인다.

- **동물당 3~5종**, 기본과 **같은 포즈/프레이밍**으로 갈아끼우기 쉽게.
- 아이디어: `한복`(설빔), `왕`(왕관·곤룡포), `도깨비`, `산타`, `탐험가`, `무사`.
- 납품: 기본과 동일 스펙(1024+, 투명, 원형 안전영역) + 표정 시트는 최소 idle/happy/star 3종.
- 파일명: `pig_hanbok_idle.png` …

### AI 프롬프트 예 (한복 스킨)
```
[동물 idle 프롬프트] wearing a colorful traditional Korean hanbok, festive, [공통 스타일 접미사]
```

---

## 6. 기술 납품 체크리스트

- [ ] PNG(투명, sRGB, 1024×1024+) + 소스(PSD/Blend)
- [ ] 5종 × 7표정 = 35장(캐릭터), 파일명 규칙 준수(`동물_표정.png`)
- [ ] 원형 크롭 안전영역(중앙 지름 ~88%) 확보, 5종 스케일·중심 통일
- [ ] 배경 16:9 + 9:16, 중앙 비움
- [ ] 스킨(선택) 동물별 3~5종
- [ ] 컬러/조명 5종 일관(한 장씩 따로 그려도 세트로 보이게)

## 7. 에셋 도착 후 이쪽에서 할 일 (코드)

- `ANIMAL_IMG` 교체 + 표정별 이미지 매핑(현재 리액션 훅에 표정 이미지 스왑 연결)
- 배경 레이어를 CSS 무대 위에 얹기(테마별)
- 스킨 선택 UI + 상점(레벨/재화 연동) + 장착 저장
- 원형 크롭·스케일 자동 정합 확인(브라우저 검증 도구로)
