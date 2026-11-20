---
name: game-feel
description: >
  dot-arcade의 pygame-ce 도트 게임에 연출(쥬스)을 붙인다: 트라우마 방식 화면 흔들림, 맞을 때 잠깐
  멈춤(히트스톱), 이징, 늘었다 줄기, 번쩍임, 넉백, 점수 튀어 오르기, 파티클. 게임이 밋밋하다,
  타격감이 없다, 연출이 심심하다, 점프나 격추가 시원하지 않다고 할 때 쓴다. 점프 수치와
  조작감(코요테 타임, 점프 버퍼)은 platformer 스킬이 맡는다.
---

# 연출 (game feel, juice)

연출은 한 사건에 작고 짧고 과장된 반응 여러 개를 한꺼번에 터뜨려 그 행동을 "팔아 주는" 층이다. 이미
돌아가는 메카닉 위에 얹는다. 시뮬레이션은 바꾸지 않는다. 흔들림은 그리는 위치만 옮기고, 히트스톱은
게임 로직의 시간만 멈춘다. 몸체 좌표를 흔들거나 충돌 판정을 멈추지 않는다.

이 프로젝트는 소리를 쓰지 않는다. 소리 채널 대신 번쩍임, 파티클, 흔들림, 글자 튀어 오르기로 채운다.

## 쓸 때

- 격추, 점프, 착지, 코인, 맞음, 죽음, 버튼이 돌아가긴 하는데 약하게 느껴질 때.
- 흔들림, 히트스톱, 이징, 늘었다 줄기, 번쩍임, 넉백, 숫자 팝을 더하거나 조절할 때.
- 연출이 얼마면 충분한지 정하고 "흔들림 줄이기, 번쩍임 줄이기" 설정을 넣을 때.

## 순서

1. **사건 자리를 찾는다.** 연출은 `hit`, `landed`, `coin`, `died` 같은 사건에 붙인다. 로직이 사건을
   알려 주지 않으면 먼저 사건을 반환하거나 목록에 쌓게 한다. 매 프레임 상태를 비교해 짐작하지 않는다.
2. **사건마다 단계를 정한다**(아래 표). 연출은 `feedback(tier, x, y)` 한 곳에서 터뜨려 게임 전체의
   비례를 맞춘다.
3. **사건마다 채널 2~3개로 시작한다**(파티클, 흔들림, 번쩍임). 돌려 보며 읽힐 때까지 하나씩 더한다.
   히트스톱과 흔들림이 가장 세고 가장 남용된다. 충돌에만 쓴다.
4. **움직이는 것은 모두 이징한다.** 튀어나오는 것은 overshoot(back), 멈춰 서는 것은 ease-out,
   준비 동작만 ease-in.
5. **히트스톱 동안 무엇이 도는지 정한다.** 로직 업데이트는 멈추고, 흔들림 감쇠와 글자 팝, UI는
   실제 시간으로 계속 돈다. 멈춘 자세는 그대로 둔다.
6. **설정을 넣는다**: 흔들림 세기 0~100%, 번쩍임 줄이기.
7. **헤드리스로 확인한 뒤 눈으로 본다.** 같은 사건을 2프레임 간격으로 두 번 터뜨리고, 긴 쪽 멈춤이
   끝난 뒤 멈춤 카운터가 0인지, trauma가 `1 / decay`초 안에 0이 되는지, 모든 크기 트윈이 정확히
   1.0으로 끝나는지 검사한다. 그다음 사용자에게 해 보게 하고, 맞은 게 읽히는지, 어지럽지 않은지,
   멈춤 중에도 입력이 먹는지 묻는다.

## 단계

| 단계 | trauma | 히트스톱 | 파티클 | 덧붙임 | 예 |
|------|:------:|:--------:|:------:|--------|----|
| small | 0.10-0.20 | 없음 | 0-4 | 없음 | 발소리, 코인, 버튼 |
| medium | 0.30-0.50 | 2-4프레임(0.04-0.06초) | 6-12 | 번쩍임 | 보통 격추, 착지, 아이템 |
| large | 0.70-1.00 | 6-9프레임(0.10-0.15초) | 20-40 | 번쩍임, 줌, 숫자 | 큰 적, 죽음, 웨이브 클리어 |

## 패턴 (pygame-ce, 60fps 고정 틱)

화면은 낮은 해상도 표면(`world`, 예: 256x192)에 그린 뒤 정수 배율로 창에 키워 붙인다. 흔들림은 이
붙이는 위치를 옮긴다.

### 1. 감쇠하는 trauma로 화면 흔들림

```python
import math

class Shake:
    """흔들림 = trauma^2. 약한 사건은 거의 안 움직이고 센 사건만 확 흔든다."""
    def __init__(self, decay=1.2, max_off=(6, 4), strength=1.0):
        self.trauma = 0.0
        self.decay = decay          # 실제 1초에 줄어드는 trauma
        self.max_off = max_off      # 낮은 해상도 픽셀 기준
        self.strength = strength    # 설정값 0..1
        self.t = 0.0

    def add(self, amount):
        self.trauma = min(1.0, self.trauma + amount)  # 더한다, 덮어쓰지 않는다

    def update(self, real_dt):      # 히트스톱 중에도 실제 시간으로 감쇠
        if self.trauma <= 0:
            return (0, 0)
        self.trauma = max(0.0, self.trauma - self.decay * real_dt)
        self.t += real_dt * 30
        s = self.trauma * self.trauma * self.strength
        # 서로 다른 속도의 사인 합: 매 프레임 random()은 지직거린다
        return (round(self.max_off[0] * s * math.sin(self.t * 1.7)),
                round(self.max_off[1] * s * math.sin(self.t * 2.3)))

# 그리기: ox, oy = shake.update(dt)
# window.blit(pygame.transform.scale(world, size), (ox * SCALE, oy * SCALE))
```

### 2. 겹쳐도 깨지지 않는 히트스톱

```python
class HitStop:
    """로직 업데이트만 몇 프레임 건너뛴다. 겹치면 더 긴 쪽을 남긴다."""
    def __init__(self):
        self.frames = 0

    def hit(self, frames):
        self.frames = max(self.frames, frames)   # 새 호출이 남은 멈춤을 줄이지 않는다

    def tick(self):
        """True면 이번 프레임 로직을 멈춘다."""
        if self.frames > 0:
            self.frames -= 1
            return True
        return False

# 루프: if not hitstop.tick(): game.update(input)   # 입력은 멈춤 중에도 버퍼에 쌓는다
```

### 3. 늘었다 줄기와 overshoot

```python
def ease_out_back(k):              # 0 -> 1, 끝에서 10%쯤 넘쳤다가 돌아온다
    c1 = 1.70158; c3 = c1 + 1; m = k - 1
    return 1 + c3 * m * m * m + c1 * m * m

class Squash:
    """착지하면 납작하게(1.3, 0.7), 점프하면 길게(0.8, 1.2) 시작해 1.0으로 튕겨 돌아온다."""
    def __init__(self, dur=0.18):
        self.dur, self.e, self.start = dur, dur, (1.0, 1.0)

    def kick(self, sx, sy):        # 다시 걸리면 이전 트윈을 덮는다(두 트윈이 싸우지 않게)
        self.start, self.e = (sx, sy), 0.0

    def update(self, dt):
        if self.e >= self.dur:
            return (1.0, 1.0)      # 끝나면 정확히 쉬는 값으로
        self.e += dt
        k = ease_out_back(min(1.0, self.e / self.dur))
        return tuple(a + (1 - a) * k for a in self.start)

# 그리기: 발밑을 기준으로 크기를 바꿔 붙인다
# img = pygame.transform.scale(sprite, (round(w * sx), round(h * sy)))
# world.blit(img, (x + (w - img.get_width()) // 2, y + h - img.get_height()))
```

### 4. 번쩍임

맞은 스프라이트를 1~3프레임 흰색으로 칠한다. `flash = sprite.copy(); flash.fill((255, 255, 255),
special_flags=pygame.BLEND_RGB_MAX)`로 한 번 만들어 두고, 번쩍이는 동안 이것을 그린다. 화면 전체
번쩍임은 큰 사건에만, 초당 3회 이하로.

## 함정

- **몸체를 흔든다**: 충돌과 조준이 어긋난다. 그리는 위치만 흔든다.
- **매 프레임 무작위 오프셋**: 지지직거린다. 감쇠하는 trauma 아래 사인 합이나 노이즈를 쓴다.
- **히트스톱 중 흔들림이 한쪽으로 쏠린 채 멈춤**: 흔들림을 로직 시간으로 감쇠시킨 경우. 실제 시간으로 감쇠한다.
- **겹친 히트스톱**: 30ms 간격 두 타격에서 먼저 것이 나중 멈춤을 끊으면 안 된다. 남은 프레임은 max로 합친다.
- **누르고 있는 공격이나 연타마다 히트스톱**: 게임이 굳는다. 충돌 한 번에 한 번, 멈춤 중 들어온 타격은 건너뛴다.
- **쉬는 값으로 안 돌아오는 연출**(크기가 조금씩 틀어짐, 끝나지 않는 흔들림): 연출로 안 읽힌다. 끝에 정확히 쉬는 값으로 맞춘다.
- **평범한 행동에 과한 연출**: 어지럽고 진짜 충돌이 묻힌다. 발소리급은 small이거나 없음.
- **입력을 막는 연출**: 긴 멈춤과 취소할 수 없는 동작은 렉처럼 느껴진다. 멈춤은 0.15초 아래로, 그동안 입력은 버퍼에 담는다.
- **광과민 한계를 넘는 번쩍임**: 큰 밝은 번쩍임은 1초에 3회 이하(WCAG 2.3.1). "번쩍임 줄이기"를 켜면 번쩍임 대신 색조만 바꾼다.

## 참고

- `references/feedback-recipes.md`: trauma 수치 범위, 이징 고르는 표, 번쩍임, 넉백, 숫자 팝, 파티클
  만드는 법, 접근성 설정.

## 관련 스킬

- `platformer`: 이 연출이 얹히는 점프 조작감과 수치.
- `pixel-art`: 팔레트와 이미지 도트화.
