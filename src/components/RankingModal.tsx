import { useEffect, useState } from 'react'
import type { Difficulty } from '../data/words'
import { DIFFICULTY_META } from '../data/words'
import {
  isSharedHistoryEnabled,
  loadRanking,
  type RankEntry,
  type RankMode,
} from '../lib/history'
import { getWeekKey } from '../lib/levels'
import {
  loadWeeklyRanking,
  type WeeklyRankEntry,
  type WeeklyRankMode,
} from '../lib/progress'

type Props = {
  open: boolean
  onClose: () => void
  /** classic = 단어킹(누적), xp = 이번 주 랭킹 */
  variant?: 'classic' | 'xp'
  initialDifficulty?: Difficulty
  onOpenHistory?: () => void
}

const MODE_LABEL: Record<RankMode, string> = {
  wins: '승수',
  fastest: '최단시간',
  attempts: '최단시도',
}

const WEEK_MODE_LABEL: Record<WeeklyRankMode, string> = {
  plays: '판수',
  attempts: '최단시도',
  fastest: '최단시간',
}

export function RankingModal({
  open,
  onClose,
  variant = 'classic',
  initialDifficulty = 'easy',
  onOpenHistory,
}: Props) {
  const [tab, setTab] = useState<Difficulty>(initialDifficulty)
  const [mode, setMode] = useState<RankMode>('wins')
  const [weekMode, setWeekMode] = useState<WeeklyRankMode>('plays')
  const [ranking, setRanking] = useState<RankEntry[]>([])
  const [weekRanking, setWeekRanking] = useState<WeeklyRankEntry[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [helpOpen, setHelpOpen] = useState(false)

  useEffect(() => {
    if (!open) return
    setTab(initialDifficulty)
    setMode('wins')
    setWeekMode('plays')
    setHelpOpen(false)
  }, [open, initialDifficulty, variant])

  useEffect(() => {
    if (!open) return
    let alive = true
    setLoading(true)
    setError(null)
    setRanking([])
    setWeekRanking([])

    if (!isSharedHistoryEnabled()) {
      setError('랭킹을 불러올 수 없어요. 잠시 후 다시 시도해 주세요.')
      setLoading(false)
      return
    }

    const load =
      variant === 'xp'
        ? (() => {
            return loadWeeklyRanking(getWeekKey(), weekMode).then((list) => {
              if (!alive) return
              setWeekRanking(list)
              setError(null)
            })
          })()
        : loadRanking(tab, mode).then((list) => {
            if (!alive) return
            setRanking(list)
            setError(null)
          })

    load
      .catch(() => {
        if (!alive) return
        setRanking([])
        setWeekRanking([])
        setError('랭킹을 불러오지 못했어요')
      })
      .finally(() => {
        if (alive) setLoading(false)
      })

    return () => {
      alive = false
    }
  }, [open, variant, tab, mode, weekMode])

  if (!open) return null

  const isWeek = variant === 'xp'
  const emptyLabel = isWeek
    ? '이번 주 기록이 아직 없어요'
    : `아직 ${DIFFICULTY_META[tab].label} 기록이 없어요`

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
          <h2 id="rank-title">
            {isWeek ? '푸들푸들 이번 주 랭킹' : '푸들푸들 단어킹'}
          </h2>
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
            {isWeek ? (
              <>
                <p>
                  <strong>이번 주 랭킹</strong>만 보여요. 판수 · 최단시도 ·
                  최단시간 기준이며, 매주 월요일 09:00에 보드가 새로
                  시작됩니다. 레벨·누적 전적은 홈에 그대로 남아요.
                </p>
                <p>
                  <strong>최단시도·최단시간</strong>은 이번 주 승리만
                  집계하고, 주간 보상은 <strong>판수</strong> 순위로 월요일
                  09:00에 정산됩니다.
                </p>
                <ul>
                  <li>1위 +300 XP</li>
                  <li>2위 +180 XP</li>
                  <li>3위 +100 XP</li>
                  <li>4~10위 +40 XP</li>
                  <li>그 외 참가 +15 XP</li>
                </ul>
              </>
            ) : (
              <>
                <p>
                  <strong>단어킹</strong>은 누적 승수 / 최단시간 / 최단시도
                  순위예요. 주간으로 리셋되지 않아요.
                </p>
                <p>
                  <strong>승수</strong>는 메인게임 + 오늘의 단어를 합치고,
                  <strong> 최단시간·최단시도</strong>는 메인게임만 집계해요.
                </p>
              </>
            )}
          </div>
        )}

        {isWeek && (
          <div
            className="rank-mode-tabs rank-week-tabs"
            role="tablist"
            aria-label="이번 주 기준"
          >
            {(Object.keys(WEEK_MODE_LABEL) as WeeklyRankMode[]).map((m) => (
              <button
                key={m}
                type="button"
                role="tab"
                aria-selected={weekMode === m}
                className={weekMode === m ? 'on' : ''}
                onClick={() => setWeekMode(m)}
              >
                {WEEK_MODE_LABEL[m]}
              </button>
            ))}
          </div>
        )}

        {!isWeek && (
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
        )}

        <div className="rank-body">
          {loading ? (
            <p className="history-empty">불러오는 중...</p>
          ) : error ? (
            <p className="history-empty">{error}</p>
          ) : isWeek ? (
            weekRanking.length === 0 ? (
              <p className="history-empty">{emptyLabel}</p>
            ) : (
              <ol className="rank-list">
                {weekRanking.map((r) => (
                  <li
                    key={`week-${weekMode}-${r.uid}`}
                    className={`rank-item${r.rank <= 3 ? ` top-${r.rank}` : ''}`}
                  >
                    <span className="rank-num" aria-label={`${r.rank}위`}>
                      {r.rank}
                    </span>
                    <strong className="rank-name">{r.nickname}</strong>
                    <span className="rank-wins">{r.scoreLabel}</span>
                  </li>
                ))}
              </ol>
            )
          ) : ranking.length === 0 ? (
            <p className="history-empty">{emptyLabel}</p>
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
          {onOpenHistory && !isWeek && (
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
