import {
  BOARD_THEMES,
  THEME_TRIAL_GAMES,
  getActiveTrial,
  getBoardTheme,
  isThemeTrialUsed,
  type ActiveThemeTrial,
  type BoardThemeId,
  type ThemeTrialStore,
} from '../lib/themes'

export type ThemeShopPanelProps = {
  themeId: BoardThemeId
  equippedId: BoardThemeId
  ownedThemeIds: string[]
  tokens: number
  loggedIn: boolean
  busy?: boolean
  error?: string | null
  trialStore: ThemeTrialStore
  trial: ActiveThemeTrial | null
  trialLocked: boolean
  gamesLeftFor: (id: BoardThemeId) => number
  canTrial: (id: BoardThemeId) => boolean
  onPreview: (id: BoardThemeId | null) => void
  onEquip: (id: BoardThemeId) => void | Promise<void>
  onBuy: (id: BoardThemeId) => Promise<boolean>
  onTrial: (id: BoardThemeId) => void
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

export function ThemeShopPanel({
  themeId,
  equippedId,
  ownedThemeIds,
  tokens,
  loggedIn,
  busy,
  error,
  trialStore,
  trial,
  trialLocked,
  gamesLeftFor,
  canTrial,
  onPreview,
  onEquip,
  onBuy,
  onTrial,
  onNeedLogin,
}: ThemeShopPanelProps) {
  void tokens
  void onPreview
  void gamesLeftFor
  const active = trial ?? getActiveTrial(trialStore)
  const trialName = active
    ? (getBoardTheme(active.themeId)?.name ?? active.themeId)
    : ''

  return (
    <div className="theme-shop-panel">
      {active ? (
        <p className="theme-trial-banner">
          {trialName} 체험 · 남은 {active.gamesLeft}판
        </p>
      ) : (
        <p className="theme-shop-hint">
          테마마다 {THEME_TRIAL_GAMES}판 체험 → 끝나면 원래 테마로 복귀
        </p>
      )}

      {error && <p className="theme-feedback is-error">{error}</p>}

      <ul className="theme-list">
        {BOARD_THEMES.map((theme) => {
          const owned =
            theme.tokenCost <= 0 || ownedThemeIds.includes(theme.id)
          const activeTheme = themeId === theme.id
          const equipped = equippedId === theme.id
          const isThisTrial = Boolean(active && active.themeId === theme.id)
          const usedUp = !owned && isThemeTrialUsed(trialStore, theme.id)
          const trialAvailable = canTrial(theme.id)

          return (
            <li key={theme.id}>
              <div
                className={`theme-card${activeTheme ? ' is-on' : ''}${
                  owned ? ' is-owned' : ''
                }`}
              >
                <div className="theme-card-main">
                  <MiniPreview themeId={theme.id} />
                  <span className="theme-item-text">
                    <strong>{theme.name}</strong>
                    <span className="theme-price">
                      {theme.tokenCost <= 0
                        ? '무료'
                        : owned
                          ? '보유'
                          : isThisTrial
                            ? `체험 ${active!.gamesLeft}/3`
                            : usedUp
                              ? '체험 완료'
                              : `가격 : ${theme.tokenCost}`}
                    </span>
                  </span>
                </div>

                <div className="theme-card-actions">
                  {owned || theme.tokenCost <= 0 ? (
                    <button
                      type="button"
                      className="pill-btn challenge"
                      disabled={busy || equipped || trialLocked}
                      onClick={() => void onEquip(theme.id)}
                    >
                      {trialLocked
                        ? '체험 중'
                        : equipped
                          ? '장착중'
                          : '장착'}
                    </button>
                  ) : isThisTrial ? (
                    <button
                      type="button"
                      className="pill-btn challenge"
                      disabled={busy}
                      onClick={() => {
                        if (!loggedIn) {
                          onNeedLogin()
                          return
                        }
                        void onBuy(theme.id)
                      }}
                    >
                      {loggedIn ? '구매' : '로그인 후 구매'}
                    </button>
                  ) : (
                    <>
                      {trialAvailable && (
                        <button
                          type="button"
                          className="pill-btn"
                          disabled={busy || trialLocked}
                          onClick={() => onTrial(theme.id)}
                        >
                          {THEME_TRIAL_GAMES}판 체험
                        </button>
                      )}
                      <button
                        type="button"
                        className="pill-btn challenge"
                        disabled={busy || (trialLocked && !isThisTrial)}
                        onClick={() => {
                          if (!loggedIn) {
                            onNeedLogin()
                            return
                          }
                          void onBuy(theme.id)
                        }}
                      >
                        {loggedIn ? '구매' : '로그인 후 구매'}
                      </button>
                    </>
                  )}
                </div>
              </div>
            </li>
          )
        })}
      </ul>
    </div>
  )
}
