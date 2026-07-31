import { useMemo } from 'react'
import type { Difficulty } from '../data/words'
import { DIFFICULTY_META } from '../data/words'
import { getDailyDoneToday } from '../lib/dailyLock'
import type { PlayMode } from '../hooks/useGame'

type Props = {
  open: boolean
  onSelect: (mode: PlayMode, difficulty: Difficulty) => void
  onBack?: () => void
}

function formatHomeDate(date = new Date()): string {
  return `${date.getMonth() + 1}월 ${date.getDate()}일`
}

export function ModeSelect({ open, onSelect, onBack }: Props) {
  const dailyDone = useMemo(
    () => (open ? getDailyDoneToday() : { easy: false, hard: false }),
    [open],
  )

  if (!open) return null

  return (
    <div className="diff-screen mode-picker">
      <div className="home-hero">
        <h2 className="home-hero-title">푸들푸들</h2>
        <p className="home-hero-sub">한글 자모로 맞히는 단어 게임</p>
      </div>

      <section className="mode-panel practice is-main">
        <div className="mode-panel-head">
          <h2>메인게임</h2>
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

      <section className="mode-panel daily">
        <div className="mode-panel-head">
          <h2>오늘의 단어</h2>
          <p>
            {formatHomeDate()} 데일리 · 난이도별 하루 1회
            <span className="mode-panel-extra"> · 날짜마다 같은 정답</span>
          </p>
          <p className="mode-xp-hint">맞춤 시 XP 보너스 ↑</p>
        </div>
        <div className="mode-diff-row">
          <button
            type="button"
            className={`mode-diff-btn${dailyDone.easy ? ' is-done' : ''}`}
            disabled={dailyDone.easy}
            onClick={() => onSelect('daily', 'easy')}
          >
            <span>쉬움</span>
            <strong>
              {dailyDone.easy
                ? '오늘 완료'
                : `자모 ${DIFFICULTY_META.easy.wordLength}칸`}
            </strong>
          </button>
          <button
            type="button"
            className={`mode-diff-btn hard${dailyDone.hard ? ' is-done' : ''}`}
            disabled={dailyDone.hard}
            onClick={() => onSelect('daily', 'hard')}
          >
            <span>어려움</span>
            <strong>
              {dailyDone.hard
                ? '오늘 완료'
                : `자모 ${DIFFICULTY_META.hard.wordLength}칸`}
            </strong>
          </button>
        </div>
      </section>

      {onBack && (
        <button
          type="button"
          className="cta cta-secondary mode-home-btn"
          onClick={onBack}
        >
          홈
        </button>
      )}
    </div>
  )
}
