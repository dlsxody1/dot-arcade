// 자모 다섯 칸(창 안): 테두리 칸 격자, 누를 수 있는 자판([입력] [삭제]), 치는 대로 칸에 찍히는 입력칸.
// 다 채우고 입력하면 칸이 하나씩 뒤집히며 색이 드러난다.

import { atom, read, update } from 'claude-code'
import type { Elements } from 'claude-code'
import type { Confetto, JamoGame, View } from '../types'
import { EMPTY_RECORDS, addScore, setStreak, useBonus } from './data'
import type { Dollar } from './data'
import { KEYBOARD, WORDS, dailyAnswer, decompose, judge, kstDay, readGuess, toJamo } from './jamo'
import type { Mark } from './jamo'

const EMPTY: JamoGame = { mode: 'daily', day: 0, answer: '', rows: [], words: [], revealed: 5, hints: [], isDone: false, isWon: false, result: '' }
export const jamoA = atom({ plugin: 'dot-arcade', key: 'jamo' } as const, EMPTY, { shape: 'jamo-2' })
const msgA = atom({ plugin: 'dot-arcade', key: 'jamoMsg' } as const, '')
const draftA = atom({ plugin: 'dot-arcade', key: 'jamoDraft' } as const, { text: '', seq: 0 })
const confettiA = atom({ plugin: 'dot-arcade', key: 'confetti' } as const, { t: 0, parts: [] as Confetto[] })
const viewA = atom({ plugin: 'dot-arcade', key: 'view' } as const, 'menu' as View)
const bonusA = atom({ plugin: 'dot-arcade', key: 'bonus' } as const, 0)
const recordsA = atom({ plugin: 'dot-arcade', key: 'records' } as const, EMPTY_RECORDS, { shape: 'records-file-2' })

const MARK_BG: Record<Mark, string> = { hit: '#008751', near: '#ffa300', miss: '#5f574f' }
const RANK: Record<Mark, number> = { hit: 3, near: 2, miss: 1 }
let revealTimer: { cancel: () => void } | undefined

const randomWord = () => WORDS[Math.floor(Math.random() * WORDS.length)] ?? '사랑'

export async function openJamo($: Dollar) {
  const today = kstDay(await $.clock.now())
  const records = await read($, recordsA)
  await update($, jamoA, (g): JamoGame => {
    if (g.answer !== '' && !g.isDone && (g.mode === 'practice' || g.day === today)) return g
    if (records.jamoLastDay === today || (g.mode === 'daily' && g.day === today && g.isDone)) {
      return { ...EMPTY, mode: 'practice', day: today, answer: randomWord() }
    }
    return { ...EMPTY, mode: 'daily', day: today, answer: dailyAnswer(today) }
  })
  await setDraft($, '')
  await update($, msgA, () => '바로 치세요. 한/영을 끄면 키마다 바로 칸에 찍혀요(a → ㅁ). 자판을 눌러도 돼요.')
}

async function practice($: Dollar) {
  await update($, jamoA, (): JamoGame => ({ ...EMPTY, mode: 'practice', answer: randomWord() }))
  await setDraft($, '')
  await update($, msgA, () => '연습 판이에요.')
}

/** 포커스를 타자 칸으로. 버튼에 포커스가 남으면 글자 키가 채팅 입력칸으로 새기 때문에 버튼을 누른 뒤에도 돌아온다. */
export async function focusTyping($: Dollar) {
  await $.ui.focus({ requestId: 'dot-arcade', key: 'typing' }).catch(() => undefined)
}

async function setDraft($: Dollar, text: string) {
  await update($, draftA, d => ({ text, seq: d.seq + 1 }))
}

/** 타자 칸 글자를 자모 다섯 개까지로: 바꿀 수 없는 글자(숫자, 기호)는 버린다. */
export function normalizeTyped(value: string): string {
  return [...value].flatMap(c => toJamo(c) ?? []).slice(0, 5).join('')
}

/** 타자 칸이 바뀔 때마다: 자모로 바꿔 칸에 찍는다. 타자 칸도 자모로 다시 그려진다. */
async function onTyped($: Dollar, value: string) {
  const text = normalizeTyped(value)
  if (text !== (await read($, draftA)).text) await setDraft($, text)
}

/** 자판 한 칸: 자모를 덧붙인다(다섯 개까지). */
async function typeJamo($: Dollar, j: string) {
  const d = await read($, draftA)
  const jamo = toJamo(d.text) ?? []
  if (jamo.length < 5) await setDraft($, [...jamo, j].join(''))
}

/** [삭제]: 마지막 자모 하나를 지운다. */
async function erase($: Dollar) {
  const d = await read($, draftA)
  await setDraft($, (toJamo(d.text) ?? []).slice(0, -1).join(''))
}

async function guess($: Dollar, text: string) {
  const g = await read($, jamoA)
  if (g.isDone || g.revealed < 5) return
  const got = readGuess(text)
  if ('error' in got) {
    await update($, msgA, () => got.error)
    return
  }
  await setDraft($, '')
  await update($, msgA, () => `"${got.word}"`)
  await update($, jamoA, cur => ({ ...cur, rows: [...cur.rows, got.jamo], words: [...cur.words, got.word], revealed: 0 }))
  revealTimer?.cancel()
  revealTimer = $.clock.every(140, () => {
    void (async () => {
      const cur = await update($, jamoA, c => ({ ...c, revealed: Math.min(5, c.revealed + 1) }))
      if (cur.revealed >= 5) {
        revealTimer?.cancel()
        await finish($)
      }
    })().catch(() => undefined)
  })
}

// ── 색종이 ──────────────────────────────────────────

const CONFETTI_COLORS = ['#ff004d', '#ffa300', '#ffec27', '#00e436', '#29adff', '#ff77a8', '#83769c', '#ffffff']
const CONFETTI_CH = ['▀', '▄', '█', '▌', '▐', '*', '+'] // 터미널에서 한 칸 폭으로 그려지는 글자만
const CONFETTI_TICKS = 36 // 70ms x 36 ≈ 2.5초
let confettiTimer: { cancel: () => void } | undefined
let paneCols = 70

/** 위 가운데 두 곳에서 위로 터져 흩날리며 떨어진다. 화면 셀 단위(가로 1칸, 세로 1줄). */
export function burstConfetti(cols: number, n = 70, seed = Date.now()): Confetto[] {
  let s = seed >>> 0 || 1
  const r = () => ((s = (Math.imul(s, 1664525) + 1013904223) >>> 0) / 4294967296)
  return Array.from({ length: n }, (_, i) => {
    const fromLeft = i % 2 === 0
    return {
      x: cols * (fromLeft ? 0.3 : 0.7) + (r() - 0.5) * 6,
      y: 8 + r() * 3,
      vx: (r() - 0.5) * 3.2 + (fromLeft ? -0.4 : 0.4),
      vy: -1.6 - r() * 1.6,
      ch: CONFETTI_CH[Math.floor(r() * CONFETTI_CH.length)] ?? '▪',
      color: CONFETTI_COLORS[Math.floor(r() * CONFETTI_COLORS.length)] ?? '#ffffff',
    }
  })
}

/** 한 틱: 중력과 공기 저항, 좌우로 살랑이기. */
export function stepConfetti(parts: Confetto[], t: number): Confetto[] {
  return parts.map(p => ({
    ...p,
    x: p.x + p.vx + Math.sin((t + p.y) / 2) * 0.25,
    y: p.y + p.vy,
    vx: p.vx * 0.94,
    vy: Math.min(1.1, p.vy + 0.22),
  }))
}

async function startConfetti($: Dollar) {
  confettiTimer?.cancel()
  await update($, confettiA, () => ({ t: 0, parts: burstConfetti(paneCols) }))
  confettiTimer = $.clock.every(70, () => {
    void (async () => {
      const cur = await update($, confettiA, c =>
        c.t >= CONFETTI_TICKS ? { t: 0, parts: [] } : { t: c.t + 1, parts: stepConfetti(c.parts, c.t) },
      )
      if (cur.parts.length === 0) confettiTimer?.cancel()
    })().catch(() => undefined)
  })
}

async function finish($: Dollar) {
  const g = await read($, jamoA)
  const answer = decompose(g.answer) ?? []
  const last = g.rows[g.rows.length - 1] ?? []
  const won = last.join('') === answer.join('')
  if (!won && g.rows.length < 6) {
    const hits = judge(last, answer).filter(m => m === 'hit').length
    if (hits >= 3) await update($, msgA, () => `"${g.words[g.words.length - 1]}" · ${hits}칸 맞음! 거의 다 왔어요`)
    return
  }
  const score = won ? (7 - g.rows.length) * 100 : 0
  const best = await addScore($, 'jamo', score)
  const streak = g.mode === 'daily' ? await setStreak($, g.day, won) : undefined
  const head = won ? `맞혔어요! ${g.rows.length}번 만에 ${score}점` : `아쉬워요. 정답은 "${g.answer}" (${answer.join(' ')})`
  const result = head + (streak !== undefined ? ` · 연속 ${streak}일` : '') + (best && score > 0 ? ' · 새 최고 기록!' : '')
  await update($, jamoA, c => ({ ...c, isDone: true, isWon: won, result }))
  if (won) {
    $.ui.toast(`자모 다섯 칸: ${head}`)
    await startConfetti($)
  }
}

async function hint($: Dollar) {
  const g = await read($, jamoA)
  if (g.isDone) return
  const answer = decompose(g.answer) ?? []
  const known = new Set([...g.hints, ...g.rows.flatMap(r => judge(r, answer).flatMap((m, i) => (m === 'hit' ? [i] : [])))])
  const i = answer.findIndex((_, idx) => !known.has(idx))
  if (i < 0) return update($, msgA, () => '더 알려 줄 칸이 없어요.')
  if (!(await useBonus($))) return update($, msgA, () => '보너스가 없어요. 다른 세션이 끝나면 하나씩 생겨요.')
  await update($, jamoA, c => ({ ...c, hints: [...c.hints, i] }))
  await update($, msgA, () => `힌트: ${i + 1}번째 칸은 ${answer[i]}`)
}

type Cell = { ch: string; fill?: string; border: string; bold?: boolean }

export type Els = Pick<Elements['terminal'], 'Box' | 'Text' | 'Button' | 'Input'>

export async function JamoView($: Dollar, els: Els, run: (p: Promise<unknown>) => void, cols = 70) {
  paneCols = cols
  const { Box, Text, Button, Input } = els
  // 버튼을 누른 뒤에는 포커스를 타자 칸으로 돌린다
  const press = (p: Promise<unknown>) => run(p.then(() => focusTyping($)))
  const g = await read($, jamoA)
  const msg = await read($, msgA)
  const draft = await read($, draftA)
  const bonus = await read($, bonusA)
  const records = await read($, recordsA)
  const confetti = await read($, confettiA)
  const answer = decompose(g.answer) ?? []
  const typed = toJamo(draft.text) ?? []
  const typing = new Set(typed)
  const seen = new Map<string, Mark>()

  const grid: Cell[][] = Array.from({ length: 6 }, (_, r) => {
    const jamo = g.rows[r]
    if (jamo !== undefined) {
      const marks = judge(jamo, answer)
      const shown = r === g.rows.length - 1 ? g.revealed : 5
      return jamo.map((ch, i): Cell => {
        const m = marks[i] ?? 'miss'
        if (i >= shown) return { ch, border: '#c2c3c7', bold: true }
        if (RANK[m] >= RANK[seen.get(ch) ?? 'miss']) seen.set(ch, m)
        return { ch, fill: MARK_BG[m], border: MARK_BG[m] }
      })
    }
    const current = r === g.rows.length && !g.isDone
    return Array.from({ length: 5 }, (_, c): Cell => {
      if (!current) return { ch: ' ', border: '#3a3f5c' }
      const ch = typed[c]
      if (ch !== undefined) return { ch, border: '#c2c3c7', bold: true }
      if (g.hints.includes(c)) return { ch: answer[c] ?? ' ', border: '#83769c' }
      return { ch: ' ', border: c === typed.length ? '#ffffff' : '#5f574f', bold: c === typed.length } // 다음에 칠 칸
    })
  })

  const keyColor = (ch: string) => {
    const m = seen.get(ch)
    return m === undefined ? '#83769c' : MARK_BG[m]
  }
  // 지금 치고 있는 자모는 흰 바탕으로 바로 표시
  const key = (ch: string) => (
    <Button key={`k-${ch}`} plain onPress={() => press(typeJamo($, ch))}>
      <Text backgroundColor={typing.has(ch) ? '#ffffff' : keyColor(ch)} color={typing.has(ch) ? '#0d1030' : '#ffffff'} weight="bold">{` ${ch} `}</Text>
    </Button>
  )

  return (
    <Box flexDirection="column" position="relative" width={cols}>
      <Box flexDirection="row" gap={1}>
        <Button key="back" label="목록" onPress={() => run(update($, viewA, () => 'menu'))} />
        <Text weight="bold">자모 다섯 칸</Text>
        <Text dimColor>{g.mode === 'daily' ? `오늘의 낱말 · 연속 ${records.jamoStreak}일` : '연습'}</Text>
      </Box>

      <Box flexDirection="column" marginTop={1} alignItems="center">
        {grid.map(cells => (
          <Box flexDirection="row" gap={1}>
            {cells.map(c => (
              <Box borderStyle={c.bold ? 'bold' : 'round'} borderColor={c.border} backgroundColor={c.fill} width={5} height={3} justifyContent="center" alignItems="center">
                <Text color="#ffffff" weight="bold">{c.ch}</Text>
              </Box>
            ))}
          </Box>
        ))}
        {g.words.length > 0 && <Text dimColor>{g.words.join(' · ')}</Text>}
      </Box>

      {!g.isDone && (
        <Box flexDirection="column" marginTop={1} gap={1} alignItems="center">
          {KEYBOARD.slice(0, 2).map(line => (
            <Box flexDirection="row" gap={1}>{[...line].map(key)}</Box>
          ))}
          <Box flexDirection="row" gap={1}>
            <Button key="enter" variant="primary" label="입력" onPress={() => press(guess($, draft.text))} />
            {[...(KEYBOARD[2] ?? '')].map(key)}
            <Button key="erase" label="삭제" onPress={() => press(erase($))} />
          </Box>
          <Box flexDirection="row" gap={1}>
            {[...(KEYBOARD[3] ?? '')].map(key)}
            <Button key="hint" label={`힌트 (보너스 ${bonus})`} onPress={() => press(hint($))} />
            {g.mode === 'practice' && <Button key="new" label="새 낱말" onPress={() => press(practice($))} />}
          </Box>
          <Input
            key="typing"
            autoFocus
            label="타자 "
            placeholder="바로 치세요 (한/영 끄면 키마다 바로)"
            submitLabel="입력"
            value={draft.text}
            onInput={v => run(onTyped($, v))}
            onSubmit={v => run(guess($, normalizeTyped(v)))}
          />
          {msg !== '' && <Text>{msg}</Text>}
        </Box>
      )}

      {g.isDone && (
        <Box flexDirection="column" marginTop={1} alignItems="center">
          <Text color={g.isWon ? '#00e436' : '#ff004d'} weight="bold">{g.result}</Text>
          <Box flexDirection="row" gap={1}>
            <Button key="again" variant="primary" label="연습 한 판 더" onPress={() => press(practice($))} />
            <Button key="back-done" label="목록으로" onPress={() => run(update($, viewA, () => 'menu'))} />
          </Box>
        </Box>
      )}

      {confetti.parts.length > 0 && (
        <Box position="absolute" top={0} left={0} width={cols} height={40}>
          {confetti.parts
            .filter(p => p.x >= 0 && p.x < cols - 1 && p.y >= 0 && p.y < 40)
            .map(p => (
              <Box position="absolute" top={Math.round(p.y)} left={Math.round(p.x)}>
                <Text color={p.color}>{p.ch}</Text>
              </Box>
            ))}
        </Box>
      )}
    </Box>
  )
}
