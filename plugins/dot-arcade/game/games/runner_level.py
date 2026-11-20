"""한길 달리기 스테이지 생성. 칸은 8픽셀, 화면 높이 18칸. platformer 스킬의 도달 거리 안에서 만든다."""
from __future__ import annotations

import random
from dataclasses import dataclass, field

T = 8
ROWS = 18
GROUND = 15            # 기본 땅 윗줄
MAX_GAP = 5            # 점프 계산기 도달 약 7칸 → 꼭 지나는 길은 5칸 이하


@dataclass
class Level:
    width: int
    tiles: dict[tuple[int, int], str] = field(default_factory=dict)
    coins: list[list[float]] = field(default_factory=list)       # [x, y]
    enemies: list[dict] = field(default_factory=list)
    flag_x: int = 0
    checkpoint_x: int = 0

    def solid(self, tx: int, ty: int) -> bool:
        if ty < 0:
            return False
        return (tx, ty) in self.tiles


def column(lv: Level, x: int, top: int) -> None:
    lv.tiles[(x, top)] = 'grass'
    for y in range(top + 1, ROWS):
        lv.tiles[(x, y)] = 'dirt'


def coin_arc(lv: Level, x0: int, x1: int, top: int) -> None:
    """구덩이 위에 점프 길을 알려 주는 코인 포물선."""
    n = max(2, x1 - x0)
    for i in range(n + 1):
        k = i / n
        lv.coins.append([(x0 + (x1 - x0) * k) * T + 4, (top - 2.5 - 3.5 * 4 * k * (1 - k)) * T])


def enemy(lv: Level, kind: str, tx: int, top: int) -> None:
    lv.enemies.append({'kind': kind, 'x': tx * T + 1.0, 'y': (top - 1) * T + 0.0, 'vx': -20.0, 'vy': 0.0,
                       'alive': True, 'dead_t': 0, 'cool': 60})


def build(stage: int, seed: int = 0) -> Level:
    rnd = random.Random(seed * 1000 + stage)
    width = 110 + stage * 30
    lv = Level(width=width)
    x = 0
    top = GROUND
    for _ in range(12):
        column(lv, x, top)
        x += 1
    while x < width - 20:
        kind = rnd.choices(
            ['flat', 'pit', 'step', 'blocks', 'bridge', 'stairs'],
            [3, 3 + stage, 2, 3, 1 + stage, 1])[0]
        if kind == 'flat':
            n = rnd.randint(4, 8)
            for i in range(n):
                column(lv, x + i, top)
            if rnd.random() < 0.5 + stage * 0.15:
                enemy(lv, 'hopper' if stage >= 2 and rnd.random() < 0.4 else 'beetle', x + n - 2, top)
            x += n
        elif kind == 'pit':
            gap = rnd.randint(2, min(MAX_GAP - 1, 2 + stage))
            coin_arc(lv, x - 1, x + gap, top)
            x += gap
            column(lv, x, top)
            x += 1
        elif kind == 'step':
            top = max(11, min(GROUND, top + rnd.choice([-2, -1, 1, 2])))
            for i in range(3):
                column(lv, x + i, top)
            x += 3
        elif kind == 'blocks':
            n = 7
            for i in range(n):
                column(lv, x + i, top)
            row = top - 4
            for i in range(1, 6):
                lv.tiles[(x + i, row)] = 'qblock' if i in (2, 4) or rnd.random() < 0.2 else 'brick'
            for i in (1, 5):
                lv.coins.append([(x + i) * T + 4, (row - 1.5) * T])
            if rnd.random() < 0.6:
                enemy(lv, 'beetle', x + 5, top)
            x += n
        elif kind == 'bridge':
            gap = MAX_GAP + 2
            mid = x + gap // 2
            for i in (-1, 0, 1):
                lv.tiles[(mid + i, top - 3)] = 'brick'
            lv.coins.append([mid * T + 4, (top - 5) * T])
            x += gap
            column(lv, x, top)
            x += 1
        elif kind == 'stairs':
            for i in range(4):
                column(lv, x + i, top)
                for h in range(i + 1):
                    lv.tiles[(x + i, top - 1 - h)] = 'brick'
            x += 4
            top = max(11, top - 1)
            for i in range(2):
                column(lv, x + i, top)
            x += 2
        if lv.checkpoint_x == 0 and x > width // 2:
            lv.checkpoint_x = x * T
    while x < width:
        column(lv, x, top)
        x += 1
    lv.flag_x = (width - 8) * T
    if lv.checkpoint_x == 0:
        lv.checkpoint_x = width // 2 * T
    return lv


def ground_top(lv: Level, tx: int) -> int | None:
    for ty in range(ROWS):
        if lv.tiles.get((tx, ty)) == 'grass':
            return ty
    return None


def step_enemy(lv: Level, e: dict, player_x: float) -> None:
    """버그 한 마리를 한 틱 움직인다. 딱정벌레는 낭떠러지에서 돌아서고, 메뚜기는 로봇 쪽으로 뛴다."""
    if e['kind'] == 'hopper':
        e['cool'] -= 1
        if e['cool'] <= 0 and e['vy'] == 0:
            e['vy'], e['cool'] = -150.0, 80
            e['vx'] = -35.0 if player_x < e['x'] else 35.0
    nx = e['x'] + e['vx'] / 60
    ahead = int((nx + (0 if e['vx'] < 0 else 7)) // T)
    foot = int((e['y'] + 8) // T)
    wall = lv.solid(ahead, int((e['y'] + 4) // T))
    edge = e['kind'] == 'beetle' and not lv.solid(ahead, foot)
    if wall or edge:
        e['vx'] = -e['vx']
    else:
        e['x'] = nx
    e['vy'] = min(e['vy'] + 600 / 60, 200)
    e['y'] += e['vy'] / 60
    if lv.solid(int((e['x'] + 4) // T), int((e['y'] + 8) // T)):
        e['y'] = int((e['y'] + 8) // T) * T - 8
        e['vy'] = 0.0
        if e['kind'] == 'hopper' and e['cool'] > 40:
            e['vx'] = 0.0
    if e['y'] > ROWS * T + 16:
        e['alive'] = False
