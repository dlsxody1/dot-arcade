"""창 없이 도는 규칙 테스트: 자모 판정, 점프 수치, 스테이지 도달 거리, 편대, 기록 파일."""
import os
import sys
import tempfile

HERE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, HERE)
os.environ['DOT_ARCADE_DATA'] = tempfile.mkdtemp()

from games.jamo_rules import WORDS, compose, daily_answer, decompose, judge, key_to_jamo, split_jamo  # noqa: E402
from games.runner_level import MAX_GAP, T, build  # noqa: E402
from games.runner_player import PH, Player  # noqa: E402
from games import shooter_wave as wv  # noqa: E402
import core  # noqa: E402


def test_decompose_splits_compound_vowels_and_finals():
    assert decompose('사과') == ['ㅅ', 'ㅏ', 'ㄱ', 'ㅗ', 'ㅏ']
    assert decompose('닭') == ['ㄷ', 'ㅏ', 'ㄹ', 'ㄱ']
    assert decompose('까치') == ['ㄱ', 'ㄱ', 'ㅏ', 'ㅊ', 'ㅣ']  # 된소리도 기본 자모 둘


def test_compose_accepts_only_two_syllables():
    assert compose(['ㅅ', 'ㅏ', 'ㄱ', 'ㅗ', 'ㅏ']) == '사과'
    assert compose(['ㅂ', 'ㅏ', 'ㄹ', 'ㅏ', 'ㅁ']) == '바람'
    assert compose(['ㅏ', 'ㅅ', 'ㄱ', 'ㅗ', 'ㅏ']) is None      # 모음으로 시작
    assert compose(['ㅅ', 'ㄱ', 'ㄱ', 'ㅗ', 'ㅏ']) is None      # 모음 없음
    for w in WORDS:
        assert compose(decompose(w)) is not None


def test_judge_counts_repeated_jamo_once_each():
    answer = ['ㅅ', 'ㅏ', 'ㄱ', 'ㅗ', 'ㅏ']
    assert judge(['ㅏ', 'ㅏ', 'ㅏ', 'ㅏ', 'ㅅ'], answer) == ['near', 'hit', 'miss', 'miss', 'near']
    assert judge(answer, answer) == ['hit'] * 5


def test_word_list_and_daily_answer():
    assert len(WORDS) > 150
    assert all(len(decompose(w)) == 5 for w in WORDS)
    day = core.kst_day(1795075429)
    assert daily_answer(day) in WORDS and daily_answer(day) == daily_answer(day)


def test_two_beol_keys():
    assert key_to_jamo('r', False) == 'ㄱ' and key_to_jamo('r', True) == 'ㄲ'
    assert key_to_jamo('k', False) == 'ㅏ' and key_to_jamo('o', True) == 'ㅒ'
    assert key_to_jamo('1', False) is None


def run_jump(hold_ticks):
    lv = build(1, 0)
    p = Player(4 * T, 15 * T - PH)
    for _ in range(3):
        p.update(lv, False, False, False, False, False, 0)
    start = p.y
    top = p.y
    for i in range(80):
        p.update(lv, False, False, i == 0, i < hold_ticks, i == hold_ticks, 0)
        top = min(top, p.y)
    return start - top, p.on_ground


def test_full_jump_reaches_3_5_tiles_and_tap_is_short():
    full, landed = run_jump(80)
    # 계산기 값은 3.5칸, 꼭대기 hang(중력 절반)을 더한 실측은 약 4.0칸. 스테이지는 실측에 맞춘다.
    assert 3.4 * T <= full <= 4.2 * T
    assert landed
    tap, _ = run_jump(1)
    assert tap < full * 0.6


def test_level_gaps_fit_jump_reach():
    for stage in (1, 2, 3):
        lv = build(stage, 7)
        cols = sorted({x for (x, y), k in lv.tiles.items() if k == 'grass'})
        gaps = [b - a - 1 for a, b in zip(cols, cols[1:]) if b - a > 1]
        bridged = {x for (x, y), k in lv.tiles.items() if k == 'brick'}
        for a, b in zip(cols, cols[1:]):
            gap = b - a - 1
            if gap > MAX_GAP:
                assert any(a < x < b for x in bridged), f'스테이지 {stage}의 {a}~{b} 구덩이에 발판이 없다'
        assert gaps and lv.flag_x > lv.checkpoint_x > 0


def test_wave_has_full_formation():
    wave = wv.make_wave(1)
    assert len(wave) == wv.COLS * wv.ROWS
    assert sum(e['hp'] for e in wave) == wv.COLS * (2 + 1 + 1 + 1)


def test_records_and_bonus_files():
    assert core.add_score('runner', 300) is True
    assert core.add_score('runner', 100) is False
    rec = core.load_records()['games']['runner']
    assert rec['best'] == 300 and rec['plays'] == 2 and rec['bestAt'].count('.') == 2
    core.change_bonus(2, ['a:1'])
    assert core.use_bonus() and core.load_bonus()['bonus'] == 1
    assert core.set_streak(100, True) == 1 and core.set_streak(101, True) == 2 and core.set_streak(103, False) == 0


def test_double_jamo_split_into_basic_ones():
    assert decompose('까치') == list('ㄱㄱㅏㅊㅣ')
    assert decompose('새') == list('ㅅㅏㅣ') and decompose('게') == list('ㄱㅓㅣ')
    assert decompose('꽤') == list('ㄱㄱㅗㅏㅣ')
    assert split_jamo('ㅖ') == ['ㅕ', 'ㅣ'] and split_jamo('ㄱ') == ['ㄱ']
    assert compose(list('ㄱㄱㅏㅊㅣ')) == '까치'
    assert daily_answer(20776) == '이름' and daily_answer(20777) == '음표'  # mod판과 같다
