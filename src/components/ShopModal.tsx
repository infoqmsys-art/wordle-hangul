import { useEffect, useState } from 'react'
import {
  DAILY_FREE_HINTS,
  SHOP_ITEMS,
  type ShopItem,
} from '../lib/economy'
import { kstDateKey } from '../lib/levels'
import {
  ThemeShopPanel,
  type ThemeShopPanelProps,
} from './ThemeShopPanel'

export type ShopTab = 'hints' | 'themes'

type Props = {
  open: boolean
  onClose: () => void
  initialTab?: ShopTab
  hints: number
  tokens: number
  lastDailyHintDate: string
  loggedIn: boolean
  busy?: boolean
  error?: string | null
  onBuyHint: (itemId: string) => Promise<boolean>
  onRefresh?: () => Promise<void>
  onNeedLogin: () => void
  theme: ThemeShopPanelProps
}

export function ShopModal({
  open,
  onClose,
  initialTab = 'hints',
  hints,
  tokens,
  lastDailyHintDate,
  loggedIn,
  busy,
  error: externalError,
  onBuyHint,
  onRefresh,
  onNeedLogin,
  theme,
}: Props) {
  const [tab, setTab] = useState<ShopTab>(initialTab)
  const [msg, setMsg] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!open) return
    setTab(initialTab)
    setMsg(null)
    setError(null)
    if (loggedIn) void onRefresh?.()
  }, [open, initialTab, loggedIn, onRefresh])

  if (!open) return null

  const close = () => {
    theme.onPreview(null)
    onClose()
  }

  const todayClaimed = lastDailyHintDate === kstDateKey()

  const buy = async (item: ShopItem) => {
    if (!loggedIn) {
      onNeedLogin()
      return
    }
    setError(null)
    setMsg(null)
    const ok = await onBuyHint(item.id)
    if (ok) {
      setMsg(`${item.name} 구매 완료`)
    }
  }

  return (
    <div className="modal-backdrop" role="presentation" onClick={close}>
      <div
        className="modal history-modal shop-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="shop-title"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 id="shop-title">상점</h2>

        <div
          className="rank-mode-tabs shop-tabs"
          role="tablist"
          aria-label="상점 분류"
        >
          <button
            type="button"
            role="tab"
            aria-selected={tab === 'hints'}
            className={tab === 'hints' ? 'on' : ''}
            onClick={() => setTab('hints')}
          >
            힌트
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={tab === 'themes'}
            className={tab === 'themes' ? 'on' : ''}
            onClick={() => setTab('themes')}
          >
            초크백 테마
          </button>
        </div>

        <div className="shop-balance">
          <div>
            <span>보유힌트</span>
            <strong>{loggedIn ? hints : '—'}</strong>
          </div>
          <div>
            <span>초크가루</span>
            <strong>{loggedIn ? tokens : '—'}</strong>
          </div>
        </div>

        {tab === 'hints' ? (
          <>
            <p className="modal-sub">
              초크가루로 힌트를 사고, 힌트는 계정에 쌓여요
            </p>

            {!loggedIn ? (
              <div className="shop-login-gate">
                <p>힌트 상점은 로그인 후 이용할 수 있어요.</p>
                <button
                  type="button"
                  className="pill-btn challenge"
                  onClick={onNeedLogin}
                >
                  로그인
                </button>
              </div>
            ) : (
              <>
                <div className="shop-daily">
                  <div>
                    <strong>오늘 무료 힌트</strong>
                    <p>매일 {DAILY_FREE_HINTS}개 · 안 쓰면 쌓여요</p>
                  </div>
                  <span
                    className={`shop-daily-badge${todayClaimed ? ' is-on' : ''}`}
                  >
                    {todayClaimed ? '수령함' : '받는 중…'}
                  </span>
                </div>

                <ul className="shop-list">
                  {SHOP_ITEMS.map((item) => (
                    <li key={item.id} className="shop-item">
                      <div>
                        <strong>{item.name}</strong>
                        <p>{item.description}</p>
                        <span className="shop-price">
                          가격 : {item.tokenCost} 초크가루
                        </span>
                      </div>
                      <button
                        type="button"
                        className="pill-btn challenge"
                        disabled={busy}
                        onClick={() => void buy(item)}
                      >
                        구매
                      </button>
                    </li>
                  ))}
                </ul>

                {(msg || error || externalError) && (
                  <p
                    className={`shop-feedback${
                      error || externalError ? ' is-error' : ''
                    }`}
                  >
                    {error || externalError || msg}
                  </p>
                )}

                <p className="shop-earn-note">
                  초크가루: 승리 시 메인게임 +3 / 오늘의 단어 +8 · 실패해도 +1
                </p>
              </>
            )}
          </>
        ) : (
          <ThemeShopPanel {...theme} tokens={tokens} loggedIn={loggedIn} />
        )}

        <button type="button" className="btn-primary full" onClick={close}>
          닫기
        </button>
      </div>
    </div>
  )
}
