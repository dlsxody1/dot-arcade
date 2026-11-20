// 도트 오락실 mod.
// - /arcade 로 채팅 옆 창(터미널과 데스크톱)을 열어 게임을 고르면, 그 창 안에서 바로 돈다.
//   (달리기와 슈팅은 Client 모듈, 자모는 이 훅 트리. 터미널은 키 뗌을 모르니 누르기만으로 하게 만들었다.)
// - "큰 창으로"는 따로 뜨는 pygame 창(이 플러그인의 game/main.py)을 띄운다.
// - 세션마다 자기 상태를 ~/.claude/dot-arcade/sessions/<id>.json 에 적고, 창이 열린 세션이 2초마다 읽는다.

import { atom, read, update } from 'claude-code'
import type { Register } from 'claude-code'
import type { GameId, SessionSummary, View } from '../types'
import { EMPTY_RECORDS, PANE, addScore, folder, labelOf, loadBonus, loadRecords, readJson, saveBonus, stamp, useBonus } from './data'
import type { Dollar } from './data'
import { JamoView, focusTyping, openJamo } from './jamo_view'
import { KEYS_MAX, addedChars, gameKey } from './keys'
import { PixelRows, thumbGrid } from './pixel'

export { labelOf, stamp }

const TITLE = '도트 오락실'

// 상태 참조는 쓰는 파일마다 만든다(같은 plugin, key면 같은 값).
const viewA = atom({ plugin: 'dot-arcade', key: 'view' } as const, 'menu' as View)
const bonusA = atom({ plugin: 'dot-arcade', key: 'bonus' } as const, 0)
const recordsA = atom({ plugin: 'dot-arcade', key: 'records' } as const, EMPTY_RECORDS, { shape: 'records-file-2' })
const sessionsA = atom({ plugin: 'dot-arcade', key: 'sessions' } as const, { working: 0, done: 0, note: '' } as SessionSummary)
const launchA = atom({ plugin: 'dot-arcade', key: 'launch' } as const, '')
const inputA = atom({ plugin: 'dot-arcade', key: 'input' } as const, { seq: 0, key: '' })
const keysFieldA = atom({ plugin: 'dot-arcade', key: 'keysField' } as const, '')

/** 키 받는 칸이 마지막으로 들고 있던 글자(새로 친 글자만 골라내려고). */
let lastKeys = ''

/** 키 받는 칸에 글자가 들어오면 게임 키로 바꿔 Client에 넘기고, 칸이 차면 비운다. */
async function keysTyped($: Dollar, value: string) {
  const added = addedChars(lastKeys, value)
  lastKeys = value
  for (const c of added) {
    const k = gameKey(c)
    if (k !== undefined) await update($, inputA, cur => ({ seq: cur.seq + 1, key: k }))
  }
  if (value.length >= KEYS_MAX) {
    const cleared = (await read($, keysFieldA)) === '' ? ' ' : ''
    lastKeys = cleared
    await update($, keysFieldA, () => cleared)
  }
}

export const GAMES: readonly { id: GameId; name: string; desc: string }[] = [
  { id: 'jamo', name: '자모 다섯 칸', desc: '두 글자 낱말을 자모 다섯 칸으로 풀어 6번 안에 맞히기' },
  { id: 'runner', name: '한길 달리기', desc: '저절로 달리는 로봇! 스페이스 점프, 공중에서 한 번 더 누르면 내리찍기' },
  { id: 'shooter', name: '버그 편대 격추', desc: '자동 연사로 편대를 쏘고, 게이지가 차면 산탄 한 방' },
]

type SessionFile = { id: string; name: string; topic: string; state: 'idle' | 'working' | 'done' | 'ended'; at: number; beat: number }

let me: SessionFile | undefined
let beatTimer: { cancel: () => void } | undefined

/** 첫 프롬프트에서 주제 한 줄: <system-reminder> 같은 태그 덩어리는 빼고 첫 문장 24자. */
export function topicOf(text: string): string {
  const plain = text.replace(/<([a-zA-Z_-]+)[^>]*>[\s\S]*?<\/\1>/g, ' ').replace(/<[^>]+>/g, ' ')
  const line = plain.split('\n').map(l => l.trim()).find(l => l.length > 0) ?? ''
  return line.slice(0, 24)
}

async function writeMe($: Dollar) {
  if (me === undefined) return
  await $.fs.write(`${await folder($)}/sessions/${me.id}.json`, JSON.stringify(me)).catch(() => undefined)
}

// ── 창이 열린 동안 2초마다: 다른 세션, 기록, 보너스 ───────────

let watch: { cancel: () => void } | undefined
let watchFrom = 0

async function poll($: Dollar) {
  const panes = await $.ui.panes().catch(() => [])
  if (!panes.some(p => p.id === PANE)) {
    watch?.cancel()
    watch = undefined
    return
  }
  const dir = await folder($)
  const now = await $.clock.now()
  const files: SessionFile[] = []
  for (const entry of await $.fs.list(`${dir}/sessions`).catch(() => [])) {
    if (!entry.name.endsWith('.json') || now - entry.mtimeMs > 12 * 3600_000) continue
    const f = await readJson<SessionFile>($, `${dir}/sessions/${entry.name}`)
    if (f !== undefined) files.push(f)
  }
  const others = files.filter(f => f.id !== me?.id)
  const working = others.filter(f => f.state === 'working' && now - f.beat < 3 * 60_000).length
  const done = others.filter(f => f.state === 'done' && now - f.at < 30 * 60_000).length
  const bonus = await loadBonus($)
  const fresh = others.filter(f => f.state === 'done' && f.at > watchFrom && !bonus.awarded.includes(`${f.id}:${f.at}`))
  let note = (await read($, sessionsA)).note
  if (fresh.length > 0) {
    bonus.bonus += fresh.length
    bonus.awarded = [...bonus.awarded, ...fresh.map(f => `${f.id}:${f.at}`)].slice(-100)
    for (const f of fresh) {
      const who = f.topic ? `${f.name}: ${f.topic}` : f.name
      note = `「${who}」 끝남 ${stamp(f.at).slice(-5)} · 보너스 +1`
      $.ui.toast(`세션이 끝났어요: ${who}  (보너스 +1)`)
    }
  }
  if (fresh.length > 0) await saveBonus($, bonus)
  else if ((await read($, bonusA)) !== bonus.bonus) await update($, bonusA, () => bonus.bonus)
  const prev = await read($, sessionsA)
  if (prev.working !== working || prev.done !== done || prev.note !== note) await update($, sessionsA, () => ({ working, done, note }))
  const records = await loadRecords($)
  if (JSON.stringify(records) !== JSON.stringify(await read($, recordsA))) await update($, recordsA, () => records)
}

async function ensureWatch($: Dollar) {
  if (watch !== undefined) return
  let timer: { cancel: () => void } | undefined
  watch = { cancel: () => timer?.cancel() } // 기다리는 사이에 두 번째 감시가 생기지 않게 먼저 자리를 잡는다
  watchFrom = await $.clock.now()
  timer = $.clock.every(2000, () => void poll($).catch(() => undefined))
  await poll($).catch(() => undefined)
}

// ── 큰 창(pygame) ─────────────────────────────────────

/** 게임 창은 따로 뜨고, mod는 기다리지 않는다(start 가 곧바로 돌아온다). */
export function launchArgv(pluginRoot: string, game: GameId | 'menu'): string[] {
  const main = `${pluginRoot.replace(/\\/g, '/').replace(/\/+$/, '')}/game/main.py`
  return ['cmd', '/c', 'start', '', 'pyw', main, '--game', game]
}

async function launch($: Dollar, game: GameId | 'menu') {
  const name = game === 'menu' ? '오락실 큰 창' : `${GAMES.find(g => g.id === game)?.name ?? game} 큰 창`
  const result = await $.process.run(launchArgv($.plugin.root, game), { timeoutMs: 10_000 }).catch((err: unknown) => ({
    exitCode: -1, stderr: err instanceof Error ? err.message : String(err),
  }))
  const ok = result.exitCode === 0
  await update($, launchA, () => (ok ? `${name}을 띄웠어요.` : `${name}을 띄우지 못했어요: ${result.stderr.trim() || `종료 코드 ${result.exitCode}`}`))
  return ok
}

async function open($: Dollar, view: View) {
  if (view === 'jamo') await openJamo($)
  lastKeys = await read($, keysFieldA) // 다시 그려진 키 받는 칸은 그린 값을 들고 시작한다
  await update($, viewA, () => view)
  await update($, launchA, () => '')
}

/** 키 받는 칸으로 포커스를 돌린다. 버튼에 포커스가 남으면 글자 키가 채팅 입력칸으로 새기 때문. */
async function focusKeys($: Dollar) {
  await $.ui.focus({ requestId: PANE, key: 'keys' }).catch(() => undefined)
}

/** 화면을 바꾼 뒤 키가 갈 곳으로 포커스를 옮긴다: 자모는 타자 칸, 달리기와 슈팅은 키 받는 칸. */
async function focusFor($: Dollar, view: View) {
  if (view === 'jamo') await focusTyping($)
  else if (view !== 'menu') await focusKeys($)
}

// ── 등록 ─────────────────────────────────────────────

export const register: Register = on => {
  on('session.start', async ($, e, next) => {
    const result = await next(e)
    await $.command.register({ name: 'arcade', description: '도트 오락실: 채팅 옆 창에서 도트 게임 (/arcade runner, /arcade shooter, /arcade jamo 로 바로 시작)' })
    const now = await $.clock.now()
    me = { id: await $.session.id(), name: labelOf(await $.session.root()), topic: '', state: 'idle', at: now, beat: now }
    await writeMe($)
    return result
  })

  on('turn.start', async ($, e, next) => {
    if (e.agentId === undefined && me !== undefined) {
      const now = await $.clock.now()
      if (me.topic === '') me.topic = topicOf(e.text)
      me = { ...me, state: 'working', at: now, beat: now }
      await writeMe($)
      beatTimer?.cancel()
      beatTimer = $.clock.every(60_000, () => {
        ;(async () => {
          if (me === undefined || me.state !== 'working') return
          me = { ...me, beat: await $.clock.now() }
          await writeMe($)
        })().catch(() => undefined)
      })
    }
    return next(e)
  })

  on('turn.complete', async ($, e, next) => {
    const result = await next(e)
    if (e.agentId === undefined && me !== undefined) {
      beatTimer?.cancel()
      beatTimer = undefined
      const now = await $.clock.now()
      me = { ...me, state: 'done', at: now, beat: now }
      await writeMe($)
    }
    return result
  })

  on('session.end', async ($, e, next) => {
    if (me !== undefined) {
      me = { ...me, state: 'ended', at: await $.clock.now() }
      await writeMe($)
    }
    return next(e)
  })

  on('command.run', { command: 'arcade' }, async ($, e) => {
    const game = GAMES.find(g => g.id === e.args.trim())
    await open($, game?.id ?? 'menu')
    // 높이를 요청해야 터미널 기본 모드(대화 아래에 끼워 열림)에서 게임이 잘리지 않는다.
    // focus: 창이 키를 받고, 포커스는 게임마다 키 받는 칸(Input)에서 시작한다. Esc는 프롬프트로.
    await $.ui.open({ id: PANE, title: TITLE, columns: 72, rows: 44, focus: true, backgroundColor: '#0d1030' })
    focusFor($, game?.id ?? 'menu').catch(() => undefined)
    await ensureWatch($)
    return { text: game ? `${game.name}을 채팅 옆 창에 열었어요.` : '도트 오락실을 열었어요. 채팅 옆 창에서 게임을 고르세요.' }
  })

  on('ui.message', async ($, e, next) => {
    const data = e.data as { type?: string; game?: GameId; score?: number } | undefined
    if (data?.type === 'score' && data.game !== undefined && typeof data.score === 'number') await addScore($, data.game, data.score)
    if (data?.type === 'bonus') await useBonus($)
    return next(e)
  })

  on('ui.render', { component: 'Pane', requestId: PANE }, async ($, e) => {
    const els = $.ui.resolve(e)
    const { Box, Text, Button } = els
    ensureWatch($).catch(() => undefined)
    const run = (p: Promise<unknown>) => {
      p.catch((err: unknown) => $.ui.toast(`도트 오락실 오류: ${err instanceof Error ? err.message : String(err)}`))
    }
    const view = await read($, viewA)
    const bonus = await read($, bonusA)
    const records = await read($, recordsA)
    const sessions = await read($, sessionsA)
    const launched = await read($, launchA)
    const cols = Math.max(40, (e.props.bodyColumns ?? 72) - 2)

    const header = (
      <Box flexDirection="column" marginBottom={1}>
        <Text>
          <Text weight="bold">다른 세션</Text> 작업 중 <Text color="#29adff">{sessions.working}</Text> · 끝남{' '}
          <Text color="#00e436">{sessions.done}</Text>
          {'   '}보너스 <Text color="#ffec27">{bonus}</Text>
        </Text>
        {sessions.note !== '' && <Text color="#00e436">{sessions.note}</Text>}
      </Box>
    )

    if (view === 'jamo' && 'Input' in els) {
      return (
        <Box flexDirection="column">
          {header}
          {await JamoView($, els, run, cols)}
        </Box>
      )
    }

    if ((view === 'runner' || view === 'shooter') && 'Client' in els) {
      const input = await read($, inputA)
      const keysField = await read($, keysFieldA)
      const props = { bonus, best: records.games[view].best, cols, input }
      // 화면 버튼을 눌러도 포커스는 키 받는 칸으로 돌아간다
      const key = (k: string) => () => run(update($, inputA, cur => ({ seq: cur.seq + 1, key: k })).then(() => focusKeys($)))
      const Client = els.Client
      const Input = 'Input' in els ? els.Input : undefined
      return (
        <Box flexDirection="column">
          {header}
          <Box flexDirection="row" gap={1} marginBottom={1}>
            <Button key="back" label="목록" onPress={() => run(open($, 'menu'))} />
            <Text weight="bold">{GAMES.find(g => g.id === view)?.name}</Text>
            <Button key="big" label="큰 창으로" onPress={() => run(launch($, view))} />
          </Box>
          {view === 'runner' ? <Client key="runner" module="./runner.tsx" props={props} /> : <Client key="shooter" module="./shooter.tsx" props={props} />}
          {Input !== undefined && (
            <Input
              key="keys"
              autoFocus
              label="키 "
              placeholder={view === 'runner' ? '스페이스 점프 (한/영 끄고)' : 'a ← · d → · 스페이스 산탄 (한/영 끄고)'}
              submitLabel="시작"
              value={keysField}
              onInput={v => run(keysTyped($, v))}
              onSubmit={() => run(update($, inputA, cur => ({ seq: cur.seq + 1, key: ' ' })))}
            />
          )}
          <Box flexDirection="row" gap={1}>
            <Button key="key-a" hotkey="a" label="←" onPress={key('left')} />
            <Button key="key-w" hotkey="w" variant="primary" label={view === 'runner' ? '점프·내리찍기' : '시작·산탄'} onPress={key(' ')} />
            <Button key="key-d" hotkey="d" label="→" onPress={key('right')} />
          </Box>
          {launched !== '' && <Text dimColor>{launched}</Text>}
        </Box>
      )
    }

    return (
      <Box flexDirection="column">
        {header}
        {GAMES.map(game => {
          const rec = records.games[game.id]
          const thumb = thumbGrid(game.id)
          const best =
            rec.plays === 0 ? '아직 기록 없음'
              : game.id === 'jamo' ? `내 최고 ${rec.best}점 · 연속 ${records.jamoStreak}일`
                : `내 최고 ${rec.best}점 · ${rec.bestAt}`
          return (
            <Box flexDirection="column" marginBottom={1}>
              <Box flexDirection="row" gap={1}>
                <Button key={`open-${game.id}`} variant="primary" label={game.name} onPress={() => run(open($, game.id).then(() => focusFor($, game.id)))} />
                <Text>: {game.desc}</Text>
              </Box>
              <Box flexDirection="row" gap={2}>
                <PixelRows els={els} grid={thumb.grid} bg={thumb.bg} />
                <Text dimColor>{best}</Text>
              </Box>
            </Box>
          )
        })}
        <Box flexDirection="row" gap={1}>
          <Button key="open-big" label="오락실 큰 창(pygame)" onPress={() => run(launch($, 'menu'))} />
        </Box>
        {launched !== '' && <Text dimColor>{launched}</Text>}
      </Box>
    )
  })
}
