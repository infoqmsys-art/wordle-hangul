import { useEffect, useState } from 'react'
import {
  formatRecordDate,
  formatSeconds,
  isSharedHistoryEnabled,
  loadHistory,
  type HistoryRecord,
} from '../lib/history'

type Props = {
  open: boolean
  onClose: () => void
}

export function HistoryModal({ open, onClose }: Props) {
  const [records, setRecords] = useState<HistoryRecord[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!open) return
    let alive = true
    setLoading(true)
    setError(null)

    if (!isSharedHistoryEnabled()) {
      setRecords([])
      setError('공유 기록이 아직 연결되지 않았어요. Firebase 설정이 필요해요.')
      setLoading(false)
      return
    }

    loadHistory()
      .then((list) => {
        if (!alive) return
        setRecords(list)
      })
      .catch(() => {
        if (!alive) return
        setError('기록을 불러오지 못했어요')
      })
      .finally(() => {
        if (!alive) return
        setLoading(false)
      })

    return () => {
      alive = false
    }
  }, [open])

  if (!open) return null

  return (
    <div className="modal-backdrop" role="presentation" onClick={onClose}>
      <div
        className="modal history-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="history-title"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 id="history-title">기록</h2>
        <p className="modal-sub">모든 플레이어의 기록이 여기에 모여요</p>

        {loading ? (
          <p className="history-empty">불러오는 중...</p>
        ) : error ? (
          <p className="history-empty">{error}</p>
        ) : records.length === 0 ? (
          <p className="history-empty">아직 기록이 없어요</p>
        ) : (
          <ul className="history-list">
            {records.map((r) => (
              <li key={r.id} className="history-item">
                <div className="history-top">
                  <strong>{r.name}</strong>
                  <span className={r.won ? 'tag-win' : 'tag-lose'}>
                    {r.won ? '성공' : '실패'}
                  </span>
                </div>
                <div className="history-meta">
                  <span>단어 「{r.word}」</span>
                  <span>{formatSeconds(r.seconds)}</span>
                  <span>
                    {r.won
                      ? `${r.attempts}/${r.maxAttempts}회`
                      : `${r.maxAttempts}회 실패`}
                  </span>
                </div>
                <div className="history-date">{formatRecordDate(r.savedAt)}</div>
              </li>
            ))}
          </ul>
        )}

        <button type="button" className="btn-primary full" onClick={onClose}>
          닫기
        </button>
      </div>
    </div>
  )
}
