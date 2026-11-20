"""도트 오락실 창. python main.py [--game runner|shooter|jamo] [--frames N --shot out.png --keys 스크립트]"""
from __future__ import annotations

import argparse
import os
import sys

os.environ.setdefault('PYGAME_HIDE_SUPPORT_PROMPT', '1')
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

import pygame  # noqa: E402

from core import FPS, H, PAL, SCALE, W, WHITE, YELLOW, BLACK, Input, load_bonus  # noqa: E402
from fx import ease_out_back  # noqa: E402
from sessions import Watcher  # noqa: E402


class App:
    def __init__(self, args: argparse.Namespace) -> None:
        pygame.init()
        pygame.key.stop_text_input()  # 한글 입력기가 키를 가로채지 않게(자모 게임은 키를 직접 받는다)
        self.window = pygame.display.set_mode((W * SCALE, H * SCALE))
        pygame.display.set_caption('도트 오락실')
        self.world = pygame.Surface((W, H))
        self.clock = pygame.time.Clock()
        self.inp = Input()
        self.fonts: dict[tuple[int, bool], pygame.font.Font] = {}
        self.watcher = Watcher()
        self.banner: list[dict] = []
        self.frame = 0
        self.args = args
        self.script = parse_keys(args.keys)
        self.bonus = load_bonus()['bonus']
        self.scene = self.make(args.game or 'menu')

    # ── 장면 ──
    def make(self, name: str):
        if name == 'runner':
            from games.runner import Runner
            return Runner(self)
        if name == 'shooter':
            from games.shooter import Shooter
            return Shooter(self)
        if name == 'jamo':
            from games.jamo import Jamo
            return Jamo(self)
        from menu import Menu
        return Menu(self)

    # ── 글자 ──
    def font(self, size: int, bold: bool = True) -> pygame.font.Font:
        key = (size, bold)
        if key not in self.fonts:
            path = pygame.font.match_font('malgungothic', bold=bold) or pygame.font.match_font('arial')
            self.fonts[key] = pygame.font.Font(path, size)
        return self.fonts[key]

    def text(self, s: str, x: float, y: float, size: int = 20, color: int = WHITE, anchor: str = 'topleft',
             shadow: bool = True, alpha: int = 255) -> pygame.Rect:
        """창 좌표(픽셀)에 글자를 그린다."""
        f = self.font(size)
        img = f.render(s, True, PAL[color])
        rect = img.get_rect(**{anchor: (round(x), round(y))})
        if shadow:
            sh = f.render(s, True, PAL[BLACK])
            sh.set_alpha(alpha)
            self.window.blit(sh, rect.move(2, 2))
        img.set_alpha(alpha)
        self.window.blit(img, rect)
        return rect

    # ── 루프 ──
    def run(self) -> None:
        while True:
            self.inp.begin()
            for name, is_down in self.script.get(self.frame, []):
                (self.inp.down if is_down else self.inp.up)(name)
            for ev in pygame.event.get():
                if ev.type == pygame.QUIT:
                    return
                if ev.type == pygame.KEYDOWN:
                    self.inp.shift = bool(ev.mod & pygame.KMOD_SHIFT)
                    self.inp.down(pygame.key.name(ev.key))
                elif ev.type == pygame.KEYUP:
                    self.inp.up(pygame.key.name(ev.key))
                elif ev.type == pygame.MOUSEBUTTONDOWN and ev.button == 1:
                    self.inp.clicks.append((ev.pos[0] // SCALE, ev.pos[1] // SCALE))
            if self.frame % 120 == 0:
                self.poll_sessions()

            juice = self.scene.juice
            if not juice.stop.tick():
                nxt = self.scene.update(self.inp)
                if nxt == 'quit':
                    return
                if nxt:
                    self.scene = self.make(nxt)
                    juice = self.scene.juice
            juice.tick_visual()
            self.draw(juice)
            self.frame += 1
            if self.args.frames and self.frame >= self.args.frames:
                if self.args.shot:
                    pygame.image.save(self.window, self.args.shot)
                return
            self.clock.tick(FPS)

    def draw(self, juice) -> None:
        self.world.fill(PAL[BLACK])
        self.scene.draw(self.world)
        if juice.flash.frames > 0:
            self.world.fill(PAL[juice.flash.color], special_flags=pygame.BLEND_RGB_ADD)
        ox, oy = juice.shake.offset()
        self.window.fill(PAL[BLACK])
        self.window.blit(pygame.transform.scale(self.world, (W * SCALE, H * SCALE)), (ox * SCALE, oy * SCALE))
        self.scene.hud()
        cam = getattr(self.scene, 'cam_x', 0)
        for p in juice.pops.items:
            k = 1 - p['life'] / p['max']
            pop = ease_out_back(min(1.0, k * 4))
            size = max(8, round(p['size'] * (0.6 + 0.4 * pop)))
            self.text(p['text'], (p['x'] - cam) * SCALE, (p['y'] - k * 14) * SCALE, size, p['color'],
                      anchor='center', alpha=round(255 * min(1.0, p['life'] / p['max'] * 2)))
        self.draw_banner()
        pygame.display.flip()

    # ── 다른 세션 ──
    def poll_sessions(self) -> None:
        for name in self.watcher.poll():
            self.banner.append({'text': f'「{name}」 세션이 끝났어요!  보너스 +1', 't': 0})
        self.bonus = load_bonus()['bonus']

    def draw_banner(self) -> None:
        if not self.banner:
            return
        b = self.banner[0]
        b['t'] += 1
        total = 240
        k = min(1.0, b['t'] / 20) if b['t'] < total - 20 else max(0.0, (total - b['t']) / 20)
        y = -40 + 52 * ease_out_back(k)
        rect = pygame.Rect(0, 0, W * SCALE - 160, 40)
        rect.midtop = (W * SCALE // 2, round(y))
        pygame.draw.rect(self.window, PAL[1], rect, border_radius=8)
        pygame.draw.rect(self.window, PAL[YELLOW], rect, 3, border_radius=8)
        self.text(b['text'], rect.centerx, rect.centery, 20, YELLOW, anchor='center')
        if b['t'] >= total:
            self.banner.pop(0)


def parse_keys(script: str | None) -> dict[int, list[tuple[str, bool]]]:
    """'30:right+ 90:space+ 100:space-' → 프레임마다 누름(+)과 뗌(-)."""
    out: dict[int, list[tuple[str, bool]]] = {}
    for part in (script or '').split():
        frame, key = part.split(':', 1)
        out.setdefault(int(frame), []).append((key[:-1], key.endswith('+')))
    return out


if __name__ == '__main__':
    ap = argparse.ArgumentParser()
    ap.add_argument('--game', choices=['runner', 'shooter', 'jamo', 'menu'])
    ap.add_argument('--frames', type=int, default=0)
    ap.add_argument('--shot')
    ap.add_argument('--keys')
    App(ap.parse_args()).run()
    pygame.quit()
