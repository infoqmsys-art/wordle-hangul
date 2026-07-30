type Props = {
  nickname: string
  photoURL?: string | null
  streak?: number
  onClick?: () => void
}

export function AuthStatusBar({
  nickname,
  photoURL,
  streak = 0,
  onClick,
}: Props) {
  const initial = nickname.trim().slice(0, 1) || '?'

  if (onClick) {
    return (
      <button
        type="button"
        className="auth-status is-button"
        aria-label={`${nickname}님 로그인됨 · 내 정보`}
        onClick={onClick}
      >
        <AuthStatusInner
          nickname={nickname}
          photoURL={photoURL}
          streak={streak}
          initial={initial}
        />
      </button>
    )
  }

  return (
    <div
      className="auth-status"
      aria-label={`${nickname}님 로그인됨`}
    >
      <AuthStatusInner
        nickname={nickname}
        photoURL={photoURL}
        streak={streak}
        initial={initial}
      />
    </div>
  )
}

function AuthStatusInner({
  nickname,
  photoURL,
  streak,
  initial,
}: {
  nickname: string
  photoURL?: string | null
  streak: number
  initial: string
}) {
  return (
    <>
      <div className="auth-status-main">
        {photoURL ? (
          <img
            className="auth-status-avatar"
            src={photoURL}
            alt=""
            referrerPolicy="no-referrer"
          />
        ) : (
          <span className="auth-status-avatar is-fallback" aria-hidden>
            {initial}
          </span>
        )}
        <div className="auth-status-text">
          <strong>{nickname}</strong>
          <span>로그인됨 · 내 정보</span>
        </div>
      </div>
      {streak >= 2 && (
        <span className="auth-status-streak" aria-label={`${streak}연속 승리`}>
          <span className="streak-fire tiny" aria-hidden>
            🔥
          </span>
          {streak}
        </span>
      )}
    </>
  )
}
