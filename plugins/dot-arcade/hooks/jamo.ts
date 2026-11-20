// 자모 다섯 칸 규칙(game/games/jamo_rules.py와 같은 규칙과 낱말 목록).

const CHO = 'ㄱㄲㄴㄷㄸㄹㅁㅂㅃㅅㅆㅇㅈㅉㅊㅋㅌㅍㅎ'
const JUNG = ['ㅏ', 'ㅐ', 'ㅑ', 'ㅒ', 'ㅓ', 'ㅔ', 'ㅕ', 'ㅖ', 'ㅗ', 'ㅗㅏ', 'ㅗㅐ', 'ㅗㅣ', 'ㅛ', 'ㅜ', 'ㅜㅓ', 'ㅜㅔ', 'ㅜㅣ', 'ㅠ', 'ㅡ', 'ㅡㅣ', 'ㅣ']
const JONG = ['', 'ㄱ', 'ㄲ', 'ㄱㅅ', 'ㄴ', 'ㄴㅈ', 'ㄴㅎ', 'ㄷ', 'ㄹ', 'ㄹㄱ', 'ㄹㅁ', 'ㄹㅂ', 'ㄹㅅ', 'ㄹㅌ', 'ㄹㅍ', 'ㄹㅎ', 'ㅁ', 'ㅂ', 'ㅂㅅ', 'ㅅ', 'ㅆ', 'ㅇ', 'ㅈ', 'ㅊ', 'ㅋ', 'ㅌ', 'ㅍ', 'ㅎ']
const KEYS = 'qwertyuiopasdfghjklzxcvbnm'
const KEY_JAMO = 'ㅂㅈㄷㄱㅅㅛㅕㅑㅐㅔㅁㄴㅇㄹㅎㅗㅓㅏㅣㅋㅌㅊㅍㅠㅜㅡ'
const SHIFT: Record<string, string> = { Q: 'ㅃ', W: 'ㅉ', E: 'ㄸ', R: 'ㄲ', T: 'ㅆ', O: 'ㅒ', P: 'ㅖ' }
const ALL_JAMO = new Set([...CHO, ...JUNG.filter(v => v.length === 1)])

export const KEYBOARD = ['ㅂㅈㄷㄱㅅㅛㅕㅑㅐㅔ', 'ㅁㄴㅇㄹㅎㅗㅓㅏㅣ', 'ㅋㅌㅊㅍㅠㅜㅡ', 'ㄲㄸㅃㅆㅉㅒㅖ']

export function decompose(word: string): string[] | undefined {
  const out: string[] = []
  for (const ch of word) {
    const code = ch.charCodeAt(0) - 0xac00
    if (code < 0 || code > 11171) return undefined
    out.push(CHO[Math.floor(code / 588)] ?? '')
    out.push(...(JUNG[Math.floor((code % 588) / 28)] ?? ''))
    out.push(...(JONG[code % 28] ?? ''))
  }
  return out
}

function* syllables(j: string[]): Generator<[string, number]> {
  const cho = CHO.indexOf(j[0] ?? '')
  if (cho < 0) return
  for (const vl of [1, 2]) {
    const v = j.slice(1, 1 + vl).join('')
    if (j.length < 1 + vl || !JUNG.includes(v)) continue
    for (const fl of [0, 1, 2]) {
      const f = j.slice(1 + vl, 1 + vl + fl).join('')
      if (j.length < 1 + vl + fl || !JONG.includes(f)) continue
      yield [String.fromCharCode(0xac00 + cho * 588 + JUNG.indexOf(v) * 28 + JONG.indexOf(f)), 1 + vl + fl]
    }
  }
}

/** 자모 5개가 정확히 두 글자로 묶이면 그 낱말. */
export function compose(j: string[]): string | undefined {
  for (const [a, n] of syllables(j)) for (const [b, m] of syllables(j.slice(n))) if (n + m === j.length) return a + b
  return undefined
}

export type Mark = 'hit' | 'near' | 'miss'

export function judge(guess: readonly string[], answer: readonly string[]): Mark[] {
  const marks: Mark[] = guess.map(() => 'miss')
  const left = new Map<string, number>()
  answer.forEach((a, i) => {
    if (guess[i] === a) marks[i] = 'hit'
    else left.set(a, (left.get(a) ?? 0) + 1)
  })
  guess.forEach((g, i) => {
    if (marks[i] === 'hit') return
    const n = left.get(g) ?? 0
    if (n > 0) {
      marks[i] = 'near'
      left.set(g, n - 1)
    }
  })
  return marks
}

/** 글자마다 자모로: 완성 글자는 풀고, 자모는 그대로, 영문은 두벌식 자리로. 섞여도 된다. 못 바꾸는 글자가 있으면 undefined. */
export function toJamo(input: string): string[] | undefined {
  const out: string[] = []
  for (const c of input.replace(/\s/g, '')) {
    if (/[가-힣]/.test(c)) out.push(...(decompose(c) ?? []))
    else if (ALL_JAMO.has(c)) out.push(c)
    else if (/[a-zA-Z]/.test(c)) {
      const j = SHIFT[c] ?? KEY_JAMO[KEYS.indexOf(c.toLowerCase())]
      if (j === undefined) return undefined
      out.push(j)
    } else return undefined
  }
  return out
}

/** 입력을 자모 5개로: 한글 두 글자("사과"), 자모 그대로("ㅅㅏㄱㅗㅏ"), 두벌식 자리("tkrhk"), 섞어도 받는다. */
export function readGuess(input: string): { jamo: string[]; word: string } | { error: string } {
  const jamo = toJamo(input)
  if (jamo === undefined || jamo.length === 0) return { error: '한글 두 글자로 넣어 주세요. 예: 사과, 또는 한/영을 끄고 tkrhk' }
  if (jamo.length !== 5) return { error: `${jamo.length}칸이에요. 자모가 딱 5개인 낱말을 넣어 주세요.` }
  const word = compose(jamo)
  if (word === undefined) return { error: '두 글자로 묶이지 않아요. 첫 칸은 자음, 둘째 칸은 모음이에요.' }
  return { jamo, word }
}

const CANDIDATES = `
사랑 바람 하늘 구름 노을 마음 가을 겨울 여름 봄비 사과 과자 우산 시간 친구 학교 가방 지갑 의자 사진
상어 문어 거북 사슴 기린 수박 딸기 감자 양파 마늘 버섯 김치 라면 국수 만두 계란 우동 녹차 홍차 콜라
기억 추억 그림 사람 엄마 언니 가족 이웃 고향 서울 부산 시골 마을 기둥 지붕 대문 마당 장미 새벽
아침 저녁 내일 오늘 주말 축제 편지 엽서 택배 문자 메일 버튼 버그 서버 빌드 커밋 로봇 달님 별님 은하
혜성 태양 바위 자갈 폭포 계곡 사막 이불 침대 거울 냄비 그릇 접시 국자 수건 치약 옷장 단추 반지 축구
농구 수영 놀이 게임 퍼즐 수첩 달력 등대 항구 택시 배낭 바퀴 신호 시장 교실 숙제 시험 점수 용기 비밀
인사 감사 박수 노력 실수 대답 이름 무릎 미간 감기 기침 미역 소금 식초 참깨 나방 벌레 참새 백조 낙타
수달 번개 안개 이슬 우박 장마 가뭄 해변 연기 상자 서랍 봉투 종이 가위 자석 소설 시인 작가 화가 의사
회사 위치 구슬 나팔 대포 모험 보물 마법 요정 거인 왕자 공주 기사 성문 다락 계단 벽돌 기와 화로
미술 수학 과학 국어 영어 체육 음표 박자 가락 단풍 낙엽 열매 씨앗 새싹 줄기 뿌리 가지 이삭 볍씨
보리 수수 녹두 팥죽 호박 오이 당근 배추 상추 부추 생강 고추 후추 땅콩 호두 대추 자두 살구
앵두 모과 매실 유자 레몬 망고 키위 메론 커튼 방석 화분 장갑 우비 부채 등잔
`

export const WORDS: readonly string[] = [...new Set(CANDIDATES.split(/\s+/).filter(w => decompose(w)?.length === 5))]

export const kstDay = (now: number) => Math.floor((now + 9 * 3600_000) / 86_400_000)

/** game/games/jamo_rules.py의 daily_answer와 같은 낱말이 나온다. */
export function dailyAnswer(day: number): string {
  const u = Number((BigInt(day) * 2654435761n) % 4294967296n)
  return WORDS[((u ^ (u >>> 15)) >>> 0) % WORDS.length] ?? '사랑'
}
