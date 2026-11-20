"""자모 다섯 칸 규칙: 자모 분해, 두 글자로 묶이는지, 색 판정, 오늘의 낱말, 두벌식 자판."""
from __future__ import annotations

# 모든 글자를 기본 자모 24개(자음 14, 모음 10)로 푼다: ㄲ → ㄱㄱ, ㅐ → ㅏㅣ, ㅙ → ㅗㅏㅣ, ㄳ → ㄱㅅ.
BASIC = 'ㄱㄴㄷㄹㅁㅂㅅㅇㅈㅊㅋㅌㅍㅎㅏㅑㅓㅕㅗㅛㅜㅠㅡㅣ'
CHO = ['ㄱ', 'ㄱㄱ', 'ㄴ', 'ㄷ', 'ㄷㄷ', 'ㄹ', 'ㅁ', 'ㅂ', 'ㅂㅂ', 'ㅅ', 'ㅅㅅ', 'ㅇ', 'ㅈ', 'ㅈㅈ', 'ㅊ', 'ㅋ', 'ㅌ', 'ㅍ', 'ㅎ']
JUNG = ['ㅏ', 'ㅏㅣ', 'ㅑ', 'ㅑㅣ', 'ㅓ', 'ㅓㅣ', 'ㅕ', 'ㅕㅣ', 'ㅗ', 'ㅗㅏ', 'ㅗㅏㅣ', 'ㅗㅣ', 'ㅛ', 'ㅜ', 'ㅜㅓ', 'ㅜㅓㅣ',
        'ㅜㅣ', 'ㅠ', 'ㅡ', 'ㅡㅣ', 'ㅣ']
JONG = ['', 'ㄱ', 'ㄱㄱ', 'ㄱㅅ', 'ㄴ', 'ㄴㅈ', 'ㄴㅎ', 'ㄷ', 'ㄹ', 'ㄹㄱ', 'ㄹㅁ', 'ㄹㅂ', 'ㄹㅅ', 'ㄹㅌ', 'ㄹㅍ', 'ㄹㅎ',
        'ㅁ', 'ㅂ', 'ㅂㅅ', 'ㅅ', 'ㅅㅅ', 'ㅇ', 'ㅈ', 'ㅊ', 'ㅋ', 'ㅌ', 'ㅍ', 'ㅎ']
# 겹자모 한 글자를 기본 자모로
SPLIT = {
    'ㄲ': 'ㄱㄱ', 'ㄸ': 'ㄷㄷ', 'ㅃ': 'ㅂㅂ', 'ㅆ': 'ㅅㅅ', 'ㅉ': 'ㅈㅈ',
    'ㅐ': 'ㅏㅣ', 'ㅒ': 'ㅑㅣ', 'ㅔ': 'ㅓㅣ', 'ㅖ': 'ㅕㅣ', 'ㅘ': 'ㅗㅏ', 'ㅙ': 'ㅗㅏㅣ', 'ㅚ': 'ㅗㅣ',
    'ㅝ': 'ㅜㅓ', 'ㅞ': 'ㅜㅓㅣ', 'ㅟ': 'ㅜㅣ', 'ㅢ': 'ㅡㅣ',
    'ㄳ': 'ㄱㅅ', 'ㄵ': 'ㄴㅈ', 'ㄶ': 'ㄴㅎ', 'ㄺ': 'ㄹㄱ', 'ㄻ': 'ㄹㅁ', 'ㄼ': 'ㄹㅂ', 'ㄽ': 'ㄹㅅ', 'ㄾ': 'ㄹㅌ',
    'ㄿ': 'ㄹㅍ', 'ㅀ': 'ㄹㅎ', 'ㅄ': 'ㅂㅅ',
}

# 두벌식: 자판 글자 → 자모 (Shift는 된소리와 ㅒ ㅖ). 겹자모는 split_jamo로 푼다.
KEYMAP = dict(zip('qwertyuiopasdfghjklzxcvbnm', 'ㅂㅈㄷㄱㅅㅛㅕㅑㅐㅔㅁㄴㅇㄹㅎㅗㅓㅏㅣㅋㅌㅊㅍㅠㅜㅡ'))
SHIFTMAP = {'q': 'ㅃ', 'w': 'ㅉ', 'e': 'ㄸ', 'r': 'ㄲ', 't': 'ㅆ', 'o': 'ㅒ', 'p': 'ㅖ'}
KEYBOARD = [
    list('ㅂㅈㄷㄱㅅㅛㅕㅑ'),
    list('ㅁㄴㅇㄹㅎㅗㅓㅏㅣ'),
    list('ㅋㅌㅊㅍㅠㅜㅡ'),
]


def split_jamo(j: str) -> list[str]:
    """자모 한 글자를 기본 자모들로: ㅐ → [ㅏ, ㅣ]."""
    return list(SPLIT.get(j, j))


def decompose(word: str) -> list[str] | None:
    out: list[str] = []
    for ch in word:
        code = ord(ch) - 0xAC00
        if not 0 <= code <= 11171:
            return None
        out.extend(CHO[code // 588])
        out.extend(JUNG[(code % 588) // 28])
        out.extend(JONG[code % 28])
    return out


def _syllable(jamo: list[str]):
    """앞에서부터 한 글자를 만드는 모든 방법: (글자, 쓴 자모 수)."""
    for cl in (1, 2):
        c = ''.join(jamo[:cl])
        if len(jamo) < cl or c not in CHO:
            continue
        for vl in (1, 2, 3):
            v = ''.join(jamo[cl:cl + vl])
            if len(jamo) < cl + vl or v not in JUNG:
                continue
            for fl in (0, 1, 2):
                f = ''.join(jamo[cl + vl:cl + vl + fl])
                if len(jamo) < cl + vl + fl or f not in JONG:
                    continue
                yield chr(0xAC00 + CHO.index(c) * 588 + JUNG.index(v) * 28 + JONG.index(f)), cl + vl + fl


def compose(jamo: list[str]) -> str | None:
    """5개 자모가 정확히 두 글자로 묶이면 그 낱말, 아니면 None."""
    for first, n in _syllable(jamo):
        for second, m in _syllable(jamo[n:]):
            if n + m == len(jamo):
                return first + second
    return None


def judge(guess: list[str], answer: list[str]) -> list[str]:
    """'hit'(자리 맞음), 'near'(있지만 자리 다름), 'miss'. 같은 자모는 정답에 있는 개수만큼만 색을 준다."""
    marks = ['miss'] * len(guess)
    left: dict[str, int] = {}
    for i, a in enumerate(answer):
        if i < len(guess) and guess[i] == a:
            marks[i] = 'hit'
        else:
            left[a] = left.get(a, 0) + 1
    for i, g in enumerate(guess):
        if marks[i] != 'hit' and left.get(g, 0) > 0:
            marks[i] = 'near'
            left[g] -= 1
    return marks


CANDIDATES = """
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
"""

WORDS: list[str] = list(dict.fromkeys(w for w in CANDIDATES.split() if len(decompose(w) or []) == 5))


def daily_answer(day: int) -> str:
    u = (day * 2654435761) % 2 ** 32
    return WORDS[(u ^ (u >> 15)) % len(WORDS)]


def key_to_jamo(name: str, shift: bool) -> str | None:
    if shift and name in SHIFTMAP:
        return SHIFTMAP[name]
    return KEYMAP.get(name)
