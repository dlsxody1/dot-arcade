// 도트 그리기: 한 칸에 픽셀 두 개(위는 글자색 ▀, 아래는 배경색).
// 훅 모듈과 게임 Client 모듈이 함께 쓴다.

import type { ClientElements } from 'claude-code'

/** [y][x] 픽셀 색. undefined는 배경색. */
export type Grid = (string | undefined)[][]

export const makeGrid = (w: number, h: number): Grid =>
  Array.from({ length: h }, () => Array.from({ length: w }, () => undefined as string | undefined))

/** 팔레트: 스프라이트 글자 하나가 색 하나. '.'과 ' '는 투명. */
export const PAL: Readonly<Record<string, string>> = {
  k: '#1b1b2a', // 거의 검정
  w: '#f4f4f4', // 흰
  g: '#8a8f9e', // 회색
  r: '#e5484d', // 빨강
  o: '#f5a524', // 주황
  y: '#ffd43b', // 노랑
  G: '#46c35c', // 초록
  d: '#2f8f46', // 진초록
  b: '#4c9aff', // 파랑
  B: '#2549a8', // 진파랑
  c: '#5ee0e8', // 하늘
  p: '#b67cff', // 보라
  m: '#ff7ab8', // 분홍
  n: '#9a5b2e', // 갈색
  N: '#6b3a1c', // 진갈색
  s: '#f2c49b', // 살구
}

export function stamp(
  g: Grid,
  sprite: readonly string[],
  x: number,
  y: number,
  pal: Readonly<Record<string, string>> = PAL,
): void {
  const ox = Math.round(x)
  const oy = Math.round(y)
  sprite.forEach((line, sy) => {
    const row = g[oy + sy]
    if (row === undefined) return
    for (let sx = 0; sx < line.length; sx++) {
      const ch = line[sx]
      if (ch === undefined || ch === '.' || ch === ' ') continue
      const px = ox + sx
      if (px < 0 || px >= row.length) continue
      row[px] = pal[ch] ?? ch
    }
  })
}

export function fillRect(g: Grid, x: number, y: number, w: number, h: number, color: string): void {
  for (let yy = Math.max(0, Math.round(y)); yy < Math.min(g.length, Math.round(y + h)); yy++) {
    const row = g[yy]
    if (row === undefined) continue
    for (let xx = Math.max(0, Math.round(x)); xx < Math.min(row.length, Math.round(x + w)); xx++) row[xx] = color
  }
}

type Seg = { top: string; bottom: string; n: number }

/** 픽셀 두 줄을 한 줄로 접고, 같은 색이 이어지면 한 덩어리로 묶는다. */
export function toSegments(g: Grid, bg: string): Seg[][] {
  const rows: Seg[][] = []
  for (let y = 0; y < g.length; y += 2) {
    const up = g[y] ?? []
    const down = g[y + 1] ?? []
    const segs: Seg[] = []
    for (let x = 0; x < up.length; x++) {
      const top = up[x] ?? bg
      const bottom = down[x] ?? bg
      const last = segs[segs.length - 1]
      if (last !== undefined && last.top === top && last.bottom === bottom) last.n += 1
      else segs.push({ top, bottom, n: 1 })
    }
    rows.push(segs)
  }
  return rows
}

type Els = Pick<ClientElements, 'Box' | 'Text'>

export function PixelRows({ els, grid, bg }: { els: Els; grid: Grid; bg: string }) {
  const { Box, Text } = els
  return (
    <Box flexDirection="column">
      {toSegments(grid, bg).map(segs => (
        <Text wrap="truncate" mono>
          {segs.map(s =>
            s.top === s.bottom ? (
              <Text backgroundColor={s.top}>{' '.repeat(s.n)}</Text>
            ) : (
              <Text color={s.top} backgroundColor={s.bottom}>
                {'▀'.repeat(s.n)}
              </Text>
            ),
          )}
        </Text>
      ))}
    </Box>
  )
}

/** 결정적인 난수(같은 씨앗이면 같은 판). */
export function rng(seed: number): () => number {
  let s = seed >>> 0 || 1
  return () => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0
    return s / 4294967296
  }
}

// ── 스프라이트 ─────────────────────────────────────────

export const ROBOT_A = ['.bb.', 'bwwb', 'bkwb', '.bb.', 'g..g', 'k..k']
export const ROBOT_B = ['.bb.', 'bwwb', 'bkwb', '.bb.', '.gg.', '.kk.']
export const CRAWLER = ['.rr.', 'rwkr', 'r..r']
export const SHIP = ['..c..', '.cwc.', 'cbbbc']
export const BUG_1 = ['p..p', '.pp.', 'pwwp', '.pp.']
export const BUG_2 = ['o..o', 'oyyo', '.oo.', 'o..o']
export const BUG_3 = ['m..m', '.mm.', 'mkkm', 'm..m']

// 선택 화면 썸네일(16 x 8 픽셀 = 16칸 x 4줄)
export function thumbGrid(game: string): { grid: Grid; bg: string } {
  const g = makeGrid(16, 8)
  if (game === 'shooter') {
    stamp(g, BUG_1, 1, 0)
    stamp(g, BUG_2, 6, 0)
    stamp(g, BUG_3, 11, 0)
    stamp(g, ['w'], 8, 4)
    stamp(g, SHIP, 6, 5)
    stamp(g, ['y'], 2, 6)
    stamp(g, ['y'], 14, 3)
    return { grid: g, bg: '#0d1030' }
  }
  if (game === 'runner') {
    fillRect(g, 0, 6, 16, 2, PAL.n ?? '#9a5b2e')
    fillRect(g, 0, 6, 16, 1, PAL.G ?? '#46c35c')
    fillRect(g, 9, 6, 2, 2, '#7fc8ff')
    stamp(g, ['yy', 'yy'], 6, 1)
    stamp(g, ROBOT_A.slice(0, 6), 2, 0)
    stamp(g, CRAWLER, 12, 3)
    return { grid: g, bg: '#7fc8ff' }
  }
  // 자모 다섯 칸
  const tiles = ['#46c35c', '#ffd43b', '#3a3f4b', '#46c35c', '#3a3f4b']
  tiles.forEach((color, i) => fillRect(g, 1 + i * 3, 1, 2, 2, color))
  const tiles2 = ['#46c35c', '#46c35c', '#ffd43b', '#46c35c', '#46c35c']
  tiles2.forEach((color, i) => fillRect(g, 1 + i * 3, 5, 2, 2, color))
  return { grid: g, bg: '#1b1b2a' }
}
