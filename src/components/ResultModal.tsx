import type { Row } from '../hooks/useGame'
import { MAX_ATTEMPTS } from '../hooks/useGame'

type Props = {
  open: boolean
  status: 'won' | 'lost' | 'playing'
  answerWord: string
  answerJamo: string[]
  definition: string | null
  rows: Row[]
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
  onClose,
}: Props) {
  if (!open || status === 'playing') return null

  const won = status === 'won'
  const title = won ? '오늘의 단어 완성!' : '아쉽지만 내일 다시'
  const subtitle = won
    ? `${rows.length}/${MAX_ATTEMPTS}번 만에 맞췄어요`
    : `정답은 「${answerWord}」였어요`

  const share = async () => {
    const text = `오늘의 단어 ${won ? rows.length : 'X'}/${MAX_ATTEMPTS}\n\n${emojiGrid(rows)}`
    try {
      if (navigator.share) {
        await navigator.share({ text })
      } else {
        await navigator.clipboard.writeText(text)
        alert('결과가 복사되었어요!')
      }
    } catch {
      /* user cancelled */
    }
  }

  return (
    <div className="modal-backdrop" role="presentation" onClick={onClose}>
      <div
        className="modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="result-title"
        onClick={(e) => e.stopPropagation()}
      >
        <div
          className={`modal-mascot${won ? '' : ' modal-mascot-night'}`}
          aria-hidden
        />
        <h2 id="result-title">{title}</h2>
        <p className="modal-sub">{subtitle}</p>
        <div className="answer-chip">
          <span className="answer-word">{answerWord}</span>
          <span className="answer-jamo">{answerJamo.join(' · ')}</span>
          {definition && <p className="answer-def">{definition}</p>}
        </div>
        <div className="share-preview" aria-hidden>
          {emojiGrid(rows)}
        </div>
        <div className="modal-actions">
          <button type="button" className="btn-secondary" onClick={onClose}>
            닫기
          </button>
          <button type="button" className="btn-primary" onClick={share}>
            결과 공유
          </button>
        </div>
      </div>
    </div>
  )
}
