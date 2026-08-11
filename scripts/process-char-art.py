#!/usr/bin/env python3
"""
캐릭터 아트 후처리 파이프라인 — 생성본(ChatGPT/DALL·E 등)을 게임용 PNG로.

왜 필요한가: ChatGPT/DALL·E는 "투명 배경"이라 해도 실제론 알파 없이 밝은 회색
체커보드를 이미지에 구워 내보낸다(RGB, hasAlpha:no). 그대로 쓰면 원형 아바타에
밝은 체크 원반이 뜬다. 이 스크립트가 그 배경을 코너 flood-fill로 벗겨내고
트림→정사각 패딩→리사이즈→256색 양자화(엣지 alpha 보존, ~25KB)까지 한다.

핵심(실측 보정): 배경 체커 = 무채색(max-min ≤ ~4), 캐릭터 밝은 부위(양털·소 흰색)
= 따뜻한 색조(max-min ≥ ~15). 그래서 isbg = min>225 AND (max-min)<8 로 체커만
정확히 제거하고 캐릭터는 보존한다.

사용:
  python3 scripts/process-char-art.py <입력.png> <출력.png> [--bust 0.60] [--size 400] [--no-quant]
  # --bust N : 전신 소스를 상단 N 비율만 잘라 상반신으로(예: 말 전신 → 0.60). 생략 시 전체.
  # --bg none: 원본에 알파가 이미 들어 있을 때(네 모서리가 투명). 색으로 안 지운다 —
  #            어두운 배경 위의 검은 머리카락을 같이 먹는 사고를 막는다.
  # 예) python3 scripts/process-char-art.py ~/Downloads/pig_happy.png public/img/pig_happy.png

의존: Pillow (pip install Pillow)
"""
import sys, argparse
from collections import deque
from PIL import Image


def isbg(p):
    r, g, b = p[0], p[1], p[2]
    return min(r, g, b) > 225 and (max(r, g, b) - min(r, g, b)) < 8


def _apply(im, px, seen, w, h):
    for y in range(h):
        row = y * w
        for x in range(w):
            if seen[row + x]:
                r, g, b, a = px[x, y]
                px[x, y] = (r, g, b, 0)
    return im


def remove_bg_checker(im):
    """코너/테두리에서 시작해 연결된 **무채색 밝은** 배경만 flood-fill로 투명화.
    ChatGPT/DALL·E의 가짜 투명(밝은 회색 체커보드)을 벗기는 경로."""
    w, h = im.size
    px = im.load()
    seen = bytearray(w * h)
    q = deque()
    border = ([(x, 0) for x in range(w)] + [(x, h - 1) for x in range(w)]
              + [(0, y) for y in range(h)] + [(w - 1, y) for y in range(h)])
    for x, y in border:
        i = y * w + x
        if not seen[i] and isbg(px[x, y]):
            seen[i] = 1
            q.append((x, y))
    while q:
        x, y = q.popleft()
        for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)):
            nx, ny = x + dx, y + dy
            if 0 <= nx < w and 0 <= ny < h:
                j = ny * w + nx
                if not seen[j] and isbg(px[nx, ny]):
                    seen[j] = 1
                    q.append((nx, ny))
    return seen


def remove_bg_grad(im, tol=4):
    """**그라데이션 배경**을 벗긴다 (2026-08-04 추가).

    왜 필요한가: 생성기가 "투명 배경"을 무시하고 **어두운 비네트+따뜻한 글로우**를 구워 내보내는
    경우가 있다(프리미엄 캐릭터 5종이 그랬다). 밝은 회색이 아니라서 checker 경로로는 한 픽셀도 못 벗긴다.

    어떻게: 씨앗 색과 비교하면 그라데이션에서 바로 멈춘다. 그래서 **이미 배경으로 인정된 이웃과**
    비교하며 번져나간다(region growing). 그라데이션은 픽셀당 1~2 정도로 천천히 변하므로 계속 번지고,
    캐릭터 윤곽에서는 차이가 확 커져 멈춘다.

    ⚠️ 캐릭터 색이 배경과 비슷하면(곰=갈색 위 갈색, 여우=주황 위 주황 글로우) 새어 들어갈 수 있다.
       그래서 process()가 남은 면적을 검사해 이상하면 경고한다. 눈으로 한 번 볼 것.
    """
    w, h = im.size
    px = im.load()
    seen = bytearray(w * h)
    q = deque()
    border = ([(x, 0) for x in range(w)] + [(x, h - 1) for x in range(w)]
              + [(0, y) for y in range(h)] + [(w - 1, y) for y in range(h)])
    for x, y in border:
        i = y * w + x
        if not seen[i]:
            seen[i] = 1
            q.append((x, y))
    while q:
        x, y = q.popleft()
        cr, cg, cb = px[x, y][:3]
        for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)):
            nx, ny = x + dx, y + dy
            if 0 <= nx < w and 0 <= ny < h:
                j = ny * w + nx
                if not seen[j]:
                    nr, ng, nb = px[nx, ny][:3]
                    if max(abs(nr - cr), abs(ng - cg), abs(nb - cb)) <= tol:
                        seen[j] = 1
                        q.append((nx, ny))
    return seen


def remove_bg(im, mode='auto', tol=4, alpha_cut=40):
    """mode: auto | checker | grad | none
    auto — checker로 먼저 시도하고, 벗겨낸 게 5% 미만이면 grad로 넘어간다.

    🔴 none — **이미 알파가 제대로 든 원본**에 쓴다. 색으로 지우지 않고 옅은 알파만 잘라낸다.
       2026-08-11에 저승사자에서 겪었다: 원본에 어두운 안개(vignette)가 반투명으로 깔려 있었는데
       auto가 grad로 넘어가 60.8%를 지우면서 **검은 머리카락까지 같이 먹었다**(가닥만 남고 구멍).
       색으로는 '어두운 배경'과 '검은 머리'를 못 가른다. 알파는 그 둘을 이미 갈라 놓았으므로
       알파가 멀쩡한 원본에서는 **아무것도 지우지 않는 것이 정답**이다.
       판별법: 네 모서리 알파가 0이면 alpha가 살아 있는 원본이다 → none."""
    im = im.convert('RGBA')
    w, h = im.size
    total = w * h
    if mode == 'none':
        a = im.split()[3]
        im.putalpha(a.point(lambda v: 0 if v < alpha_cut else v))   # 옅은 안개만 걷어낸다
        print(f'  배경 제거 안 함(alpha<{alpha_cut}만 정리) — 원본 알파를 그대로 믿는다')
        return im
    if mode in ('auto', 'checker'):
        seen = remove_bg_checker(im)
        got = sum(seen) / total
        if mode == 'checker' or got >= 0.05:
            print(f'  배경 제거: checker ({got*100:.1f}%)')
            return _apply(im, im.load(), seen, w, h)
        print(f'  checker로는 {got*100:.1f}%밖에 못 벗겼다 → grad로 재시도')
    seen = remove_bg_grad(im, tol=tol)
    print(f'  배경 제거: grad tol={tol} ({sum(seen)/total*100:.1f}%)')
    return _apply(im, im.load(), seen, w, h)


def process(src, dst, bust=None, size=400, quant=True, margin=0.14, bg='auto', tol=4):
    im = remove_bg(Image.open(src), mode=bg, tol=tol)
    bb = im.getbbox()
    if not bb:
        raise SystemExit('빈 이미지(배경만 남음) — isbg 임계값 확인')
    # 남은 면적 검사 — 배경이 안 벗겨졌거나 캐릭터까지 먹었으면 알려준다
    w0, h0 = im.size
    kept = (bb[2] - bb[0]) * (bb[3] - bb[1]) / (w0 * h0)
    if kept > 0.97:
        print('  ⚠️ 배경이 거의 안 벗겨졌다(남은 박스 %.0f%%) — --tol 을 올려보거나 눈으로 확인할 것' % (kept * 100))
    elif kept < 0.15:
        print('  ⚠️ 너무 많이 먹었다(남은 박스 %.0f%%) — 캐릭터까지 지워졌을 수 있다. --tol 을 낮출 것' % (kept * 100))
    if bust:                                   # 전신 → 상단 일부만(상반신)
        l, t, r, b = bb
        bb = (l, t, r, t + int((b - t) * bust))
    im = im.crop(bb)
    w, h = im.size
    side = int(max(w, h) * (1 + margin))       # 여백 두고 정사각
    sq = Image.new('RGBA', (side, side), (0, 0, 0, 0))
    sq.paste(im, ((side - w) // 2, (side - h) // 2), im)
    sq = sq.resize((size, size), Image.LANCZOS)
    if quant:                                  # 256색 양자화(엣지 alpha 보존, 대폭 경량)
        sq = sq.quantize(colors=256, method=Image.FASTOCTREE, dither=Image.FLOYDSTEINBERG)
    sq.save(dst, optimize=True)
    import os
    print(f'저장 {dst} — {size}px, {os.path.getsize(dst)//1024}KB')


if __name__ == '__main__':
    ap = argparse.ArgumentParser()
    ap.add_argument('src')
    ap.add_argument('dst')
    ap.add_argument('--bust', type=float, default=None, help='전신→상반신 상단 비율(예: 0.60)')
    ap.add_argument('--size', type=int, default=400)
    ap.add_argument('--no-quant', action='store_true')
    ap.add_argument('--bg', choices=['auto', 'checker', 'grad', 'none'], default='auto',
                    help='배경 종류. auto=체커 먼저 시도 후 그라데이션 (기본)')
    ap.add_argument('--tol', type=int, default=4, help='grad 모드 허용 색차(작을수록 보수적)')
    a = ap.parse_args()
    process(a.src, a.dst, bust=a.bust, size=a.size, quant=not a.no_quant, bg=a.bg, tol=a.tol)
