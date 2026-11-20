// 버그 편대 격추(터미널판) 그리기. 규칙은 shooter_rules.ts.

import type { ClientModule, ClientSurface } from 'claude-code'
import { Juice, normKey } from './juice'
import { BUG_1, BUG_2, BUG_3, PixelRows, SHIP, fillRect, makeGrid, stamp } from './pixel'
import type { Grid } from './pixel'
import { H, SHIP_Y, newShoot, pressShoot, stepShoot } from './shooter_rules'
import type { Shoot } from './shooter_rules'

const BG = '#0d1030'
const SPRITES = [BUG_3, BUG_1, BUG_2]
const WHITE = ['w..w', '.ww.', 'wwww', 'w..w']

type Props = { bonus: number; best: number; cols: number; input?: { seq: number; key: string } }
type State = { g: Shoot; j: Juice; props: Props; seq: number }

function draw(g: Shoot, j: Juice): Grid {
  const grid = makeGrid(g.w, H)
  const [ox, oy] = j.offset()
  for (let i = 0; i < 26; i++) {
    const x = (i * 37) % g.w
    const y = Math.floor((i * 53 + g.t * (0.3 + (i % 3) * 0.3)) % H)
    stamp(grid, [i % 3 === 0 ? 'g' : 'B'], x, y)
  }
  for (const b of g.bugs) {
    if (b.hp <= 0 || (b.mode === 'enter' && b.k < 0)) continue
    const sprite = b.hit > 1 ? WHITE : (SPRITES[b.r] ?? BUG_1)
    stamp(grid, g.t % 10 < 5 || b.mode !== 'home' ? sprite : sprite.slice(1).concat(sprite.slice(0, 1)), b.x + ox, b.y + oy)
  }
  for (const s of g.shots) fillRect(grid, s.x + ox, s.y + oy, 1, 2, '#ffec27')
  for (const b of g.bombs) fillRect(grid, b.x + ox, b.y + oy, 1, 2, g.t % 4 < 2 ? '#ff004d' : '#ff77a8')
  for (const c of g.caps) stamp(grid, ['cc', 'cc'], c.x + ox, c.y + oy)
  j.drawParts(grid, -ox)
  if (g.phase === 'play' && !(g.safe && g.t % 2)) {
    const [sx] = j.scale()
    stamp(grid, sx < 0.9 ? ['.c.', 'cwc', 'bbb'] : SHIP, g.x + ox + (sx < 0.9 ? 1 : 0), SHIP_Y + oy)
  }
  if (j.flash > 0) for (const row of grid) row.fill('#ffffff')
  return grid
}

function apply(surface: ClientSurface<State>, s: State, key: string) {
  if (['left', 'a', 'h', 'right', 'd', 'l'].includes(key)) s.j.kick(0.8, 1)
  if (pressShoot(s.g, s.j, key) !== 'start') return
  const bonus = s.props.bonus > 0
  if (bonus) surface.post({ type: 'bonus', game: 'shooter' })
  s.g = newShoot(Math.max(40, Math.min(100, s.props.cols)), Math.floor(Math.random() * 1e9), bonus)
  s.g.phase = 'play'
  s.j = new Juice()
  s.j.pop(s.g.w / 2, 18, '웨이브 1', '#ffec27')
}

function onKey(surface: ClientSurface<State>, key: string) {
  const s = surface.state
  if (s === undefined) return
  apply(surface, s, key)
  surface.setState({ ...s })
}

const ShooterView: ClientModule<Props, State> = (props, surface) => {
  const { Box, Text } = surface.elements
  let s = surface.state
  if (s === undefined) {
    s = { g: newShoot(Math.max(40, Math.min(100, props.cols)), 1), j: new Juice(), props, seq: props.input?.seq ?? 0 }
    surface.setState(s)
    surface.every(50, () => {
      const cur = surface.state
      if (cur === undefined || cur.g.phase === 'ready') return
      const wasOver = cur.g.phase === 'over'
      if (!cur.j.tick()) stepShoot(cur.g, cur.j)
      if (!wasOver && cur.g.phase === 'over') surface.post({ type: 'score', game: 'shooter', score: cur.g.score })
      surface.setState({ ...cur })
    })
    surface.onKey(k => onKey(surface, normKey(k.key)))
    surface.onPointer(p => {
      if (p.type !== 'down') return
      const cur = surface.state
      if (cur === undefined) return
      if (cur.g.phase !== 'play') return onKey(surface, ' ')
      cur.g.tx = Math.max(0, Math.min(cur.g.w - 5, p.x - 2))
      surface.setState({ ...cur })
    })
  } else {
    s.props = props
    if (props.input !== undefined && props.input.seq !== s.seq) {
      s.seq = props.input.seq
      apply(surface, s, props.input.key)
    }
  }
  const { g, j } = s
  const gauge = '■'.repeat(Math.floor(g.charge / 10)) + '□'.repeat(10 - Math.floor(g.charge / 10))
  return (
    <Box flexDirection="column">
      <Text mono>
        <Text color="#ffec27">점수 {g.score}</Text>
        {'  '}
        <Text color="#ff004d">{'♥'.repeat(Math.max(0, g.lives)) || '-'}</Text>
        {'  '}웨이브 {g.wave}{'  '}
        <Text color={g.charge >= 100 ? '#29adff' : '#5f574f'}>산탄 {gauge}</Text>
        {g.chain > 2 ? <Text color="#ffec27">  연속 x{Math.min(5, 1 + Math.floor((g.chain - 1) / 2))}</Text> : ''}
      </Text>
      <Box position="relative">
        <PixelRows els={surface.elements} grid={draw(g, j)} bg={BG} />
        {j.popLayer(surface.elements, g.w, H / 2)}
      </Box>
      {g.phase === 'ready' && <Text color="#29adff">게임을 한 번 클릭하고 스페이스로 시작 (클릭이 안 되면 아래 W 버튼)</Text>}
      {(g.phase === 'play' || g.phase === 'dead') && <Text dimColor>← → 이동(누를 때마다) · 연사는 자동 · 게이지가 차면 스페이스로 산탄</Text>}
      {g.phase === 'over' && <Text color="#ffec27">게임 오버! {g.score}점 · 스페이스로 다시</Text>}
    </Box>
  )
}

export default ShooterView
