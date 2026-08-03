import {
  BOARD_THEMES,
  canUseTheme,
  type BoardThemeId,
  type ThemeTrial,
} from '../lib/themes'

type Props = {
  open: boolean
  themeId: BoardThemeId
  equippedId: BoardThemeId
  ownedThemeIds: string[]
  tokens: number
  loggedIn: boolean
  busy?: boolean
  error?: string | null
  trial: ThemeTrial | null
  trialRemainingMs: number
  onPreview: (id: BoardThemeId | null) => void
  onEquip: (id: BoardThemeId) => void | Promise<void>
  onBuy: (id: BoardThemeId) => Promise<boolean>
  onTrial: (id: BoardThemeId) => void
  onClose: () => void
  onNeedLogin: () => void
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

function formatRemain(ms: number): string {
  const s = Math.ceil(ms / 1000)
  const m = Math.floor(s / 60)
  const r = s % 60
  return `${m}:${String(r).padStart(2, '0')}`
}

export function ThemeModal({
  open,
  themeId,
  equippedId,
  ownedThemeIds,
  tokens,
  loggedIn,
  busy,
  error,
  trial,
  trialRemainingMs,
  onPreview,
  onEquip,
  onBuy,
  onTrial,
  onClose,
  onNeedLogin,
}: Props) {
  if (!open) return null

  const close = () => {
    onPreview(null)
    onClose()
  }

  return (
    <div className="modal-backdrop" role="presentation" onClick={close}>
      <div
        className="modal history-modal theme-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="theme-title"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 id="theme-title">보드 테마</h2>
        <p className="modal-sub">
          눌러보면 미리보기가 적용돼요. 유료 테마는 15분 체험 후 구매할 수
          있어요.
        </p>
        <p className="theme-balance">
          초크가루 <strong>{tokens}</strong>
        </p>

        {trial && trialRemainingMs > 0 && (
          <p className="theme-trial-banner">
            체험 중 · 남은 시간 {formatRemain(trialRemainingMs)}
          </p>
        )}

        <ul className="theme-list">
          {BOARD_THEMES.map((theme) => {
            const owned =
              theme.tokenCost <= 0 || ownedThemeIds.includes(theme.id)
            const active = themeId === theme.id
            const equipped = equippedId === theme.id
            const inTrial =
              trial?.themeId === theme.id && (trial.expiresAt ?? 0) > Date.now()
            const usable = canUseTheme(theme.id, ownedThemeIds, trial)

            return (
              <li key={theme.id}>
                <div
                  className={`theme-card${active ? ' is-on' : ''}${
                    owned ? ' is-owned' : ''
                  }`}
                >
                  <button
                    type="button"
                    className="theme-card-main"
                    onClick={() => onPreview(theme.id)}
                  >
                    <MiniPreview themeId={theme.id} />
                    <span className="theme-item-text">
                      <strong>{theme.name}</strong>
                      <span>{theme.description}</span>
                      <span className="theme-price">
                        {theme.tokenCost <= 0
                          ? '무료'
                          : owned
                            ? '보유'
                            : inTrial
                              ? '체험 중'
                              : `${theme.tokenCost} 초크가루`}
                      </span>
                    </span>
                  </button>

                  <div className="theme-card-actions">
                    {usable ? (
                      <button
                        type="button"
                        className="pill-btn challenge"
                        disabled={busy || equipped}
                        onClick={() => void onEquip(theme.id)}
                      >
                        {equipped ? '장착중' : '장착'}
                      </button>
                    ) : (
                      <>
                        <button
                          type="button"
                          className="pill-btn"
                          disabled={busy}
                          onClick={() => onTrial(theme.id)}
                        >
                          15분 체험
                        </button>
                        <button
                          type="button"
                          className="pill-btn challenge"
                          disabled={
                            busy || (loggedIn && tokens < theme.tokenCost)
                          }
                          onClick={() => {
                            if (!loggedIn) {
                              onNeedLogin()
                              return
                            }
                            void onBuy(theme.id)
                          }}
                        >
                          {loggedIn
                            ? tokens < theme.tokenCost
                              ? '부족'
                              : '구매'
                            : '로그인 후 구매'}
                        </button>
                      </>
                    )}
                  </div>
                </div>
              </li>
            )
          })}
        </ul>

        {error && <p className="theme-feedback is-error">{error}</p>}

        <button type="button" className="btn-primary full" onClick={close}>
          닫기
        </button>
      </div>
    </div>
  )
}
