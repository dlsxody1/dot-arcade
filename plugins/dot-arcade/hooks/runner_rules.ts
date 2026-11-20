// 한길 달리기(터미널판) 규칙: 코스 만들기, 한 틱 진행, 키 누르기. 그리기와 나눠 테스트에서 그대로 부른다.

import { DT, Juice } from './juice'

export const T = 4
export const H = 36
const ROWS_T = H / T // 9

export type Bug = { x: number; y: number; vx: number; alive: boolean; dead: number }

export type Run = {
  phase: 'ready' | 'play' | 'dead'
  ground: number[]
  boxes: Map<string, boolean>
  coins: { x: number; y: number }[]
  bugs: Bug[]
  x: number
  y: number
  vy: number
  onGround: boolean
  air: number // 내리찍기를 쓴 횟수
  buffer: number // 착지하면 바로 뛸 남은 틱(점프 미리 받기)
  lastGround: number // 마지막으로 땅에 있던 틱(발판 끝 유예)
  combo: number
  coinsGot: number
  stomps: number
  shield: boolean
  safe: number
  tick: number
  dead: number
  score: number
  milestone: number
  seed: number
}

function rnd(g: Run) {
  g.seed = (Math.imul(g.seed, 1664525) + 1013904223) >>> 0
  return g.seed / 4294967296
}

const speedOf = (g: Run) => Math.min(72, 34 + g.x * 0.01)

/** 화면 오른쪽 너머까지 코스를 이어 붙인다. 구덩이는 지금 속도의 점프 거리 안에서만. */
export function extend(g: Run, until: number) {
  while (g.ground.length * T < until) {
    const c = g.ground.length
    const top = g.ground[c - 1] || 2
    if (c < 16) {
      g.ground.push(2)
      continue
    }
    const r = rnd(g)
    const reach = Math.floor((speedOf(g) * 0.55) / T) // 한 번 점프로 건너는 칸
    if (r < 0.28) {
      const gap = 2 + Math.floor(rnd(g) * Math.max(1, reach - 2))
      for (let i = 0; i < gap; i++) g.ground.push(0)
      for (let i = 0; i <= gap + 1; i++) {
        const k = i / (gap + 1)
        g.coins.push({ x: (c - 1 + i) * T + 2, y: H - top * T - 6 - 10 * 4 * k * (1 - k) })
      }
    } else if (r < 0.42) {
      const h = Math.max(1, Math.min(4, top + (rnd(g) < 0.5 ? 1 : -1)))
      for (let i = 0; i < 4; i++) g.ground.push(h)
    } else if (r < 0.62) {
      for (let i = 0; i < 6; i++) g.ground.push(top)
      const row = ROWS_T - top - 4
      for (let i = 1; i < 5; i++) g.boxes.set(`${c + i},${row}`, i === 2 || rnd(g) < 0.25)
    } else {
      const n = 5 + Math.floor(rnd(g) * 4)
      for (let i = 0; i < n; i++) g.ground.push(top)
      if (rnd(g) < 0.75) g.bugs.push({ x: (c + n - 2) * T, y: H - top * T - 3, vx: -6 - rnd(g) * 6, alive: true, dead: 0 })
    }
  }
}

export function newRun(seed: number, shield = false): Run {
  const g: Run = {
    phase: 'ready', ground: [], boxes: new Map(), coins: [], bugs: [], x: 4 * T, y: H - 2 * T - 6, vy: 0,
    onGround: true, air: 0, buffer: 0, lastGround: 0, combo: 0, coinsGot: 0, stomps: 0, shield, safe: 0, tick: 0, dead: 0, score: 0, milestone: 0, seed: seed || 1,
  }
  extend(g, 400)
  return g
}

const groundTop = (g: Run, px: number) => {
  const h = g.ground[Math.floor(px / T)] ?? 2
  return h === 0 ? Infinity : H - h * T
}

/** 한 틱. 화면과 상관없는 순수 규칙이라 테스트에서 그대로 부른다. */
export function stepRun(g: Run, j: Juice) {
  if (g.phase === 'dead') {
    g.dead += 1
    g.vy += 300 * DT
    g.y += g.vy * DT
    return
  }
  if (g.phase !== 'play') return
  g.tick += 1
  if (g.safe > 0) g.safe -= 1
  const wasGround = g.onGround
  const fall = g.vy
  // 가로: 벽이면 멈춘다(점프로 넘는다)
  const nx = g.x + speedOf(g) * DT
  const wall = Math.min(groundTop(g, nx + 3), groundTop(g, nx))
  if (wall < g.y + 6 - 0.5) {
    g.x = Math.floor((nx + 3) / T) * T - 4
  } else g.x = nx
  // 세로
  g.vy = Math.min(150, g.vy + 300 * DT)
  const ny = g.y + g.vy * DT
  const floor = Math.min(groundTop(g, g.x + 0.5), groundTop(g, g.x + 3.5))
  g.onGround = false
  if (g.vy >= 0 && g.y + 6 <= floor + 0.01 && ny + 6 >= floor) {
    g.y = floor - 6
    g.vy = 0
    g.onGround = true
    g.air = 0
    g.lastGround = g.tick
  } else g.y = ny
  // 머리로 상자 치기
  if (g.vy < 0) {
    const key = `${Math.floor((g.x + 2) / T)},${Math.floor(g.y / T)}`
    const box = g.boxes.get(key)
    if (box !== undefined) {
      g.vy = 20
      g.y = (Math.floor(g.y / T) + 1) * T
      if (box) {
        g.boxes.set(key, false)
        g.coinsGot += 1
        j.hit('small', g.x + 2, g.y - 4, ['#ffec27', '#ffa300'], '+10', '#ffec27')
      }
    }
  }
  if (g.buffer > 0) g.buffer -= 1
  if (g.onGround && g.buffer > 0) {
    // 착지 직전에 누른 스페이스: 내리찍기 대신 착지하자마자 점프
    g.buffer = 0
    jump(g, j)
  }
  if (g.onGround && !wasGround) {
    const heavy = fall > 110
    j.kick(heavy ? 1.5 : 1.25, heavy ? 0.55 : 0.75)
    j.burst(g.x + 2, g.y + 6, heavy ? 6 : 2, ['#fff1e8', '#c2c3c7'], 14, 30, 0.35, true)
    if (heavy) j.trauma = Math.min(1, j.trauma + 0.3)
    g.combo = 0
  }
  if (g.onGround && g.tick % 4 === 0) j.burst(g.x, g.y + 6, 1, ['#c2c3c7'], 6, -10, 0.25, true)
  // 코인
  g.coins = g.coins.filter(c => {
    const got = Math.abs(c.x - (g.x + 2)) < 4 && Math.abs(c.y - (g.y + 3)) < 5
    if (got) {
      g.coinsGot += 1
      j.burst(c.x, c.y, 3, ['#ffec27', '#ffffff'], 12, 20, 0.3)
    }
    return !got
  })
  // 버그
  for (const b of g.bugs) {
    if (!b.alive) {
      b.dead += 1
      continue
    }
    if (b.x > g.x + 200) continue
    const nbx = b.x + b.vx * DT
    if (groundTop(g, b.vx < 0 ? nbx : nbx + 4) !== b.y + 3) b.vx = -b.vx
    else b.x = nbx
    const hit = g.x < b.x + 4 && g.x + 4 > b.x && g.y < b.y + 3 && g.y + 6 > b.y
    if (!hit || g.safe > 0) continue
    if (g.vy > 0 && g.y + 6 - b.y < 4) {
      b.alive = false
      g.combo += 1
      g.stomps += 50 * 2 ** Math.min(g.combo - 1, 4)
      g.vy = -95
      g.air = 0
      j.kick(1.4, 0.65)
      const pts = 50 * 2 ** Math.min(g.combo - 1, 4)
      j.hit(g.combo >= 3 ? 'large' : 'medium', b.x + 2, b.y, ['#ff004d', '#ffa300', '#ffffff'], g.combo > 1 ? `+${pts} x${g.combo}` : `+${pts}`, g.combo > 1 ? '#ffec27' : '#ffffff')
    } else if (g.shield) {
      g.shield = false
      g.safe = 30
      j.hit('medium', g.x + 2, g.y + 3, ['#29adff', '#ffffff'], '방패!', '#29adff', true)
    } else kill(g, j)
  }
  if (g.y > H + 4) kill(g, j)
  const m = Math.floor(g.x / T / 100)
  if (m > g.milestone) {
    g.milestone = m
    j.pop(g.x + 20, 8, `${m * 100}m!`, '#00e436')
  }
  g.score = Math.floor(g.x / T) + g.coinsGot * 10 + g.stomps
  g.bugs = g.bugs.filter(b => b.x > g.x - 60)
  g.coins = g.coins.filter(c => c.x > g.x - 60)
  extend(g, g.x + 400)
}

export function kill(g: Run, j: Juice) {
  g.phase = 'dead'
  g.dead = 0
  g.vy = -110
  j.hit('large', g.x + 2, Math.min(g.y, H - 4), ['#ff004d', '#ffffff', '#29adff'], undefined, '#fff', true)
}

function jump(g: Run, j: Juice) {
  g.vy = -82
  g.onGround = false
  g.lastGround = -99
  j.kick(0.7, 1.35)
  j.burst(g.x + 2, g.y + 6, 3, ['#fff1e8', '#c2c3c7'], 14, 30, 0.3, true)
}

export function press(g: Run, j: Juice, key: string): 'start' | undefined {
  if (g.phase === 'ready' || (g.phase === 'dead' && g.dead > 15)) return [' ', 'return', 'up', 'w', 'k', 'z'].includes(key) ? 'start' : undefined
  if (g.phase !== 'play') return undefined
  const action = [' ', 'up', 'w', 'k', 'z'].includes(key)
  // 땅에서 스페이스는 점프, 공중에서 스페이스는 내리찍기(이 게임의 조작). ↓도 내리찍기.
  // 발판에서 떨어진 직후(3틱)는 아직 땅으로 친다. 내려오다 땅 바로 위(3틱 안에 닿을 높이)에서 누르면 착지하자마자 뛴다.
  const coyote = !g.onGround && g.vy >= 0 && g.tick - g.lastGround <= 3 && g.air === 0
  const nearLanding = !g.onGround && g.vy > 0 && groundTop(g, g.x + 2) - (g.y + 6) < g.vy * DT * 3 + 1
  if (action && (g.onGround || coyote)) {
    jump(g, j)
  } else if (action && nearLanding) {
    g.buffer = 3
  } else if ((action || ['down', 's', 'j'].includes(key)) && !g.onGround && g.vy < 150) {
    g.vy = 150
    g.air += 1
    j.kick(0.75, 1.3)
    j.burst(g.x + 2, g.y, 3, ['#ffffff', '#29adff'], 8, -20, 0.25)
  }
  return undefined
}

