"""버그 편대 격추: 아래에서 위로 쏘는 고정 화면 슈팅. 연속 격추 배율, 더블 샷 캡슐, 웨이브마다 빨라진다."""
from __future__ import annotations

import random

import pygame

from core import (BLUE, DGRAY, H, LAVENDER, LIME, NAVY, ORANGE, PAL, PINK, RED, SCALE, W, WHITE, YELLOW,
                  add_score, use_bonus)
from fx import Juice, Squash
from games import shooter_wave as wv
from sprites import scaled, sprite

SHIP_Y = H - 12
COLORS = {'bug_a': [PINK, WHITE], 'bug_b': [LAVENDER, WHITE], 'bug_c': [ORANGE, YELLOW, WHITE]}


class Shooter:
    def __init__(self, app) -> None:
        self.app = app
        self.juice = Juice()
        self.rnd = random.Random()
        self.x = W / 2 - 4
        self.vx = 0.0
        self.shots: list[list[float]] = []
        self.bombs: list[list[float]] = []
        self.caps: list[list[float]] = []
        self.score = 0
        self.lives = 3 + (1 if use_bonus() else 0)
        self.has_bonus = self.lives > 3
        self.wave = 0
        self.t = 0
        self.cool = 0
        self.double = 0
        self.safe = 0
        self.chain = 0
        self.chain_t = 0
        self.state = 'play'
        self.timer = 0
        self.best_msg = ''
        self.tilt = Squash(0.15)
        self.stars = [[self.rnd.uniform(0, W), self.rnd.uniform(0, H), self.rnd.choice([1, 2, 3])] for _ in range(50)]
        self.next_wave()

    def next_wave(self) -> None:
        self.wave += 1
        self.enemies = wv.make_wave(self.wave)
        self.bombs.clear()
        self.juice.pops.add(W / 2, H / 2, f'웨이브 {self.wave}', YELLOW, 34, 1.3)

    def update(self, inp) -> str | None:
        if inp.any('escape'):
            return 'menu'
        self.t += 1
        self.timer += 1
        for s in self.stars:
            s[1] = (s[1] + s[2] * 0.25) % H
        if self.state == 'over':
            if self.timer > 40 and inp.any('space', 'return', 'z'):
                return 'shooter'
            self.step_world()
            return None
        if self.state == 'dead':
            self.step_world()
            if self.timer > 70:
                if self.lives <= 0:
                    self.state, self.timer = 'over', 0
                    if add_score('shooter', self.score):
                        self.best_msg = '새 최고 기록!'
                else:
                    self.state, self.safe, self.x = 'play', 120, W / 2 - 4
            return None
        self.control(inp)
        self.step_world()
        self.collide()
        if all(e['hp'] <= 0 for e in self.enemies):
            bonus = 500 * self.wave
            self.score += bonus
            self.juice.feedback('large', W / 2, 60, [YELLOW, WHITE, LIME], f'클리어! +{bonus}', YELLOW, flash=True)
            self.next_wave()
        return None

    def control(self, inp) -> None:
        want = inp.any('right', 'd', held=True) - inp.any('left', 'a', held=True)
        self.vx += (want * 130 - self.vx) * 0.35
        self.x = max(2.0, min(W - 10.0, self.x + self.vx / 60))
        if want and inp.any('right', 'd', 'left', 'a'):
            self.tilt.kick(0.8, 1.1)
        if self.cool:
            self.cool -= 1
        if self.safe:
            self.safe -= 1
        firing = inp.any('space', 'z', 'up', 'w', held=True) or inp.any('space', 'z', 'up', 'w')
        if firing and self.cool == 0 and len(self.shots) < (8 if self.double else 4):
            self.cool = 8
            xs = [self.x + 1, self.x + 6] if self.double else [self.x + 3.5]
            for sx in xs:
                self.shots.append([sx, SHIP_Y - 2])
            self.juice.parts.burst(self.x + 4, SHIP_Y - 1, 2, [YELLOW, WHITE], 25, 0, 0.12, up=True)
        if self.double:
            self.double -= 1
        if self.chain_t:
            self.chain_t -= 1
        else:
            self.chain = 0

    def step_world(self) -> None:
        for s in self.shots:
            s[1] -= 260 / 60
        self.shots = [s for s in self.shots if s[1] > -4]
        for b in self.bombs:
            b[0] += b[2] / 60
            b[1] += b[3] / 60
        self.bombs = [b for b in self.bombs if -4 < b[1] < H + 4]
        for c in self.caps:
            c[1] += 40 / 60
        self.caps = [c for c in self.caps if c[1] < H + 8]
        every = max(25, 70 - self.wave * 7)
        if self.state == 'play' and self.t % every == 0:
            homes = [e for e in self.enemies if e['hp'] > 0 and e['mode'] == 'home']
            homes.sort(key=lambda e: -e['r'])
            for e in homes[:self.rnd.choice([1, 1, 2]) if self.wave > 1 else 1]:
                if self.rnd.random() < 0.85:
                    wv.start_dive(e, self.x)
        for e in self.enemies:
            if e['hp'] > 0:
                for b in wv.step(e, self.t, self.x, self.wave, self.rnd):
                    if self.state == 'play':
                        self.bombs.append(list(b))

    def collide(self) -> None:
        for e in self.enemies:
            if e['hp'] <= 0 or e['mode'] == 'enter' and e['k'] < 0:
                continue
            for s in self.shots:
                if e['x'] - 1 <= s[0] <= e['x'] + 8 and e['y'] - 1 <= s[1] <= e['y'] + 8:
                    s[1] = -99
                    e['hp'] -= 1
                    e['hit'] = 6
                    if e['hp'] > 0:
                        self.juice.parts.burst(s[0], s[1] + 99, 4, [WHITE, YELLOW], 40, 0, 0.2)
                        self.juice.shake.add(0.08)
                    else:
                        self.kill(e)
                    break
        self.shots = [s for s in self.shots if s[1] > -4]
        if self.safe:
            return
        hit = any(self.x - 1 <= b[0] <= self.x + 8 and SHIP_Y <= b[1] <= SHIP_Y + 8 for b in self.bombs)
        hit = hit or any(e['hp'] > 0 and e['mode'] == 'dive' and abs(e['x'] - self.x) < 6 and abs(e['y'] - SHIP_Y) < 6
                         for e in self.enemies)
        for c in self.caps:
            if abs(c[0] - self.x) < 8 and abs(c[1] - SHIP_Y) < 8:
                c[1] = H + 99
                self.double = 600
                self.juice.feedback('medium', self.x + 4, SHIP_Y, [BLUE, WHITE], '더블 샷!', BLUE)
        if hit:
            self.lives -= 1
            self.state, self.timer = 'dead', 0
            self.bombs.clear()
            self.double = 0
            self.juice.feedback('large', self.x + 4, SHIP_Y + 3, [RED, ORANGE, YELLOW, WHITE], flash=True)
            self.juice.parts.burst(self.x + 4, SHIP_Y + 3, 20, [BLUE, WHITE], 90, 40, 0.9)

    def kill(self, e: dict) -> None:
        diving = e['mode'] in ('dive', 'back')
        self.chain = self.chain + 1 if self.chain_t else 1
        self.chain_t = 40
        mult = min(5, 1 + (self.chain - 1) // 2)
        pts = wv.POINTS[e['kind']] * (2 if diving else 1) * mult
        self.score += pts
        label = f'+{pts}' + (f' x{mult}' if mult > 1 else '')
        tier = 'large' if e['kind'] == 'bug_c' and diving else 'medium' if diving or e['kind'] == 'bug_c' else 'small'
        self.juice.feedback(tier, e['x'] + 4, e['y'] + 4, COLORS[e['kind']], label,
                            YELLOW if mult > 2 or diving else WHITE)
        self.juice.parts.burst(e['x'] + 4, e['y'] + 4, 8, COLORS[e['kind']], 70, 30, 0.5, size=2)
        if self.rnd.random() < 0.07 and not self.double:
            self.caps.append([e['x'], e['y']])

    # ── 그리기 ──
    def draw(self, world: pygame.Surface) -> None:
        world.fill(PAL[0])
        for x, y, layer in self.stars:
            world.set_at((int(x), int(y)), PAL[[NAVY, DGRAY, LAVENDER][layer - 1]])
        for e in self.enemies:
            if e['hp'] <= 0 or (e['mode'] == 'enter' and e['k'] < 0):
                continue
            frame = (self.t // 12 + e['c']) % 2
            world.blit(sprite(e['kind'], frame, white=e['hit'] > 3), (round(e['x']), round(e['y'])))
        for s in self.shots:
            world.fill(PAL[YELLOW], (round(s[0]), round(s[1]), 1, 4))
            world.set_at((round(s[0]), round(s[1])), PAL[WHITE])
        for b in self.bombs:
            pygame.draw.rect(world, PAL[RED if self.t % 6 < 3 else PINK], (round(b[0]) - 1, round(b[1]) - 1, 2, 3))
        for c in self.caps:
            world.blit(sprite('power'), (round(c[0]), round(c[1])))
        if self.state == 'play' and not (self.safe and self.t % 6 < 3):
            sx, sy = self.tilt.scale()
            img = scaled('ship', self.t // 4, sx, sy)
            world.blit(img, (round(self.x + (8 - img.get_width()) / 2), SHIP_Y + 8 - img.get_height()))
            if self.double:
                pygame.draw.circle(world, PAL[BLUE], (round(self.x + 4), SHIP_Y + 4), 7, 1)
        self.juice.parts.draw(world)

    def hud(self) -> None:
        a = self.app
        a.text(f'점수 {self.score:06d}', 16, 10, 22)
        a.text('♥' * max(0, self.lives), 300, 8, 24, RED)
        a.text(f'웨이브 {self.wave}', W * SCALE - 16, 10, 22, anchor='topright')
        if self.chain > 2:
            a.text(f'연속 x{min(5, 1 + (self.chain - 1) // 2)}', W * SCALE / 2, 10, 22, YELLOW, anchor='midtop')
        if self.wave == 1 and self.t < 240:
            a.text('← → 이동   스페이스/Z 누르고 있으면 연사   파란 캡슐은 더블 샷', W * SCALE / 2, H * SCALE - 120, 18,
                   anchor='center')
            if self.has_bonus:
                a.text('보너스로 목숨 +1', W * SCALE / 2, H * SCALE - 150, 18, BLUE, anchor='center')
        if self.state == 'over':
            a.text('게임 오버', W * SCALE / 2, H * SCALE / 2 - 50, 56, RED, anchor='center')
            a.text(f'점수 {self.score}   {self.best_msg}', W * SCALE / 2, H * SCALE / 2 + 20, 28, anchor='center')
            a.text('스페이스: 다시   Esc: 목록', W * SCALE / 2, H * SCALE / 2 + 70, 20,
                   DGRAY if self.timer < 40 else WHITE, anchor='center')
