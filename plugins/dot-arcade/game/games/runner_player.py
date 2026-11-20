"""한길 달리기의 로봇 조작. 수치는 platformer 스킬의 jump_tuner.py로 구했다
(높이 3.5칸, 꼭대기 0.35초, 8px 칸, 60Hz, 낙하 중력 x1.8): 상승 457, 낙하 823, 점프 -160 px/s."""
from __future__ import annotations

from core import DT
from games.runner_level import T, Level

RISE_G = 457.0
FALL_G = 823.0
JUMP_V = -160.0
JUMP_CUT = 0.5
APEX_HANG = 0.5
APEX_V = 0.4 * 160
MAX_FALL = 200.0
RUN = 92.0
ACCEL = 1100.0
AIR = 0.65
FRICTION = 900.0
COYOTE = 6
BUFFER = 7
NEVER = -10 ** 9
PW, PH = 6, 7          # 몸 크기(스프라이트 8x8 안)


class Player:
    def __init__(self, x: float, y: float) -> None:
        self.x, self.y = x, y
        self.vx = self.vy = 0.0
        self.on_ground = False
        self.facing = 1
        self.tick = 0
        self.last_ground = NEVER
        self.last_press = NEVER
        self.events: list[str] = []      # 'jump', 'land', 'bump:<tx>,<ty>'
        self.fall_speed = 0.0

    def update(self, lv: Level, left: bool, right: bool, press: bool, held: bool, release: bool,
               min_x: float) -> None:
        self.events.clear()
        self.tick += 1
        want = (1 if right else 0) - (1 if left else 0)
        accel = ACCEL * (1 if self.on_ground else AIR)
        if want:
            self.vx += want * accel * DT
            self.vx = max(-RUN, min(RUN, self.vx))
            self.facing = want
        elif self.on_ground:
            dec = FRICTION * DT
            self.vx = 0.0 if abs(self.vx) <= dec else self.vx - dec * (1 if self.vx > 0 else -1)

        if self.on_ground and self.vy >= 0:
            self.last_ground = self.tick
        if press:
            self.last_press = self.tick
        if self.tick - self.last_press <= BUFFER and self.tick - self.last_ground <= COYOTE:
            self.vy = JUMP_V
            self.last_press = self.last_ground = NEVER
            self.on_ground = False
            self.events.append('jump')
            if not held:
                self.vy *= JUMP_CUT
        if release and self.vy < 0:
            self.vy *= JUMP_CUT

        g = FALL_G if self.vy > 0 else RISE_G
        if held and abs(self.vy) < APEX_V:
            g *= APEX_HANG
        # 반스텝 적분(계산기의 --integrator half와 같은 꼭대기 높이)
        v0 = self.vy
        self.vy = min(self.vy + g * DT, MAX_FALL)
        dy = (v0 + self.vy) / 2 * DT

        self.move_x(lv, self.vx * DT, min_x)
        self.move_y(lv, dy)

    def boxes(self, lv: Level, x: float, y: float) -> list[tuple[int, int]]:
        out = []
        for tx in range(int(x // T), int((x + PW - 0.01) // T) + 1):
            for ty in range(int(y // T), int((y + PH - 0.01) // T) + 1):
                if lv.solid(tx, ty):
                    out.append((tx, ty))
        return out

    def move_x(self, lv: Level, dx: float, min_x: float) -> None:
        self.x += dx
        if self.x < min_x:
            self.x, self.vx = min_x, 0.0
        for tx, _ in self.boxes(lv, self.x, self.y):
            if dx > 0:
                self.x = tx * T - PW
            elif dx < 0:
                self.x = (tx + 1) * T
            self.vx = 0.0

    def move_y(self, lv: Level, dy: float) -> None:
        was_ground = self.on_ground
        self.y += dy
        self.on_ground = False
        hits = self.boxes(lv, self.x, self.y)
        if not hits:
            if self.vy > 0:
                self.fall_speed = self.vy
            return
        if dy > 0:
            self.y = min(ty for _, ty in hits) * T - PH
            self.on_ground = True
            if not was_ground:
                self.events.append('land')
            self.vy = 0.0
        elif dy < 0:
            # 천장 모서리 보정: 3px 안에서 걸쳤으면 옆으로 밀어 통과
            for nudge in (1, -1, 2, -2, 3, -3):
                if not self.boxes(lv, self.x + nudge, self.y):
                    self.x += nudge
                    return
            ty = max(ty for _, ty in hits)
            self.y = (ty + 1) * T
            self.vy = 0.0
            cx = int((self.x + PW / 2) // T)
            target = min(hits, key=lambda h: abs(h[0] - cx))
            self.events.append(f'bump:{target[0]},{target[1]}')
