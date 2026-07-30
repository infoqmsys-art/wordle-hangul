import type { Difficulty } from '../data/words'
import { DIFFICULTY_META } from '../data/words'
import type { PlayMode } from '../hooks/useGame'

type Props = {
  open: boolean
  onSelect: (mode: PlayMode, difficulty: Difficulty) => void
  nickname?: string | null
  streak?: number
}

function formatHomeDate(date = new Date()): string {
  return `${date.getMonth() + 1}월 ${date.getDate()}일`
}

export function ModeSelect({
  open,
  onSelect,
  nickname,
  streak = 0,
}: Props) {
  if (!open) return null

  const nick = nickname?.trim()
  const showStreak = Boolean(nick) && streak >= 2

  return (
    <div className="diff-screen">
      <div className="home-hero">
        <h2 className="home-hero-title">푸들푸들</h2>
        <p className="home-hero-sub">한글 자모로 맞히는 오늘의 단어</p>
        {showStreak && (
          <p className="home-hero-streak">
            <span className="streak-fire tiny" aria-hidden>
              🔥
            </span>
            {nick} · {streak}연승
          </p>
        )}
      </div>

      <section className="mode-panel">
        <div className="mode-panel-head">
          <h2>오늘의 단어</h2>
          <p>
            {formatHomeDate()} · 오늘 한 문제
            <span className="mode-panel-extra"> · 날짜마다 같은 정답</span>
          </p>
        </div>
        <div className="mode-diff-row">
          <button
            type="button"
            className="mode-diff-btn"
            onClick={() => onSelect('daily', 'easy')}
          >
            <span>쉬움</span>
            <strong>자모 {DIFFICULTY_META.easy.wordLength}칸</strong>
          </button>
          <button
            type="button"
            className="mode-diff-btn hard"
            onClick={() => onSelect('daily', 'hard')}
          >
            <span>어려움</span>
            <strong>자모 {DIFFICULTY_META.hard.wordLength}칸</strong>
          </button>
        </div>
      </section>

      <section className="mode-panel practice">
        <div className="mode-panel-head">
          <h2>연습</h2>
          <p>랜덤 연속 플레이 · 다음 문제로 이어가기</p>
        </div>
        <div className="mode-diff-row">
          <button
            type="button"
            className="mode-diff-btn"
            onClick={() => onSelect('practice', 'easy')}
          >
            <span>쉬움</span>
            <strong>자모 {DIFFICULTY_META.easy.wordLength}칸</strong>
          </button>
          <button
            type="button"
            className="mode-diff-btn hard"
            onClick={() => onSelect('practice', 'hard')}
          >
            <span>어려움</span>
            <strong>자모 {DIFFICULTY_META.hard.wordLength}칸</strong>
          </button>
        </div>
      </section>
    </div>
  )
}
