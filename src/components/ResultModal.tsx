import { useEffect, useState } from 'react'
import type { Row } from '../hooks/useGame'
import { MAX_ATTEMPTS } from '../hooks/useGame'
import {
  formatSeconds,
  getLastName,
  saveHistoryRecord,
} from '../lib/history'

type Props = {
  open: boolean
  status: 'won' | 'lost' | 'playing'
  answerWord: string
  answerJamo: string[]
  definition: string | null
  rows: Row[]
  seconds: number
  dateKey: string
  recordSaved: boolean
  onRecordSaved: () => void
  onNextRound: () => void
  onOpenHistory: () => void
  onClose: () => void
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
  recordSaved,
  onRecordSaved,
  onNextRound,
  onOpenHistory,
  onClose,
}: Props) {
  const [name, setName] = useState(getLastName)
  const [saved, setSaved] = useState(recordSaved)
  const [savedName, setSavedName] = useState(getLastName)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (open) {
      const last = getLastName()
      setName(last)
      setSavedName(last)
      setSaved(recordSaved)
      setError(null)
    }
  }, [open, recordSaved, answerWord])

  if (!open || status === 'playing') return null

  const won = status === 'won'

  const save = () => {
    const trimmed = name.trim()
    if (!trimmed) {
      setError('본인 이름을 적어주세요~')
      return
    }
    const finalName = trimmed.slice(0, 20)
    saveHistoryRecord({
      name: finalName,
      word: answerWord,
      seconds,
      attempts: rows.length,
      maxAttempts: MAX_ATTEMPTS,
      won,
      dateKey,
    })
    setSaved(true)
    setSavedName(finalName)
    onRecordSaved()
  }

  const share = async () => {
    const who = savedName.trim() || '나'
    const text = `푸들푸들 오늘의 단어 연습\n${who} · ${won ? '성공' : '실패'}\n정답은 ${answerWord}\n${won ? rows.length : 'X'}/${MAX_ATTEMPTS} · ${formatSeconds(seconds)}\n\n${emojiGrid(rows)}`
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
        <p className="result-jamo">{answerJamo.join(' · ')}</p>
        {definition && <p className="result-def">{definition}</p>}

        <div className={`result-card ${won ? 'is-win' : 'is-lose'}`}>
          {!saved ? (
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
              <button type="button" className="result-save-btn" onClick={save}>
                이름 저장
              </button>
            </div>
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
        </div>

        <div className="result-rows">
          <div className="result-row">
            <span>이번 결과</span>
            <button type="button" className="pill-btn" onClick={share}>
              공유하기
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
            다음 문제 풀기
          </button>
        </div>
      </div>
    </div>
  )
}
