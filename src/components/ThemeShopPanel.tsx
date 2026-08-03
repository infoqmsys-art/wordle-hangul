import {
  BOARD_THEMES,
  THEME_TRIAL_GAMES,
  canUseTheme,
  type BoardThemeId,
  type ThemeTrial,
} from '../lib/themes'

export type ThemeShopPanelProps = {
  themeId: BoardThemeId
  equippedId: BoardThemeId
  ownedThemeIds: string[]
  tokens: number
  loggedIn: boolean
  busy?: boolean
  error?: string | null
  trial: ThemeTrial | null
  trialGamesLeft: number
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

/** 상점 테마 탭용 패널 (모달 껍데기 없음) */
export function ThemeShopPanel({
  themeId,
  equippedId,
  ownedThemeIds,
  tokens,
  loggedIn,
  busy,
  error,
  trial,
  trialGamesLeft,
  onPreview,
  onEquip,
  onBuy,
  onTrial,
  onNeedLogin,
}: ThemeShopPanelProps) {
  void tokens
  return (
    <div className="theme-shop-panel">
      <p className="modal-sub theme-shop-sub">
        눌러보면 미리보기가 적용돼요. 유료 테마는 {THEME_TRIAL_GAMES}판 체험 후
        구매할 수 있어요.
      </p>

      {trial && trialGamesLeft > 0 && (
        <p className="theme-trial-banner">
          체험 중 · 남은 {trialGamesLeft}판
        </p>
      )}

      {error && <p className="theme-feedback is-error">{error}</p>}

      <ul className="theme-list">
        {BOARD_THEMES.map((theme) => {
          const owned =
            theme.tokenCost <= 0 || ownedThemeIds.includes(theme.id)
          const active = themeId === theme.id
          const equipped = equippedId === theme.id
          const inTrial =
            trial?.themeId === theme.id && (trial.gamesLeft ?? 0) > 0
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
                            ? `체험 ${trialGamesLeft}판`
                            : `가격 : ${theme.tokenCost} 초크가루`}
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
                        {THEME_TRIAL_GAMES}판 체험
                      </button>
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
