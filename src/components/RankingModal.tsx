import { useEffect, useState } from 'react'
import type { Difficulty } from '../data/words'
import { DIFFICULTY_META } from '../data/words'
import {
  isSharedHistoryEnabled,
  loadRanking,
  type RankEntry,
  type RankMode,
} from '../lib/history'

type Props = {
  open: boolean
  onClose: () => void
  initialDifficulty?: Difficulty
  onOpenHistory?: () => void
}

const MODE_LABEL: Record<RankMode, string> = {
  wins: '승수',
  fastest: '최단시간',
  attempts: '최단시도',
}

export function RankingModal({
  open,
  onClose,
  initialDifficulty = 'easy',
  onOpenHistory,
}: Props) {
  const [tab, setTab] = useState<Difficulty>(initialDifficulty)
  const [mode, setMode] = useState<RankMode>('wins')
  const [ranking, setRanking] = useState<RankEntry[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [helpOpen, setHelpOpen] = useState(false)

  useEffect(() => {
    if (!open) return
    setTab(initialDifficulty)
    setMode('wins')
    setHelpOpen(false)
  }, [open, initialDifficulty])

  useEffect(() => {
    if (!open) return
    let alive = true
    setLoading(true)
    setError(null)
    setRanking([])

    if (!isSharedHistoryEnabled()) {
      setError('공유 기록이 아직 연결되지 않았어요')
      setLoading(false)
      return
    }

    loadRanking(tab, mode)
      .then((list) => {
        if (!alive) return
        setRanking(list)
        setError(null)
      })
      .catch(() => {
        if (!alive) return
        setRanking([])
        setError('랭킹을 불러오지 못했어요')
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
        <div className="rank-title-row">
          <h2 id="rank-title">푸들푸들 이번주 단어킹</h2>
          <button
            type="button"
            className="rank-help-btn"
            aria-label="랭킹·보상 안내"
            aria-expanded={helpOpen}
            onClick={() => setHelpOpen((v) => !v)}
          >
            ?
          </button>
        </div>

        {helpOpen && (
          <div className="rank-help-panel" role="note">
            <p>
              <strong>단어킹</strong>은 쉬움·어려움별 승수 / 최단시간 /
              최단시도 순위예요. 같은 기록이면 같은 순위(공동)입니다.
            </p>
            <p>
              <strong>주간 XP 보상</strong>은 로그인 유저만, 이번 주 모은 XP
              순위로 매주 <strong>월요일 09:00</strong>에 정산해요.
            </p>
            <ul>
              <li>1위 +300 XP</li>
              <li>2위 +180 XP</li>
              <li>3위 +100 XP</li>
              <li>4~10위 +40 XP</li>
              <li>그 외 참가 +15 XP</li>
            </ul>
            <p>
              보상은 홈·내 정보에서 <strong>받기</strong>로 수령하고, 정산 후
              <strong> 7일</strong>이 지나면 사라져요. 공동 순위면 보상도
              같습니다.
            </p>
          </div>
        )}

        <div className="rank-filters">
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
          <div className="rank-mode-tabs" role="tablist" aria-label="기준">
            {(Object.keys(MODE_LABEL) as RankMode[]).map((m) => (
              <button
                key={m}
                type="button"
                role="tab"
                aria-selected={mode === m}
                className={mode === m ? 'on' : ''}
                onClick={() => setMode(m)}
              >
                {MODE_LABEL[m]}
              </button>
            ))}
          </div>
        </div>

        <div className="rank-body">
          {loading ? (
            <p className="history-empty">불러오는 중...</p>
          ) : error ? (
            <p className="history-empty">{error}</p>
          ) : ranking.length === 0 ? (
            <p className="history-empty">
              아직 {DIFFICULTY_META[tab].label} 기록이 없어요
            </p>
          ) : (
            <ol className="rank-list">
              {ranking.map((r) => {
                const place = r.rank
                return (
                  <li
                    key={`${tab}-${mode}-${r.name}`}
                    className={`rank-item${place <= 3 ? ` top-${place}` : ''}`}
                  >
                    <span className="rank-num" aria-label={`${place}위`}>
                      {place}
                    </span>
                    <strong className="rank-name">{r.name}</strong>
                    <span className="rank-wins">{r.scoreLabel}</span>
                  </li>
                )
              })}
            </ol>
          )}
        </div>

        <div className="rank-footer">
          {onOpenHistory && (
            <div className="rank-footer-links">
              <button
                type="button"
                className="rank-history-link is-on"
                onClick={onOpenHistory}
              >
                기록 보기
              </button>
            </div>
          )}
          <button type="button" className="btn-primary full" onClick={onClose}>
            닫기
          </button>
        </div>
      </div>
    </div>
  )
}
