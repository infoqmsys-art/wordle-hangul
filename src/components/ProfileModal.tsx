import { useEffect, useRef, useState, type CSSProperties } from 'react'
import type { UserProfile } from '../lib/auth'
import { formatSeconds, getLastName } from '../lib/history'
import {
  getHold,
  holdXpBarColor,
  isRewardClaimable,
  isRewardExpired,
  progressFromXp,
} from '../lib/levels'
import {
  avgWinAttempts,
  getPersonalStats,
  winRate,
  type PersonalStats,
} from '../lib/stats'
import { HoldBadge, HoldTrail } from './HoldBadge'

type AuthMode = 'login' | 'signup'

type Props = {
  open: boolean
  profile: UserProfile | null
  authEnabled: boolean
  busy?: boolean
  error?: string | null
  onClose: () => void
  onSignIn: (nickname: string, password: string) => Promise<UserProfile | null>
  onSignUp: (nickname: string, password: string) => Promise<UserProfile | null>
  onSignOut: () => void
  onUpdateNickname: (nickname: string) => Promise<boolean>
  onClaimReward?: () => Promise<{ gained: number } | null>
}

export function ProfileModal({
  open,
  profile,
  authEnabled,
  busy,
  error,
  onClose,
  onSignIn,
  onSignUp,
  onSignOut,
  onUpdateNickname,
  onClaimReward,
}: Props) {
  const [editing, setEditing] = useState(false)
  const [name, setName] = useState(profile?.nickname ?? '')
  const [localError, setLocalError] = useState<string | null>(null)
  const [stats, setStats] = useState<PersonalStats>(() => getPersonalStats())
  const [authMode, setAuthMode] = useState<AuthMode>('login')
  const [nickname, setNickname] = useState('')
  const [password, setPassword] = useState('')
  const [claimMsg, setClaimMsg] = useState<string | null>(null)
  const ignoreCloseUntil = useRef(0)
  const backdropPress = useRef(false)

  useEffect(() => {
    if (!open) {
      backdropPress.current = false
      return
    }
    setEditing(false)
    setName(profile?.nickname ?? '')
    setLocalError(null)
    setStats(profile ?? getPersonalStats())
    setAuthMode('login')
    setNickname(getLastName().trim())
    setPassword('')
    setClaimMsg(null)
    ignoreCloseUntil.current = Date.now() + 800
  }, [open, profile])

  if (!open) return null

  const avgAttempts = avgWinAttempts(stats)
  const levelView = profile ? progressFromXp(profile.xp) : null
  const pending = profile?.pendingWeekReward ?? null
  const canClaim = isRewardClaimable(pending)
  const rewardExpired = isRewardExpired(pending)

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

  const submitAuth = async () => {
    setLocalError(null)
    const nick = nickname.trim()
    if (!nick) {
      setLocalError('닉네임을 입력해 주세요')
      return
    }
    if (password.length < 6) {
      setLocalError('비밀번호는 6자만 되면 돼요 (아무 글자나 OK)')
      return
    }
    const profileNext =
      authMode === 'signup'
        ? await onSignUp(nick, password)
        : await onSignIn(nick, password)
    if (profileNext) {
      setPassword('')
      onClose()
    }
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
        e.stopPropagation()
      }}
    >
      <div
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
              <HoldBadge level={profile.level} size="lg" />
              <div className="profile-hero-text">
                <p className="profile-label">내 닉네임</p>
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
                  </>
                )}
                {(localError || error) && (
                  <p className="name-error">{localError || error}</p>
                )}
              </div>
            </div>

            {levelView && (
              <div className="profile-level" aria-label="레벨">
                <div className="profile-level-head">
                  <strong>
                    Lv.{levelView.level} {levelView.hold.name}
                  </strong>
                  <span>
                    {levelView.xpForNext == null
                      ? `${levelView.totalXp.toLocaleString('ko-KR')} XP`
                      : `${levelView.xpIntoLevel} / ${levelView.xpForNext} XP`}
                  </span>
                </div>
                <div
                  className="xp-bar"
                  style={
                    {
                      '--xp-color': holdXpBarColor(levelView.level),
                    } as CSSProperties
                  }
                >
                  <div
                    className="xp-bar-fill"
                    style={{
                      width: `${
                        levelView.xpForNext == null
                          ? 100
                          : Math.min(
                              100,
                              (levelView.xpIntoLevel / levelView.xpForNext) *
                                100,
                            )
                      }%`,
                    }}
                  />
                </div>
                <p className="profile-level-next">
                  {levelView.xpForNext == null
                    ? '최고 홀드 · XP는 계속 쌓여요'
                    : `다음: Lv.${levelView.level + 1} ${getHold(levelView.level + 1).name}`}
                </p>
                <HoldTrail currentLevel={levelView.level} />
              </div>
            )}

            {pending && (
              <div
                className={`week-reward-card${canClaim ? ' is-ready' : ''}${
                  pending.claimed ? ' is-claimed' : ''
                }${rewardExpired ? ' is-expired' : ''}`}
              >
                <div>
                  <strong>지난주 {pending.rank}위</strong>
                  <span>+{pending.xp} XP</span>
                </div>
                {canClaim && onClaimReward ? (
                  <button
                    type="button"
                    className="pill-btn challenge"
                    disabled={busy}
                    onClick={() => {
                      void onClaimReward().then((r) => {
                        if (r) setClaimMsg(`+${r.gained} XP 받았어요`)
                      })
                    }}
                  >
                    {busy ? '받는 중...' : '받기'}
                  </button>
                ) : pending.claimed ? (
                  <span className="week-reward-state">받음</span>
                ) : rewardExpired ? (
                  <span className="week-reward-state">만료</span>
                ) : null}
                {claimMsg && <p className="week-reward-msg">{claimMsg}</p>}
              </div>
            )}

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
              닉네임과 비밀번호로 가입하면, 기록을 다른 기기에서도 이어갈 수
              있어요. 카톡 안에서도 바로 됩니다.
            </p>

            <div className="auth-mode-tabs" role="tablist">
              <button
                type="button"
                role="tab"
                aria-selected={authMode === 'login'}
                className={authMode === 'login' ? 'is-active' : undefined}
                onClick={() => {
                  setAuthMode('login')
                  setLocalError(null)
                }}
              >
                로그인
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={authMode === 'signup'}
                className={authMode === 'signup' ? 'is-active' : undefined}
                onClick={() => {
                  setAuthMode('signup')
                  setLocalError(null)
                }}
              >
                회원가입
              </button>
            </div>

            {authMode === 'signup' && (
              <ul className="nick-setup-guide">
                <li>
                  <strong>닉네임</strong>
                  <span>랭킹·기록에 쓰여요. 중복은 안 됩니다.</span>
                </li>
                <li>
                  <strong>비밀번호</strong>
                  <span>
                    6자만 되면 아무거나 돼요. 다른 기기 로그인할 때 씁니다.
                  </span>
                </li>
              </ul>
            )}

            <form
              className="auth-form"
              onSubmit={(e) => {
                e.preventDefault()
                void submitAuth()
              }}
            >
              <label className="nick-setup-label" htmlFor="auth-nickname">
                닉네임
              </label>
              <input
                id="auth-nickname"
                type="text"
                maxLength={20}
                value={nickname}
                autoComplete="username"
                placeholder="닉네임"
                disabled={busy || !authEnabled}
                onChange={(e) => {
                  setNickname(e.target.value)
                  setLocalError(null)
                }}
              />
              <label className="nick-setup-label" htmlFor="auth-password">
                비밀번호
              </label>
              <input
                id="auth-password"
                type="password"
                minLength={6}
                value={password}
                autoComplete={
                  authMode === 'signup' ? 'new-password' : 'current-password'
                }
                placeholder="아무거나 6자+"
                disabled={busy || !authEnabled}
                onChange={(e) => {
                  setPassword(e.target.value)
                  setLocalError(null)
                }}
              />
              {(localError || error) && (
                <p className="name-error">{localError || error}</p>
              )}
              {authEnabled ? (
                <button type="submit" className="cta" disabled={busy}>
                  {busy
                    ? authMode === 'signup'
                      ? '가입 중...'
                      : '로그인 중...'
                    : authMode === 'signup'
                      ? '가입하고 시작'
                      : '로그인'}
                </button>
              ) : (
                <p className="profile-guest-note">
                  로그인을 아직 설정하지 않았어요
                </p>
              )}
            </form>

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
          </div>
        )}
      </div>
    </div>
  )
}
