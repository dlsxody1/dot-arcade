// 연출(game-feel 스킬을 터미널 도트에 옮김): 흔들림, 히트스톱, 늘었다 줄기, 파티클, 글자 팝, 번쩍임.
// 틱은 50ms(초당 20장). 모든 수치는 그 틱 기준.

import type { ClientElements } from 'claude-code'
import type { Grid } from './pixel'

export const DT = 0.05

/** 터미널과 데스크톱이 넘기는 키 이름을 하나로: 'space' → ' ', 'enter' → 'return', 화살표는 그대로. */
export function normKey(key: string): string {
  const k = key.toLowerCase()
  if (k === 'space' || k === 'spacebar' || key === ' ') return ' '
  if (k === 'enter') return 'return'
  if (k === 'arrowleft') return 'left'
  if (k === 'arrowright') return 'right'
  if (k === 'arrowup') return 'up'
  if (k === 'arrowdown') return 'down'
  return k
}

export const TIERS = {
  small: { trauma: 0.15, stop: 0, parts: 3 },
  medium: { trauma: 0.4, stop: 2, parts: 8 },
  large: { trauma: 0.85, stop: 5, parts: 18 },
} as const
export type Tier = keyof typeof TIERS

export const easeOutBack = (k: number) => {
  const c1 = 1.70158
  const m = k - 1
  return 1 + (c1 + 1) * m * m * m + c1 * m * m
}

type Part = { x: number; y: number; vx: number; vy: number; life: number; max: number; color: string; g: number }
type Pop = { x: number; y: number; text: string; color: string; life: number; max: number }

export class Juice {
  trauma = 0
  t = 0
  stop = 0
  flash = 0
  flashLog: number[] = []
  clock = 0
  parts: Part[] = []
  pops: Pop[] = []
  squash = { e: 1, sx: 1, sy: 1 }

  /** 한 곳에서 단계별 연출을 터뜨린다. */
  hit(tier: Tier, x: number, y: number, colors: string[], text?: string, textColor = '#ffffff', flash = false) {
    const t = TIERS[tier]
    this.trauma = Math.min(1, this.trauma + t.trauma)
    this.stop = Math.max(this.stop, t.stop)
    this.burst(x, y, t.parts, colors, 12 + t.parts)
    if (text !== undefined) this.pop(x, y - 2, text, textColor)
    if (flash) this.doFlash()
  }

  burst(x: number, y: number, n: number, colors: string[], speed = 20, g = 60, life = 0.5, up = false) {
    for (let i = 0; i < n; i++) {
      const a = up ? -Math.PI * Math.random() : Math.random() * Math.PI * 2
      const v = speed * (0.3 + 0.7 * Math.random())
      const lf = life * (0.5 + 0.5 * Math.random())
      this.parts.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, life: lf, max: lf, color: colors[i % colors.length] ?? '#fff', g })
    }
  }

  pop(x: number, y: number, text: string, color = '#ffffff') {
    this.pops.push({ x, y, text, color, life: 0.9, max: 0.9 })
  }

  doFlash() {
    this.flashLog = this.flashLog.filter(c => this.clock - c < 20) // 1초(20틱)에 3번 넘게 번쩍이지 않는다(WCAG 2.3.1)
    if (this.flashLog.length >= 3) return
    this.flashLog.push(this.clock)
    this.flash = 2
  }

  kick(sx: number, sy: number) {
    this.squash = { e: 0, sx, sy }
  }

  scale(): [number, number] {
    const s = this.squash
    if (s.e >= 1) return [1, 1]
    const k = easeOutBack(Math.min(1, s.e))
    return [s.sx + (1 - s.sx) * k, s.sy + (1 - s.sy) * k]
  }

  /** 틱마다. true면 이번 틱은 로직을 멈춘다(히트스톱). 흔들림과 파티클은 계속 돈다. */
  tick(): boolean {
    this.clock += 1
    if (this.flash > 0) this.flash -= 1
    this.squash.e += DT / 0.2
    this.trauma = Math.max(0, this.trauma - 1.4 * DT)
    this.t += DT * 30
    for (const p of this.parts) {
      p.vy += p.g * DT
      p.x += p.vx * DT
      p.y += p.vy * DT
      p.life -= DT
    }
    this.parts = this.parts.filter(p => p.life > 0)
    for (const p of this.pops) p.life -= DT
    this.pops = this.pops.filter(p => p.life > 0)
    if (this.stop > 0) {
      this.stop -= 1
      return true
    }
    return false
  }

  /** 흔들림 오프셋(픽셀). trauma^2 * 사인 합. */
  offset(): [number, number] {
    const s = this.trauma * this.trauma
    return [Math.round(3 * s * Math.sin(this.t * 1.7)), Math.round(2 * s * Math.sin(this.t * 2.3))]
  }

  drawParts(g: Grid, camX = 0) {
    for (const p of this.parts) {
      const row = g[Math.round(p.y)]
      const x = Math.round(p.x - camX)
      if (row !== undefined && x >= 0 && x < row.length) row[x] = p.color
    }
  }

  /** 글자 팝: 떠오르며 사라지는 글자를 셀 위치에 겹쳐 그린다(Box absolute). */
  popLayer(els: Pick<ClientElements, 'Box' | 'Text'>, cols: number, rows: number, camX = 0) {
    const { Box, Text } = els
    return (
      <Box position="absolute" top={0} left={0} width={cols} height={rows}>
        {this.pops.map(p => {
          const k = 1 - p.life / p.max
          const col = Math.max(0, Math.min(cols - p.text.length, Math.round(p.x - camX - p.text.length / 2)))
          const row = Math.max(0, Math.round((p.y - k * 8) / 2))
          return (
            <Box position="absolute" top={row} left={col}>
              <Text color={p.color} weight="bold" dimColor={k > 0.7}>
                {p.text}
              </Text>
            </Box>
          )
        })}
      </Box>
    )
  }
}
