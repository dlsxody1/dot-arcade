"""Codex 세션의 작업 중/끝남을 도트 오락실에 알린다(파이썬 표준 라이브러리만).

Codex가 이 스크립트를 부르면 ~/.claude/dot-arcade/sessions/codex-<세션>.json 을 쓴다.
큰 창 게임과 Claude Code의 /arcade 창이 이 폴더를 읽어 "다른 세션 끝남" 알림과 보너스를 준다.

두 가지로 불린다.
- Codex 훅(hooks.json): stdin으로 JSON 하나. hook_event_name이
  UserPromptSubmit → 작업 중, PostToolUse → 작업 중(살아 있음 갱신), Stop → 끝남, SessionEnd → 닫힘.
- Codex notify(config.toml): 마지막 인자로 JSON 하나. type이 agent-turn-complete → 끝남.
"""
from __future__ import annotations

import json
import os
import sys
import time
from pathlib import Path

DATA = Path(os.environ.get('DOT_ARCADE_DATA', Path.home() / '.claude' / 'dot-arcade'))

# 훅 이벤트 → 세션 상태
HOOK_STATE = {
    'UserPromptSubmit': 'working',
    'PostToolUse': 'working',
    'Stop': 'done',
    'SessionEnd': 'ended',
}


def label_of(cwd: str) -> str:
    """세션 이름: 'Codex · 폴더 이름'."""
    name = Path(cwd.rstrip('/\\')).name if cwd else ''
    return f'Codex · {name}' if name else 'Codex'


def topic_of(text: object) -> str:
    """주제 한 줄: 첫 줄 24자."""
    if isinstance(text, list):
        text = next((t for t in text if isinstance(t, str) and t.strip()), '')
    if not isinstance(text, str):
        return ''
    line = next((ln.strip() for ln in text.splitlines() if ln.strip()), '')
    return line[:24]


def event_of(argv: list[str], stdin_text: str) -> tuple[str, str, str, str] | None:
    """(세션 id, 상태, cwd, 주제). 모르는 이벤트면 None."""
    if len(argv) > 1 and argv[-1].lstrip().startswith('{'):  # notify
        try:
            data = json.loads(argv[-1])
        except ValueError:
            return None
        if data.get('type') != 'agent-turn-complete':
            return None
        sid = str(data.get('thread-id') or 'unknown')
        return sid, 'done', str(data.get('cwd') or ''), topic_of(data.get('input-messages'))
    try:
        data = json.loads(stdin_text or '{}')
    except ValueError:
        return None
    state = HOOK_STATE.get(str(data.get('hook_event_name')))
    if state is None:
        return None
    sid = str(data.get('session_id') or 'unknown')
    return sid, state, str(data.get('cwd') or ''), topic_of(data.get('prompt'))


def write_state(sid: str, state: str, cwd: str, topic: str, now_ms: int | None = None) -> Path:
    """세션 파일을 쓴다. 주제는 처음 받은 것을 지키고, 작업 중이 이어지면 시작 시각(at)은 그대로 둔다."""
    now = int(time.time() * 1000) if now_ms is None else now_ms
    safe = ''.join(c if c.isalnum() or c in '-_' else '_' for c in sid)[:80]
    path = DATA / 'sessions' / f'codex-{safe}.json'
    try:
        prev = json.loads(path.read_text(encoding='utf-8'))
    except (OSError, ValueError):
        prev = {}
    same_run = prev.get('state') == 'working' and state == 'working'
    record = {
        'id': f'codex-{safe}',
        'name': prev.get('name') or label_of(cwd),
        'topic': prev.get('topic') or topic,
        'state': state,
        'at': prev.get('at', now) if same_run else now,
        'beat': now,
    }
    path.parent.mkdir(parents=True, exist_ok=True)
    tmp = path.with_suffix('.tmp')
    tmp.write_text(json.dumps(record, ensure_ascii=False), encoding='utf-8')
    tmp.replace(path)
    return path


def hooks_json(script: Path, python: str) -> str:
    """~/.codex/hooks.json 에 넣을 내용. 경로는 이 스크립트의 실제 위치로 채운다."""
    # 빗금(/)으로 적어 JSON에서 역빗금을 겹쳐 쓰지 않게 한다(Windows도 이 경로를 읽는다)
    command = f'"{python.replace(chr(92), "/")}" "{script.as_posix()}"'
    entry = [{'hooks': [{'type': 'command', 'command': command, 'timeout': 5}]}]
    return json.dumps({'hooks': {name: entry for name in HOOK_STATE}}, ensure_ascii=False, indent=2)


def main() -> int:
    if sys.argv[1:] == ['--print-hooks']:
        print(hooks_json(Path(__file__).resolve(), sys.executable))
        return 0
    stdin_text = '' if len(sys.argv) > 1 or sys.stdin is None or sys.stdin.isatty() else sys.stdin.read()
    event = event_of(sys.argv, stdin_text)
    if event is not None:
        try:
            write_state(*event)
        except OSError:
            pass  # 게임 쪽 알림이 안 갈 뿐, Codex 작업은 막지 않는다
    return 0  # 훅은 늘 성공으로 끝내 Codex 흐름을 바꾸지 않는다


if __name__ == '__main__':
    sys.exit(main())
