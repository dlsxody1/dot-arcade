export type GameId = 'jamo' | 'runner' | 'shooter'
export type View = 'menu' | GameId

export type Record1 = { best: number; bestAt: string; plays: number }
export type Records = { games: Record<GameId, Record1>; jamoStreak: number; jamoLastDay?: number }

export type Confetto = { x: number; y: number; vx: number; vy: number; ch: string; color: string }

export type SessionSummary = { working: number; done: number; note: string }

export type JamoGame = {
  mode: 'daily' | 'practice'
  day: number
  answer: string
  rows: string[][]
  words: string[]
  revealed: number
  hints: number[]
  isDone: boolean
  isWon: boolean
  result: string
}

declare module 'claude-code' {
  interface PluginState {
    'dot-arcade': {
      view: View
      bonus: number
      records: Shaped<Records>
      sessions: SessionSummary
      launch: string
      input: { seq: number; key: string }
      keysField: string
      keysTip: string
      jamo: Shaped<JamoGame>
      jamoMsg: string
      jamoDraft: { text: string; seq: number }
      confetti: { t: number; parts: Confetto[] }
    }
  }
}
