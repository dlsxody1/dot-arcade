"""자모 다섯 칸: 두벌식 자판으로 자모를 한 칸씩 친다. Enter 확인, Backspace 지우기, F1 힌트(보너스), F2 새 낱말."""
from __future__ import annotations

import math
import random

import pygame

from core import (BLUE, DGRAY, GREEN, H, LAVENDER, LIME, NAVY, PAL, PINK, RED, SCALE, W, WHITE, YELLOW,
                  add_score, kst_day, load_records, set_streak, use_bonus)
from fx import Juice
from games.jamo_rules import KEYBOARD, WORDS, compose, daily_answer, decompose, judge, key_to_jamo, split_jamo

CELL, PITCH = 13, 15
GX, GY = 18, 20
KX, KY, KP = 118, 30, 13
COLOR = {'hit': GREEN, 'near': 9, 'miss': DGRAY, None: 1}
RANK = {'hit': 3, 'near': 2, 'miss': 1}


class Jamo:
    def __init__(self, app) -> None:
        self.app = app
        self.juice = Juice()
        self.t = 0
        self.today = kst_day()
        done_today = load_records().get('jamoLastDay') == self.today
        self.new_round('practice' if done_today else 'daily')
        if done_today:
            self.msg = '오늘의 낱말은 이미 풀었어요. 연습 판입니다.'

    def new_round(self, mode: str) -> None:
        self.mode = mode
        self.word = daily_answer(self.today) if mode == 'daily' else random.choice(WORDS)
        self.answer = decompose(self.word) or []
        self.rows: list[list[str]] = []
        self.marks: list[list[str]] = []
        self.cur: list[str] = []
        self.pop = [0] * 5
        self.reveal = -1          # 드러나는 중인 줄
        self.reveal_t = 0
        self.shake_t = 0
        self.win_t = -1
        self.done = False
        self.won = False
        self.hints: list[int] = []
        self.msg = '두벌식 자판으로 자모를 한 칸씩 쳐요. 예: 사과 = ㅅ ㅏ ㄱ ㅗ ㅏ'
        self.result = ''

    # ── 입력 ──
    def update(self, inp) -> str | None:
        self.t += 1
        if inp.any('escape'):
            return 'menu'
        if self.shake_t:
            self.shake_t -= 1
        self.pop = [max(0, p - 1) for p in self.pop]
        if self.reveal >= 0:
            self.reveal_t += 1
            if self.reveal_t > 5 * 8 + 14:
                self.finish_reveal()
            return None
        if self.win_t >= 0:
            self.win_t += 1
        for x, y in inp.clicks:
            self.click(x, y)
        if inp.any('f2') or (self.done and inp.any('return', 'space')):
            self.new_round('practice')
            return None
        if self.done:
            return None
        if inp.any('f1'):
            self.hint()
        if inp.any('backspace') and self.cur:
            self.cur.pop()
        if inp.any('return'):
            self.submit()
        for name in inp.pressed:
            j = key_to_jamo(name, inp.shift)
            if j:
                self.type(j)
        return None

    def type(self, j: str) -> None:
        for part in split_jamo(j):  # ㅐ는 ㅏ ㅣ 두 칸
            if len(self.cur) < 5 and not self.done:
                self.cur.append(part)
                self.pop[len(self.cur) - 1] = 8

    def click(self, x: int, y: int) -> None:
        for r, line in enumerate(KEYBOARD):
            for c, j in enumerate(line):
                kx, ky = KX + c * KP + r * 3, KY + r * 16
                if kx <= x < kx + KP - 1 and ky <= y < ky + 14:
                    self.type(j)
        if KY + 66 <= y < KY + 80:
            if KX <= x < KX + 40 and self.cur:
                self.cur.pop()
            elif KX + 44 <= x < KX + 84:
                self.submit()
            elif KX + 88 <= x < KX + 128:
                self.hint()

    def submit(self) -> None:
        if len(self.cur) < 5:
            self.fail('다섯 칸을 다 채워 주세요.')
            return
        word = compose(self.cur)
        if word is None:
            self.fail('두 글자로 묶이지 않아요. 첫 칸은 자음, 둘째 칸은 모음이에요.')
            return
        self.rows.append(self.cur)
        self.marks.append(judge(self.cur, self.answer))
        self.cur = []
        self.reveal, self.reveal_t = len(self.rows) - 1, 0
        self.msg = f'"{word}"'

    def fail(self, text: str) -> None:
        self.shake_t = 18
        self.msg = text
        self.juice.shake.add(0.15)

    def finish_reveal(self) -> None:
        row = self.reveal
        self.reveal = -1
        if all(m == 'hit' for m in self.marks[row]):
            self.done = self.won = True
            self.win_t = 0
            score = (7 - len(self.rows)) * 100
            self.juice.feedback('large', GX + 37, GY + row * PITCH + 6, [LIME, YELLOW, PINK, BLUE, WHITE],
                                f'맞혔어요! +{score}', YELLOW)
            for i in range(5):
                self.juice.parts.burst(GX + i * PITCH + 6, GY + row * PITCH, 10, [LIME, YELLOW, PINK, BLUE],
                                       110, 180, 1.2, up=True, size=2)
            self.juice.anims.play('confetti', GX + 37, GY + row * PITCH + 10)
            self.end(score)
        elif len(self.rows) >= 6:
            self.done = True
            self.juice.feedback('medium', GX + 37, GY + 90, [RED, DGRAY])
            self.end(0)
        else:
            hits = sum(m == 'hit' for m in self.marks[row])
            if hits >= 3:
                self.juice.pops.add(GX + 37, GY + row * PITCH, f'{hits}칸 맞음!', LIME, 18)

    def end(self, score: int) -> None:
        best = add_score('jamo', score)
        streak = set_streak(self.today, self.won) if self.mode == 'daily' else None
        head = f'{len(self.rows)}번 만에! {score}점' if self.won else f'정답은 "{self.word}"'
        tail = f' · 연속 {streak}일' if streak else ''
        self.result = head + tail + (' · 새 최고 기록!' if best else '')
        self.msg = 'Enter: 연습 한 판 더   Esc: 목록'

    def hint(self) -> None:
        if self.done:
            return
        known = {i for marks in self.marks for i, m in enumerate(marks) if m == 'hit'} | set(self.hints)
        left = [i for i in range(5) if i not in known]
        if not left:
            self.msg = '더 알려 줄 칸이 없어요.'
        elif not use_bonus():
            self.msg = '보너스가 없어요. 다른 세션이 끝나면 하나씩 생겨요.'
        else:
            self.hints.append(left[0])
            self.app.bonus = max(0, self.app.bonus - 1)
            self.msg = f'힌트: {left[0] + 1}번째 칸은 {self.answer[left[0]]}'

    # ── 그리기 ──
    def cell_state(self, r: int, c: int) -> tuple[str | None, float, float, str]:
        """(색 표시, 세로 배율, 위로 뜬 정도, 글자)"""
        if r < len(self.rows):
            ch = self.rows[r][c]
            mark = self.marks[r][c]
            if r == self.reveal:
                k = (self.reveal_t - c * 8) / 14
                if k <= 0:
                    return (None, 1.0, 0, ch)
                if k < 1:
                    return (mark if k > 0.5 else None, abs(math.cos(k * math.pi)), 0, ch)
            lift = 0.0
            if self.won and r == len(self.rows) - 1 and self.win_t >= 0:
                k = (self.win_t - c * 5) / 20
                lift = 4 * math.sin(k * math.pi) if 0 < k < 1 else 0
            return (mark, 1.0, lift, ch)
        if r == len(self.rows):
            ch = self.cur[c] if c < len(self.cur) else ''
            return ('typing', 1.0 + self.pop[c] / 40, 0, ch)
        return (None, 1.0, 0, '')

    def draw(self, world: pygame.Surface) -> None:
        world.fill(PAL[NAVY])
        for r in range(6):
            sx = round(math.sin(self.shake_t * 1.3) * 3 * self.shake_t / 18) if r == len(self.rows) else 0
            for c in range(5):
                mark, sy, lift, _ch = self.cell_state(r, c)
                x, y = GX + c * PITCH + sx, GY + r * PITCH - lift
                h = max(1, round(CELL * sy))
                rect = pygame.Rect(x, round(y + (CELL - h) / 2), CELL, h)
                if mark in ('hit', 'near', 'miss'):
                    pygame.draw.rect(world, PAL[COLOR[mark]], rect)
                else:
                    pygame.draw.rect(world, PAL[0], rect)
                    hint = r == len(self.rows) and c in self.hints
                    pygame.draw.rect(world, PAL[YELLOW if hint else (LAVENDER if mark == 'typing' and _ch else DGRAY)], rect, 1)
        best = self.key_marks()
        for r, line in enumerate(KEYBOARD):
            for c, j in enumerate(line):
                kx, ky = KX + c * KP + r * 3, KY + r * 16
                pygame.draw.rect(world, PAL[COLOR[best[j]] if j in best else LAVENDER], (kx, ky, KP - 1, 14))
        for i, color in enumerate([DGRAY, GREEN, 9]):
            pygame.draw.rect(world, PAL[color], (KX + i * 44, KY + 66, 40, 14))
        self.juice.parts.draw(world)
        self.juice.anims.draw(world)

    def key_marks(self) -> dict[str, str]:
        best: dict[str, str] = {}
        for r, (row, marks) in enumerate(zip(self.rows, self.marks)):
            if r == self.reveal:
                continue
            for j, m in zip(row, marks):
                if RANK[m] > RANK.get(best.get(j, ''), 0):
                    best[j] = m
        return best

    def hud(self) -> None:
        a, s = self.app, SCALE
        a.text('자모 다섯 칸', 18 * s, 4, 24, YELLOW)
        mode = '오늘의 낱말' if self.mode == 'daily' else '연습'
        a.text(f'{mode}   보너스 {a.bonus}', W * s - 16, 8, 18, LAVENDER, anchor='topright')
        for r in range(6):
            for c in range(5):
                mark, sy, lift, ch = self.cell_state(r, c)
                if ch and sy > 0.35:
                    x = (GX + c * PITCH + CELL / 2) * s
                    y = (GY + r * PITCH + CELL / 2 - lift) * s
                    a.text(ch, x, y, round(28 * min(1.25, sy)), WHITE, anchor='center', shadow=mark is not None)
                elif r == len(self.rows) and c in self.hints and not ch:
                    a.text(self.answer[c], (GX + c * PITCH + CELL / 2) * s, (GY + r * PITCH + CELL / 2) * s, 24,
                           YELLOW, anchor='center', alpha=120)
            if r < len(self.rows) and r != self.reveal:
                a.text(compose(self.rows[r]) or '', (GX + 5 * PITCH + 2) * s, (GY + r * PITCH + 3) * s, 18, LAVENDER)
        for r, line in enumerate(KEYBOARD):
            for c, j in enumerate(line):
                a.text(j, (KX + c * KP + r * 3 + 6) * s, (KY + r * 16 + 7) * s, 24, WHITE, anchor='center', shadow=False)
        for i, label in enumerate(['지우기', '확인', 'F1 힌트']):
            a.text(label, (KX + i * 44 + 20) * s, (KY + 73) * s, 18, WHITE, anchor='center', shadow=False)
        a.text(self.result, (KX - 2) * s, (KY + 88) * s, 22, LIME if self.won else PINK)
        a.text(self.msg, 18 * s, H * s - 30, 18, WHITE)
        a.text('F2 새 낱말   Esc 목록', W * s - 16, H * s - 30, 16, DGRAY, anchor='topright')
