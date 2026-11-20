// 한길 달리기(터미널판): 로봇이 저절로 오른쪽으로 달린다. 터미널은 키를 뗀 것을 모르니 누르기만으로 한다.
// 스페이스 점프, 공중에서 스페이스는 내리찍기. 갈수록 빨라지는 끝없는 코스, 버그를 연달아 밟으면 점수가 두 배씩.

import type { ClientModule, ClientSurface } from 'claude-code'
import { Juice, normKey } from './juice'
import { CRAWLER, PAL, PixelRows, ROBOT_A, ROBOT_B, fillRect, makeGrid, stamp } from './pixel'
import type { Grid } from './pixel'
import { H, T, newRun, press, stepRun } from './runner_rules'
import type { Run } from './runner_rules'
const SKY = '#29adff'
const PX = 12 // 화면에서 로봇이 서는 열

type Props = { bonus: number; best: number; cols: number; input?: { seq: number; key: string } }
function draw(g: Run, j: Juice, cols: number, fr: number): Grid {
  const grid = makeGrid(cols, H)
  const [ox, oy] = j.offset()
  const cam = Math.round(g.x - PX) - ox
  for (let i = 0; i < 4; i++) {
    const cx = ((((i * 47 - cam * 0.3) % (cols + 20)) + cols + 20) % (cols + 20)) - 10
    stamp(grid, ['.ww.', 'wwww'], cx, 3 + (i % 2) * 4 + oy)
  }
  for (let x = 0; x < cols; x++) {
    const hh = 6 + Math.round(4 * Math.abs(Math.sin((x + cam * 0.5) / 14)))
    fillRect(grid, x, H - hh - 6 + oy, 1, hh + 6, '#00e436')
  }
  const first = Math.floor(cam / T)
  for (let tx = first; tx <= first + Math.ceil(cols / T) + 1; tx++) {
    const h = g.ground[tx] ?? 0
    if (h === 0) fillRect(grid, tx * T - cam, H - 2 * T + oy, T, 2 * T + 2, '#1d2b53') // 구덩이는 어둡게
    if (h > 0) {
      fillRect(grid, tx * T - cam, H - h * T + oy, T, h * T, PAL.n ?? '#9a5b2e')
      fillRect(grid, tx * T - cam, H - h * T + oy, T, 1, PAL.G ?? '#46c35c')
    }
  }
  for (const [key, full] of g.boxes) {
    const [tx, ty] = key.split(',').map(Number)
    if (tx === undefined || ty === undefined) continue
    stamp(grid, full ? ['oyyo', 'okyo', 'oyko', 'oooo'] : ['NNNN', 'NnnN', 'NnnN', 'NNNN'], tx * T - cam, ty * T + oy)
  }
  for (const c of g.coins) stamp(grid, fr % 6 < 3 ? ['yy', 'yy'] : ['.y', '.y'], c.x - cam - 1, c.y - 1 + oy)
  for (const b of g.bugs) if (b.alive) stamp(grid, CRAWLER, b.x - cam, b.y + oy)
  j.drawParts(grid, cam)
  const blink = g.safe > 0 && fr % 2 === 0
  if (!blink) {
    const [sx, sy] = j.scale()
    const body = g.phase === 'dead' || !g.onGround ? ROBOT_A : fr % 4 < 2 ? ROBOT_A : ROBOT_B
    const h = Math.max(3, Math.round(6 * sy))
    const sprite = Array.from({ length: h }, (_, i) => body[Math.min(5, Math.floor((i * 6) / h))] ?? '')
    const w = Math.round(4 * sx)
    const wide = sprite.map(line => Array.from({ length: w }, (_, i) => line[Math.min(3, Math.floor((i * 4) / w))]).join(''))
    stamp(grid, wide, PX + ox - Math.round((w - 4) / 2), g.y + 6 - h + oy)
    if (g.shield) stamp(grid, ['c....c'], PX + ox - 1, g.y + 2 + oy)
  }
  if (j.flash > 0) for (const row of grid) row.fill('#ffffff')
  return grid
}

type State = { g: Run; j: Juice; props: Props; seq: number }

/** 키 하나를 상태에 반영한다(그리는 중에도 부를 수 있게 setState는 부르는 쪽이 정한다). */
function apply(surface: ClientSurface<State>, s: State, key: string) {
  if (press(s.g, s.j, key) !== 'start') return
  const shield = s.props.bonus > 0
  if (shield) surface.post({ type: 'bonus', game: 'runner' })
  s.g = newRun(Math.floor(Math.random() * 1e9), shield)
  s.g.phase = 'play'
  s.j = new Juice()
}

function onKey(surface: ClientSurface<State>, key: string) {
  const s = surface.state
  if (s === undefined) return
  apply(surface, s, key)
  surface.setState({ ...s })
}

const RunnerView: ClientModule<Props, State> = (props, surface) => {
  const { Box, Text } = surface.elements
  let s = surface.state
  if (s === undefined) {
    s = { g: newRun(1), j: new Juice(), props, seq: props.input?.seq ?? 0 }
    surface.setState(s)
    surface.every(50, () => {
      const cur = surface.state
      if (cur === undefined || cur.g.phase === 'ready') return
      if (!cur.j.tick()) stepRun(cur.g, cur.j)
      if (cur.g.phase === 'dead' && cur.g.dead === 20) surface.post({ type: 'score', game: 'runner', score: cur.g.score })
      surface.setState({ ...cur })
    })
    surface.onKey(k => onKey(surface, normKey(k.key)))
    surface.onPointer(p => p.type === 'down' && onKey(surface, ' '))
  } else {
    s.props = props
    if (props.input !== undefined && props.input.seq !== s.seq) {
      s.seq = props.input.seq
      apply(surface, s, props.input.key)
    }
  }
  const { g, j } = s
  const cols = Math.max(40, Math.min(120, props.cols))
  return (
    <Box flexDirection="column">
      <Text mono>
        <Text color="#00e436">{Math.floor(g.x / T)}m</Text>
        {'  '}
        <Text color="#ffec27">코인 {g.coinsGot}</Text>
        {'  '}점수 {g.score}
        {g.shield ? <Text color="#29adff">  방패</Text> : ''}
        {'  '}
        <Text dimColor>최고 {Math.max(props.best, g.phase === 'dead' ? g.score : 0)}</Text>
      </Text>
      <Box position="relative">
        <PixelRows els={surface.elements} grid={draw(g, j, cols, g.tick)} bg={SKY} />
        {j.popLayer(surface.elements, cols, H / 2, Math.round(g.x - PX))}
      </Box>
      {g.phase === 'ready' && <Text color="#ffec27">게임을 한 번 클릭하고 스페이스로 출발 (클릭이 안 되면 아래 W 버튼)</Text>}
      {g.phase === 'play' && <Text dimColor>스페이스 점프 · 공중에서 스페이스 내리찍기 · 버그는 밟거나 내리찍기</Text>}
      {g.phase === 'dead' && <Text color="#ff004d">넘어졌어요! {g.score}점 · 스페이스로 다시</Text>}
    </Box>
  )
}

export default RunnerView
