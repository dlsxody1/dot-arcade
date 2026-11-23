"""Codex 연결 스크립트: 훅과 notify 입력을 세션 파일로 바꾸고, 큰 창 게임이 그것을 끝남으로 읽는다."""
from __future__ import annotations

import json
import subprocess
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
SCRIPT = HERE.parent / 'codex_arcade.py'
sys.path.insert(0, str(HERE.parent))
sys.path.insert(0, str(HERE.parent.parent / 'game'))

import codex_arcade as ca  # noqa: E402


def run(tmp: Path, args: list[str], stdin: str = '') -> None:
    env = {**__import__('os').environ, 'DOT_ARCADE_DATA': str(tmp)}
    out = subprocess.run([sys.executable, str(SCRIPT), *args], input=stdin, text=True, env=env, capture_output=True)
    assert out.returncode == 0, out.stderr


def read(tmp: Path, sid: str) -> dict:
    return json.loads((tmp / 'sessions' / f'codex-{sid}.json').read_text(encoding='utf-8'))


def test_hooks_turn_working_then_done(tmp_path: Path) -> None:
    run(tmp_path, [], json.dumps({'hook_event_name': 'UserPromptSubmit', 'session_id': 'thr_1', 'cwd': 'C:\\work\\my-app', 'prompt': '로그인 버그 고쳐 줘\n자세히'}))
    f = read(tmp_path, 'thr_1')
    assert f['state'] == 'working' and f['name'] == 'Codex · my-app' and f['topic'] == '로그인 버그 고쳐 줘'
    run(tmp_path, [], json.dumps({'hook_event_name': 'PostToolUse', 'session_id': 'thr_1', 'cwd': 'C:\\work\\my-app'}))
    assert read(tmp_path, 'thr_1')['at'] == f['at']  # 같은 작업이면 시작 시각 유지
    run(tmp_path, [], json.dumps({'hook_event_name': 'Stop', 'session_id': 'thr_1', 'cwd': 'C:\\work\\my-app'}))
    done = read(tmp_path, 'thr_1')
    assert done['state'] == 'done' and done['topic'] == '로그인 버그 고쳐 줘'


def test_notify_turn_complete_is_done(tmp_path: Path) -> None:
    payload = {'type': 'agent-turn-complete', 'thread-id': 'abc', 'turn-id': 't1', 'cwd': '/home/me/api', 'input-messages': ['테스트 돌려 줘']}
    run(tmp_path, [json.dumps(payload)])
    f = read(tmp_path, 'abc')
    assert f['state'] == 'done' and f['name'] == 'Codex · api' and f['topic'] == '테스트 돌려 줘'


def test_unknown_events_write_nothing(tmp_path: Path) -> None:
    run(tmp_path, [], json.dumps({'hook_event_name': 'PreToolUse', 'session_id': 'x'}))
    run(tmp_path, [json.dumps({'type': 'approval-requested', 'thread-id': 'y'})])
    run(tmp_path, [], 'not json')
    assert not (tmp_path / 'sessions').exists() or not any((tmp_path / 'sessions').iterdir())


def test_print_hooks_names_this_script() -> None:
    text = ca.hooks_json(Path('C:/x/codex_arcade.py'), 'C:/py/python.exe')
    hooks = json.loads(text)['hooks']
    assert set(hooks) == {'UserPromptSubmit', 'PostToolUse', 'Stop', 'SessionEnd'}
    assert hooks['Stop'][0]['hooks'][0]['command'] == '"C:/py/python.exe" "C:/x/codex_arcade.py"'


def test_big_window_gives_bonus_for_codex_done(tmp_path: Path, monkeypatch) -> None:
    import core
    import sessions
    monkeypatch.setattr(core, 'DATA', tmp_path)
    monkeypatch.setattr(sessions, 'DATA', tmp_path)
    w = sessions.Watcher()
    w.since -= 1000
    monkeypatch.setattr(ca, 'DATA', tmp_path)
    ca.write_state('thr_9', 'done', '/work/shop', '결제 화면')
    assert w.poll() == ['Codex · shop: 결제 화면']
    assert w.poll() == []  # 같은 끝남에 보너스는 한 번
