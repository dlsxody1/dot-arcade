"""스프라이트: 8x8 글자 그림. 0-f는 PICO-8 색 번호, '.'은 투명."""
from __future__ import annotations

import pygame

from core import PAL

ART: dict[str, list[list[str]]] = {
    # 한길 달리기의 로봇(서 있기, 달리기 2장, 점프)
    'robot': [
        ['...a....', '..cccc..', '.c7777c.', '.c71c1c.', '.cccccc.', '..c66c..', '.c6..6c.', '.5....5.'],
        ['...a....', '..cccc..', '.c7777c.', '.c71c1c.', '.cccccc.', '..c66c..', '..6..c6.', '..5..55.'],
        ['...a....', '..cccc..', '.c7777c.', '.c71c1c.', '.cccccc.', '..c66c..', '.6c..6..', '.55..5..'],
        ['..a.....', '..cccc..', '.c7777c.', '.c71c1c.', 'ccccccc.', 'c.c66c..', '..6..6..', '.5....5.'],
    ],
    'beetle': [
        ['........', '........', '..8888..', '.887788.', '.888888.', '88888888', '.2....2.', '2......2'],
        ['........', '........', '..8888..', '.887788.', '.888888.', '88888888', '..2..2..', '.2....2.'],
    ],
    'squashed': [['........', '........', '........', '........', '........', '........', '.888888.', '28888882']],
    'hopper': [
        ['........', '..b..b..', '.b0bb0b.', '.bbbbbb.', '..3bb3..', '.3bbbb3.', '.3....3.', '33....33'],
        ['..b..b..', '.b0bb0b.', '.bbbbbb.', '..3bb3..', '.3bbbb3.', '3......3', '3......3', '........'],
    ],
    'coin': [
        ['..aaaa..', '.a9aa9a.', 'a9a77a9a', 'a9a7aa9a', 'a9aaaa9a', 'a9aaaa9a', '.a9aa9a.', '..aaaa..'],
        ['...aa...', '..a9aa..', '..a7aa..', '..a7aa..', '..aaaa..', '..aaaa..', '..a9aa..', '...aa...'],
        ['...aa...', '...aa...', '...7a...', '...aa...', '...aa...', '...aa...', '...aa...', '...aa...'],
    ],
    'qblock': [['99999999', '9aa44aa9', '9a4aa4a9', '9aaaa4a9', '9aa44aa9', '9aa4aaa9', '9aaaaaa9', '99a4a999']],
    'used': [['44444444', '4f4444f4', '44444444', '44444444', '44444444', '44444444', '4f4444f4', '44444444']],
    'brick': [['99949994', '44444444', '94999499', '44444444', '99949994', '44444444', '94999499', '44444444']],
    'grass': [['bbbbbbbb', '3b3bb3b3', '34433443', '44444444', '44f44444', '44444444', '4444f444', '44444444']],
    'dirt': [['44444444', '44f44444', '44444444', '44444f44', '44444444', '4f444444', '44444444', '44444444']],
    'flag': [['78888...', '788888..', '78888...', '7.......', '7.......', '7.......', '7.......', '7.......']],
    'heart': [['........', '.88.88..', '8888888.', '8888888.', '.88888..', '..888...', '...8....', '........']],
    # 버그 편대 격추
    'ship': [
        ['...7....', '...c....', '..c7c...', '..c1c...', '.cc7cc..', 'cc7c7cc.', 'c.8.8.c.', '..9.9...'],
        ['...7....', '...c....', '..c7c...', '..c1c...', '.cc7cc..', 'cc7c7cc.', 'c.9.9.c.', '..a.a...'],
    ],
    'bug_a': [
        ['e......e', '.e....e.', '..eeee..', '.e7ee7e.', 'eeeeeeee', 'e.eeee.e', 'e.e..e.e', '...ee...'],
        ['........', 'e......e', '.eeeeee.', '.e7ee7e.', 'eeeeeeee', '..eeee..', '.e.ee.e.', 'e......e'],
    ],
    'bug_b': [
        ['..d..d..', '...dd...', '.dddddd.', 'dd0dd0dd', 'dddddddd', '.d.dd.d.', 'd......d', '.d....d.'],
        ['..d..d..', '...dd...', '.dddddd.', 'dd0dd0dd', 'dddddddd', 'd..dd..d', '.d....d.', '..d..d..'],
    ],
    'bug_c': [
        ['.9....9.', '..9999..', '.999999.', '9a0990a9', '99999999', '.9.99.9.', '9.9..9.9', '........'],
        ['.9....9.', '..9999..', '.999999.', '9a0990a9', '99999999', '9.9999.9', '.9....9.', '9......9'],
    ],
    'power': [['.cccccc.', 'c777777c', 'c7cc7c7c', 'c7c77c7c', 'c7cc7c7c', 'c7c7cc7c', 'c777777c', '.cccccc.']],
}

_cache: dict[tuple[str, int, bool, bool], pygame.Surface] = {}


def frames(name: str) -> int:
    return len(ART[name])


def sprite(name: str, frame: int = 0, flip: bool = False, white: bool = False) -> pygame.Surface:
    """글자 그림을 Surface로. white=True면 번쩍임용 흰 실루엣."""
    key = (name, frame % len(ART[name]), flip, white)
    if key in _cache:
        return _cache[key]
    rows = ART[name][key[1]]
    surf = pygame.Surface((len(rows[0]), len(rows)), pygame.SRCALPHA)
    for y, line in enumerate(rows):
        for x, ch in enumerate(line):
            if ch != '.':
                surf.set_at((x, y), (255, 255, 255) if white else PAL[int(ch, 16)])
    if flip:
        surf = pygame.transform.flip(surf, True, False)
    _cache[key] = surf
    return surf


def scaled(name: str, frame: int, sx: float, sy: float, flip: bool = False, white: bool = False) -> pygame.Surface:
    """늘었다 줄기: 크기를 바꾼 사본."""
    base = sprite(name, frame, flip, white)
    if sx == 1.0 and sy == 1.0:
        return base
    w = max(1, round(base.get_width() * sx))
    h = max(1, round(base.get_height() * sy))
    return pygame.transform.scale(base, (w, h))
