import { expect, mock, test } from 'claude-code/testing'

import { WORDS, dailyAnswer, kstDay, readGuess } from '../hooks/jamo'
import { burstConfetti, normalizeTyped, stepConfetti } from '../hooks/jamo_view'
import { Juice, normKey } from '../hooks/juice'
import { addedChars, gameKey } from '../hooks/keys'
import { labelOf, launchArgv, stamp, topicOf } from '../hooks/register'
import { H, T, newRun, press, stepRun } from '../hooks/runner_rules'
import { SHIP_Y, newShoot, pressShoot, stepShoot } from '../hooks/shooter_rules'

const NOW = Date.UTC(2026, 10, 19, 5, 2)

test('한국 시각 날짜, 세션 이름, 큰 창 명령', () => {
  expect(stamp(NOW)).toBe('2026.11.19 (목) 14:02')
  expect(labelOf('C:\\Users\\me\\my-app\\.claude\\worktrees\\happy-otter-1a2b3c')).toBe('my-app/happy-otter-1a2b3c')
  expect(launchArgv('C:\\me\\dot-arcade\\plugins\\dot-arcade', 'runner')).toEqual(
    ['cmd', '/c', 'start', '', 'pyw', 'C:/me/dot-arcade/plugins/dot-arcade/game/main.py', '--game', 'runner'])
})

test('세션 주제는 시스템 태그를 빼고 첫 문장', () => {
  expect(topicOf('<system-reminder>\n규칙들\n</system-reminder>\n휴가 신청 화면 고쳐 줘\n자세히는')).toBe('휴가 신청 화면 고쳐 줘')
  expect(topicOf('<command-name>/arcade</command-name> 게임')).toBe('게임')
})

test('자모: 한글, 자모, 두벌식 자리 입력을 모두 받고 5칸이 아니면 돌려보낸다', () => {
  expect(readGuess('사과')).toEqual({ jamo: ['ㅅ', 'ㅏ', 'ㄱ', 'ㅗ', 'ㅏ'], word: '사과' })
  expect(readGuess('tkrhk')).toEqual({ jamo: ['ㅅ', 'ㅏ', 'ㄱ', 'ㅗ', 'ㅏ'], word: '사과' })
  expect(readGuess('ㅂㅏㄹㅏㅁ')).toEqual({ jamo: ['ㅂ', 'ㅏ', 'ㄹ', 'ㅏ', 'ㅁ'], word: '바람' })
  expect(readGuess('사ㄱhk')).toEqual({ jamo: ['ㅅ', 'ㅏ', 'ㄱ', 'ㅗ', 'ㅏ'], word: '사과' }) // 섞어 쳐도 된다
  expect('error' in readGuess('나무')).toBe(true)
  // 겹자모는 모두 기본 자모로 푼다: ㄲ → ㄱㄱ, ㅐ → ㅏㅣ, ㅔ → ㅓㅣ
  expect(readGuess('까치')).toEqual({ jamo: ['ㄱ', 'ㄱ', 'ㅏ', 'ㅊ', 'ㅣ'], word: '까치' })
  expect(readGuess('Rkcl')).toEqual({ jamo: ['ㄱ', 'ㄱ', 'ㅏ', 'ㅊ', 'ㅣ'], word: '까치' }) // Shift+r = ㄲ
  expect(readGuess('ㅅㅐㄱㅣ')).toEqual({ jamo: ['ㅅ', 'ㅏ', 'ㅣ', 'ㄱ', 'ㅣ'], word: '새기' })
  expect('error' in readGuess('새벽')).toBe(true) // ㅅㅏㅣㅂㅕㄱ: 6칸
  expect('error' in readGuess('ㅏㅏㅏㅏㅏ')).toBe(true)
})

test('자모: 낱말 목록과 오늘의 낱말이 큰 창(파이썬)판과 같다', () => {
  expect(WORDS.length).toBe(162)
  expect(kstDay(NOW)).toBe(20776)
  expect(dailyAnswer(20776)).toBe('이름')
  expect(dailyAnswer(20777)).toBe('음표')
})

test('색종이: 위로 터졌다가 떨어진다', () => {
  let parts = burstConfetti(60, 40, 7)
  expect(parts.length).toBe(40)
  const y0 = Math.min(...parts.map(p => p.y))
  for (let t = 0; t < 4; t++) parts = stepConfetti(parts, t)
  expect(Math.min(...parts.map(p => p.y))).toBeLessThan(y0)  // 처음엔 위로
  for (let t = 4; t < 30; t++) parts = stepConfetti(parts, t)
  expect(Math.max(...parts.map(p => p.y))).toBeGreaterThan(y0 + 5) // 나중엔 아래로
})

test('달리기: 스페이스로 뛰고, 공중에서 스페이스를 또 누르면 내리찍는다', () => {
  const g = newRun(7)
  const j = new Juice()
  g.phase = 'play'
  const ground = g.y
  press(g, j, ' ')
  stepRun(g, j)
  expect(g.y).toBeLessThan(ground)
  for (let i = 0; i < 4; i++) stepRun(g, j)
  press(g, j, ' ')
  expect(g.vy).toBe(150) // 공중 스페이스 = 내리찍기
  expect(g.air).toBe(1)
  for (let i = 0; i < 40 && !g.onGround; i++) stepRun(g, j)
  expect(g.onGround || (g.phase as string) === 'dead').toBe(true)
})

test('달리기: 구덩이에 빠지면 넘어지고, 버그를 밟으면 연속 점수', () => {
  const g = newRun(3)
  const j = new Juice()
  g.phase = 'play'
  g.ground = g.ground.map((h, i) => (i >= 5 && i < 12 ? 0 : h))
  for (let i = 0; i < 80 && g.phase === 'play'; i++) stepRun(g, j)
  expect(g.phase).toBe('dead')

  const s = newRun(3)
  s.phase = 'play'
  s.bugs = [{ x: s.x, y: H - 2 * T - 3, vx: 0, alive: true, dead: 0 }]
  s.y = H - 2 * T - 9
  s.vy = 40
  s.onGround = false
  stepRun(s, j)
  expect(s.bugs[0]?.alive).toBe(false)
  expect(s.stomps).toBe(50)
  expect(s.vy).toBeLessThan(0)
})

test('키 받는 칸: 새로 친 글자만 골라 게임 키로 바꾼다', () => {
  expect(addedChars('', ' ')).toEqual([' '])
  expect(addedChars('ad', 'a d')).toEqual([' ']) // 커서를 옮겨 가운데 쳐도
  expect(addedChars('add', 'ad')).toEqual([]) // 지우기는 무시
  expect(['a', 'ㅁ', 'd', 'ㅇ', ' ', 'w', 'x'].map(gameKey)).toEqual(['left', 'left', 'right', 'right', ' ', ' ', undefined])
  expect(normalizeTyped('주a1')).toBe('ㅈㅜㅁ') // 한글은 풀고, 두벌식 자리는 바꾸고, 숫자는 버린다
  expect(normalizeTyped('ㅁㅜㄴㅇㅓㅇ')).toBe('ㅁㅜㄴㅇㅓ') // 다섯 개까지
})

test('키 이름: 터미널이 space, enter로 넘겨도 같은 키로 본다', () => {
  expect(normKey('space')).toBe(' ')
  expect(normKey(' ')).toBe(' ')
  expect(normKey('enter')).toBe('return')
  expect(normKey('ArrowLeft')).toBe('left')
})

test('달리기: 발판에서 막 떨어진 직후와 착지 직전에 누른 스페이스도 점프가 된다', () => {
  const j = new Juice()
  const g = newRun(1)
  g.phase = 'play'
  stepRun(g, j)
  // 발판 끝에서 떨어진 직후(유예 안)
  g.onGround = false
  g.vy = 10
  press(g, j, ' ')
  expect(g.vy).toBe(-82)

  // 내려오다 땅 바로 위에서 누르면 내리찍기 대신 착지하자마자 점프
  const h = newRun(1)
  h.phase = 'play'
  for (let i = 0; i < 3; i++) stepRun(h, j)
  press(h, j, ' ')
  for (let i = 0; i < 6; i++) stepRun(h, j)
  h.lastGround = -99
  h.vy = 100
  h.onGround = false
  h.y -= 2
  press(h, j, ' ')
  expect(h.buffer).toBe(3)
  for (let i = 0; i < 3 && h.vy >= 0; i++) stepRun(h, j)
  expect(h.vy).toBeLessThan(0)
})

test('슈팅: 누르는 즉시 움직이고, 키 반복이 오기 전 공백에도 계속 간다', () => {
  const j = new Juice()
  const g = newShoot(60, 2)
  g.phase = 'play'
  const x0 = g.x
  pressShoot(g, j, 'right')
  expect(g.x).toBeGreaterThan(x0) // 바로 한 걸음
  for (let i = 0; i < 9; i++) stepShoot(g, j) // 0.45초: 아직 반복 입력 전
  expect(g.x - x0).toBeGreaterThan(20)
  const x1 = g.x
  for (let i = 0; i < 6; i++) stepShoot(g, j) // 손을 뗐으면 멈춘다
  expect(g.x - x1).toBeLessThan(8)
})

test('슈팅: 자동 연사로 버그를 맞히고, 폭탄에 맞으면 목숨이 준다', () => {
  const g = newShoot(60, 5)
  const j = new Juice()
  g.phase = 'play'
  for (let i = 0; i < 200 && g.score === 0; i++) {
    j.tick()
    stepShoot(g, j)
  }
  expect(g.score).toBeGreaterThan(0)
  g.safe = 0
  g.bombs = [{ x: g.x + 2, y: SHIP_Y, vx: 0, vy: 0 }]
  const lives = g.lives
  stepShoot(g, j)
  expect(g.lives).toBe(lives - 1)
})

const PANE = {
  plugin: 'dot-arcade', component: 'Pane', requestId: 'dot-arcade',
  props: { title: '도트 오락실', isFocused: true, bodyColumns: 72, placement: 'dock', scroll: { offset: 0, bodyRows: 60 }, view: {} },
} as const

type Body = Extract<Parameters<typeof test>[1], (...args: never[]) => unknown>
type On = Parameters<Body>[1]

function world(on: On) {
  const files = new Map<string, string>()
  const clock = mock.clock(on, { now: NOW })
  mock.env(on, { USERPROFILE: 'C:\\Users\\me' })
  on('ui.panes', () => ({ value: [{ id: 'dot-arcade', title: '도트 오락실', isShown: true, isFocused: true, isPlaced: true }] }))
  on('fs.list', () => ({ value: [] }))
  on('ui.toast', () => ({ value: undefined }))
  on('fs.read', (_, e) => {
    const text = files.get((e as unknown as { path: string }).path)
    if (text === undefined) throw new Error('ENOENT')
    return { value: text }
  })
  on('fs.write', (_, e) => {
    const { path, text } = e as unknown as { path: string; text: string }
    files.set(path, text)
    return { value: undefined }
  })
  return { files, clock }
}

test('창: 게임 셋이 나오고, 고르면 창 안에서 그 게임이 돈다', async ($, on) => {
  world(on)
  for (const surface of ['terminal', 'desktop'] as const) {
    const ui = await $.ui.mount({ ...PANE, surface })
    expect(await ui.find({ key: 'open-jamo' })).toBeDefined()
    await ui.press({ key: 'open-runner' })
    expect(await ui.find({ key: 'runner' })).toBeDefined()
    expect(await ui.find({ key: 'key-w' })).toBeDefined()
    await ui.press({ key: 'back' })
    await ui.press({ key: 'open-shooter' })
    expect(await ui.find({ key: 'shooter' })).toBeDefined()
    await ui.press({ key: 'back' })
    await ui.unmount()
  }
})

test('창: 데스크톱, VS Code, 모바일은 자모 판을 그림으로 그리고, 달리기는 열 곳을 알려 준다', async ($, on) => {
  world(on)
  for (const surface of ['vscode', 'mobile', 'desktop'] as const) {
    const ui = await $.ui.mount({ ...PANE, surface })
    if (surface !== 'desktop') {
      await ui.press({ key: 'open-runner' })
      expect(await ui.find({ type: 'Text', text: /실시간 게임을 그릴 수 없어요/ })).toBeDefined()
      await ui.press({ key: 'back' })
    }
    await ui.press({ key: 'open-jamo' })
    // 모바일 앱은 Input을 받겠다고 한 앱에만 그려 주므로, 화면 자판은 어디서나 된다
    await ui.press({ key: 'k-ㅂ' })
    // 터미널이 아닌 곳은 판을 그림 한 장(어두운 바탕 포함)으로 그린다: 밝은 테마에서도 칸과 글자가 보인다
    const board = (await ui.findAll({ type: 'Svg' }))[0]?.props as { source?: string } | undefined
    expect(board?.source).toContain('>ㅂ</text>')
    expect(board?.source).toContain('fill="#0d1030"')
    if (surface === 'vscode') expect(await ui.find({ key: 'typing' })).toBeDefined()
    await ui.press({ key: 'back' })
    await ui.unmount()
  }
})

test('창: 한/영이 켜진 채 치면 끄라고 알려 준다', async ($, on) => {
  world(on)
  const ui = await $.ui.mount({ ...PANE, surface: 'terminal' })
  await ui.press({ key: 'open-runner' })
  expect(await ui.find({ type: 'Text', text: /한\/영은 꺼 두세요/ })).toBeDefined()
  await ui.input({ key: 'keys', text: 'ㅁ', kind: 'change' })
  expect(await ui.find({ type: 'Text', text: /한\/영이 켜져 있어요/ })).toBeDefined()
  await ui.input({ key: 'keys', text: 'ㅁa', kind: 'change' })
  expect(await ui.find({ type: 'Text', text: /한\/영이 켜져 있어요/ })).toBeUndefined()
  await ui.unmount()
})

test('창: 자모 다섯 칸을 창 안에서 풀면 칸이 뒤집히고 기록이 남는다', async ($, on) => {
  const { files, clock } = world(on)
  const ui = await $.ui.mount({ ...PANE, surface: 'terminal' })
  await ui.press({ key: 'open-jamo' })
  // 자판을 눌러 자모를 칠 수 있고, [삭제]로 지운다
  await ui.press({ key: 'k-ㅂ' })
  await ui.press({ key: 'k-ㅏ' })
  expect(await ui.find({ type: 'Text', text: 'ㅂ' })).toBeDefined()
  await ui.press({ key: 'erase' })
  await ui.press({ key: 'erase' })
  // 타자 칸(포커스가 처음부터 여기): 키마다 바로 칸에 찍힌다(한/영 끈 두벌식 자리)
  await ui.input({ key: 'typing', text: 'a', kind: 'change' })
  expect(await ui.find({ type: 'Text', text: 'ㅁ' })).toBeDefined()
  expect((await ui.find({ key: 'typing' }))?.props).toMatchObject({ value: 'ㅁ', autoFocus: true }) // 칸도 자모로 다시 그려진다
  await ui.input({ key: 'typing', text: '나무' }) // 4칸이면 돌려보낸다
  expect(await ui.find({ type: 'Text', text: /자모가 딱 5개인/ })).toBeDefined()
  await ui.input({ key: 'typing', text: 'ㅐ', kind: 'change' }) // 겹모음은 두 칸
  expect((await ui.find({ key: 'typing' }))?.props).toMatchObject({ value: 'ㅏㅣ' })
  await ui.input({ key: 'typing', text: '나무' })
  expect(await ui.find({ type: 'Text', text: /자모가 딱 5개인/ })).toBeDefined()
  for (const text of ['d', 'dl', 'dlf', 'dlfm', 'dlfma']) await ui.input({ key: 'typing', text, kind: 'change' }) // 이름
  expect((await ui.find({ key: 'typing' }))?.props).toMatchObject({ value: 'ㅇㅣㄹㅡㅁ' })
  await ui.input({ key: 'typing', text: 'ㅇㅣㄹㅡㅁ' })
  await clock.advance(1000)
  expect(await ui.find({ type: 'Text', text: /맞혔어요! 1번 만에 600점/ })).toBeDefined()
  expect((await ui.findAll({ type: 'Text', text: /^[▀▄█▌▐*+]$/ })).length).toBeGreaterThan(10) // 색종이가 터진다
  await clock.advance(3000)
  expect((await ui.findAll({ type: 'Text', text: /^[▀▄█▌▐*+]$/ })).length).toBe(0) // 다 떨어지면 사라진다
  const path = [...files.keys()].find(k => k.endsWith('records.json'))
  expect(path?.split('\\').join('/')).toBe('C:/Users/me/.claude/dot-arcade/records.json')
  const records = JSON.parse(files.get(path ?? '') ?? '{}')
  expect(records.games.jamo.best).toBe(600)
  expect(records.jamoStreak).toBe(1)
  await ui.unmount()
})

test('창: 달리기와 슈팅 모듈이 키를 받고 프레임을 돌린다', async ($, on) => {
  world(on)
  for (const surface of ['terminal', 'desktop'] as const) {
    const ui = await $.ui.mount({ ...PANE, surface })
    await ui.press({ key: 'open-runner' })
    await ui.key({ key: ' ', in: 'runner' })
    await ui.advance(1500)
    const run = JSON.stringify(await ui.drawn({ in: 'runner' }))
    expect(run).toMatch(/"m"\]/)
    expect(run).not.toMatch(/"0","m"/)   // 출발해서 달린 거리가 0이 아니다
    await ui.press({ key: 'back' })
    await ui.press({ key: 'open-shooter' })
    await ui.key({ key: ' ', in: 'shooter' })
    await ui.key({ key: 'left', in: 'shooter' })
    await ui.advance(3000)
    expect(JSON.stringify(await ui.drawn({ in: 'shooter' }))).toMatch(/점수 /)
    await ui.press({ key: 'key-d' })
    await ui.advance(200)
    // 키 받는 칸: 포커스가 처음부터 여기 있고, 친 글자를 게임 키로 넘긴다
    expect((await ui.find({ key: 'keys' }))?.props).toMatchObject({ autoFocus: true })
    const before = JSON.stringify(await ui.drawn({ in: 'shooter' }))
    for (const text of ['d', 'dd', 'ddd']) await ui.input({ key: 'keys', text, kind: 'change' })
    await ui.advance(100)
    expect(JSON.stringify(await ui.drawn({ in: 'shooter' }))).not.toBe(before)
    await ui.press({ key: 'back' })
    await ui.unmount()
  }
})
