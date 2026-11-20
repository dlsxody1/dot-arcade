---
name: pixel-art
description: >
  이미지를 시대별 팔레트(NES, 게임보이, PICO-8, C64 등)의 도트 그림으로 바꾸고, 팔레트 색 값을
  꺼내 쓴다. dot-arcade 게임의 배경, 타이틀 그림, 참고 이미지를 도트로 만들거나, 게임 팔레트를
  PICO-8 같은 하드웨어 팔레트로 맞출 때 쓴다. 스프라이트를 처음부터 그리는 일은 하지 않는다
  (그건 Pillow 스크립트로 직접 찍는다).
---

# 도트 변환 (pixel art)

이미지를 레트로 도트 그림 PNG로 바꾼다. 프리셋은 하드웨어 팔레트(NES, 게임보이, PICO-8 등)에 색을
맞추거나, 아케이드, SNES 느낌이면 N색 적응 양자화를 쓴다.

스크립트(이 스킬 폴더 `scripts/`):

- `pixel_art.py`: 이미지 → 도트 PNG(Floyd-Steinberg 디더링)
- `palettes.py`: 이름 붙은 팔레트 28개의 RGB 값과 `build_palette_image`

## 쓸 때

- 사진이나 그림을 도트 배경, 타이틀 그림으로 바꾸고 싶을 때.
- NES, 게임보이, PICO-8, C64, 아케이드, SNES 느낌을 원할 때.
- 게임의 팔레트를 하드웨어 팔레트 색 값으로 맞추고 싶을 때(`palettes.py`에서 꺼낸다).

## 순서

### 1단계: 스타일 고르기

결과가 프리셋마다 크게 다르고 다시 만드는 데 시간이 드니 먼저 고른다. 사용자가 이미 시대를 말했으면
("게임보이처럼") 묻지 않고 그 프리셋을 쓴다. 아니면 질문 도구(AskUserQuestion)로 한 번만 묻는다.
기본 선택지:

- arcade: 굵고 큼직한 80년대 오락실 느낌(16색, 8px)
- nes: 패미컴 8비트 하드웨어 팔레트(54색, 8px)
- gameboy: 초록 4단계 게임보이
- pico8: PICO-8 16색(6px)

### 2단계: 만들기

`pixel_art()`를 돌린다. 결과는 프로젝트의 `assets/` 아래에 둔다.

## 프리셋

| 프리셋 | 시대 | 팔레트 | 블록 | 어울리는 것 |
|--------|------|--------|------|-------------|
| `arcade` | 80년대 오락실 | 적응 16 | 8px | 굵은 포스터, 주인공 그림 |
| `snes` | 16비트 | 적응 32 | 4px | 캐릭터, 세밀한 장면 |
| `nes` | 8비트 | NES(54) | 8px | 진짜 NES 느낌 |
| `gameboy` | DMG 휴대기 | 초록 4단계 | 8px | 흑백 게임보이 |
| `gameboy_pocket` | 포켓 | 회색 4단계 | 8px | 게임보이 포켓 |
| `pico8` | PICO-8 | 고정 16 | 6px | 판타지 콘솔 |
| `c64` | 코모도어 64 | 고정 16 | 8px | 8비트 가정용 컴퓨터 |
| `apple2` | 애플 II | 고정 6 | 10px | 극단적 레트로 |
| `teletext` | BBC 텔레텍스트 | 원색 8 | 10px | 큼직한 원색 |
| `mspaint` | 윈도 그림판 | 고정 24 | 8px | 추억의 데스크톱 |
| `mono_green` | CRT 형광 | 초록 2 | 6px | 터미널, CRT |
| `mono_amber` | CRT 호박색 | 호박색 2 | 6px | 호박색 모니터 |
| `neon` | 사이버펑크 | 네온 10 | 6px | 베이퍼웨이브 |
| `pastel` | 파스텔 | 파스텔 10 | 6px | 귀엽고 부드러운 |

이름 붙은 팔레트 전체는 `references/palettes.md`. 프리셋 값은 덮어쓸 수 있다.

```python
pixel_art("in.png", "out.png", preset="snes", palette="PICO_8", block=6)
```

## 부르는 법 (저장소 맨 위 폴더에서)

### import

```python
import sys
sys.path.insert(0, ".claude/skills/pixel-art/scripts")
from pixel_art import pixel_art
from palettes import PALETTES

pixel_art("photo.jpg", "assets/title.png", preset="pico8")
pico8 = PALETTES["PICO_8"]   # [(r, g, b), ...] 게임 팔레트로 그대로 쓴다
```

### 명령줄

```bash
cd .claude/skills/pixel-art/scripts
python pixel_art.py in.jpg out.png --preset gameboy
python pixel_art.py in.jpg out.png --preset snes --palette PICO_8 --block 6
```

## 처리 순서와 이유

1. 대비, 채도, 선명도를 올린다(팔레트가 작을수록 세게).
2. 포스터화로 톤을 단순하게 만든 뒤 양자화한다.
3. `block` 배율로 `Image.NEAREST` 축소(보간 없는 딱딱한 픽셀).
4. Floyd-Steinberg 디더링으로 양자화. 적응 N색 팔레트나 이름 붙은 하드웨어 팔레트에 맞춘다.
5. `Image.NEAREST`로 다시 키운다.

축소한 **뒤에** 양자화해야 디더링이 최종 픽셀 격자에 맞는다.

## 필요한 것

- Python 3.9 이상
- Pillow (`pip install pillow`)

## 함정

- 팔레트 이름은 대소문자를 가린다(`"NES"`, `"PICO_8"`, `"GAMEBOY_ORIGINAL"`).
- 아주 작은 원본(폭 100px 미만)은 8~10px 블록에서 뭉개진다. 원본을 먼저 키운다.
- `block`, `palette`에 소수를 넣으면 양자화가 깨진다. 양의 정수로.
- `mono_green`, `mono_amber`는 채도를 0으로 만든다. 덮어써서 색을 남기면 2색 팔레트에 줄무늬가 생긴다.

## 확인

- 출력 경로에 PNG가 생겼다.
- 프리셋 블록 크기의 네모난 픽셀이 또렷하다.
- 색 수가 프리셋과 맞다(`Image.open(p).getcolors()`).

## 출처

하드웨어 팔레트는 [pixel-art-studio](https://github.com/Synero/pixel-art-studio)(MIT)에서 옮긴 것이다.
`ATTRIBUTION.md`와 `SOURCE.md`를 본다.
