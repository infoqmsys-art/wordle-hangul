import type { Row } from '../hooks/useGame'
import { MAX_ATTEMPTS } from '../hooks/useGame'
import type { TileStatus } from '../lib/game'

type Props = {
  rows: Row[]
  current: string[]
  shake: boolean
  revealingRow: number | null
  wordLength: number
  bounce?: boolean
  hintGrid?: (string | null)[][]
  /** 힌트 칸 고르기 모드 */
  pickMode?: boolean
  canHintAt?: (row: number, col: number) => boolean
  onPickCell?: (row: number, col: number) => void
}

function Tile({
  ch,
  status,
  flip,
  delay,
  pickable,
  onClick,
}: {
  ch: string
  status: TileStatus
  flip?: boolean
  delay?: number
  pickable?: boolean
  onClick?: () => void
}) {
  if (pickable) {
    return (
      <button
        type="button"
        className={['tile', `tile-${status}`, 'tile-pickable']
          .filter(Boolean)
          .join(' ')}
        style={
          delay !== undefined ? { animationDelay: `${delay}ms` } : undefined
        }
        onClick={onClick}
      >
        <span>{ch}</span>
      </button>
    )
  }

  return (
    <div
      className={['tile', `tile-${status}`, flip ? 'tile-flip' : '']
        .filter(Boolean)
        .join(' ')}
      style={delay !== undefined ? { animationDelay: `${delay}ms` } : undefined}
    >
      <span>{ch}</span>
    </div>
  )
}

export function Board({
  rows,
  current,
  shake,
  revealingRow,
  wordLength,
  bounce = false,
  hintGrid = [],
  pickMode = false,
  canHintAt,
  onPickCell,
}: Props) {
  const display: {
    jamo: string[]
    statuses: TileStatus[]
    isCurrent: boolean
    flip: boolean
  }[] = []

  for (let i = 0; i < MAX_ATTEMPTS; i++) {
    if (i < rows.length) {
      const jamo = [...rows[i].jamo]
      const statuses = [...rows[i].statuses] as TileStatus[]
      for (let c = 0; c < wordLength; c++) {
        const hint = hintGrid[i]?.[c]
        if (hint && statuses[c] !== 'correct') {
          jamo[c] = hint
          statuses[c] = 'hint'
        }
      }
      display.push({
        jamo,
        statuses,
        isCurrent: false,
        flip: revealingRow === i,
      })
    } else if (i === rows.length) {
      // current에 힌트 칸이 이미 고정되어 있음. 표시만 힌트 스타일.
      const jamo = Array.from({ length: wordLength }, (_, k) => {
        const hint = hintGrid[i]?.[k]
        if (hint) return hint
        return current[k] ?? ''
      })
      const statuses: TileStatus[] = Array.from({ length: wordLength }, (_, k) => {
        if (hintGrid[i]?.[k]) return 'hint'
        return current[k] ? 'tbd' : 'empty'
      })
      display.push({ jamo, statuses, isCurrent: true, flip: false })
    } else {
      const jamo = Array.from(
        { length: wordLength },
        (_, k) => hintGrid[i]?.[k] ?? '',
      )
      const statuses: TileStatus[] = Array.from({ length: wordLength }, (_, k) =>
        hintGrid[i]?.[k] ? 'hint' : 'empty',
      )
      display.push({
        jamo,
        statuses,
        isCurrent: false,
        flip: false,
      })
    }
  }

  return (
    <div className={`board-wrap${pickMode ? ' is-picking' : ''}`}>
      {pickMode && (
        <p className="hint-pick-guide">이번 줄에서 칸을 고르세요</p>
      )}
      <div
        className={[
          'board',
          `board-cols-${wordLength}`,
          bounce ? 'board-bounce' : '',
          pickMode ? 'board-picking' : '',
        ]
          .filter(Boolean)
          .join(' ')}
        aria-label="추측 보드"
      >
        {display.map((row, ri) => (
          <div
            key={ri}
            className={[
              'board-row',
              row.isCurrent && shake ? 'shake' : '',
              pickMode && row.isCurrent ? 'is-hint-row' : '',
              pickMode && !row.isCurrent ? 'is-hint-dim' : '',
            ]
              .filter(Boolean)
              .join(' ')}
            style={{ gridTemplateColumns: `repeat(${wordLength}, 1fr)` }}
          >
            {row.jamo.map((ch, ci) => {
              const pickable =
                pickMode && Boolean(canHintAt?.(ri, ci)) && Boolean(onPickCell)
              return (
                <Tile
                  key={ci}
                  ch={ch}
                  status={row.statuses[ci]}
                  flip={row.flip}
                  delay={row.flip ? ci * 140 : undefined}
                  pickable={pickable}
                  onClick={() => onPickCell?.(ri, ci)}
                />
              )
            })}
          </div>
        ))}
      </div>
    </div>
  )
}
