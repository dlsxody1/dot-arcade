# 출처

- 원본: NousResearch/hermes-agent, optional-skills/creative/pixel-art
- 검사하고 가져온 커밋: 1b8bd66b7f9fa12dc61efc50730efa420764e789
- 라이선스: MIT
- 가져온 날: 2026-11-19
- 감별 결과: 보안 깨끗함(읽은 범위에서), 적합성 고치면 맞음

MIT License, Copyright (c) 2025 Nous Research. 하드웨어 팔레트는 Synero/pixel-art-studio(MIT)에서 옮긴 것이다(ATTRIBUTION.md).

## 원본에서 바꾼 것

- SKILL.md: 한국어로 옮김. Hermes 전용 `clarify(...)` → 질문 도구(AskUserQuestion) 한 번.
  `~/.hermes/skills/...`, `~/.hermes/cache/scratch` 경로 → 이 스킬 폴더와 저장소의 `assets/`.
  frontmatter의 `metadata.hermes`, version, author, platforms 제거. description을 dot-arcade 쓰임새로 다시 씀.
- 뺀 것: `scripts/pixel_art_video.py`와 장면 목록, 영상과 ffmpeg 안내(게임에 쓰지 않음, ffmpeg 필요).
- 그대로: scripts/pixel_art.py, scripts/palettes.py, scripts/__init__.py, references/palettes.md, ATTRIBUTION.md
  (ATTRIBUTION.md는 영상 스크립트를 언급하지만 이 사본에는 그 파일이 없다).

## 연결

- 스스로 불리게: dot-arcade 폴더 세션에서만.
