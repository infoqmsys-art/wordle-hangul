import { useEffect, useRef, useState } from 'react'
import type { Difficulty } from '../data/words'
import { DIFFICULTY_META } from '../data/words'
import type { PlayMode, Row } from '../hooks/useGame'
import { MAX_ATTEMPTS } from '../hooks/useGame'
import {
  formatSeconds,
  getLastName,
  saveHistoryRecord,
} from '../lib/history'
import {
  avgWinAttempts,
  getPersonalStats,
  winRate,
  type PersonalStats,
} from '../lib/stats'
import { shareChallenge } from '../lib/challenge'

type Props = {
  open: boolean
  status: 'won' | 'lost' | 'playing'
  answerWord: string
  answerJamo: string[]
  definition: string | null
  rows: Row[]
  seconds: number
  dateKey: string
  difficulty: Difficulty
  wordLength: number
  playMode: PlayMode
  recordSaved: boolean
  onRecordSaved: () => void
  onNextRound: () => void
  onOpenHistory: () => void
  onClose: () => void
  /** 로그인 닉네임 — 있으면 기록 자동 저장 */
  autoNickname?: string | null
  /** 로그인 uid — 기록에 붙여 이름 변경 시 따라가게 */
  userUid?: string | null
}

function emojiGrid(rows: Row[]): string {
  return rows
    .map((row) =>
      row.statuses
        .map((s) => (s === 'correct' ? '🟩' : s === 'present' ? '🟨' : '⬛'))
        .join(''),
    )
    .join('\n')
}

export function ResultModal({
  open,
  status,
  answerWord,
  answerJamo,
  definition,
  rows,
  seconds,
  dateKey,
  difficulty,
  wordLength,
  playMode,
  recordSaved,
  onRecordSaved,
  onNextRound,
  onOpenHistory,
  onClose,
  autoNickname,
  userUid,
}: Props) {
  const [name, setName] = useState(getLastName)
  const [saved, setSaved] = useState(recordSaved)
  const [savedName, setSavedName] = useState(getLastName)
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [stats, setStats] = useState<PersonalStats>(() => getPersonalStats())
  const [challengeBusy, setChallengeBusy] = useState(false)
  const autoTried = useRef<string | null>(null)

  useEffect(() => {
    if (open) {
      const last = autoNickname?.trim() || getLastName()
      setName(last)
      setSavedName(last)
      setSaved(recordSaved)
      setError(null)
      setStats(getPersonalStats())
    } else {
      autoTried.current = null
    }
  }, [open, recordSaved, answerWord, autoNickname])

  useEffect(() => {
    if (!open || status === 'playing' || recordSaved) return
    const nick = autoNickname?.trim()
    if (!nick) return
    const key = `${answerWord}:${dateKey}:${difficulty}`
    if (autoTried.current === key) return
    autoTried.current = key

    let cancelled = false
    setSaving(true)
    saveHistoryRecord({
      name: nick.slice(0, 20),
      word: answerWord,
      seconds,
      attempts: rows.length,
      maxAttempts: MAX_ATTEMPTS,
      won: status === 'won',
      dateKey,
      difficulty,
      wordLength,
      uid: userUid ?? undefined,
    })
      .then(() => {
        if (cancelled) return
        setSaved(true)
        setSavedName(nick.slice(0, 20))
        onRecordSaved()
      })
      .catch(() => {
        if (!cancelled) autoTried.current = null
      })
      .finally(() => {
        if (!cancelled) setSaving(false)
      })

    return () => {
      cancelled = true
    }
  }, [
    open,
    status,
    recordSaved,
    autoNickname,
    answerWord,
    dateKey,
    difficulty,
    wordLength,
    seconds,
    rows.length,
    onRecordSaved,
    userUid,
  ])

  if (!open || status === 'playing') return null

  const won = status === 'won'
  const avgAttempts = avgWinAttempts(stats)
  const nextLabel =
    playMode === 'daily' ? '연습 이어하기' : '다음 문제 풀기'

  const save = async () => {
    const trimmed = name.trim()
    if (!trimmed) {
      setError('본인 이름을 적어주세요~')
      return
    }
    const finalName = trimmed.slice(0, 20)
    setSaving(true)
    setError(null)
    try {
      await saveHistoryRecord({
        name: finalName,
        word: answerWord,
        seconds,
        attempts: rows.length,
        maxAttempts: MAX_ATTEMPTS,
        won,
        dateKey,
        difficulty,
        wordLength,
        uid: userUid ?? undefined,
      })
      setSaved(true)
      setSavedName(finalName)
      onRecordSaved()
    } catch {
      setError('기록 저장에 실패했어요. 잠시 후 다시 시도해 주세요.')
    } finally {
      setSaving(false)
    }
  }

  const share = async () => {
    const who = savedName.trim() || '나'
    const modeLabel = playMode === 'daily' ? '오늘의 단어' : '연습'
    const streakLine =
      won && stats.currentStreak >= 2
        ? `\n🔥 ${stats.currentStreak}연속 승리`
        : ''
    const text = `푸들푸들 오늘의 단어\n${who} · ${won ? '성공' : '실패'} · ${modeLabel} · ${DIFFICULTY_META[difficulty].label}\n정답은 ${answerWord}\n${won ? rows.length : 'X'}/${MAX_ATTEMPTS} · ${formatSeconds(seconds)}${streakLine}\n\n${emojiGrid(rows)}`
    try {
      if (navigator.share) {
        await navigator.share({ text })
      } else {
        await navigator.clipboard.writeText(text)
        alert('결과가 복사되었어요!')
      }
    } catch {
      /* cancelled */
    }
  }

  const shareAsChallenge = async () => {
    if (challengeBusy) return
    setChallengeBusy(true)
    try {
      const result = await shareChallenge({
        difficulty,
        word: answerWord,
        fromName: savedName.trim() || name.trim() || undefined,
      })
      if (result === 'copied') alert('도전 링크가 복사되었어요!')
    } finally {
      setChallengeBusy(false)
    }
  }

  const goNext = () => {
    onNextRound()
    onClose()
  }

  return (
    <div className="modal-backdrop result-screen" role="presentation">
      <div
        className="result-panel"
        role="dialog"
        aria-modal="true"
        aria-labelledby="result-answer-title"
        onClick={(e) => e.stopPropagation()}
      >
        <button type="button" className="result-back" onClick={onClose} aria-label="닫기">
          ←
        </button>

        <p id="result-answer-title" className="result-answer-line">
          정답은 <span>{answerWord}</span>
        </p>
        <p className="result-jamo">
          {playMode === 'daily' ? '오늘의 단어' : '연습'} ·{' '}
          {DIFFICULTY_META[difficulty].label} · {answerJamo.join(' · ')}
        </p>
        {definition && <p className="result-def">{definition}</p>}

        <div className={`result-card ${won ? 'is-win' : 'is-lose'}`}>
          {!saved ? (
            autoNickname ? (
              <p className="result-player-name">
                {saving ? '기록 저장 중...' : autoNickname}
              </p>
            ) : (
              <div className="result-name-box">
                <p className="result-name-guide">본인 이름을 적어주세요~</p>
                <input
                  id="player-name"
                  type="text"
                  maxLength={20}
                  value={name}
                  placeholder="이름을 입력해 주세요"
                  autoFocus
                  onChange={(e) => {
                    setName(e.target.value)
                    setError(null)
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault()
                      save()
                    }
                  }}
                />
                {error && <p className="name-error">{error}</p>}
                <button
                  type="button"
                  className="result-save-btn"
                  onClick={save}
                  disabled={saving}
                >
                  {saving ? '저장 중...' : '이름 저장'}
                </button>
              </div>
            )
          ) : (
            <p className="result-player-name">{savedName}</p>
          )}
          <div className="result-divider" />
          <p className={`result-status ${won ? 'win' : 'lose'}`}>
            {won ? '성공' : '실패'}
          </p>
          <p className="result-stats">
            {won
              ? `${rows.length}/${MAX_ATTEMPTS}번 · ${formatSeconds(seconds)}`
              : `${MAX_ATTEMPTS}번 실패 · ${formatSeconds(seconds)}`}
          </p>
          {won && stats.currentStreak >= 2 && (
            <p
              className={`result-streak${stats.currentStreak >= 5 ? ' is-hot' : ''}`}
            >
              <span className="streak-fire" aria-hidden>
                🔥
              </span>
              {stats.currentStreak}연속 승리 중!
            </p>
          )}
          {won && stats.currentStreak === 1 && (
            <p className="result-streak is-start">연속 승리 시작!</p>
          )}
          {!won && stats.maxStreak > 0 && (
            <p className="result-streak is-broken">연속 승리가 끊겼어요</p>
          )}
        </div>

        {stats.played > 0 && (
          <div className="personal-stats" aria-label="내 통계">
            <div>
              <strong>{winRate(stats)}%</strong>
              <span>승률</span>
            </div>
            <div className={stats.currentStreak >= 2 ? 'is-streak' : undefined}>
              <strong>
                {stats.currentStreak >= 2 ? (
                  <>
                    <span className="streak-fire tiny" aria-hidden>
                      🔥
                    </span>
                    {stats.currentStreak}
                  </>
                ) : (
                  stats.currentStreak
                )}
              </strong>
              <span>연속 승리</span>
            </div>
            <div>
              <strong>{stats.maxStreak}</strong>
              <span>최고 연속</span>
            </div>
            <div>
              <strong>{avgAttempts != null ? avgAttempts : '—'}</strong>
              <span>평균 시도</span>
            </div>
          </div>
        )}

        <div className="result-rows">
          <div className="result-row">
            <span>이번 결과</span>
            <button type="button" className="pill-btn" onClick={share}>
              공유하기
            </button>
          </div>
          <div className="result-row">
            <span>같은 문제 도전</span>
            <button
              type="button"
              className="pill-btn challenge"
              onClick={shareAsChallenge}
              disabled={challengeBusy}
            >
              {challengeBusy ? '준비 중...' : '도전 보내기'}
            </button>
          </div>
          <div className="result-row">
            <span>플레이 기록</span>
            <button
              type="button"
              className="pill-btn"
              onClick={() => {
                onClose()
                onOpenHistory()
              }}
            >
              보러가기
            </button>
          </div>
        </div>

        <div className="result-bottom">
          <button type="button" className="result-bottom-btn" onClick={onClose}>
            닫기
          </button>
          <button type="button" className="result-bottom-btn primary" onClick={goNext}>
            {nextLabel}
          </button>
        </div>
      </div>
    </div>
  )
}
