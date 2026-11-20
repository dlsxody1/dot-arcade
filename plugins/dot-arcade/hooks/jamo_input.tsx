// 자모 다섯 칸의 타자 칸(Client 모듈): 키를 하나씩 직접 받는다.
// 한/영을 끄고 치면 키마다 바로 자모가 찍히고(a → ㅁ), 한글 입력기를 켜면 글자가 확정될 때마다 들어온다.
// 친 내용은 통째로 훅 모듈에 보낸다(한 프레임에 여러 번 보내도 마지막 것만 가면 되게).

import type { ClientModule, ClientSurface } from 'claude-code'
import { toJamo } from './jamo'

type Props = { text: string; seq: number; disabled: boolean }
type State = { text: string; seq: number; focused: boolean }

/** 키 하나를 반영한 새 입력. 자모는 다섯 개까지. */
export function applyKey(text: string, key: string): { text: string; submit?: true } {
  const jamo = toJamo(text) ?? []
  if (key === 'backspace' || key === 'delete') return { text: jamo.slice(0, -1).join('') }
  if (key === 'return') return { text, submit: true }
  if (key.length === 0 || key === ' ' || key === 'tab') return { text }
  const add = toJamo(key)
  if (add === undefined) return { text }
  return { text: [...jamo, ...add].slice(0, 5).join('') }
}

function onKey(surface: ClientSurface<State>, key: string) {
  const s = surface.state
  if (s === undefined) return
  const next = applyKey(s.text, key)
  if (next.submit) {
    surface.post({ type: 'jamo-submit', text: next.text })
    return
  }
  if (next.text === s.text) return
  surface.setState({ ...s, text: next.text, focused: true })
  surface.post({ type: 'jamo-draft', text: next.text })
}

const JamoInput: ClientModule<Props, State> = (props, surface) => {
  const { Box, Text } = surface.elements
  let s = surface.state
  if (s === undefined) {
    s = { text: props.text, seq: props.seq, focused: false }
    surface.setState(s)
    surface.onKey(k => onKey(surface, k.key))
    surface.onPointer(p => {
      const cur = surface.state
      if (p.type === 'down' && cur !== undefined && !cur.focused) surface.setState({ ...cur, focused: true })
    })
  } else if (props.seq !== s.seq) {
    // 자판 버튼이나 [삭제], [입력]으로 훅 쪽에서 바뀌면 그것을 따른다
    s.text = props.text
    s.seq = props.seq
  }
  const jamo = toJamo(s.text) ?? []
  const shown = jamo.length > 0 ? jamo.join(' ') : ''
  return (
    <Box borderStyle="round" borderColor={s.focused ? '#ffffff' : '#5f574f'} paddingX={1} width={44}>
      <Text>
        <Text color="#ffec27" weight="bold">{shown}</Text>
        <Text color="#ffffff">{props.disabled ? '' : '▏'}</Text>
        {shown === '' && <Text dimColor>{s.focused ? '자모를 치세요 (한/영 끄면 키마다 바로)' : '여기를 클릭하고 치세요'}</Text>}
      </Text>
    </Box>
  )
}

export default JamoInput
