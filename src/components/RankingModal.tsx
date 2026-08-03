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
  loadXpRanking,
  type WeeklyRankEntry,
  type XpRankEntry,
} from '../lib/progress'

type Props = {
  open: boolean
  onClose: () => void
  /** classic = 단어킹(누적 승수 등), xp = 주간/누적 XP */
  variant?: 'classic' | 'xp'
  initialDifficulty?: Difficulty
  onOpenHistory?: () => void
}

type XpTab = 'week' | 'total'

const MODE_LABEL: Record<RankMode, string> = {
  wins: '승수',
  fastest: '최단시간',
  attempts: '최단시도',
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
  const [xpTab, setXpTab] = useState<XpTab>('week')
  const [ranking, setRanking] = useState<RankEntry[]>([])
  const [xpRanking, setXpRanking] = useState<XpRankEntry[]>([])
  const [weekRanking, setWeekRanking] = useState<WeeklyRankEntry[]>([])
  const [weekKey, setWeekKey] = useState(getWeekKey())
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [helpOpen, setHelpOpen] = useState(false)

  useEffect(() => {
    if (!open) return
    setTab(initialDifficulty)
    setMode('wins')
    setXpTab('week')
    setHelpOpen(false)
  }, [open, initialDifficulty, variant])

  useEffect(() => {
    if (!open) return
    let alive = true
    setLoading(true)
    setError(null)
    setRanking([])
    setXpRanking([])
    setWeekRanking([])

    if (!isSharedHistoryEnabled()) {
      setError('공유 기록이 아직 연결되지 않았어요')
      setLoading(false)
      return
    }

    const load =
      variant === 'xp'
        ? xpTab === 'week'
          ? (() => {
              const key = getWeekKey()
              setWeekKey(key)
              return loadWeeklyRanking(key).then((list) => {
                if (!alive) return
                setWeekRanking(list)
                setError(null)
              })
            })()
          : loadXpRanking().then((list) => {
              if (!alive) return
              setXpRanking(list)
              setError(null)
            })
        : loadRanking(tab, mode).then((list) => {
            if (!alive) return
            setRanking(list)
            setError(null)
          })

    load
      .catch(() => {
        if (!alive) return
        setRanking([])
        setXpRanking([])
        setWeekRanking([])
        setError('랭킹을 불러오지 못했어요')
      })
      .finally(() => {
        if (alive) setLoading(false)
      })

    return () => {
      alive = false
    }
  }, [open, variant, tab, mode, xpTab])

  if (!open) return null

  const isXp = variant === 'xp'
  const emptyLabel = isXp
    ? xpTab === 'week'
      ? '이번 주 XP 기록이 아직 없어요'
      : '아직 누적 XP 기록이 없어요'
    : `아직 ${DIFFICULTY_META[tab].label} 기록이 없어요`

  const title = isXp
    ? xpTab === 'week'
      ? '푸들푸들 이번 주 랭킹'
      : '푸들푸들 누적 XP'
    : '푸들푸들 단어킹'

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
          <h2 id="rank-title">{title}</h2>
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
            {isXp ? (
              xpTab === 'week' ? (
                <>
                  <p>
                    <strong>이번 주 랭킹</strong>은 로그인 유저가 이번 주(월
                    09:00~다음 월 09:00)에 모은 XP 순이에요. 주가 바뀌면 보드가
                    비고 새로 쌓입니다. 누적 레벨 XP는 그대로예요.
                  </p>
                  <p>
                    보상은 매주 <strong>월요일 09:00</strong>에 지난주 순위로
                    정산되고, 홈·내 정보에서 <strong>받기</strong>로 수령해요
                    (7일 후 만료).
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
                <p>
                  <strong>누적 XP</strong>는 계정에 쌓인 전체 XP·레벨 순이에요.
                  주가 바뀌어도 리셋되지 않습니다.
                </p>
              )
            ) : (
              <>
                <p>
                  <strong>단어킹</strong>은 로그인 계정의 쉬움·어려움별 승수 /
                  최단시간 / 최단시도 순위예요. 비로그인 기록은 제외되며, 같은
                  기록이면 같은 순위(공동)입니다. 주간으로 리셋되지 않아요.
                </p>
                <p>
                  <strong>승수</strong>는 메인게임 + 오늘의 단어를 합치고,
                  <strong> 최단시간·최단시도</strong>는 메인게임만 집계해요.
                </p>
              </>
            )}
          </div>
        )}

        {isXp && (
          <div className="rank-mode-tabs" role="tablist" aria-label="XP 기준">
            <button
              type="button"
              role="tab"
              aria-selected={xpTab === 'week'}
              className={xpTab === 'week' ? 'on' : ''}
              onClick={() => setXpTab('week')}
            >
              이번 주
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={xpTab === 'total'}
              className={xpTab === 'total' ? 'on' : ''}
              onClick={() => setXpTab('total')}
            >
              누적
            </button>
          </div>
        )}

        {isXp && xpTab === 'week' && (
          <p className="rank-week-key" aria-label="주간 키">
            {weekKey} · 월 09:00 기준
          </p>
        )}

        {!isXp && (
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
          ) : isXp && xpTab === 'week' ? (
            weekRanking.length === 0 ? (
              <p className="history-empty">{emptyLabel}</p>
            ) : (
              <ol className="rank-list">
                {weekRanking.map((r) => (
                  <li
                    key={`week-${r.uid}`}
                    className={`rank-item${r.rank <= 3 ? ` top-${r.rank}` : ''}`}
                  >
                    <span className="rank-num" aria-label={`${r.rank}위`}>
                      {r.rank}
                    </span>
                    <strong className="rank-name">{r.nickname}</strong>
                    <span className="rank-wins">
                      {r.weekXp.toLocaleString('ko-KR')} XP
                      <span className="rank-week-wins"> · {r.weekWins}승</span>
                    </span>
                  </li>
                ))}
              </ol>
            )
          ) : isXp ? (
            xpRanking.length === 0 ? (
              <p className="history-empty">{emptyLabel}</p>
            ) : (
              <ol className="rank-list">
                {xpRanking.map((r) => (
                  <li
                    key={`xp-${r.uid}`}
                    className={`rank-item${r.rank <= 3 ? ` top-${r.rank}` : ''}`}
                  >
                    <span className="rank-num" aria-label={`${r.rank}위`}>
                      {r.rank}
                    </span>
                    <strong className="rank-name">
                      {r.nickname}
                      <span className="rank-level"> Lv.{r.level}</span>
                    </strong>
                    <span className="rank-wins">
                      {r.xp.toLocaleString('ko-KR')} XP
                    </span>
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
          {onOpenHistory && !isXp && (
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
