"""다른 Claude Code 세션의 상태: mod가 세션마다 ~/.claude/dot-arcade/sessions/<id>.json을 쓴다."""
from __future__ import annotations

import json
import time

from core import DATA, change_bonus, load_bonus


class Watcher:
    def __init__(self) -> None:
        self.since = time.time() * 1000
        self.working = 0
        self.done = 0

    def poll(self) -> list[str]:
        """새로 끝난 세션의 이름 목록. 끝난 세션마다 보너스 1개를 준다(mod와 같이 쓰는 목록으로 중복 방지)."""
        now = time.time() * 1000
        folder = DATA / 'sessions'
        files = []
        try:
            for path in folder.glob('*.json'):
                if now - path.stat().st_mtime * 1000 > 12 * 3600_000:
                    continue
                try:
                    files.append(json.loads(path.read_text(encoding='utf-8')))
                except (OSError, ValueError):
                    pass
        except OSError:
            return []
        self.working = sum(1 for f in files if f.get('state') == 'working' and now - f.get('beat', 0) < 180_000)
        self.done = sum(1 for f in files if f.get('state') == 'done' and now - f.get('at', 0) < 1_800_000)

        awarded = set(load_bonus()['awarded'])
        fresh = [f for f in files
                 if f.get('state') == 'done' and f.get('at', 0) > self.since
                 and f"{f.get('id')}:{f.get('at')}" not in awarded]
        if not fresh:
            return []
        change_bonus(len(fresh), [f"{f.get('id')}:{f.get('at')}" for f in fresh])
        names = []
        for f in fresh:
            topic = f.get('topic') or ''
            names.append(f"{f.get('name', '세션')}: {topic}" if topic else f.get('name', '세션'))
        return names
