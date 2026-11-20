"""연출(game-feel 스킬): 흔들림, 히트스톱, 늘었다 줄기, 파티클, 글자 팝, 화면 번쩍임."""
from __future__ import annotations

import math
import random

from core import DT, PAL, WHITE

TIERS = {
    #          trauma 멈춤(프레임) 파티클
    'small': (0.15, 0, 4),
    'medium': (0.4, 3, 10),
    'large': (0.85, 8, 28),
}


def ease_out_back(k: float) -> float:
    c1 = 1.70158
    c3 = c1 + 1
    m = k - 1
    return 1 + c3 * m * m * m + c1 * m * m


def ease_out_cubic(k: float) -> float:
    return 1 - (1 - k) ** 3


class Shake:
    """흔들림 = trauma^2. 실제 시간으로 감쇠해서 멈춤 중에도 계속 줄어든다."""

    def __init__(self, decay: float = 1.3, max_off: tuple[int, int] = (6, 4), strength: float = 1.0):
        self.trauma = 0.0
        self.decay = decay
        self.max_off = max_off
        self.strength = strength
        self.t = 0.0

    def add(self, amount: float) -> None:
        self.trauma = min(1.0, self.trauma + amount)

    def offset(self) -> tuple[int, int]:
        if self.trauma <= 0:
            return (0, 0)
        self.trauma = max(0.0, self.trauma - self.decay * DT)
        self.t += DT * 30
        s = self.trauma * self.trauma * self.strength
        return (round(self.max_off[0] * s * math.sin(self.t * 1.7)),
                round(self.max_off[1] * s * math.sin(self.t * 2.3)))


class HitStop:
    """로직 업데이트만 몇 프레임 건너뛴다. 겹치면 긴 쪽을 남긴다."""

    def __init__(self) -> None:
        self.frames = 0

    def hit(self, frames: int) -> None:
        self.frames = max(self.frames, frames)

    def tick(self) -> bool:
        if self.frames > 0:
            self.frames -= 1
            return True
        return False


class Squash:
    """착지하면 납작, 점프하면 길쭉하게 시작해 1.0으로 튕겨 돌아온다."""

    def __init__(self, dur: float = 0.2) -> None:
        self.dur = dur
        self.e = dur
        self.start = (1.0, 1.0)

    def kick(self, sx: float, sy: float) -> None:
        self.start = (sx, sy)
        self.e = 0.0

    def scale(self) -> tuple[float, float]:
        if self.e >= self.dur:
            return (1.0, 1.0)
        self.e += DT
        k = ease_out_back(min(1.0, self.e / self.dur))
        return (self.start[0] + (1 - self.start[0]) * k, self.start[1] + (1 - self.start[1]) * k)


class Particles:
    def __init__(self) -> None:
        self.items: list[list[float]] = []  # x, y, vx, vy, life, max_life, color, gravity, size

    def burst(self, x: float, y: float, n: int, colors: list[int], speed: float = 60,
              gravity: float = 200, life: float = 0.5, up: bool = False, size: int = 1) -> None:
        for _ in range(n):
            a = random.uniform(-math.pi, 0) if up else random.uniform(0, math.tau)
            v = random.uniform(speed * 0.3, speed)
            lf = random.uniform(life * 0.5, life)
            self.items.append([x, y, math.cos(a) * v, math.sin(a) * v, lf, lf,
                               random.choice(colors), gravity, size])

    def update(self) -> None:
        alive = []
        for p in self.items:
            p[2] *= 0.98
            p[3] += p[7] * DT
            p[0] += p[2] * DT
            p[1] += p[3] * DT
            p[4] -= DT
            if p[4] > 0:
                alive.append(p)
        self.items = alive

    def draw(self, surf, cam_x: float = 0) -> None:
        for x, y, _vx, _vy, life, max_life, color, _g, size in self.items:
            s = size if life > max_life * 0.4 else 1
            surf.fill(PAL[color], (round(x - cam_x), round(y), s, s))


class Popups:
    """떠오르며 사라지는 글자("+100"). 위치는 논리 좌표, 그리기는 창 위(HUD)에서."""

    def __init__(self) -> None:
        self.items: list[dict] = []

    def add(self, x: float, y: float, text: str, color: int = WHITE, size: int = 20, life: float = 0.8) -> None:
        self.items.append({'x': x + random.uniform(-3, 3), 'y': y, 'text': text, 'color': color,
                           'size': size, 'life': life, 'max': life})

    def update(self) -> None:
        for p in self.items:
            p['life'] -= DT
        self.items = [p for p in self.items if p['life'] > 0]


class Flash:
    """화면 전체 번쩍임. 1초에 3번을 넘지 않는다(WCAG 2.3.1)."""

    def __init__(self) -> None:
        self.frames = 0
        self.color = WHITE
        self.recent: list[int] = []
        self.clock = 0

    def hit(self, frames: int = 3, color: int = WHITE) -> None:
        self.recent = [t for t in self.recent if self.clock - t < 60]
        if len(self.recent) >= 3:
            return
        self.recent.append(self.clock)
        self.frames = frames
        self.color = color

    def tick(self) -> None:
        self.clock += 1
        if self.frames > 0:
            self.frames -= 1


class Juice:
    """한 곳에서 단계별 연출을 터뜨린다."""

    def __init__(self) -> None:
        self.shake = Shake()
        self.stop = HitStop()
        self.parts = Particles()
        self.pops = Popups()
        self.flash = Flash()

    def feedback(self, tier: str, x: float, y: float, colors: list[int], text: str | None = None,
                 text_color: int = WHITE, flash: bool = False) -> None:
        trauma, stop, n = TIERS[tier]
        self.shake.add(trauma)
        if stop:
            self.stop.hit(stop)
        if n:
            self.parts.burst(x, y, n, colors, speed=40 + n * 3)
        if text:
            self.pops.add(x, y - 4, text, text_color, size=16 if tier == 'small' else 22)
        if flash:
            self.flash.hit(2 if tier == 'medium' else 4)

    def tick_visual(self) -> None:
        self.parts.update()
        self.pops.update()
        self.flash.tick()
