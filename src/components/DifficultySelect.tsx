import type { Difficulty } from '../data/words'
import { DIFFICULTY_META } from '../data/words'

type Props = {
  open: boolean
  onSelect: (difficulty: Difficulty) => void
}

export function DifficultySelect({ open, onSelect }: Props) {
  if (!open) return null

  return (
    <div className="diff-screen">
      <p className="diff-kicker">푸들푸들</p>
      <h1 className="diff-title">난이도 선택</h1>
      <p className="diff-sub">칸 수에 따라 문제 길이가 달라요</p>

      <div className="diff-cards">
        <button
          type="button"
          className="diff-card"
          onClick={() => onSelect('easy')}
        >
          <span className="diff-badge">쉬움</span>
          <strong>자모 5칸</strong>
          <p>{DIFFICULTY_META.easy.desc} · 기본 연습</p>
        </button>
        <button
          type="button"
          className="diff-card hard"
          onClick={() => onSelect('hard')}
        >
          <span className="diff-badge">어려움</span>
          <strong>자모 7칸</strong>
          <p>{DIFFICULTY_META.hard.desc} · 도전 모드</p>
        </button>
      </div>
    </div>
  )
}
