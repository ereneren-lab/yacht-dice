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

# ── 캐릭터. desc/neg는 8/04·8/11 원본 프롬프트 그대로다(그 그림이 그 문장에서 나왔으므로).
#    hint = 표정을 **무엇으로** 표현할지. 사물 캐릭터엔 이게 없으면 모델이 사람으로 바꿔 버린다.
#    over = 표정별 덮어쓰기. 팔이 없는 캐릭터에 'arms raised'를 시키면 팔이 자라난다.
C = [
 dict(id='tiger', kr='호랑이', full=False,
      desc='a playful young Korean tiger cub, warm orange fur with soft black stripes, cream muzzle and belly, round cheeks, one ear flicked back, tiny fangs'),
 dict(id='rabbit', kr='토끼', full=False,
      desc='a soft white-and-grey rabbit, one long ear upright and the other folded, pink inner ears, a twitching nose',
      hint='The long upright ear carries the emotion — perked up and quivering when excited, drooping when dejected.'),
 dict(id='bear', kr='곰', full=False,
      desc='a chubby honey-brown bear cub, small round ears, a broad soft muzzle, gentle sleepy-warm eyes'),
 dict(id='fox', kr='여우', full=False,
      desc='a sleek red-orange fox, white cheek fur and chest, tall pointed ears, narrow clever eyes, a bushy tail curling up behind',
      hint='The bushy tail carries the emotion — puffed up when startled, curled low and tight when dejected.'),
 dict(id='dokkaebi', kr='도깨비', full=False,
      desc='a friendly Korean dokkaebi goblin, a single small horn on the forehead, warm teal-green skin, wild dark hair, round mischievous eyes, a tiny wooden club (bangmangi) resting on one shoulder',
      neg='japanese oni, red demon skin, tiger-skin loincloth, two horns, scary, horror'),

 # ── 8/11 8종. 전신으로 뽑는다 → 판 위 판본과 우승 화면 판본을 한 장에서 다 뽑는다.
 dict(id='yutgarak', kr='윷가락', full=True,
      desc='two rounded wooden yut sticks as one cheerful mascot, pale birch wood with visible warm grain, the flat side painted with a bold red X mark, a small friendly face carved into the upper stick',
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
      desc='a traditional Korean wedding lantern mascot, a hexagonal frame with blue and red silk panels, a warm candle glow from inside lighting its own face, a small wooden carrying handle tilted, a tiny flame flickering',
      neg='plain object, product photo, no face, still life, human hands, paper lantern festival',
      hint='Its face is lit from inside by the candle, and it has no arms. The inner flame carries the emotion — flaring bright and tall when excited, guttering low and dim when dejected, burning sharp red when angry.',
      over={'cheer': 'the inner flame flares up bright and tall, the whole lantern tilting back with a huge joyful open smile and sparkling star-shaped eyes',
            'angry': 'the inner flame burns a sharp hot red, the lit face pulled into a furrowed pouty frown, a small red anger vein',
            'sad':   'the inner flame gutters low and dim, the face barely lit, teary droopy eyes, the lantern hanging low'}),
 dict(id='jangseung', kr='장승', full=True,
      desc='a friendly Korean village guardian totem post, weathered mossy grey-green wood, comically bulging round eyes, a wide red-painted grinning mouth with two blunt teeth, carved eyebrows, gentle rather than fearsome',
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
      desc='a stylish Korean grim reaper as a cute mascot, a wide black gat hat tilted to one side, an ink-black traditional dopo robe, a pale calm face, half-lidded cool eyes, a faint smirk, not scary at all',
      neg='western grim reaper, skull face, scythe, hooded cloak, horror, dark background',
      hint='Keep him COOL and understated — he never goes loud or goofy. Show the emotion in small shifts: the gat hat tilting further, one eyebrow raised, the smirk widening or flattening.',
      over={'cheer': 'one hand raised in a small cool victory gesture rather than both arms flailing, the smirk widened into a rare open smile, a single sparkle in one eye, the gat hat tilted back',
            'angry': 'the half-lidded eyes narrowed to a cold flat stare, the smirk gone, one eyebrow twitching, the gat hat pulled low — icy rather than loud'}),
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
