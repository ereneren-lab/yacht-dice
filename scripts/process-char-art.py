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
  # 예) python3 scripts/process-char-art.py ~/Downloads/pig_happy.png public/img/pig_happy.png

의존: Pillow (pip install Pillow)
"""
import sys, argparse
from collections import deque
from PIL import Image


def isbg(p):
    r, g, b = p[0], p[1], p[2]
    return min(r, g, b) > 225 and (max(r, g, b) - min(r, g, b)) < 8


def remove_bg(im):
    """코너/테두리에서 시작해 연결된 무채색 밝은 배경만 flood-fill로 투명화."""
    im = im.convert('RGBA')
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
    for y in range(h):
        for x in range(w):
            if seen[y * w + x]:
                r, g, b, a = px[x, y]
                px[x, y] = (r, g, b, 0)
    return im


def process(src, dst, bust=None, size=400, quant=True, margin=0.14):
    im = remove_bg(Image.open(src))
    bb = im.getbbox()
    if not bb:
        raise SystemExit('빈 이미지(배경만 남음) — isbg 임계값 확인')
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
    a = ap.parse_args()
    process(a.src, a.dst, bust=a.bust, size=a.size, quant=not a.no_quant)
