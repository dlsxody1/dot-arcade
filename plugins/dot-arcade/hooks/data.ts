// 게임(pygame)과 같이 쓰는 파일: ~/.claude/dot-arcade/{records.json, bonus.json, sessions/*.json}

import { atom, read, update } from 'claude-code'
import type { EngineInterface } from 'claude-code'
import type { GameId, Records, SessionSummary, View } from '../types'

export type Dollar = EngineInterface

export const PANE = 'dot-arcade'

export const EMPTY_RECORDS: Records = {
  games: {
    jamo: { best: 0, bestAt: '', plays: 0 },
    runner: { best: 0, bestAt: '', plays: 0 },
    shooter: { best: 0, bestAt: '', plays: 0 },
  },
  jamoStreak: 0,
  jamoLastDay: 0,
}

const viewA = atom({ plugin: 'dot-arcade', key: 'view' } as const, 'menu' as View)
const bonusA = atom({ plugin: 'dot-arcade', key: 'bonus' } as const, 0)
const recordsA = atom({ plugin: 'dot-arcade', key: 'records' } as const, EMPTY_RECORDS, { shape: 'records-file-2' })
const sessionsA = atom({ plugin: 'dot-arcade', key: 'sessions' } as const, { working: 0, done: 0, note: '' } as SessionSummary)
const launchA = atom({ plugin: 'dot-arcade', key: 'launch' } as const, '')
const inputA = atom({ plugin: 'dot-arcade', key: 'input' } as const, { seq: 0, key: '' })

const DAYS = ['일', '월', '화', '수', '목', '금', '토']
const pad = (n: number) => String(n).padStart(2, '0')
/** 2026.11.19 (목) 14:02 (한국 시각) */
export function stamp(now: number): string {
  const d = new Date(now + 9 * 3600_000)
  return `${d.getUTCFullYear()}.${pad(d.getUTCMonth() + 1)}.${pad(d.getUTCDate())} (${DAYS[d.getUTCDay()]}) ${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}`
}

/** 세션 이름: 워크트리면 "저장소/워크트리", 아니면 폴더 이름. */
export function labelOf(root: string): string {
  const p = root.replace(/\\/g, '/').replace(/\/+$/, '')
  const wt = p.match(/\/([^/]+)\/\.claude\/worktrees\/([^/]+)$/)
  if (wt) return `${wt[1]}/${wt[2]}`
  return p.split('/').pop() || p
}

let base: string | undefined
export async function folder($: Dollar): Promise<string> {
  if (base === undefined) {
    const home = (await $.env.get('USERPROFILE')) ?? (await $.env.get('HOME')) ?? '.'
    base = `${home.replace(/\\/g, '/')}/.claude/dot-arcade`
  }
  return base
}

export async function readJson<T>($: Dollar, path: string): Promise<T | undefined> {
  const text = await $.fs.read(path).catch(() => undefined)
  if (typeof text !== 'string') return undefined
  try {
    return JSON.parse(text) as T
  } catch {
    return undefined
  }
}

export async function loadRecords($: Dollar): Promise<Records> {
  const r = await readJson<Partial<Records>>($, `${await folder($)}/records.json`)
  return { ...EMPTY_RECORDS, ...r, games: { ...EMPTY_RECORDS.games, ...r?.games } }
}

async function saveRecords($: Dollar, r: Records) {
  const out = { ...r, updatedAt: stamp(await $.clock.now()) }
  await $.fs.write(`${await folder($)}/records.json`, JSON.stringify(out, null, 2)).catch(() => undefined)
  await update($, recordsA, () => r)
}

/** 판 수를 올리고, 최고 기록이면 바꾼다. 최고 기록이면 true. */
export async function addScore($: Dollar, game: GameId, score: number): Promise<boolean> {
  const r = await loadRecords($)
  const one = r.games[game]
  const isBest = score > one.best
  r.games[game] = { ...one, plays: one.plays + 1, ...(isBest ? { best: score, bestAt: stamp(await $.clock.now()) } : {}) }
  await saveRecords($, r)
  if (isBest && score > 0) $.ui.toast(`새 최고 기록! ${score}점`)
  return isBest
}

export async function setStreak($: Dollar, day: number, won: boolean): Promise<number> {
  const r = await loadRecords($)
  if (r.jamoLastDay === day) return r.jamoStreak
  r.jamoStreak = won ? (r.jamoLastDay === day - 1 ? r.jamoStreak + 1 : 1) : 0
  r.jamoLastDay = day
  await saveRecords($, r)
  return r.jamoStreak
}

export type BonusFile = { bonus: number; awarded: string[] }

export async function loadBonus($: Dollar): Promise<BonusFile> {
  return (await readJson<BonusFile>($, `${await folder($)}/bonus.json`)) ?? { bonus: 0, awarded: [] }
}

export async function saveBonus($: Dollar, b: BonusFile) {
  await $.fs.write(`${await folder($)}/bonus.json`, JSON.stringify(b, null, 2)).catch(() => undefined)
  if ((await read($, bonusA)) !== b.bonus) await update($, bonusA, () => b.bonus)
}

export async function useBonus($: Dollar): Promise<boolean> {
  const b = await loadBonus($)
  if (b.bonus <= 0) return false
  await saveBonus($, { ...b, bonus: b.bonus - 1 })
  return true
}
