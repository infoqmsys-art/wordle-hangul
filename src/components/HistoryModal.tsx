import { useEffect, useState } from 'react'
import { findDefinition, loadDictionary } from '../data/words'
import {
  formatRecordDate,
  formatSeconds,
  isSharedHistoryEnabled,
  loadHistory,
  type HistoryRecord,
} from '../lib/history'
import { lookupStdict } from '../lib/stdict'

type Props = {
  open: boolean
  onClose: () => void
}

function recordHeadline(r: HistoryRecord): string {
  if (r.playMode === 'daily') {
    return r.won ? '오늘의 단어 성공!' : '오늘의 단어 실패'
  }
  return `단어 「${r.word}」`
}

export function HistoryModal({ open, onClose }: Props) {
  const [records, setRecords] = useState<HistoryRecord[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [defs, setDefs] = useState<Record<string, string>>({})
  const [openDefId, setOpenDefId] = useState<string | null>(null)
  const [defLoadingId, setDefLoadingId] = useState<string | null>(null)

  useEffect(() => {
    if (!open) return
    let alive = true
    setLoading(true)
    setError(null)
    setOpenDefId(null)

    if (!isSharedHistoryEnabled()) {
      setRecords([])
      setError('공유 기록이 아직 설정되지 않았어요. Firebase 설정이 필요해요.')
      setLoading(false)
      return
    }

    Promise.all([loadHistory(), loadDictionary().catch(() => null)])
      .then(([list, dict]) => {
        if (!alive) return
        setRecords(list)
        if (dict) setDefs({ ...dict.definitions })
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

  const toggleDefinition = async (r: HistoryRecord) => {
    if (r.playMode === 'daily' || !r.word) return
    if (openDefId === r.id) {
      setOpenDefId(null)
      return
    }
    setOpenDefId(r.id)
    if (defs[r.word]) return

    setDefLoadingId(r.id)
    try {
      const dict = await loadDictionary().catch(() => null)
      const baked = findDefinition(dict, r.word)
      if (baked) {
        setDefs((prev) => ({ ...prev, [r.word]: baked }))
        return
      }
      const api = await lookupStdict(r.word)
      if (api?.definition) {
        setDefs((prev) => ({ ...prev, [r.word]: api.definition! }))
      } else {
        setDefs((prev) => ({
          ...prev,
          [r.word]: '뜻을 찾지 못했어요',
        }))
      }
    } finally {
      setDefLoadingId(null)
    }
  }

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
        <p className="modal-sub">
          메인게임 단어를 누르면 사전 뜻을 볼 수 있어요. 오늘의 단어는
          정답을 숨겨요.
        </p>

        {loading ? (
          <p className="history-empty">불러오는 중...</p>
        ) : error ? (
          <p className="history-empty">{error}</p>
        ) : records.length === 0 ? (
          <p className="history-empty">아직 기록이 없어요</p>
        ) : (
          <ul className="history-list">
            {records.map((r) => {
              const canShowDef = r.playMode !== 'daily' && Boolean(r.word)
              const expanded = openDefId === r.id
              return (
                <li key={r.id} className="history-item">
                  <div className="history-top">
                    <strong>{r.name}</strong>
                    <span className={r.won ? 'tag-win' : 'tag-lose'}>
                      {r.won ? '성공' : '실패'}
                    </span>
                  </div>
                  <div className="history-meta">
                    <span
                      className={
                        r.playMode === 'daily' ? 'history-daily-line' : undefined
                      }
                    >
                      {recordHeadline(r)}
                    </span>
                    <span>
                      {r.difficulty === 'hard' ? '어려움' : '쉬움'}
                    </span>
                    {r.playMode !== 'daily' && (
                      <>
                        <span>{formatSeconds(r.seconds)}</span>
                        <span>
                          {r.won
                            ? `${r.attempts}/${r.maxAttempts}회`
                            : `${r.maxAttempts}회 실패`}
                        </span>
                        <span
                          className={r.hintUsed ? 'tag-hint' : 'tag-no-hint'}
                        >
                          {r.hintUsed ? '힌트 사용' : '힌트 없음'}
                        </span>
                      </>
                    )}
                  </div>
                  <div className="history-date">{formatRecordDate(r.savedAt)}</div>
                  {canShowDef && (
                    <button
                      type="button"
                      className="history-def-btn"
                      onClick={() => void toggleDefinition(r)}
                    >
                      {expanded ? '뜻 닫기' : '사전 뜻 보기'}
                    </button>
                  )}
                  {expanded && canShowDef && (
                    <p className="history-def">
                      {defLoadingId === r.id
                        ? '뜻 불러오는 중…'
                        : defs[r.word] ?? '뜻을 찾지 못했어요'}
                    </p>
                  )}
                </li>
              )
            })}
          </ul>
        )}

        <button type="button" className="btn-primary full" onClick={onClose}>
          닫기
        </button>
      </div>
    </div>
  )
}
