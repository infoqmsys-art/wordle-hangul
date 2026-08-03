import { useEffect, useState } from 'react'
import { unclaimedMail, type MailItem } from '../lib/mailbox'

type Props = {
  open: boolean
  onClose: () => void
  claimedMailIds: string[]
  busy?: boolean
  error?: string | null
  onClaim: (mailId: string) => Promise<boolean>
}

function rewardLabel(mail: MailItem): string {
  const parts: string[] = []
  if (mail.hints > 0) parts.push(`힌트 ${mail.hints}개`)
  if (mail.tokens > 0) parts.push(`초크가루 ${mail.tokens}`)
  return parts.length > 0 ? parts.join(' · ') : '보상'
}

export function MailboxModal({
  open,
  onClose,
  claimedMailIds,
  busy,
  error: externalError,
  onClaim,
}: Props) {
  const [msg, setMsg] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const pending = unclaimedMail(claimedMailIds)

  useEffect(() => {
    if (!open) return
    setMsg(null)
    setError(null)
  }, [open])

  if (!open) return null

  const claim = async (mail: MailItem) => {
    setError(null)
    setMsg(null)
    const ok = await onClaim(mail.id)
    if (ok) setMsg(`${mail.title} 수령 · ${rewardLabel(mail)}`)
  }

  return (
    <div className="modal-backdrop" role="presentation" onClick={onClose}>
      <div
        className="modal history-modal mailbox-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="mailbox-title"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 id="mailbox-title">우편함</h2>
        <p className="modal-sub">로그인 계정으로만 보상을 받을 수 있어요</p>

        {pending.length > 0 ? (
          <ul className="mail-list">
            {pending.map((mail) => (
              <li key={mail.id} className="mail-item is-new">
                <div>
                  <strong>{mail.title}</strong>
                  <p>{mail.body}</p>
                  <span className="mail-reward">{rewardLabel(mail)}</span>
                </div>
                <button
                  type="button"
                  className="pill-btn challenge"
                  disabled={busy}
                  onClick={() => void claim(mail)}
                >
                  {busy ? '받는 중...' : '받기'}
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mail-empty">받을 우편이 없어요</p>
        )}

        {(error || externalError || msg) && (
          <p className={error || externalError ? 'name-error' : 'shop-msg'}>
            {error || externalError || msg}
          </p>
        )}

        <button type="button" className="btn-secondary" onClick={onClose}>
          닫기
        </button>
      </div>
    </div>
  )
}
