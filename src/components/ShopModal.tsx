import { useEffect, useState } from 'react'
import {
  DAILY_FREE_HINTS,
  SHOP_ITEMS,
  type ShopItem,
} from '../lib/economy'
import { kstDateKey } from '../lib/levels'

type Props = {
  open: boolean
  onClose: () => void
  hints: number
  tokens: number
  lastDailyHintDate: string
  busy?: boolean
  error?: string | null
  onBuy: (itemId: string) => Promise<boolean>
  onRefresh?: () => Promise<void>
}

export function ShopModal({
  open,
  onClose,
  hints,
  tokens,
  lastDailyHintDate,
  busy,
  error: externalError,
  onBuy,
  onRefresh,
}: Props) {
  const [msg, setMsg] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!open) return
    setMsg(null)
    setError(null)
    void onRefresh?.()
  }, [open, onRefresh])

  if (!open) return null

  const todayClaimed = lastDailyHintDate === kstDateKey()

  const buy = async (item: ShopItem) => {
    setError(null)
    setMsg(null)
    const ok = await onBuy(item.id)
    if (ok) {
      setMsg(`${item.name} 구매 완료`)
    }
  }

  return (
    <div className="modal-backdrop" role="presentation" onClick={onClose}>
      <div
        className="modal history-modal shop-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="shop-title"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 id="shop-title">상점</h2>
        <p className="modal-sub">
          초크가루로 힌트를 사고, 힌트는 계정에 쌓여요
        </p>

        <div className="shop-balance">
          <div>
            <span>보유힌트</span>
            <strong>{hints}</strong>
          </div>
          <div>
            <span>초크가루</span>
            <strong>{tokens}</strong>
          </div>
        </div>

        <div className="shop-daily">
          <div>
            <strong>오늘 무료 힌트</strong>
            <p>매일 {DAILY_FREE_HINTS}개 · 안 쓰면 쌓여요</p>
          </div>
          <span className={`shop-daily-badge${todayClaimed ? ' is-on' : ''}`}>
            {todayClaimed ? '수령함' : '받는 중…'}
          </span>
        </div>

        <ul className="shop-list">
          {SHOP_ITEMS.map((item) => {
            const canBuy = tokens >= item.tokenCost
            return (
              <li key={item.id} className="shop-item">
                <div>
                  <strong>{item.name}</strong>
                  <p>{item.description}</p>
                  <span className="shop-price">{item.tokenCost} 초크가루</span>
                </div>
                <button
                  type="button"
                  className="pill-btn challenge"
                  disabled={busy || !canBuy}
                  onClick={() => void buy(item)}
                >
                  {canBuy ? '구매' : '부족'}
                </button>
              </li>
            )
          })}
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

        <button type="button" className="btn-primary full" onClick={onClose}>
          닫기
        </button>
      </div>
    </div>
  )
}
