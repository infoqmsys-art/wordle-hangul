import { useEffect, useState } from 'react'
import type { Difficulty } from '../data/words'
import { DIFFICULTY_META } from '../data/words'
import {
  formatRecordDate,
  isSharedHistoryEnabled,
  loadRanking,
  type RankEntry,
  type RankMode,
} from '../lib/history'

type Props = {
  open: boolean
  onClose: () => void
  initialDifficulty?: Difficulty
}

const MODE_META: Record<RankMode, { label: string; sub: string }> = {
  wins: {
    label: '승수',
    sub: '같은 이름으로 성공할 때마다 승수가 쌓여요',
  },
  fastest: {
    label: '최단 시간',
    sub: '성공한 판 중 가장 빠른 기록을 겨뤄요',
  },
  attempts: {
    label: '최소 시도',
    sub: '성공한 판 중 가장 적은 시도 횟수를 겨뤄요',
  },
}

export function RankingModal({
  open,
  onClose,
  initialDifficulty = 'easy',
}: Props) {
  const [tab, setTab] = useState<Difficulty>(initialDifficulty)
  const [mode, setMode] = useState<RankMode>('wins')
  const [ranking, setRanking] = useState<RankEntry[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!open) return
    setTab(initialDifficulty)
  }, [open, initialDifficulty])

  useEffect(() => {
    if (!open) return
    let alive = true
    setLoading(true)
    setError(null)

    if (!isSharedHistoryEnabled()) {
      setRanking([])
      setError('공유 기록이 아직 연결되지 않았어요')
      setLoading(false)
      return
    }

    loadRanking(tab, mode)
      .then((list) => {
        if (alive) setRanking(list)
      })
      .catch(() => {
        if (alive) setError('랭킹을 불러오지 못했어요')
      })
      .finally(() => {
        if (alive) setLoading(false)
      })

    return () => {
      alive = false
    }
  }, [open, tab, mode])

  if (!open) return null

  return (
    <div className="modal-backdrop" role="presentation" onClick={onClose}>
      <div
        className="modal history-modal rank-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="rank-title"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 id="rank-title">랭킹</h2>
        <p className="modal-sub">{MODE_META[mode].sub}</p>

        <div className="rank-tabs" role="tablist" aria-label="난이도">
          <button
            type="button"
            role="tab"
            aria-selected={tab === 'easy'}
            className={tab === 'easy' ? 'on' : ''}
            onClick={() => setTab('easy')}
          >
            쉬움
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={tab === 'hard'}
            className={tab === 'hard' ? 'on' : ''}
            onClick={() => setTab('hard')}
          >
            어려움
          </button>
        </div>

        <div className="rank-mode-tabs" role="tablist" aria-label="랭킹 종류">
          {(Object.keys(MODE_META) as RankMode[]).map((m) => (
            <button
              key={m}
              type="button"
              role="tab"
              aria-selected={mode === m}
              className={mode === m ? 'on' : ''}
              onClick={() => setMode(m)}
            >
              {MODE_META[m].label}
            </button>
          ))}
        </div>

        {loading ? (
          <p className="history-empty">불러오는 중...</p>
        ) : error ? (
          <p className="history-empty">{error}</p>
        ) : ranking.length === 0 ? (
          <p className="history-empty">
            아직 {DIFFICULTY_META[tab].label} 성공 기록이 없어요
          </p>
        ) : (
          <ol className="rank-list">
            {ranking.map((r, i) => {
              const place = i + 1
              return (
                <li
                  key={`${tab}-${mode}-${r.name}`}
                  className={`rank-item${place === 1 ? ' rank-first' : ''}`}
                >
                  <span
                    className={`rank-num place-${Math.min(place, 4)}`}
                    aria-label={`${place}위`}
                  >
                    {place}
                  </span>
                  <div className="rank-body">
                    <div className="rank-row">
                      <div className="rank-name-block">
                        <strong>{r.name}</strong>
                        {place === 1 && mode === 'wins' && (
                          <span className="rank-king-title">
                            푸들푸들 오늘의 단어 킹
                          </span>
                        )}
                        {place === 1 && mode === 'fastest' && (
                          <span className="rank-king-title">스피드 킹</span>
                        )}
                        {place === 1 && mode === 'attempts' && (
                          <span className="rank-king-title">효율 킹</span>
                        )}
                      </div>
                      <span className="rank-wins">{r.scoreLabel}</span>
                    </div>
                    {r.lastSavedAt > 0 && (
                      <span className="rank-date">
                        {mode === 'wins'
                          ? `최근 ${formatRecordDate(r.lastSavedAt)}`
                          : `${r.wins}승 · 최근 ${formatRecordDate(r.lastSavedAt)}`}
                      </span>
                    )}
                  </div>
                </li>
              )
            })}
          </ol>
        )}

        <button type="button" className="btn-primary full" onClick={onClose}>
          닫기
        </button>
      </div>
    </div>
  )
}
