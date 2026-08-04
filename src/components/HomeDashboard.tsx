import { useState, type CSSProperties } from 'react'
import type { UserProfile } from '../lib/auth'
import {
  displayWeekStat,
  getHold,
  holdXpBarColor,
  progressFromXp,
} from '../lib/levels'
import { hasUnclaimedMail } from '../lib/mailbox'
import { HoldBadge, HoldPreview, HoldTrail } from './HoldBadge'

type Props = {
  profile: UserProfile | null
  streak: number
  played: number
  wins: number
  onOpenProfile: () => void
  onOpenRanking: () => void
  onOpenShop?: () => void
  onOpenMailbox?: () => void
}

function formatToday(): string {
  const d = new Date()
  return `${d.getMonth() + 1}월 ${d.getDate()}일`
}

export function HomeDashboard({
  profile,
  streak,
  played,
  wins,
  onOpenProfile,
  onOpenRanking,
  onOpenShop,
  onOpenMailbox,
}: Props) {
  const [previewLevel, setPreviewLevel] = useState<number | null>(null)
  const levelView = profile ? progressFromXp(profile.xp) : null
  const losses = Math.max(0, played - wins)
  const mailReady = Boolean(
    profile && hasUnclaimedMail(profile.claimedMailIds ?? []),
  )

  return (
    <div className="home-dash">
      <div className="home-dash-hero">
        <h2 className="home-hero-title">푸들푸들</h2>
        <p className="home-hero-sub">한글 자모로 맞히는 단어 게임</p>
        <p className="home-dash-date">{formatToday()}</p>
      </div>

      {profile && levelView ? (
        <section className="home-card home-card-level">
          <div className="home-level-row">
            <HoldBadge
              level={profile.level}
              size="lg"
              onClick={() => setPreviewLevel(profile.level)}
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
          <HoldTrail
            currentLevel={levelView.level}
            onSelectReached={setPreviewLevel}
          />
        </section>
      ) : (
        <section className="home-card">
          <p className="home-card-kicker">이 브라우저</p>
          <strong className="home-guest-title">내 전적</strong>
          <p className="home-guest-sub">
            {streak >= 2 ? `${streak}연승 중` : '쉬움·어려움 합산'}
          </p>
        </section>
      )}

      <section className="home-record" aria-label="누적">
        <p className="home-record-title">누적</p>
        <div className="home-record-stats">
          <div>
            <span>판수</span>
            <strong>{played}</strong>
          </div>
          <div>
            <span>승</span>
            <strong>{wins}</strong>
          </div>
          <div>
            <span>패</span>
            <strong>{losses}</strong>
          </div>
        </div>
      </section>

      {profile && (
        <>
          <section className="home-week-chip" aria-label="이번 주">
            <span>이번 주</span>
            <strong>
              {displayWeekStat(profile.weekKey, profile.weekPlays ?? 0)}판
            </strong>
            <span className="home-week-sep">·</span>
            <strong>
              {displayWeekStat(profile.weekKey, profile.weekWins)}승
            </strong>
          </section>
          <section className="home-economy" aria-label="힌트와 초크가루">
            <div>
              <span>보유힌트</span>
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
        {onOpenShop && (
          <button type="button" className="home-quick-btn" onClick={onOpenShop}>
            상점
          </button>
        )}
        {profile && onOpenMailbox && (
          <button
            type="button"
            className={`home-quick-btn${mailReady ? ' has-mail' : ''}`}
            onClick={onOpenMailbox}
          >
            우편함{mailReady ? ' · NEW' : ''}
          </button>
        )}
        <button type="button" className="home-quick-btn" onClick={onOpenProfile}>
          내 정보
        </button>
      </div>

      {previewLevel != null && (
        <HoldPreview
          level={previewLevel}
          onClose={() => setPreviewLevel(null)}
        />
      )}
    </div>
  )
}
