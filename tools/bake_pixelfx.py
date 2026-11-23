"""pixelfx(MIT, patch-gg/pixelfx) 효과를 큰 창용 작은 스프라이트 띠로 굽는다.

    python tools/bake_pixelfx.py <pixelfx 저장소 폴더>

pixelfx 폴더에서 `npm ci` 를 한 번 해 두어야 한다(Node 18 이상). Pillow가 필요하다.
효과마다: PICO-8 색 띠로 그린 뒤, 모든 픽셀을 PICO-8 16색 중 가까운 색으로 맞추고(반투명은 버림),
앞부분만 잘라 프레임을 솎고, 필요하면 반으로 줄여 game/assets/pixelfx/<이름>.png 띠와 index.json에 담는다.
"""
from __future__ import annotations

import json
import shutil
import subprocess
import sys
import tempfile
from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / 'plugins' / 'dot-arcade' / 'game' / 'assets' / 'pixelfx'

PICO = [
    (0, 0, 0), (29, 43, 83), (126, 37, 83), (0, 135, 81), (171, 82, 54), (95, 87, 79), (194, 195, 199), (255, 241, 232),
    (255, 0, 77), (255, 163, 0), (255, 236, 39), (0, 228, 54), (41, 173, 255), (131, 118, 156), (255, 119, 168), (255, 204, 170),
]
WARM = ['#7e2553', '#ff004d', '#ff004d', '#ffa300', '#ffa300', '#ffec27', '#fff1e8', '#fff1e8']
DUST = ['#1d2b53', '#5f574f', '#83769c', '#c2c3c7', '#fff1e8', '#fff1e8']
GOLD = ['#1d2b53', '#7e2553', '#ab5236', '#ffa300', '#ffec27', '#ffec27', '#fff1e8', '#fff1e8']
PARTY = ['#ff004d', '#ffa300', '#ffec27', '#00e436', '#29adff', '#83769c', '#ff77a8']

# 이름: (pixelfx id, 옵션, 앞에서 몇 초까지, 몇 프레임마다 하나(30fps 기준), 줄임 배율)
EFFECTS = {
    'spark': ('impacts/hit-spark', {'palette': WARM[:7], 'height': 8}, 0.5, 1, 2),
    'boom': ('explosions/small-explosion', {'palette': WARM, 'size': 0.6}, 0.9, 2, 2),
    'poof': ('spawn/poof', {'palette': DUST}, 0.9, 2, 2),
    'collect': ('pickups/collect-burst', {'palette': GOLD}, 1.0, 2, 2),
    'slam': ('impacts/ground-slam', {'palette': WARM[:7], 'reach': 48}, 0.8, 2, 3),
    'confetti': ('ui/confetti', {'palette': PARTY}, 2.4, 2, 1),
}
ALPHA_MIN = 110


def nearest(rgb: tuple[int, int, int]) -> tuple[int, int, int]:
    return min(PICO, key=lambda p: (p[0] - rgb[0]) ** 2 + (p[1] - rgb[1]) ** 2 + (p[2] - rgb[2]) ** 2)


def snap(frame: Image.Image) -> Image.Image:
    """반투명은 버리고 나머지는 PICO-8 색으로."""
    out = Image.new('RGBA', frame.size, (0, 0, 0, 0))
    src, dst = frame.load(), out.load()
    cache: dict[tuple[int, int, int], tuple[int, int, int]] = {}
    for y in range(frame.height):
        for x in range(frame.width):
            r, g, b, a = src[x, y]
            if a >= ALPHA_MIN:
                c = cache.setdefault((r, g, b), nearest((r, g, b)))
                dst[x, y] = (*c, 255)
    return out


def bake_one(pfx: Path, tmp: Path, name: str, spec: tuple) -> dict:
    fid, opts, secs, step, k = spec
    subprocess.run(['node', 'tools/render.mjs', fid, '--sheet', '--no-actor', '--opts', json.dumps(opts), '--out', str(tmp)],
                   cwd=pfx, check=True, capture_output=True)
    stem = fid.split('/')[-1]
    meta = json.loads((tmp / fid / f'{stem}.json').read_text(encoding='utf-8'))
    sheet = Image.open(tmp / fid / f'{stem}.png').convert('RGBA')
    info = meta['meta']['pixelfx']
    fw, fh = info['frameSize']
    fps = info['fps']
    count = min(info['frames'], round(secs * fps))
    frames = []
    for i in range(0, count, step):
        f = meta['frames'][i]['frame']
        frames.append(snap(sheet.crop((f['x'], f['y'], f['x'] + fw, f['y'] + fh))))
    boxes = [b for b in (f.getbbox() for f in frames) if b]
    x0, y0 = min(b[0] for b in boxes), min(b[1] for b in boxes)
    x1, y1 = max(b[2] for b in boxes), max(b[3] for b in boxes)
    frames = [f.crop((x0, y0, x1, y1)) for f in frames]
    if k > 1:  # 가장 가까운 픽셀로 줄인다(도트가 번지지 않게)
        frames = [f.resize((max(1, f.width // k), max(1, f.height // k)), Image.NEAREST) for f in frames]
    w, h = frames[0].size
    strip = Image.new('RGBA', (w * len(frames), h), (0, 0, 0, 0))
    for i, f in enumerate(frames):
        strip.paste(f, (i * w, 0))
    strip.save(OUT / f'{name}.png', optimize=True)
    px, py = info['pivot']
    return {'id': fid, 'w': w, 'h': h, 'n': len(frames), 'fps': fps / step,
            'px': round((px - x0) / k), 'py': round((py - y0) / k)}


def main() -> int:
    if len(sys.argv) != 2:
        print(__doc__)
        return 2
    pfx = Path(sys.argv[1]).resolve()
    OUT.mkdir(parents=True, exist_ok=True)
    tmp = Path(tempfile.mkdtemp(prefix='pixelfx-'))
    try:
        index = {name: bake_one(pfx, tmp, name, spec) for name, spec in EFFECTS.items()}
    finally:
        shutil.rmtree(tmp, ignore_errors=True)
    commit = subprocess.run(['git', 'rev-parse', 'HEAD'], cwd=pfx, capture_output=True, text=True).stdout.strip()
    (OUT / 'index.json').write_text(json.dumps({'source': 'https://github.com/patch-gg/pixelfx', 'commit': commit,
                                                'effects': index}, ensure_ascii=False, indent=1), encoding='utf-8')
    for name, e in index.items():
        print(f'{name:9} {e["w"]}x{e["h"]} {e["n"]}프레임 {e["fps"]:.0f}fps  ({e["id"]})')
    return 0


if __name__ == '__main__':
    sys.exit(main())
