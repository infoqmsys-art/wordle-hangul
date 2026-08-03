import { BOARD_THEMES, type BoardThemeId } from '../lib/themes'

type Props = {
  open: boolean
  themeId: BoardThemeId
  onSelect: (id: BoardThemeId) => void
  onClose: () => void
}

function MiniPreview({ themeId }: { themeId: BoardThemeId }) {
  return (
    <div className="theme-mini" data-theme-preview={themeId} aria-hidden>
      <span className="theme-mini-tile is-correct">ㄱ</span>
      <span className="theme-mini-tile is-present">ㅏ</span>
      <span className="theme-mini-tile is-absent">ㄴ</span>
    </div>
  )
}

export function ThemeModal({ open, themeId, onSelect, onClose }: Props) {
  if (!open) return null

  return (
    <div className="modal-backdrop" role="presentation" onClick={onClose}>
      <div
        className="modal history-modal theme-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="theme-title"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 id="theme-title">보드 테마</h2>
        <p className="modal-sub">
          지금은 전부 무료예요. 마음에 드는 분위기를 골라 보세요.
        </p>

        <ul className="theme-list">
          {BOARD_THEMES.map((theme) => {
            const on = theme.id === themeId
            return (
              <li key={theme.id}>
                <button
                  type="button"
                  className={`theme-item${on ? ' is-on' : ''}`}
                  onClick={() => onSelect(theme.id)}
                >
                  <MiniPreview themeId={theme.id} />
                  <span className="theme-item-text">
                    <strong>{theme.name}</strong>
                    <span>{theme.description}</span>
                  </span>
                  <span className="theme-item-state">{on ? '적용중' : '선택'}</span>
                </button>
              </li>
            )
          })}
        </ul>

        <button type="button" className="btn-primary full" onClick={onClose}>
          닫기
        </button>
      </div>
    </div>
  )
}
