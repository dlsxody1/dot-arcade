"""게임 고르기 화면. ↑↓ 고르기, Enter/스페이스 시작, 클릭도 된다."""
from __future__ import annotations

import math

import pygame

from core import (BLUE, DGRAY, GAMES, H, LAVENDER, LIME, NAVY, PAL, PINK, SCALE, W, WHITE, YELLOW,
                  load_records)
from fx import Juice
from sprites import sprite

DESC = {
    'jamo': '두 글자 낱말을 자모 다섯 칸으로 풀어 6번 안에 맞히기',
    'runner': '로봇과 오른쪽으로! 버그를 연달아 밟으면 점수가 두 배씩',
    'shooter': '편대를 짓다 내리꽂는 버그를 쏘아 떨어뜨리기',
}
ORDER = ['jamo', 'runner', 'shooter']
ROW_Y = [34, 70, 106]


class Menu:
    def __init__(self, app) -> None:
        self.app = app
        self.juice = Juice()
        self.sel = 1
        self.t = 0
        self.records = load_records()

    def update(self, inp) -> str | None:
        self.t += 1
        if inp.any('escape'):
            return 'quit'
        if inp.any('up', 'w'):
            self.sel = (self.sel - 1) % 3
        if inp.any('down', 's'):
            self.sel = (self.sel + 1) % 3
        for _x, y in inp.clicks:
            for i, ry in enumerate(ROW_Y):
                if ry - 4 <= y < ry + 30:
                    return ORDER[i]
        if inp.any('return', 'space', 'z'):
            return ORDER[self.sel]
        return None

    def draw(self, world: pygame.Surface) -> None:
        world.fill(PAL[NAVY])
        for i in range(30):
            x = (i * 37) % W
            y = (i * 53 + self.t // (2 + i % 3)) % H
            world.set_at((x, y), PAL[DGRAY if i % 2 else LAVENDER])
        for i, gid in enumerate(ORDER):
            y = ROW_Y[i]
            sel = i == self.sel
            box = pygame.Rect(10, y - 4, W - 20, 30)
            pygame.draw.rect(world, PAL[1 if not sel else 2], box)
            pygame.draw.rect(world, PAL[YELLOW if sel else DGRAY], box, 1)
            self.thumb(world, gid, 16, y)

    def thumb(self, world: pygame.Surface, gid: str, x: int, y: int) -> None:
        bob = round(math.sin(self.t / 10) * 1.5)
        pygame.draw.rect(world, PAL[0], (x, y - 1, 44, 24))
        if gid == 'runner':
            world.fill(PAL[BLUE], (x, y - 1, 44, 24))
            for i in range(6):
                world.blit(sprite('grass'), (x + i * 8 - 2, y + 15))
            world.blit(sprite('robot', 1 + (self.t // 6) % 2), (x + 8, y + 7 + bob))
            world.blit(sprite('beetle', (self.t // 10) % 2), (x + 30, y + 7))
            world.blit(sprite('coin', 0), (x + 20, y))
        elif gid == 'shooter':
            for i, name in enumerate(['bug_a', 'bug_b', 'bug_c']):
                world.blit(sprite(name, (self.t // 12) % 2), (x + 4 + i * 13, y + 1 + (bob if i == 1 else 0)))
            world.fill(PAL[WHITE], (x + 21, y + 10 - (self.t // 3) % 6, 1, 2))
            world.blit(sprite('ship', (self.t // 4) % 2), (x + 18, y + 14))
        else:
            colors = [11, 10, 5, 11, 11]
            for i, c in enumerate(colors):
                lift = max(0, round(3 * math.sin((self.t - i * 6) / 8)))
                world.fill(PAL[c], (x + 2 + i * 8, y + 6 - lift, 7, 9))

    def hud(self) -> None:
        a = self.app
        s = SCALE
        a.text('도트 오락실', W * s / 2, 12, 34, YELLOW, anchor='midtop')
        w = a.watcher
        a.text(f'다른 세션  작업 중 {w.working} · 끝남 {w.done}    보너스 {a.bonus}', W * s - 20, 22, 18,
               LIME if w.done else WHITE, anchor='topright')
        for i, gid in enumerate(ORDER):
            y = ROW_Y[i] * s
            rec = self.records['games'][gid]
            sel = i == self.sel
            a.text(GAMES[gid], 66 * s, y - 2, 28, YELLOW if sel else WHITE)
            a.text(DESC[gid], 66 * s, y + 38, 18, WHITE if sel else LAVENDER)
            best = '아직 기록 없음' if rec.get('plays', 0) == 0 else f"내 최고 {rec['best']}점 · {rec['bestAt']}"
            if gid == 'jamo' and rec.get('plays', 0):
                best += f" · 연속 {self.records['jamoStreak']}일"
            a.text(best, W * s - 52, y + 6, 16, PINK if sel else DGRAY, anchor='topright')
        a.text('↑↓ 고르기   Enter 시작   Esc 끝내기', W * s / 2, H * s - 14, 16, LAVENDER, anchor='midbottom')
