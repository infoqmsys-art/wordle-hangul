import { useEffect, useRef, useState } from 'react'
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
  onClearError?: () => void
  theme: ThemeShopPanelProps
}

export function ShopModal({
  open,
  onClose,
  initialTab = 'hints',
  hints: _hints,
  tokens,
  lastDailyHintDate,
  loggedIn,
  busy,
  error: externalError,
  onBuyHint,
  onRefresh,
  onNeedLogin,
  onClearError,
  theme,
}: Props) {
  void _hints
  const [tab, setTab] = useState<ShopTab>(initialTab)
  const [msg, setMsg] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const wasOpen = useRef(false)

  useEffect(() => {
    if (open && !wasOpen.current) {
      setTab(initialTab)
      setMsg(null)
      setError(null)
      onClearError?.()
      if (loggedIn) void onRefresh?.()
    }
    wasOpen.current = open
  }, [open, initialTab, loggedIn, onRefresh, onClearError])

  if (!open) return null

  const close = () => {
    theme.onPreview(null)
    onClearError?.()
    onClose()
  }

  const switchTab = (next: ShopTab) => {
    setTab(next)
    setMsg(null)
    setError(null)
    onClearError?.()
  }

  const todayClaimed = lastDailyHintDate === kstDateKey()

  const buy = async (item: ShopItem) => {
    if (!loggedIn) {
      onNeedLogin()
      return
    }
    setError(null)
    setMsg(null)
    onClearError?.()
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
        <div className="shop-header">
          <h2 id="shop-title">상점</h2>
          <p className="shop-chalk-chip" aria-label="보유 초크가루">
            초크가루 <strong>{loggedIn ? tokens : '—'}</strong>
          </p>
        </div>

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
            onClick={() => switchTab('hints')}
          >
            힌트
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={tab === 'themes'}
            className={tab === 'themes' ? 'on' : ''}
            onClick={() => switchTab('themes')}
          >
            초크백 테마
          </button>
        </div>

        {tab === 'hints' ? (
          <div className="shop-pane">
            {!loggedIn ? (
              <div className="shop-login-gate">
                <p>로그인 후 힌트를 살 수 있어요.</p>
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
                    <p>매일 {DAILY_FREE_HINTS}개</p>
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
              </>
            )}
          </div>
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
