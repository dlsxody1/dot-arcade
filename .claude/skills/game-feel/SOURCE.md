# 출처

- 원본: gamedev-skills/awesome-gamedev-agent-skills, skills/disciplines/game-feel
- 검사하고 가져온 커밋: 00a9045a78714be481c09622727284e8960ee69f
- 라이선스: Apache-2.0 (Copyright 2026 Abhishek Barali and the awesome-gamedev-agent-skills contributors)
- 가져온 날: 2026-11-19
- 감별 결과: 보안 깨끗함(읽은 범위에서), 적합성 고치면 맞음

## 원본에서 바꾼 것 (Apache-2.0 4(b): 이 파일들은 수정되었다)

- 언어: 영어 → 한국어.
- 엔진: Godot 4.7 GDScript, Unity C# 예시 → pygame-ce 2.5 Python 예시(흔들림, 히트스톱, 늘었다 줄기, 번쩍임).
  원래 계획은 Pyxel이었으나 이 PC의 스마트 앱 컨트롤이 Pyxel DLL을 막아 pygame-ce로 바꿨다.
- 히트스톱: 엔진 time scale + 실시간 타이머 → 로직 업데이트를 건너뛰는 프레임 카운터(겹치면 max).
- 단계 표: 히트스톱을 초와 함께 60fps 프레임 수로도 적음. small 단계의 "tick SFX" 제거.
- 뺀 것: 소리 채널과 오디오 함정(이 프로젝트는 소리를 쓰지 않음), Unity Cinemachine 안내,
  엔진별 바인딩 요약, 이 폴더에 없는 스킬(input-systems, camera-systems 등) 링크, 버전 노트,
  도트 화면에 맞지 않는 회전 흔들림.
- 그대로 둔 것: trauma 모델, 단계 표 수치, 이징 선택, 함정 목록, 접근성(WCAG 2.3.1).

## 연결

- 스스로 불리게: description을 "연출, 타격감, 밋밋하다" 같은 말로 다시 씀. dot-arcade 폴더 세션에서만.
