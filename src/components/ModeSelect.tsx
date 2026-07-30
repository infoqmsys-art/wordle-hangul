import type { Difficulty } from '../data/words'
import { DIFFICULTY_META } from '../data/words'
import type { PlayMode } from '../hooks/useGame'

type Props = {
  open: boolean
  onSelect: (mode: PlayMode, difficulty: Difficulty) => void
}

export function ModeSelect({ open, onSelect }: Props) {
  if (!open) return null

  return (
    <div className="diff-screen">
      <p className="diff-kicker">푸들푸들</p>
      <h1 className="diff-title">무엇을 할까요?</h1>
      <p className="diff-sub">한 번만 누르면 바로 시작해요</p>

      <section className="mode-block">
        <h2 className="mode-heading">오늘의 단어</h2>
        <p className="mode-desc">날짜마다 같은 정답 · 하루 한 문제</p>
        <div className="diff-cards">
          <button
            type="button"
            className="diff-card"
            onClick={() => onSelect('daily', 'easy')}
          >
            <span className="diff-badge">쉬움</span>
            <strong>자모 {DIFFICULTY_META.easy.wordLength}칸</strong>
            <p>오늘의 쉬운 문제</p>
          </button>
          <button
            type="button"
            className="diff-card hard"
            onClick={() => onSelect('daily', 'hard')}
          >
            <span className="diff-badge">어려움</span>
            <strong>자모 {DIFFICULTY_META.hard.wordLength}칸</strong>
            <p>오늘의 도전 문제</p>
          </button>
        </div>
      </section>

      <section className="mode-block">
        <h2 className="mode-heading">연습</h2>
        <p className="mode-desc">랜덤 연속 플레이 · 다음 문제로 이어가기</p>
        <div className="diff-cards">
          <button
            type="button"
            className="diff-card"
            onClick={() => onSelect('practice', 'easy')}
          >
            <span className="diff-badge">쉬움</span>
            <strong>자모 {DIFFICULTY_META.easy.wordLength}칸</strong>
            <p>편하게 연습</p>
          </button>
          <button
            type="button"
            className="diff-card hard"
            onClick={() => onSelect('practice', 'hard')}
          >
            <span className="diff-badge">어려움</span>
            <strong>자모 {DIFFICULTY_META.hard.wordLength}칸</strong>
            <p>랜덤 도전</p>
          </button>
        </div>
      </section>
    </div>
  )
}
