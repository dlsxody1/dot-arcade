"""한길 달리기: 오른쪽으로만 가는 도트 발판 게임. 3스테이지, 버그 밟기 연속 점수, 상자 코인."""
from __future__ import annotations

import math
import random

import pygame

from core import (BLACK, BLUE, BROWN, DGRAY, GREEN, H, LIME, ORANGE, PAL, PEACH, RED, SCALE, W, WHITE,
                  YELLOW, add_score, use_bonus)
from fx import Juice, Squash
from games.runner_level import ROWS, T, build, ground_top, step_enemy
from games.runner_player import PH, PW, Player
from sprites import scaled, sprite

STAGES = 3
TIME = 200


class Runner:
    def __init__(self, app) -> None:
        self.app = app
        self.juice = Juice()
        self.seed = random.randint(0, 9999)
        self.score = 0
        self.coins = 0
        self.lives = 3
        self.shield = use_bonus()
        self.stage = 1
        self.best_msg = ''
        self.start_stage()

    def start_stage(self, from_checkpoint: bool = False) -> None:
        if not from_checkpoint:
            self.lv = build(self.stage, self.seed)
            self.check = 2 * T
            self.bumps: dict[tuple[int, int], int] = {}
            self.coin_fx: list[list[float]] = []
        gt = ground_top(self.lv, int(self.check // T)) or 15
        self.p = Player(self.check, gt * T - PH)
        self.squash = Squash()
        self.cam_x = max(0.0, self.check - 60)
        self.state = 'intro'
        self.timer = 0
        self.time_left = TIME * 60
        self.combo = 0
        self.safe = 60

    # ── 진행 ──
    def update(self, inp) -> str | None:
        if inp.any('escape'):
            return 'menu'
        self.timer += 1
        if self.state in ('over', 'win'):
            if self.timer > 40 and inp.any('space', 'return', 'z'):
                return 'runner'
            return None
        if self.state == 'intro':
            if self.timer == 1:
                self.juice.pops.add(self.cam_x + W / 2, H / 2 - 10, f'스테이지 {self.stage}', YELLOW, 34, 1.2)
            if self.timer > 50:
                self.state, self.timer = 'play', 0
            return None
        if self.state == 'dead':
            self.p.vy += 600 / 60
            self.p.y += self.p.vy / 60
            if self.timer > 90:
                self.lives -= 1
                if self.lives <= 0:
                    self.finish('over')
                else:
                    self.start_stage(from_checkpoint=True)
            return None
        if self.state == 'clear':
            if self.time_left > 0:
                step = min(self.time_left, 120)
                self.time_left -= step
                self.score += step // 60 * 5
            if self.timer % 12 == 0:
                fx = self.lv.flag_x + random.randint(-40, 40)
                self.juice.parts.burst(fx, random.randint(20, 70), 18, [RED, YELLOW, PEACH, LIME, BLUE], 70, 60, 0.9)
            if self.timer > 150:
                if self.stage >= STAGES:
                    self.finish('win')
                else:
                    self.stage += 1
                    self.start_stage()
            return None
        self.play(inp)
        return None

    def play(self, inp) -> None:
        p = self.p
        jump_keys = ('space', 'z', 'up', 'w')
        p.update(self.lv, inp.any('left', 'a', held=True), inp.any('right', 'd', held=True),
                 inp.any(*jump_keys), inp.any(*jump_keys, held=True),
                 any(k in inp.released for k in jump_keys), self.cam_x)
        self.time_left -= 1
        if self.safe:
            self.safe -= 1
        for ev in p.events:
            self.on_event(ev)
        if p.on_ground and p.events.count('land') == 0 and abs(p.vx) > 70 and self.timer % 7 == 0:
            self.juice.parts.burst(p.x + 3 - p.facing * 3, p.y + PH, 1, [PEACH, WHITE], 20, -20, 0.3)
        if p.on_ground:
            self.combo = 0
        target = p.x - 96
        self.cam_x = max(self.cam_x, min(target, self.lv.width * T - W))
        self.update_coins()
        self.update_enemies()
        if p.y > H + 8 or self.time_left <= 0:
            self.die(fell=True)
        if p.x >= self.lv.flag_x and self.state == 'play':
            self.state, self.timer = 'clear', 0
            self.juice.feedback('large', p.x, p.y, [YELLOW, WHITE, LIME], '도착!', YELLOW)
        if p.x > self.lv.checkpoint_x and self.check < self.lv.checkpoint_x:
            self.check = self.lv.checkpoint_x
            self.juice.pops.add(p.x, p.y - 10, '중간 지점', LIME, 18)

    def on_event(self, ev: str) -> None:
        p = self.p
        if ev == 'jump':
            self.squash.kick(0.7, 1.35)
            self.juice.parts.burst(p.x + 3, p.y + PH, 3, [WHITE, PEACH], 30, 50, 0.3, up=True)
        elif ev == 'land':
            heavy = p.fall_speed > 150
            self.squash.kick(1.45 if heavy else 1.25, 0.6 if heavy else 0.75)
            self.juice.parts.burst(p.x + 3, p.y + PH, 6 if heavy else 3, [WHITE, PEACH], 40, 60, 0.35, up=True)
            if heavy:
                self.juice.shake.add(0.2)
        elif ev.startswith('bump:'):
            tx, ty = map(int, ev[5:].split(','))
            kind = self.lv.tiles.get((tx, ty))
            self.bumps[(tx, ty)] = 10
            if kind == 'qblock':
                self.lv.tiles[(tx, ty)] = 'used'
                self.coins += 1
                self.score += 10
                self.coin_fx.append([tx * T, ty * T - 8, -180.0, 0])
                self.juice.feedback('small', tx * T + 4, ty * T - 4, [YELLOW, ORANGE], '+10', YELLOW)
            else:
                self.juice.parts.burst(tx * T + 4, ty * T, 3, [ORANGE, BROWN], 40, 200, 0.4, up=True)
            for e in self.lv.enemies:
                if e['alive'] and abs(e['x'] + 3 - (tx * T + 4)) < 8 and abs(e['y'] + 8 - ty * T) < 3:
                    self.kill(e, 100)

    def update_coins(self) -> None:
        p = self.p
        keep = []
        for c in self.lv.coins:
            if abs(c[0] - (p.x + 3)) < 7 and abs(c[1] - (p.y + 3)) < 7:
                self.coins += 1
                self.score += 10
                self.juice.feedback('small', c[0], c[1], [YELLOW, WHITE], '+10', YELLOW)
            else:
                keep.append(c)
        self.lv.coins = keep
        for c in self.coin_fx:
            c[2] += 700 / 60
            c[1] += c[2] / 60
            c[3] += 1
        self.coin_fx = [c for c in self.coin_fx if c[3] < 24]
        for k in list(self.bumps):
            self.bumps[k] -= 1
            if self.bumps[k] <= 0:
                del self.bumps[k]

    def update_enemies(self) -> None:
        p = self.p
        for e in self.lv.enemies:
            if not e['alive']:
                e['dead_t'] += 1
                continue
            if e['x'] > self.cam_x + W + 16:
                continue
            step_enemy(self.lv, e, p.x)
            overlap = p.x < e['x'] + 7 and p.x + PW > e['x'] + 1 and p.y < e['y'] + 8 and p.y + PH > e['y'] + 2
            if not overlap or self.state != 'play':
                continue
            if p.vy > 0 and p.y + PH - e['y'] < 5:
                self.combo += 1
                self.kill(e, 100 * 2 ** min(self.combo - 1, 4))
                p.vy = -210 if 'space' in self.app.inp.held or 'z' in self.app.inp.held else -140
                self.squash.kick(1.3, 0.7)
            elif self.safe == 0:
                self.hurt()

    def kill(self, e: dict, points: int) -> None:
        e['alive'] = False
        self.score += points
        tier = 'large' if points >= 400 else 'medium'
        self.juice.feedback(tier, e['x'] + 4, e['y'] + 4, [RED, ORANGE, WHITE] if e['kind'] == 'beetle'
                            else [LIME, GREEN, WHITE], f'+{points}', WHITE if points < 400 else YELLOW)

    def hurt(self) -> None:
        if self.shield:
            self.shield = False
            self.safe = 90
            self.juice.feedback('medium', self.p.x + 3, self.p.y + 3, [BLUE, WHITE], '방패!', BLUE, flash=True)
            return
        self.die()

    def die(self, fell: bool = False) -> None:
        if self.state != 'play':
            return
        self.state, self.timer = 'dead', 0
        self.p.vy = -220.0 if not fell else -260.0
        if fell:
            self.p.y = H - 4
        self.juice.feedback('large', self.p.x + 3, min(self.p.y, H - 8), [RED, WHITE, BLUE], flash=True)

    def finish(self, state: str) -> None:
        self.state, self.timer = state, 0
        if add_score('runner', self.score):
            self.best_msg = '새 최고 기록!'

    # ── 그리기 ──
    def draw(self, world: pygame.Surface) -> None:
        cam = int(self.cam_x)
        world.fill(PAL[BLUE])
        for i in range(6):
            cx = (i * 70 - cam * 0.2) % (W + 60) - 30
            for dx, dy, r in ((0, 0, 6), (7, -3, 7), (14, 0, 6)):
                pygame.draw.circle(world, PAL[WHITE], (round(cx + dx), 24 + (i % 3) * 10 + dy), r)
        for layer, color, base, amp, speed in ((0, GREEN, 104, 18, 0.3), (1, 3, 116, 10, 0.55)):
            pts = [(x, base - amp * abs(math.sin((x + cam * speed) / (40 + layer * 20)))) for x in range(0, W + 1, 4)]
            pygame.draw.polygon(world, PAL[LIME if layer == 0 else color], [(0, H)] + pts + [(W, H)])
        first = cam // T
        for tx in range(first - 1, first + W // T + 2):
            for ty in range(ROWS):
                kind = self.lv.tiles.get((tx, ty))
                if kind:
                    off = self.bumps.get((tx, ty), 0)
                    world.blit(sprite(kind), (tx * T - cam, ty * T - (3 * math.sin(off / 10 * math.pi) if off else 0)))
        fx = self.lv.flag_x - cam
        world.fill(PAL[WHITE], (fx + 3, 40, 1, 80))
        world.blit(sprite('flag'), (fx + 3, 40 + 2 * math.sin(self.timer / 8)))
        spin = (self.app.frame // 6) % 4
        for c in self.lv.coins:
            world.blit(sprite('coin', [0, 1, 2, 1][spin]), (c[0] - 4 - cam, c[1] - 4))
        for c in self.coin_fx:
            world.blit(sprite('coin', c[3] // 4 % 3), (c[0] - cam, c[1]))
        for e in self.lv.enemies:
            if e['alive']:
                frame = (self.app.frame // 10) % 2 if e['kind'] == 'beetle' else (0 if e['vy'] == 0 else 1)
                world.blit(sprite(e['kind'], frame, flip=e['vx'] > 0), (e['x'] - cam, e['y']))
            elif e['dead_t'] < 30 and e['kind'] == 'beetle':
                world.blit(sprite('squashed'), (e['x'] - cam, e['y']))
        self.draw_player(world, cam)
        self.juice.parts.draw(world, cam)

    def draw_player(self, world: pygame.Surface, cam: int) -> None:
        p = self.p
        if self.safe and self.state == 'play' and (self.app.frame // 3) % 2:
            return
        if self.state == 'dead':
            frame = 3
        elif not p.on_ground:
            frame = 3
        elif abs(p.vx) > 10:
            frame = 1 + (self.app.frame // 5) % 2
        else:
            frame = 0
        sx, sy = self.squash.scale()
        img = scaled('robot', frame, sx, sy, flip=p.facing < 0)
        x = p.x - 1 + (8 - img.get_width()) / 2 - cam
        world.blit(img, (round(x), round(p.y + PH - img.get_height() + 1)))
        if self.shield:
            r = 7 + math.sin(self.app.frame / 6)
            pygame.draw.circle(world, PAL[BLUE], (round(p.x + 3 - cam), round(p.y + 3)), round(r), 1)

    def hud(self) -> None:
        a = self.app
        a.text(f'점수 {self.score:05d}', 16, 10, 22)
        a.text(f'코인 {self.coins}', 230, 10, 22, YELLOW)
        a.text('♥' * max(0, self.lives), 380, 8, 24, RED)
        a.text(f'스테이지 {self.stage}/{STAGES}', 560, 10, 22)
        a.text(f'시간 {max(0, self.time_left) // 60}', W * SCALE - 16, 10, 22, anchor='topright')
        if a.bonus and self.state == 'intro':
            a.text(f'보너스 {a.bonus}개 남음', W * SCALE - 16, 44, 16, BLUE, anchor='topright')
        if self.state == 'intro' and self.stage == 1 and self.lives == 3:
            a.text('← → 이동   스페이스/Z 점프(길게 누르면 높이)   버그는 밟기', W * SCALE / 2, H * SCALE - 40, 18,
                   anchor='center')
        if self.state in ('over', 'win'):
            title = '완주!' if self.state == 'win' else '게임 오버'
            a.text(title, W * SCALE / 2, H * SCALE / 2 - 50, 56, YELLOW if self.state == 'win' else RED, anchor='center')
            a.text(f'점수 {self.score}   {self.best_msg}', W * SCALE / 2, H * SCALE / 2 + 20, 28, anchor='center')
            a.text('스페이스: 다시   Esc: 목록', W * SCALE / 2, H * SCALE / 2 + 70, 20, DGRAY if self.timer < 40
                   else WHITE, anchor='center')
