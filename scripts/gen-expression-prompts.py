#!/usr/bin/env python3
"""
표정 프롬프트 생성기 — 상점 13종 × 6표정 = 78개 낱장 프롬프트를 마크다운으로 찍는다.

왜 손으로 안 쓰나 (2026-08-20)
  78개를 손으로 쓰면 공통 앞머리가 조금씩 달라지고, 그 차이가 그림의 차이로 나온다.
  실제로 8/11에 캐릭터마다 프롬프트를 조금씩 다르게 써서 한 장만 스타일이 튄 적이 있다.
  여기서 조각(스타일·캐릭터·표정·프레이밍·네거티브)을 조립하면 **다른 건 표정뿐**이 보장된다.

  ChatGPT가 3-업 시트를 잘 못 뽑아서 낱장으로 바꿨다(재성님 요청). 낱장이라 장수는 늘지만
  ① 표정 하나가 캔버스를 다 쓰므로 해상도가 좋고
  ② 시트에서 얼굴이 붙어 못 자르던 사고(8/20에 8장 중 2장)가 아예 없어지고
  ③ 8/11 8종을 전신으로 뽑으면 판 위 판본과 우승 화면 판본을 한 장에서 다 뽑는다.

사용: python3 scripts/gen-expression-prompts.py > outputs/production/<날짜>_..._shop13-prompts.md
"""

# ── 스타일: 13종 전부 같은 문장을 쓴다. 여기가 갈리면 그림이 갈린다.
STYLE = """Match the attached reference image exactly: the same character, the same species and design,
the same colors, the same costume and props, the same art style. That image is this character's
official art. Only the facial expression and the pose change.

If anything in the text below disagrees with the attached image, FOLLOW THE IMAGE. The image wins.

Style: soft 3D render with a smooth glossy vinyl-toy look, rounded chibi proportions with a big head,
big glossy expressive eyes with two catchlights, warm soft global illumination with the key light from
the upper left, subtle rim light, no hard outlines, clean readable silhouette at small sizes,
front three-quarter view, transparent background, high resolution."""

NEG = """Do NOT change the species, horn count, hair, costume, accessories or palette.
Do NOT use: pixel art, hard black outline, cel shading, flat vector, sticker cutout edge, text,
watermark, busy background, more than one character, photorealistic human"""

# 판 위 말은 원형으로 잘린다 — 얼굴이 그 원 밖으로 나가면 안 된다.
FRAME_FULL = ("Framing: a single full-body illustration. The whole body must be visible including the "
              "feet or base and every prop, nothing cropped off, centered with a small even margin on "
              "all sides. Keep the face clearly readable.")
FRAME_BUST = ("Framing: bust framing, head and upper body, centered, the same crop as the reference "
              "image. Keep the face inside the central circle (about 88% of the width) — this art gets "
              "cropped into a circle.")

EMO = {
    'star':     ('별눈',   'sparkling star-shaped eyes, a triumphant proud grin, chin lifted'),
    'surprise': ('놀람',   'a wide open O mouth, big round shocked eyes, eyebrows shot up, startled and leaning back'),
    'happy':    ('기쁨',   'a beaming happy smile with closed ^^ curved eyes, joyful and relaxed'),
    'sad':      ('슬픔',   'teary droopy sad eyes, a small frown, shoulders slumped, dejected'),
    'angry':    ('화남',   'an angry pouty frown with furrowed brows and a small red anger vein, arms crossed'),
    'cheer':    ('환호',   'both arms raised high cheering, a huge joyful open smile, sparkling star-shaped eyes'),
}
# 어느 파부터 뽑을지 — 값이 큰 순서. cheer가 1등인 이유는 우승 화면에서 **크게** 뜨기 때문이다.
ORDER = ['cheer', 'star', 'happy', 'surprise', 'sad', 'angry']
WHY = {
    'cheer':    '우승 화면에서 110px로 **크게** 뜨고 영구 교체된다 — 한 장당 값이 가장 크다',
    'star':     '윷·모를 던질 때. 한 판에 가장 자주 뜬다',
    'happy':    '상대 말을 잡았을 때 — 윷에서 제일 신나는 순간',
    'surprise': '빽도',
    'sad':      '내 말이 잡혔을 때',
    'angry':    '함정(늪)에 빠졌을 때',
}

# ── 캐릭터.
#    ⚠️ **desc는 `public/img/`의 실제 그림을 보고 쓴다. 그 그림을 만든 옛 프롬프트를 베끼면 안 된다.**
#    2026-08-20에 그 실수로 cheer 13장 중 4장을 버렸다. 처음엔 ART_BRIEF.md·8/11 문서의 문장을
#    그대로 옮겨 썼는데, **납품된 그림이 그 문장에서 이미 드리프트해 있었다** —
#    토끼엔 없던 노란 나비넥타이와 검은 무늬가 생겼고, 곰엔 있다던 스카프가 없었고,
#    청사초롱은 둥근 등이 아니라 팔다리 달린 사각 몸통이 됐다.
#    텍스트와 레퍼런스 이미지가 싸우면 **모델은 텍스트를 따른다.** 그래서 텍스트가 그림을
#    옛 프롬프트 쪽으로 되돌려 버렸다. 아래 설명은 전부 실제 PNG를 보고 다시 썼다.
#    hint = 표정을 **무엇으로** 표현할지. 사물 캐릭터엔 이게 없으면 모델이 사람으로 바꿔 버린다.
#    over = 표정별 덮어쓰기. 팔이 없는 캐릭터에 'arms raised'를 시키면 팔이 자라난다.
C = [
 dict(id='tiger', kr='호랑이', full=False,
      desc='a playful young Korean tiger cub, warm orange fur with soft black stripes, cream muzzle and belly, round cheeks, one ear flicked back, tiny fangs'),
 dict(id='rabbit', kr='토끼', full=False,
      # ⚠️ 실제 그림은 '흰 토끼'가 아니다 — 얼굴 절반이 검은 무늬이고 노란 나비넥타이를 맸다.
      desc='a chubby rabbit with a bold BLACK-AND-WHITE patched coat — a large black mask marking '
           'covering the eyes and most of the face, a white muzzle and a white chest, a black patch on '
           'the back — tall ears with pink inner ears (one upright, one folded), and a GOLDEN-YELLOW '
           'BOW TIE at the neck',
      neg='plain all-white rabbit, no bow tie, both ears upright',
      hint='The black face mask and the golden bow tie are its identity — never drop them. '
           'The long upright ear carries the emotion: perked up and quivering when excited, drooping when dejected.'),
 dict(id='bear', kr='곰', full=False,
      # ⚠️ 실제 그림엔 소품이 하나도 없다. 스카프를 적으면 없던 스카프가 생긴다.
      desc='a chubby honey-brown bear cub with soft fuzzy fur, small round ears, a broad soft muzzle, '
           'a cream belly patch, gentle warm eyes, and NO accessories at all — no scarf, no collar, '
           'no bell, nothing around the neck',
      neg='red scarf, neckerchief, collar, bell, bandana, any neck accessory'),
 dict(id='fox', kr='여우', full=False,
      desc='a sleek red-orange fox, white cheek fur and chest, tall pointed ears, narrow clever eyes, a bushy tail curling up behind',
      hint='The bushy tail carries the emotion — puffed up when startled, curled low and tight when dejected.'),
 dict(id='dokkaebi', kr='도깨비', full=False,
      desc='a friendly Korean dokkaebi goblin, a single small horn on the forehead, warm teal-green skin, '
           'wild dark BROWN hair, pointed ears, round mischievous eyes, a DEEP RED sleeveless vest over '
           'bare green shoulders, a brass bell on a cord at the chest, and a wooden club (bangmangi) held '
           'over one shoulder',
      neg='japanese oni, red demon skin, tiger-skin loincloth, two horns, blue or white robe, scary, horror'),

 # ── 8/11 8종. 전신으로 뽑는다 → 판 위 판본과 우승 화면 판본을 한 장에서 다 뽑는다.
 dict(id='yutgarak', kr='윷가락', full=True,
      desc='two rounded wooden yut sticks as one cheerful mascot, pale birch wood with visible warm grain, '
           'the flat side painted with a bold red X mark, a small friendly face carved into the front stick, '
           'a RED HEADBAND tied around the top of that stick with the knot trailing, and small rounded '
           'wooden feet at the bottom',
      neg='plain object, product photo, no face, still life, human hands',
      hint='The face is carved into the upper wooden stick. It has no arms — express the emotion with the carved eyes and mouth and with how the two sticks lean against each other.',
      over={'cheer': 'the two sticks fly apart into a joyful V shape mid-tumble, the carved face beaming with a huge open smile and sparkling star-shaped eyes',
            'angry': 'the two sticks pressed tightly together, the carved brows furrowed low, the carved mouth a hard scowl, a small red anger vein',
            'sad':   'the two sticks slumped over sideways, the carved eyes drooping and teary, the mouth a small frown'}),
 dict(id='bokjumeoni', kr='복주머니', full=True,
      desc='a plump crimson silk lucky pouch mascot, a gold embroidered longevity pattern, the drawstring gathered at the top like a topknot, two golden tassels swinging to one side, a round happy face on the pouch body',
      neg='plain object, product photo, no face, still life, human hands',
      hint='The face is on the crimson pouch body. The two golden tassels act as its arms — they carry the emotion.',
      over={'cheer': 'both golden tassels flung straight up like raised arms, a huge joyful open smile, sparkling star-shaped eyes',
            'angry': 'the two golden tassels crossed in front of the pouch like folded arms, a pouty furrowed frown, a small red anger vein',
            'sad':   'both tassels hanging limp and still, teary droopy eyes, the pouch body sagging'}),
 dict(id='chorong', kr='청사초롱', full=True,
      # ⚠️ 실제 그림은 유리 랜턴이 아니라 **팔다리 달린 사각 초롱**이고, 얼굴이 몸통 앞면에 크게 그려져 있다.
      desc='a traditional Korean wedding lantern mascot with a BOXY UPRIGHT RECTANGULAR body — a RED upper '
           'panel with a floral pattern and a BLUE lower panel with cloud patterns, brass rims at the top '
           'and bottom — a big round happy FACE drawn on the front of the blue body panel, a brass ring on '
           'top with a curved carrying handle and a red-and-blue tassel hanging from it, a small candle '
           'flame glowing INSIDE and BELOW the face, and tiny stubby arms and little feet',
      neg='plain object, product photo, no face, still life, human hands, paper lantern festival, '
          'glass lantern, round or hexagonal lantern, big flame covering the face, armless',
      hint='Its face is painted on the front of the boxy body and it HAS small stubby arms and feet. '
           'The inner candle flame also carries the emotion — flaring brighter when excited, guttering low '
           'and dim when dejected — but it must stay small and below the face, never covering it.',
      over={'angry': 'the tiny arms planted on its sides, the painted face pulled into a furrowed pouty frown, '
                     'a small red anger vein, the inner flame burning a sharp hot red',
            'sad':   'the tiny arms hanging limp, teary droopy eyes on the painted face, the whole lantern '
                     'tilting over, the inner flame guttering low and dim'}),
 dict(id='jangseung', kr='장승', full=True,
      desc='a friendly Korean village guardian totem post, weathered mossy grey-green wood, comically bulging '
           'round eyes, a wide red-painted grinning mouth with two blunt teeth, carved eyebrows, a SMALL DARK '
           'WOODEN HAT resting flat on top of the post with a rope band under it, a leafy green twig sprouting '
           'at one side, gentle rather than fearsome',
      neg='native american totem pole, tiki mask, scary, horror, human hands',
      hint='It is a carved wooden post with no arms and no legs. Express the emotion ONLY with the bulging round eyes, the carved eyebrows and the wide red-painted mouth, plus how the whole post tilts.',
      over={'cheer': 'no arms — the whole post tilting back in celebration, the bulging eyes wide with joy, the wide red mouth thrown open in a shout, sparkling star highlights in the eyes',
            'angry': 'no arms — the carved eyebrows driven down hard, the bulging eyes narrowed, the red mouth pulled into a scowl, a small red anger vein',
            'sad':   'no arms — the whole post leaning over sadly, the bulging eyes teary and droopy, the red mouth turned down'}),
 dict(id='haetae', kr='해태', full=True,
      desc='a young Korean haetae guardian beast, golden fur with a copper-red mane in tight curls, a single small horn on the forehead, a scaled collar, round proud eyes',
      neg='stone statue, temple lion statue, chinese guardian lion, jade sculpture',
      hint='The copper-red curly mane carries the emotion — bristling out when angry, flattened down when dejected.'),
 dict(id='sansin', kr='산신령', full=True,
      desc='a tiny kind Korean mountain spirit grandfather, a flowing white beard covering half his face, a jade-green traditional robe, bushy white eyebrows, warm crinkled eyes, a small gnarled wooden staff',
      neg='wizard, gandalf, chinese immortal, robe with stars, pointed hat',
      hint='The long white beard and the bushy eyebrows carry the emotion. Keep the beard covering half of his face — that is his silhouette.'),
 dict(id='yong', kr='청룡', full=True,
      desc='a small friendly east-asian blue dragon, deep azure scales with a silver belly, deer-like antlers, long flowing whiskers caught in the wind, round bright eyes, a serpentine body coiled compactly',
      neg='western dragon, bat wings, fire breathing, four-legged lizard',
      hint='The long whiskers and the coiled serpentine body carry the emotion — whiskers streaming upward when excited, drooping when dejected.'),
 dict(id='jeoseung', kr='저승사자', full=True,
      desc='a stylish Korean grim reaper as a cute mascot, a wide BLACK gat hat with a beaded chin strap, '
           'long straight black hair, an INK-BLACK traditional dopo robe with a navy sash and a swirling '
           'cloud pattern, a pale calm face, half-lidded cool eyes, a faint CLOSED smirk, and a GLOWING '
           'BLUE SOUL LANTERN held in one hand. He is composed and aloof, not scary at all',
      neg='western grim reaper, skull face, scythe, hooded cloak, horror, dark background, '
          'white or beige robe, open-mouthed grin, goofy, energetic, cheerful boy',
      hint='⚠️ He is the COOL one of the set and must never go loud or goofy. His mouth stays a small '
           'CLOSED smirk in every expression — never an open-mouthed grin, never teeth. Show emotion only '
           'in small shifts: the gat hat tilting, one eyebrow, the smirk widening a few degrees, the blue '
           'lantern brightening or dimming. Keep the blue lantern in his hand.',
      over={'cheer': 'still composed — he simply raises the blue soul lantern a little higher in one hand, '
                     'the closed smirk curling up at one corner, one eye giving a single bright sparkle, '
                     'the gat hat tipped back a touch. NO open grin, NO both arms in the air',
            'star':  'the closed smirk curling with quiet confidence, star-shaped highlights in the '
                     'half-lidded eyes, chin lifted slightly — smug, not excited',
            'happy': 'a small warm CLOSED smile and softly curved eyes, the blue lantern glowing brighter — quietly pleased',
            'surprise': 'the half-lidded eyes snapped wide for once and one eyebrow shot up, the gat hat knocked '
                        'askew, the blue lantern jolting in his hand — but the mouth stays a small tight O',
            'angry': 'the half-lidded eyes narrowed to a cold flat stare, the smirk gone into a hard line, '
                     'one eyebrow twitching, the gat hat pulled low, the blue lantern flaring cold — icy, not loud'}),
]

# ⚠️ 저승사자는 배경을 어둡게 두면 검은 갓·검은 도포와 안 갈려 통째로 못 쓴다(8/11에 실제로 버렸다).
BG_WARN = {'jeoseung'}


def prompt(c, emo):
    body = (c.get('over') or {}).get(emo) or EMO[emo][1]
    parts = [STYLE, '', 'The character: ' + c['desc'] + '.']
    if c.get('hint'):
        parts.append(c['hint'])
    parts += ['', 'Expression: ' + body + '.', '',
              FRAME_FULL if c['full'] else FRAME_BUST, '',
              NEG + (', ' + c['neg'] if c.get('neg') else '') + '.']
    if c['id'] in BG_WARN:
        parts.append('The background must be fully transparent (or a plain mid-grey if transparency is '
                     'not possible) — never black, so the black hat and robe stay separable.')
    return '\n'.join(parts)


def main():
    print('# 상점 13종 표정 — 낱장 프롬프트 78개 (2026-08-20)\n')
    print('> 이 문서는 `scripts/gen-expression-prompts.py`가 찍어낸다. **여기를 직접 고치지 말고**')
    print('> 스크립트를 고쳐 다시 찍을 것 — 78개의 공통 부분이 갈리면 그림이 갈린다.\n')
    print('> 판단 근거·처리 절차는 `2026-08-20_dice-alley_shop13-expressions.md`에 있다.\n')
    print('## 매번 지킬 것 두 가지\n')
    print('1. **레퍼런스로 그 캐릭터 자신의 그림을 첨부한다.** 아래 각 프롬프트에 붙일 파일이 적혀 있다.')
    print('2. **파일 이름을 프롬프트 제목 그대로** 저장한다(`{id}_{emotion}.png`). 이름이 곧 배선이다.\n')
    print('| 파 | 표정 | 왜 이 순서 |\n|---|---|---|')
    for e in ORDER:
        print('| %d | `%s` (%s) | %s |' % (ORDER.index(e) + 1, e, EMO[e][0], WHY[e]))
    print('\n어느 파에서 멈춰도 깨지지 않는다 — 없는 표정은 `reactImg`가 조용히 베이스로 폴백한다.\n')
    print('---\n')
    for e in ORDER:
        print('# %d파 — `%s` (%s) · 13장\n' % (ORDER.index(e) + 1, e, EMO[e][0]))
        print('%s\n' % WHY[e])
        for c in C:
            ref = 'public/img/%s%s.png' % (c['id'], '_full' if c['full'] else '')
            print('## `%s_%s.png` — %s' % (c['id'], e, c['kr']))
            print('\n첨부: `%s`%s\n' % (ref, ' · **전신으로**' if c['full'] else ' · **상반신으로**'))
            print('```')
            print(prompt(c, e))
            print('```\n')
        print('---\n')


if __name__ == '__main__':
    main()
