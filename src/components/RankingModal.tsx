import { useEffect, useState } from 'react'
import type { Difficulty } from '../data/words'
import { DIFFICULTY_META } from '../data/words'
import {
  formatRecordDate,
  isSharedHistoryEnabled,
  loadRanking,
  type RankEntry,
} from '../lib/history'

type Props = {
  open: boolean
  onClose: () => void
  initialDifficulty?: Difficulty
}

export function RankingModal({
  open,
  onClose,
  initialDifficulty = 'easy',
}: Props) {
  const [tab, setTab] = useState<Difficulty>(initialDifficulty)
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

    loadRanking(tab)
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
  }, [open, tab])

  if (!open) return null

  return (
    <div className="modal-backdrop" role="presentation" onClick={onClose}>
      <div
        className="modal history-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="rank-title"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 id="rank-title">랭킹</h2>
        <p className="modal-sub">같은 이름으로 성공할 때마다 승수가 쌓여요</p>

        <div className="rank-tabs">
          <button
            type="button"
            className={tab === 'easy' ? 'on' : ''}
            onClick={() => setTab('easy')}
          >
            쉬움 (5칸)
          </button>
          <button
            type="button"
            className={tab === 'hard' ? 'on' : ''}
            onClick={() => setTab('hard')}
          >
            어려움 (7칸)
          </button>
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
            {ranking.map((r, i) => (
              <li key={`${tab}-${r.name}`} className="rank-item">
                <span className="rank-num">{i + 1}</span>
                <div className="rank-body">
                  <div className="history-top">
                    <strong>{r.name}</strong>
                    <span className="rank-time">{r.wins}승</span>
                  </div>
                  {r.lastSavedAt > 0 && (
                    <div className="history-meta">
                      <span>최근 {formatRecordDate(r.lastSavedAt)}</span>
                    </div>
                  )}
                </div>
              </li>
            ))}
          </ol>
        )}

        <button type="button" className="btn-primary full" onClick={onClose}>
          닫기
        </button>
      </div>
    </div>
  )
}
