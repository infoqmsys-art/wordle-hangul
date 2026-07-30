import { useEffect, useRef, useState } from 'react'
import type { UserProfile } from '../lib/auth'
import {
  inAppLoginHint,
  isInAppBrowser,
  isKakaoTalkBrowser,
  openInExternalBrowser,
} from '../lib/browser'
import {
  avgWinAttempts,
  getPersonalStats,
  winRate,
  type PersonalStats,
} from '../lib/stats'
import { formatSeconds } from '../lib/history'

type Props = {
  open: boolean
  profile: UserProfile | null
  authEnabled: boolean
  busy?: boolean
  error?: string | null
  inAppHint?: string
  onClose: () => void
  onSignIn: () => void
  onSignOut: () => void
  onUpdateNickname: (nickname: string) => Promise<boolean>
}

export function ProfileModal({
  open,
  profile,
  authEnabled,
  busy,
  error,
  inAppHint,
  onClose,
  onSignIn,
  onSignOut,
  onUpdateNickname,
}: Props) {
  const [editing, setEditing] = useState(false)
  const [name, setName] = useState(profile?.nickname ?? '')
  const [localError, setLocalError] = useState<string | null>(null)
  const [stats, setStats] = useState<PersonalStats>(() => getPersonalStats())
  const ignoreCloseUntil = useRef(0)
  const backdropPress = useRef(false)
  const hint =
    inAppHint ||
    (typeof navigator !== 'undefined' && isInAppBrowser()
      ? inAppLoginHint()
      : '')
  const inKakao = typeof navigator !== 'undefined' && isKakaoTalkBrowser()

  useEffect(() => {
    if (!open) {
      backdropPress.current = false
      return
    }
    setEditing(false)
    setName(profile?.nickname ?? '')
    setLocalError(null)
    setStats(profile ?? getPersonalStats())
    // 로그인 버튼을 누른 같은 제스처가 배경 닫기로 이어지지 않게
    ignoreCloseUntil.current = Date.now() + 500
  }, [open, profile])

  if (!open) return null

  const avgAttempts = avgWinAttempts(stats)
  const initial = (profile?.nickname ?? '?').trim().slice(0, 1) || '?'

  const tryCloseFromBackdrop = () => {
    if (Date.now() < ignoreCloseUntil.current) return
    onClose()
  }

  const saveName = async () => {
    const trimmed = name.trim()
    if (!trimmed) {
      setLocalError('닉네임을 입력해 주세요')
      return
    }
    if (trimmed === profile?.nickname) {
      setEditing(false)
      return
    }
    const ok = await onUpdateNickname(trimmed)
    if (ok) setEditing(false)
  }

  return (
    <div
      className="modal-backdrop profile-backdrop"
      role="presentation"
      onPointerDown={(e) => {
        backdropPress.current = e.target === e.currentTarget
      }}
      onPointerUp={(e) => {
        const startedOnBackdrop = backdropPress.current
        backdropPress.current = false
        if (startedOnBackdrop && e.target === e.currentTarget) {
          tryCloseFromBackdrop()
        }
      }}
      onClick={(e) => {
        // click만으로 닫지 않음 (열기 직후 잔여 click 방지)
        e.stopPropagation()
      }}
    >      <div
        className="profile-panel"
        role="dialog"
        aria-modal="true"
        aria-labelledby="profile-title"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="profile-top">
          <h2 id="profile-title">내 정보</h2>
          <button
            type="button"
            className="profile-close"
            onClick={onClose}
            aria-label="닫기"
          >
            ✕
          </button>
        </div>

        {profile ? (
          <>
            <div className="profile-hero">
              {profile.photoURL ? (
                <img
                  className="profile-avatar"
                  src={profile.photoURL}
                  alt=""
                  referrerPolicy="no-referrer"
                />
              ) : (
                <span className="profile-avatar is-fallback" aria-hidden>
                  {initial}
                </span>
              )}
              <div className="profile-hero-text">
                <p className="profile-label">로그인 계정</p>
                {editing ? (
                  <div className="profile-edit">
                    <input
                      type="text"
                      maxLength={20}
                      value={name}
                      autoFocus
                      disabled={busy}
                      onChange={(e) => {
                        setName(e.target.value)
                        setLocalError(null)
                      }}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault()
                          void saveName()
                        }
                      }}
                    />
                    <div className="profile-edit-actions">
                      <button
                        type="button"
                        className="pill-btn"
                        onClick={() => {
                          setEditing(false)
                          setName(profile.nickname)
                          setLocalError(null)
                        }}
                        disabled={busy}
                      >
                        취소
                      </button>
                      <button
                        type="button"
                        className="pill-btn challenge"
                        onClick={() => void saveName()}
                        disabled={busy}
                      >
                        {busy ? '저장 중...' : '저장'}
                      </button>
                    </div>
                  </div>
                ) : (
                  <>
                    <strong className="profile-name">{profile.nickname}</strong>
                    <button
                      type="button"
                      className="profile-rename"
                      onClick={() => setEditing(true)}
                    >
                      이름 바꾸기
                    </button>
                    <p className="profile-rename-note">
                      이미 쓰인 닉네임은 안 되고, 바꿔도 통계·랭킹 기록은 그대로
                      따라가요.
                    </p>
                  </>
                )}
                {(localError || error) && (
                  <p className="name-error">{localError || error}</p>
                )}
                {profile.email && (
                  <p className="profile-email">{profile.email}</p>
                )}
              </div>
            </div>

            <div className="profile-stats" aria-label="내 통계">
              <div>
                <strong>{winRate(stats)}%</strong>
                <span>승률</span>
              </div>
              <div>
                <strong>{stats.currentStreak}</strong>
                <span>연속 승리</span>
              </div>
              <div>
                <strong>{stats.maxStreak}</strong>
                <span>최고 연속</span>
              </div>
              <div>
                <strong>{stats.played}</strong>
                <span>플레이</span>
              </div>
              <div>
                <strong>{avgAttempts != null ? avgAttempts : '—'}</strong>
                <span>평균 시도</span>
              </div>
              <div>
                <strong>
                  {stats.wins > 0
                    ? formatSeconds(stats.winSeconds / stats.wins)
                    : '—'}
                </strong>
                <span>평균 시간</span>
              </div>
            </div>

            <button
              type="button"
              className="cta cta-secondary profile-logout"
              onClick={onSignOut}
              disabled={busy}
            >
              로그아웃
            </button>
          </>
        ) : (
          <div className="profile-guest">
            <p className="profile-guest-lead">
              Google로 로그인하면 닉네임을 정하고, 기록을 다른 기기에서도 이어갈
              수 있어요.
            </p>
            <ul className="nick-setup-guide">
              <li>
                <strong>첫 연동</strong>
                <span>
                  정한 닉네임이 계정 시작 데이터예요. 이 기기 연속 승리도
                  이어붙여요.
                </span>
              </li>
              <li>
                <strong>중복 불가</strong>
                <span>이미 있는 닉네임은 쓸 수 없어요.</span>
              </li>
              <li>
                <strong>이름 변경</strong>
                <span>바꿔도 통계와 랭킹 기록은 uid 기준으로 따라가요.</span>
              </li>
            </ul>
            <div className="profile-stats" aria-label="이 브라우저 통계">
              <div>
                <strong>{winRate(stats)}%</strong>
                <span>승률</span>
              </div>
              <div>
                <strong>{stats.currentStreak}</strong>
                <span>연속 승리</span>
              </div>
              <div>
                <strong>{stats.maxStreak}</strong>
                <span>최고 연속</span>
              </div>
              <div>
                <strong>{stats.played}</strong>
                <span>플레이</span>
              </div>
            </div>
            <p className="profile-guest-note">위 숫자는 이 브라우저 기준이에요</p>
            {hint && <p className="profile-inapp-hint">{hint}</p>}
            {authEnabled ? (
              <button
                type="button"
                className="cta"
                onClick={() => {
                  if (inKakao) {
                    openInExternalBrowser()
                    return
                  }
                  onSignIn()
                }}
                disabled={busy}
              >
                {busy
                  ? '연결 중...'
                  : inKakao
                    ? '브라우저에서 로그인'
                    : 'Google 로그인'}
              </button>
            ) : (
              <p className="profile-guest-note">로그인을 아직 설정하지 않았어요</p>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
