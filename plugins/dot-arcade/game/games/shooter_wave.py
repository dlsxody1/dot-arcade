"""버그 편대 격추의 편대와 움직임: 휘어 들어와 자리 잡기, 숨쉬는 편대, 고리를 그리며 내리꽂기."""
from __future__ import annotations

import math
import random

from core import H, W

COLS, ROWS = 8, 4
GAP_X, GAP_Y = 14, 11
KINDS = ['bug_c', 'bug_b', 'bug_b', 'bug_a']      # 위 줄부터
POINTS = {'bug_c': 80, 'bug_b': 50, 'bug_a': 30}
HP = {'bug_c': 2, 'bug_b': 1, 'bug_a': 1}


def slot(e: dict, t: int) -> tuple[float, float]:
    """편대 자리: 좌우로 흔들리고 숨쉬듯 벌어졌다 오므린다."""
    breathe = 1 + 0.08 * math.sin(t / 40)
    cx = W / 2 + 18 * math.sin(t / 70)
    return (cx + (e['c'] - (COLS - 1) / 2) * GAP_X * breathe - 4,
            14 + e['r'] * GAP_Y * (1 + 0.05 * math.sin(t / 40)))


def bezier(p0, p1, p2, k: float) -> tuple[float, float]:
    a = (1 - k) ** 2
    b = 2 * (1 - k) * k
    c = k * k
    return (a * p0[0] + b * p1[0] + c * p2[0], a * p0[1] + b * p1[1] + c * p2[1])


def make_wave(wave: int) -> list[dict]:
    enemies = []
    for r in range(ROWS):
        side = r % 2
        for c in range(COLS):
            kind = KINDS[r]
            enemies.append({
                'r': r, 'c': c, 'kind': kind, 'hp': HP[kind], 'mode': 'enter', 'x': -20.0, 'y': -20.0,
                'k': -(r * 70 + c * 7) / 90,        # 0이 되면 들어오기 시작
                'from': (-12.0 if side == 0 else W + 4.0, 30.0 + r * 6),
                'via': (W / 2 + (-70 if side == 0 else 70), 150.0),
                'hit': 0, 'shots': 0, 'dk': 0.0, 'aim': 0.0,
            })
    return enemies


def step(e: dict, t: int, ship_x: float, wave: int, rnd: random.Random) -> list[tuple[float, float, float, float]]:
    """한 틱. 새 적 총알 [(x, y, vx, vy)]를 돌려준다."""
    bullets = []
    if e['hit']:
        e['hit'] -= 1
    speed = 1 + wave * 0.12
    if e['mode'] == 'enter':
        e['k'] += speed / 90
        if e['k'] < 0:
            return bullets
        sx, sy = slot(e, t)
        k = min(1.0, e['k'])
        e['x'], e['y'] = bezier(e['from'], e['via'], (sx, sy), k)
        if k >= 1:
            e['mode'] = 'home'
    elif e['mode'] == 'home':
        e['x'], e['y'] = slot(e, t)
    elif e['mode'] == 'dive':
        e['dk'] += 1 / 60
        dk = e['dk']
        if dk < 0.6:  # 위로 작은 고리를 그리며 몸을 뒤집는다
            a = dk / 0.6 * math.pi * 1.5
            e['x'] = e['ox'] + e['dir'] * (1 - math.cos(a)) * 10
            e['y'] = e['oy'] - math.sin(a) * 10
        else:
            e['aim'] += (ship_x - e['x']) * 0.015 * speed
            e['aim'] = max(-60.0, min(60.0, e['aim']))
            e['x'] += (e['aim'] + 35 * math.sin(dk * 5)) / 60
            e['y'] += (55 + 18 * wave) * speed / 60 / speed ** 0.5
            if e['shots'] < 1 + wave // 3 and 40 < e['y'] < 90 and rnd.random() < 0.04:
                e['shots'] += 1
                dx, dy = ship_x - e['x'], (H - 10) - e['y']
                d = math.hypot(dx, dy) or 1
                v = 80 + wave * 6
                bullets.append((e['x'] + 4, e['y'] + 8, dx / d * v, dy / d * v))
        if e['y'] > H + 8:
            e['mode'], e['y'] = 'back', -12.0
    elif e['mode'] == 'back':
        sx, sy = slot(e, t)
        e['x'] += (sx - e['x']) * 0.08
        e['y'] += 1.2
        if e['y'] >= sy:
            e['mode'] = 'home'
    return bullets


def start_dive(e: dict, ship_x: float) -> None:
    e['mode'] = 'dive'
    e['dk'] = 0.0
    e['ox'], e['oy'] = e['x'], e['y']
    e['dir'] = -1 if e['x'] > W / 2 else 1
    e['aim'] = 0.0
    e['shots'] = 0
