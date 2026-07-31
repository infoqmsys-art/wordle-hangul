import { useState, type CSSProperties } from 'react'
import type { UserProfile } from '../lib/auth'
import {
  getHold,
  holdImageSrc,
  holdXpBarColor,
  isRewardClaimable,
  progressFromXp,
} from '../lib/levels'
import { HoldBadge, HoldTrail } from './HoldBadge'

type Props = {
  profile: UserProfile | null
  streak: number
  onOpenProfile: () => void
  onOpenRanking: () => void
  onOpenShop?: () => void
  onClaimReward?: () => Promise<{ gained: number } | null>
  claimBusy?: boolean
}

function formatToday(): string {
  const d = new Date()
  return `${d.getMonth() + 1}월 ${d.getDate()}일`
}

export function HomeDashboard({
  profile,
  streak,
  onOpenProfile,
  onOpenRanking,
  onOpenShop,
  onClaimReward,
  claimBusy,
}: Props) {
  const [holdPreview, setHoldPreview] = useState(false)
  const levelView = profile ? progressFromXp(profile.xp) : null
  const pending = profile?.pendingWeekReward ?? null
  const canClaim = isRewardClaimable(pending)

  return (
    <div className="home-dash">
      <div className="home-dash-hero">
        <h2 className="home-hero-title">푸들푸들</h2>
        <p className="home-hero-sub">한글 자모로 맞히는 오늘의 단어</p>
        <p className="home-dash-date">{formatToday()}</p>
      </div>

      {profile && levelView ? (
        <section className="home-card home-card-level">
          <div className="home-level-row">
            <HoldBadge
              level={profile.level}
              size="lg"
              onClick={() => setHoldPreview(true)}
            />
            <div className="home-level-text">
              <p className="home-card-kicker">{profile.nickname}</p>
              <strong>
                Lv.{levelView.level} {levelView.hold.name}
              </strong>
              <span>
                {levelView.xpForNext == null
                  ? `${levelView.totalXp.toLocaleString('ko-KR')} XP`
                  : `${levelView.xpIntoLevel} / ${levelView.xpForNext} XP`}
              </span>
            </div>
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
                        (levelView.xpIntoLevel / levelView.xpForNext) * 100,
                      )
                }%`,
              }}
            />
          </div>
          <p className="home-level-next">
            {levelView.xpForNext == null
              ? '최고 홀드 · XP는 계속 쌓여요'
              : `다음: Lv.${levelView.level + 1} ${getHold(levelView.level + 1).name}`}
            {streak >= 2 ? ` · ${streak}연승` : ''}
          </p>
          <HoldTrail currentLevel={levelView.level} />
        </section>
      ) : (
        <section className="home-card">
          <p className="home-card-kicker">이 브라우저</p>
          <strong className="home-guest-title">오늘의 기록</strong>
          <p className="home-guest-sub">
            {streak >= 2 ? `${streak}연승 중` : '게임을 시작해 보세요'}
          </p>
        </section>
      )}

      {pending && (
        <section
          className={`week-reward-card home-reward${canClaim ? ' is-ready' : ''}${
            pending.claimed ? ' is-claimed' : ''
          }`}
        >
          <div>
            <strong>지난주 {pending.rank}위</strong>
            <span>+{pending.xp} XP</span>
          </div>
          {canClaim && onClaimReward ? (
            <button
              type="button"
              className="pill-btn challenge"
              disabled={claimBusy}
              onClick={() => void onClaimReward()}
            >
              {claimBusy ? '받는 중...' : '받기'}
            </button>
          ) : pending.claimed ? (
            <span className="week-reward-state">받음</span>
          ) : null}
        </section>
      )}

      {profile && (
        <>
          <section className="home-week-chip" aria-label="이번 주">
            <span>이번 주</span>
            <strong>{profile.weekXp.toLocaleString('ko-KR')} XP</strong>
            <span className="home-week-sep">·</span>
            <strong>{profile.weekWins}승</strong>
          </section>
          <section className="home-economy" aria-label="힌트와 초크가루">
            <div>
              <span>힌트</span>
              <strong>{profile.hints}</strong>
            </div>
            <div>
              <span>초크가루</span>
              <strong>{profile.tokens}</strong>
            </div>
            {onOpenShop && (
              <button type="button" className="home-shop-btn" onClick={onOpenShop}>
                상점
              </button>
            )}
          </section>
        </>
      )}

      <div className="home-quick">
        <button type="button" className="home-quick-btn" onClick={onOpenRanking}>
          랭킹
        </button>
        <button type="button" className="home-quick-btn" onClick={onOpenProfile}>
          내 정보
        </button>
      </div>

      {holdPreview && profile && levelView && (
        <div
          className="modal-backdrop hold-preview-backdrop"
          role="presentation"
          onClick={() => setHoldPreview(false)}
        >
          <div
            className="hold-preview-pop"
            role="dialog"
            aria-modal="true"
            aria-label={`Lv.${levelView.level} ${levelView.hold.name}`}
            onClick={(e) => e.stopPropagation()}
          >
            <img
              src={holdImageSrc(profile.level)}
              alt={`Lv.${levelView.level} ${levelView.hold.name}`}
              draggable={false}
            />
            <p>
              Lv.{levelView.level} {levelView.hold.name}
            </p>
            <button
              type="button"
              className="btn-secondary"
              onClick={() => setHoldPreview(false)}
            >
              닫기
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
