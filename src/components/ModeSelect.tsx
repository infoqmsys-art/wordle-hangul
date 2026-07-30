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
      <section className="mode-panel">
        <div className="mode-panel-head">
          <h2>오늘의 단어</h2>
          <p>날짜마다 같은 정답 · 하루 한 문제</p>
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
