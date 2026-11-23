# 출처

이 폴더의 그림(`*.png`)은 [patch-gg/pixelfx](https://github.com/patch-gg/pixelfx)(MIT, Copyright (c) 2026 Patch)의
효과 코드로 그린 것을 도트 오락실 큰 창에 맞게 다시 구운 것입니다. 원본 라이선스는 같은 폴더의 `LICENSE`.

- 쓴 효과: impacts/hit-spark, explosions/small-explosion, spawn/poof, pickups/collect-burst, impacts/ground-slam, ui/confetti
  (커밋은 `index.json`의 `commit`).
- 바꾼 곳: 색 띠를 PICO-8 색으로 바꿔 그리고, 모든 픽셀을 PICO-8 16색으로 맞추고(반투명은 버림), 앞부분만 잘라
  프레임을 솎고, 일부는 가장 가까운 픽셀로 줄였습니다. 굽는 도구는 `tools/bake_pixelfx.py`.
- 위 여섯 효과는 pixelfx가 밝힌 대로 Hugo Duprez의 Sprite Fusion 오픈소스 픽셀 아트 효과
  (https://www.spritefusion.com/pixel-art-vfx, Copyright (c) 2026 Hugo Duprez, MIT)를 고쳐 쓴 것입니다.
- pixelfx의 폰트(`gallery/fonts`)는 쓰지 않았습니다.
