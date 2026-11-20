"""공용: 화면 크기, 팔레트, 입력, 글자, 기록과 보너스 파일."""
from __future__ import annotations

import json
import os
import time
from pathlib import Path

W, H = 256, 144
SCALE = 4
FPS = 60
DT = 1 / FPS

# PICO-8 16색
PAL = [
    (0, 0, 0), (29, 43, 83), (126, 37, 83), (0, 135, 81),
    (171, 82, 54), (95, 87, 79), (194, 195, 199), (255, 241, 232),
    (255, 0, 77), (255, 163, 0), (255, 236, 39), (0, 228, 54),
    (41, 173, 255), (131, 118, 156), (255, 119, 168), (255, 204, 170),
]
BLACK, NAVY, PLUM, GREEN, BROWN, DGRAY, LGRAY, WHITE = range(8)
RED, ORANGE, YELLOW, LIME, BLUE, LAVENDER, PINK, PEACH = range(8, 16)

GAMES = {
    'jamo': '자모 다섯 칸',
    'runner': '한길 달리기',
    'shooter': '버그 편대 격추',
}

DATA = Path(os.environ.get('DOT_ARCADE_DATA', Path.home() / '.claude' / 'dot-arcade'))


class Input:
    """이번 프레임에 눌린 키, 누르고 있는 키, 뗀 키."""

    def __init__(self) -> None:
        self.held: set[str] = set()
        self.pressed: set[str] = set()
        self.released: set[str] = set()
        self.clicks: list[tuple[int, int]] = []
        self.shift = False

    def begin(self) -> None:
        self.pressed.clear()
        self.released.clear()
        self.clicks.clear()

    def down(self, name: str) -> None:
        if name not in self.held:
            self.pressed.add(name)
        self.held.add(name)

    def up(self, name: str) -> None:
        self.held.discard(name)
        self.released.add(name)

    def any(self, *names: str, held: bool = False) -> bool:
        pool = self.held if held else self.pressed
        return any(n in pool for n in names)


# ── 시각 ────────────────────────────────────────────

DAYS = '월화수목금토일'


def stamp(now: float | None = None) -> str:
    """2026.11.19 (목) 14:02, 한국 시각."""
    t = time.gmtime((now if now is not None else time.time()) + 9 * 3600)
    return f'{t.tm_year}.{t.tm_mon:02d}.{t.tm_mday:02d} ({DAYS[t.tm_wday]}) {t.tm_hour:02d}:{t.tm_min:02d}'


def kst_day(now: float | None = None) -> int:
    return int(((now if now is not None else time.time()) + 9 * 3600) // 86400)


# ── 파일 ────────────────────────────────────────────

def _read(path: Path, default: dict) -> dict:
    try:
        return json.loads(path.read_text(encoding='utf-8'))
    except (OSError, ValueError):
        return default


def _write(path: Path, data: dict) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    tmp = path.with_suffix('.tmp')
    tmp.write_text(json.dumps(data, ensure_ascii=False, indent=2), encoding='utf-8')
    os.replace(tmp, path)


def load_records() -> dict:
    data = _read(DATA / 'records.json', {})
    games = data.get('games', {})
    for gid in GAMES:
        games.setdefault(gid, {'best': 0, 'bestAt': '', 'plays': 0})
    data['games'] = games
    data.setdefault('jamoStreak', 0)
    data.setdefault('jamoLastDay', 0)
    return data


def add_score(game: str, score: int) -> bool:
    """판 수를 올리고 최고 기록이면 바꾼다. 최고 기록이면 True."""
    data = load_records()
    one = data['games'][game]
    one['plays'] = one.get('plays', 0) + 1
    is_best = score > one.get('best', 0)
    if is_best:
        one['best'] = score
        one['bestAt'] = stamp()
    data['updatedAt'] = stamp()
    _write(DATA / 'records.json', data)
    return is_best


def set_streak(day: int, won: bool) -> int:
    data = load_records()
    last = data.get('jamoLastDay', 0)
    if last == day:
        return data['jamoStreak']
    data['jamoStreak'] = (data['jamoStreak'] + 1 if last == day - 1 else 1) if won else 0
    data['jamoLastDay'] = day
    _write(DATA / 'records.json', data)
    return data['jamoStreak']


def load_bonus() -> dict:
    data = _read(DATA / 'bonus.json', {})
    data.setdefault('bonus', 0)
    data.setdefault('awarded', [])
    return data


def change_bonus(delta: int, awarded: list[str] | None = None) -> int:
    data = load_bonus()
    data['bonus'] = max(0, data['bonus'] + delta)
    if awarded:
        data['awarded'] = (data['awarded'] + awarded)[-100:]
    _write(DATA / 'bonus.json', data)
    return data['bonus']


def use_bonus() -> bool:
    if load_bonus()['bonus'] <= 0:
        return False
    change_bonus(-1)
    return True
