import type { Row } from '../hooks/useGame'
import { MAX_ATTEMPTS, WORD_LENGTH } from '../hooks/useGame'
import type { TileStatus } from '../lib/game'

type Props = {
  rows: Row[]
  current: string[]
  shake: boolean
  revealingRow: number | null
}

function Tile({
  ch,
  status,
  flip,
  delay,
}: {
  ch: string
  status: TileStatus
  flip?: boolean
  delay?: number
}) {
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

export function Board({ rows, current, shake, revealingRow }: Props) {
  const display: {
    jamo: string[]
    statuses: TileStatus[]
    isCurrent: boolean
    flip: boolean
  }[] = []

  for (let i = 0; i < MAX_ATTEMPTS; i++) {
    if (i < rows.length) {
      display.push({
        jamo: rows[i].jamo,
        statuses: rows[i].statuses,
        isCurrent: false,
        flip: revealingRow === i,
      })
    } else if (i === rows.length) {
      const jamo = Array.from({ length: WORD_LENGTH }, (_, k) => current[k] ?? '')
      const statuses: TileStatus[] = jamo.map((ch) => (ch ? 'tbd' : 'empty'))
      display.push({ jamo, statuses, isCurrent: true, flip: false })
    } else {
      display.push({
        jamo: Array(WORD_LENGTH).fill(''),
        statuses: Array(WORD_LENGTH).fill('empty'),
        isCurrent: false,
        flip: false,
      })
    }
  }

  return (
    <div className="board" aria-label="추측 보드">
      {display.map((row, ri) => (
        <div
          key={ri}
          className={`board-row${row.isCurrent && shake ? ' shake' : ''}`}
        >
          {row.jamo.map((ch, ci) => (
            <Tile
              key={ci}
              ch={ch}
              status={row.statuses[ci]}
              flip={row.flip}
              delay={row.flip ? ci * 160 : undefined}
            />
          ))}
        </div>
      ))}
    </div>
  )
}
