import { formatRecordDate, formatSeconds, loadHistory, type HistoryRecord } from '../lib/history'

type Props = {
  open: boolean
  onClose: () => void
}

export function HistoryModal({ open, onClose }: Props) {
  if (!open) return null

  const records: HistoryRecord[] = loadHistory()

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
        <p className="modal-sub">이 기기에 저장된 플레이 기록이에요</p>

        {records.length === 0 ? (
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
                    {r.won ? `${r.attempts}/${r.maxAttempts}회` : `${r.maxAttempts}회 실패`}
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
