# 도트 오락실 작업 규칙

재미로 만드는 Claude Code mod. 답과 문서는 한국어.

## 구성

- `plugins/dot-arcade/`: Claude Code mod. `/arcade`로 채팅 옆 창(터미널, 데스크톱)을 열고, 그 창 안에서 게임 셋을 돌린다.
  - `hooks/`: 훅 모듈(`register.tsx`), 게임별 규칙(`*_rules.ts`)과 그리기(`*.tsx`, Client 모듈), 연출(`juice.tsx`), 도트(`pixel.tsx`).
  - `game/`: "큰 창으로" 버튼이 띄우는 pygame-ce 창 게임(Python 3.12). 키 누름과 뗌을 다 알아서 길게 누르기 점프, 60fps.
    - Windows 스마트 앱 컨트롤이 Pyxel DLL을 막는 PC가 있어 Pyxel 대신 pygame-ce를 쓴다.
- `.claude/skills/`: platformer(점프 수치), game-feel(연출), pixel-art(팔레트, 도트 변환). 게임을 만들거나 고칠 때 먼저 읽는다. 출처와 바꾼 곳은 각 `SOURCE.md`.

## 터미널판 원칙

- 터미널은 키를 뗀 것을 알려 주지 않는다. 길게 누르기에 기대지 않고 누르기만으로 재미있게: 자동 달리기, 자동 연사, 탭 이동.
- 키 반복은 첫 입력 뒤 약 0.5초 쉰다. 첫 입력에 바로 반응하고 그 공백을 메운다.
- 키 이름은 `normKey`로 맞춘다(`space` → `' '`, `enter` → `'return'`).
- 한글 입력기가 글자를 조립하는 동안은 터미널이 글자를 넘기지 않는다. 키마다 반응해야 하면 Client의 `onKey`로 받는다.

## 큰 창(pygame)

- 논리 해상도 256 x 144, 정수 배율 4. 그림은 논리 해상도에 그리고 NEAREST로 키운다. 글자(HUD)는 키운 뒤 그린다.
- 팔레트는 PICO-8 16색(`game/core.py`의 `PAL`). 새 색을 지어내지 않는다.
- 구운 효과(`game/assets/pixelfx/`)는 `fx.Anims`로 재생한다(`juice.anims.play(이름, x, y)`). 효과를 더하거나 바꾸려면 `tools/bake_pixelfx.py`의 `EFFECTS`를 고치고 pixelfx 저장소를 받아 다시 굽는다.
- 60fps 고정 틱. 소리는 쓰지 않고 연출(흔들림, 멈춤, 늘었다 줄기, 번쩍임, 파티클, 글자 팝)로 채운다.

## 코드

- 파일 하나 300줄 이하.
- 게임 규칙(점수, 충돌, 판정)은 그리기와 나눠서 창 없이 테스트할 수 있게 한다.

## 데이터 (mod와 큰 창이 같이 쓴다)

- `~/.claude/dot-arcade/records.json`: 게임별 최고 점수, 날짜(`2026.11.19 (목) 14:02`), 판 수.
- `~/.claude/dot-arcade/bonus.json`: 보너스 개수와 이미 준 세션 끝남 목록.
- `~/.claude/dot-arcade/sessions/*.json`: 각 세션의 mod가 쓰는 작업 중/끝남. Codex 세션은 `codex/codex_arcade.py`(Codex 훅이 부름)가 `codex-<세션>.json`으로 쓴다.

## 확인

- mod: `claude plugin validate plugins/dot-arcade`, `claude plugin test plugins/dot-arcade`.
- 큰 창 규칙과 Codex 연결: `python -m pytest plugins/dot-arcade/game/tests plugins/dot-arcade/codex/tests -q`.
- 큰 창 화면: `python plugins/dot-arcade/game/main.py --game runner --frames 600 --shot out.png` (입력 스크립트는 `--keys`).
