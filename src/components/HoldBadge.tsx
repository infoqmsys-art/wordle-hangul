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
  const disc = (
    <span className="hold-disc hold-disc-img" aria-hidden={!onClick}>
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

export function HoldPreview({
  level,
  onClose,
}: {
  level: number
  onClose: () => void
}) {
  const hold = getHold(level)
  return (
    <div
      className="modal-backdrop hold-preview-backdrop"
      role="presentation"
      onClick={onClose}
    >
      <div
        className="hold-preview-pop"
        role="dialog"
        aria-modal="true"
        aria-label={`Lv.${hold.level} ${hold.name}`}
        onClick={(e) => e.stopPropagation()}
      >
        <img
          src={holdImageSrc(level)}
          alt={`Lv.${hold.level} ${hold.name}`}
          draggable={false}
        />
        <p>
          Lv.{hold.level} {hold.name}
        </p>
        <button type="button" className="btn-secondary" onClick={onClose}>
          닫기
        </button>
      </div>
    </div>
  )
}

export function HoldTrail({
  currentLevel,
  onSelectReached,
}: {
  currentLevel: number
  onSelectReached?: (level: number) => void
}) {
  return (
    <div className="hold-trail" aria-label="홀드 레벨">
      {Array.from({ length: MAX_LEVEL }, (_, i) => {
        const level = i + 1
        const hold = getHold(level)
        const reached = level <= currentLevel
        const canOpen = reached && Boolean(onSelectReached)
        const className = `hold-trail-disc${reached ? ' is-reached' : ''}${
          level === currentLevel ? ' is-current' : ''
        }${canOpen ? ' is-openable' : ''}`

        const img = (
          <img
            src={holdImageSrc(level)}
            alt=""
            draggable={false}
            className={reached ? undefined : 'is-locked'}
          />
        )

        if (canOpen) {
          return (
            <button
              key={level}
              type="button"
              className={className}
              title={`Lv.${level} ${hold.name}`}
              aria-label={`Lv.${level} ${hold.name} 크게 보기`}
              onClick={() => onSelectReached?.(level)}
            >
              {img}
            </button>
          )
        }

        return (
          <span
            key={level}
            className={className}
            title={`Lv.${level} ${hold.name}`}
          >
            {img}
          </span>
        )
      })}
    </div>
  )
}
