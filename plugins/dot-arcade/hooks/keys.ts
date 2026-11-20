// 게임 화면의 키 받는 칸(Input) 도우미.
// 창의 포커스가 버튼에 있으면 버튼이 못 받는 글자 키가 채팅 입력칸으로 넘어간다.
// 그래서 게임마다 포커스를 Input에 둔다: Input은 포커스가 있는 동안 모든 글자 키를 혼자 받는다.

/** 입력칸 글자가 prev에서 next로 바뀌었을 때 새로 들어온 글자들. 지우기는 무시한다. */
export function addedChars(prev: string, next: string): string[] {
  if (next.length <= prev.length) return []
  let i = 0
  while (i < prev.length && prev[i] === next[i]) i++
  return [...next.slice(i, i + next.length - prev.length)]
}

/** 글자를 게임 키로: 스페이스와 w(ㅈ)는 점프·산탄, a(ㅁ)는 왼쪽, d(ㅇ)는 오른쪽. */
export function gameKey(c: string): string | undefined {
  if (c === ' ' || c === 'w' || c === 'W' || c === 'ㅈ' || c === 'ㅉ') return ' '
  if (c === 'a' || c === 'A' || c === 'ㅁ') return 'left'
  if (c === 'd' || c === 'D' || c === 'ㅇ') return 'right'
  return undefined
}

/** 키 받는 칸이 이만큼 차면 비운다(비울 때는 '' 와 ' ' 를 번갈아 그려야 새로 그린 것으로 친다). */
export const KEYS_MAX = 8
