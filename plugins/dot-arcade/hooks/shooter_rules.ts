// 버그 편대 격추(터미널판) 규칙. 누르기만으로 한다: 연사는 자동, ← → 한 번에 한 칸씩 미끄러지듯,
// 스페이스는 게이지를 다 채우면 쓰는 산탄. 편대는 휘어 들어와 자리를 잡고, 고리를 그리며 내리꽂는다.

import { DT, Juice } from './juice'

export const H = 40
export const SHIP_Y = H - 4
const ROWS = 3
const POINTS = [80, 50, 30]
export const BUG_COLORS = [['#ffa300', '#ffec27'], ['#83769c', '#ffffff'], ['#ff77a8', '#ffffff']]

export type Bug = {
  r: number; c: number; hp: number; mode: 'enter' | 'home' | 'dive' | 'back'
  x: number; y: number; k: number; from: [number, number]; via: [number, number]
  hit: number; dk: number; ox: number; oy: number; dir: number; aim: number; shots: number
}
export type Shoot = {
  phase: 'ready' | 'play' | 'dead' | 'over'
  w: number; x: number; tx: number; cols: number
  shots: { x: number; y: number; vx: number }[]; bombs: { x: number; y: number; vx: number; vy: number }[]
  caps: { x: number; y: number }[]; bugs: Bug[]
  wave: number; score: number; lives: number; t: number; cool: number; double: number
  safe: number; chain: number; chainT: number; charge: number; timer: number; seed: number
  dir: number; holdUntil: number; lastMove: number
}

function rnd(g: Shoot) {
  g.seed = (Math.imul(g.seed, 1664525) + 1013904223) >>> 0
  return g.seed / 4294967296
}

export function slot(g: Shoot, b: Bug): [number, number] {
  const breathe = 1 + 0.08 * Math.sin(g.t / 20)
  const cx = g.w / 2 + 4 * Math.sin(g.t / 35)
  return [cx + (b.c - (g.cols - 1) / 2) * 6 * breathe - 2, 3 + b.r * 5]
}

function makeWave(g: Shoot) {
  g.bugs = []
  for (let r = 0; r < ROWS; r++)
    for (let c = 0; c < g.cols; c++) {
      const side = (r + c) % 2
      g.bugs.push({
        r, c, hp: r === 0 ? 2 : 1, mode: 'enter', x: -9, y: -9, k: -(r * 30 + c * 4) / 40,
        from: [side ? g.w + 4 : -6, 8 + r * 3], via: [g.w / 2 + (side ? 25 : -25), H + 6],
        hit: 0, dk: 0, ox: 0, oy: 0, dir: 1, aim: 0, shots: 0,
      })
    }
  g.bombs = []
}

export function newShoot(w: number, seed: number, bonusLife = false): Shoot {
  const g: Shoot = {
    phase: 'ready', w, x: w / 2 - 2, tx: w / 2 - 2, cols: Math.max(5, Math.min(9, Math.floor((w - 10) / 6))),
    shots: [], bombs: [], caps: [], bugs: [], wave: 1, score: 0, lives: bonusLife ? 4 : 3, t: 0, cool: 0,
    double: 0, safe: 0, chain: 0, chainT: 0, charge: 0, timer: 0, seed: seed || 1, dir: 0, holdUntil: 0, lastMove: -99,
  }
  makeWave(g)
  return g
}

function moveBug(g: Shoot, b: Bug) {
  const speed = 1 + g.wave * 0.12
  if (b.hit) b.hit -= 1
  if (b.mode === 'enter') {
    b.k += speed / 40
    if (b.k < 0) return
    const k = Math.min(1, b.k)
    const [sx, sy] = slot(g, b)
    const a = (1 - k) ** 2, m = 2 * (1 - k) * k, c = k * k
    b.x = a * b.from[0] + m * b.via[0] + c * sx
    b.y = a * b.from[1] + m * b.via[1] + c * sy
    if (k >= 1) b.mode = 'home'
  } else if (b.mode === 'home') {
    ;[b.x, b.y] = slot(g, b)
  } else if (b.mode === 'dive') {
    b.dk += DT
    if (b.dk < 0.6) {
      const a = (b.dk / 0.6) * Math.PI * 1.5
      b.x = b.ox + b.dir * (1 - Math.cos(a)) * 5
      b.y = b.oy - Math.sin(a) * 4
    } else {
      b.aim = Math.max(-25, Math.min(25, b.aim + (g.x - b.x) * 0.08 * speed))
      b.x += (b.aim + 14 * Math.sin(b.dk * 5)) * DT
      b.y += (22 + 4 * g.wave) * DT
      if (b.shots < 1 + Math.floor(g.wave / 3) && b.y > 12 && b.y < 26 && rnd(g) < 0.08) {
        b.shots += 1
        const dx = g.x + 2 - b.x, dy = SHIP_Y - b.y, d = Math.hypot(dx, dy) || 1, v = 26 + g.wave * 2
        g.bombs.push({ x: b.x + 2, y: b.y + 4, vx: (dx / d) * v, vy: (dy / d) * v })
      }
    }
    if (b.y > H + 4) {
      b.mode = 'back'
      b.y = -6
    }
  } else {
    const [sx, sy] = slot(g, b)
    b.x += (sx - b.x) * 0.15
    b.y += 1.2
    if (b.y >= sy) b.mode = 'home'
  }
}

function kill(g: Shoot, b: Bug, j: Juice) {
  const diving = b.mode === 'dive' || b.mode === 'back'
  g.chain = g.chainT > 0 ? g.chain + 1 : 1
  g.chainT = 14
  const mult = Math.min(5, 1 + Math.floor((g.chain - 1) / 2))
  const pts = (POINTS[b.r] ?? 30) * (diving ? 2 : 1) * mult
  g.score += pts
  g.charge = Math.min(100, g.charge + 8)
  const colors = BUG_COLORS[b.r] ?? ['#ffffff']
  j.hit(diving && b.r === 0 ? 'large' : diving || b.r === 0 ? 'medium' : 'small', b.x + 2, b.y + 2, [...colors, '#ffffff'],
    mult > 1 ? `+${pts} x${mult}` : `+${pts}`, mult > 2 || diving ? '#ffec27' : '#ffffff')
  if (rnd(g) < 0.07 && !g.double) g.caps.push({ x: b.x, y: b.y })
}

/** 한 틱. */
export function stepShoot(g: Shoot, j: Juice) {
  if (g.phase === 'ready') return
  g.t += 1
  g.timer += 1
  if (g.phase === 'dead' && g.timer > 30) {
    if (g.lives <= 0) {
      g.phase = 'over'
      g.timer = 0
    } else Object.assign(g, { phase: 'play', safe: 50, x: g.w / 2 - 2, tx: g.w / 2 - 2 })
  }
  if (g.t < g.holdUntil) {
    // 누르고 있는 동안: 1초에 64픽셀로 곧게 간다
    g.x = Math.max(0, Math.min(g.w - 5, g.x + g.dir * 3.2))
    g.tx = g.x
  } else g.x += (g.tx - g.x) * 0.6 // 클릭으로 정한 자리
  for (const s of g.shots) {
    s.y -= 4
    s.x += s.vx
  }
  g.shots = g.shots.filter(s => s.y > -2 && s.x > -2 && s.x < g.w + 2)
  for (const b of g.bombs) {
    b.x += b.vx * DT
    b.y += b.vy * DT
  }
  g.bombs = g.bombs.filter(b => b.y < H + 2)
  for (const c of g.caps) c.y += 0.7
  if (g.phase === 'play') {
    if (g.safe) g.safe -= 1
    if (g.chainT) g.chainT -= 1
    if (g.double) g.double -= 1
    if (g.cool > 0) g.cool -= 1
    else if (g.shots.length < (g.double ? 8 : 4)) {
      g.cool = 3
      for (const dx of g.double ? [0, 4] : [2]) g.shots.push({ x: g.x + dx, y: SHIP_Y - 1, vx: 0 })
    }
    const every = Math.max(10, 30 - g.wave * 3)
    if (g.t % every === 0) {
      const homes = g.bugs.filter(b => b.hp > 0 && b.mode === 'home').sort((a, b) => b.r - a.r)
      const pick = homes[Math.floor(rnd(g) * Math.min(homes.length, g.cols))]
      if (pick) Object.assign(pick, { mode: 'dive', dk: 0, ox: pick.x, oy: pick.y, dir: pick.x > g.w / 2 ? -1 : 1, aim: 0, shots: 0 })
    }
  }
  for (const b of g.bugs) if (b.hp > 0) moveBug(g, b)
  if (g.phase !== 'play') return
  for (const b of g.bugs) {
    if (b.hp <= 0 || (b.mode === 'enter' && b.k < 0)) continue
    for (const s of g.shots) {
      if (s.x >= b.x - 0.5 && s.x <= b.x + 4.5 && s.y >= b.y - 1 && s.y <= b.y + 4) {
        s.y = -9
        b.hp -= 1
        b.hit = 3
        if (b.hp > 0) j.burst(s.x, b.y + 4, 3, ['#ffffff', '#ffec27'], 14, 0, 0.2)
        else kill(g, b, j)
        break
      }
    }
  }
  g.caps = g.caps.filter(c => {
    const got = Math.abs(c.x - g.x) < 5 && Math.abs(c.y - SHIP_Y) < 4
    if (got) {
      g.double = 200
      j.hit('medium', g.x + 2, SHIP_Y, ['#29adff', '#ffffff'], '더블 샷!', '#29adff')
    }
    return !got && c.y < H + 4
  })
  const hit = g.safe === 0 && (g.bombs.some(b => b.x >= g.x - 0.5 && b.x <= g.x + 5 && b.y >= SHIP_Y - 1 && b.y <= SHIP_Y + 3) ||
    g.bugs.some(b => b.hp > 0 && b.mode === 'dive' && Math.abs(b.x - g.x) < 4 && Math.abs(b.y - SHIP_Y) < 4))
  if (hit) {
    g.lives -= 1
    g.phase = 'dead'
    g.timer = 0
    g.bombs = []
    g.double = 0
    j.hit('large', g.x + 2, SHIP_Y + 1, ['#ff004d', '#ffa300', '#ffec27', '#ffffff'], undefined, '#fff', true)
  }
  if (g.bugs.every(b => b.hp <= 0)) {
    const bonus = 300 * g.wave
    g.score += bonus
    j.hit('large', g.w / 2, 16, ['#ffec27', '#00e436', '#ffffff'], `웨이브 ${g.wave} 클리어! +${bonus}`, '#ffec27', true)
    g.wave += 1
    makeWave(g)
  }
}

export function pressShoot(g: Shoot, j: Juice, key: string): 'start' | undefined {
  if (g.phase === 'ready' || (g.phase === 'over' && g.timer > 15)) return [' ', 'return', 'up', 'w', 'k'].includes(key) ? 'start' : undefined
  if (g.phase !== 'play') return undefined
  const dir = ['left', 'a', 'h'].includes(key) ? -1 : ['right', 'd', 'l'].includes(key) ? 1 : 0
  if (dir !== 0) {
    // 터미널은 키를 누르고 있으면 첫 입력 뒤 약 0.5초 쉬고 반복을 보낸다.
    // 첫 입력이면 0.55초 동안 계속 가서 그 공백을 메우고, 반복 중이면 0.15초만 가서 떼면 바로 선다.
    const repeating = g.t - g.lastMove <= 3 && g.dir === dir
    g.dir = dir
    g.lastMove = g.t
    g.holdUntil = g.t + (repeating ? 3 : 11)
    if (!repeating) g.x = Math.max(0, Math.min(g.w - 5, g.x + dir * 2)) // 누르는 즉시 한 걸음
    g.tx = g.x
  }
  if ([' ', 'up', 'w', 'k'].includes(key) && g.charge >= 100) {
    g.charge = 0
    for (let i = -3; i <= 3; i++) g.shots.push({ x: g.x + 2, y: SHIP_Y - 1, vx: i * 0.6 })
    j.hit('medium', g.x + 2, SHIP_Y - 2, ['#29adff', '#ffffff', '#ffec27'], '산탄!', '#29adff', true)
  }
  return undefined
}
