import type { CSSProperties } from 'react'
import { MAX_LEVEL, getHold, holdImageSrc } from '../lib/levels'

type Props = {
  level: number
  size?: 'sm' | 'md' | 'lg'
  showLabel?: boolean
  className?: string
  onClick?: () => void
}

export function HoldBadge({
  level,
  size = 'md',
  showLabel = false,
  className = '',
  onClick,
}: Props) {
  const hold = getHold(level)
  const src = holdImageSrc(level)
  const tinted = hold.level > 11
  const disc = (
    <span
      className={`hold-disc hold-disc-img${tinted ? ' is-tinted' : ''}`}
      style={
        tinted
          ? ({ '--hold-tint': hold.color } as CSSProperties)
          : undefined
      }
      aria-hidden={!onClick}
    >
      <img src={src} alt="" draggable={false} />
    </span>
  )

  return (
    <span className={`hold-badge hold-${size} ${className}`.trim()}>
      {onClick ? (
        <button
          type="button"
          className="hold-badge-btn"
          onClick={onClick}
          aria-label={`Lv.${hold.level} ${hold.name} 크게 보기`}
        >
          {disc}
        </button>
      ) : (
        disc
      )}
      {showLabel && (
        <span className="hold-label">
          Lv.{hold.level} {hold.name}
        </span>
      )}
    </span>
  )
}

export function HoldTrail({ currentLevel }: { currentLevel: number }) {
  return (
    <div className="hold-trail" aria-label="홀드 레벨">
      {Array.from({ length: MAX_LEVEL }, (_, i) => {
        const level = i + 1
        const hold = getHold(level)
        const reached = level <= currentLevel
        const tinted = hold.level > 11
        return (
          <span
            key={level}
            className={`hold-trail-disc${reached ? ' is-reached' : ''}${
              level === currentLevel ? ' is-current' : ''
            }${tinted ? ' is-tinted' : ''}`}
            style={
              tinted
                ? ({ '--hold-tint': hold.color } as CSSProperties)
                : undefined
            }
            title={`Lv.${level} ${hold.name}`}
          >
            <img
              src={holdImageSrc(level)}
              alt=""
              draggable={false}
              className={reached ? undefined : 'is-locked'}
            />
          </span>
        )
      })}
    </div>
  )
}
