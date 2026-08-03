import { useEffect, useRef, useState } from 'react'
import { Board } from './components/Board'
import { Confetti } from './components/Confetti'
import { HistoryModal } from './components/HistoryModal'
import { HoldBadge } from './components/HoldBadge'
import { HomeDashboard } from './components/HomeDashboard'
import { HowTo } from './components/HowTo'
import { Keyboard } from './components/Keyboard'
import { ModeSelect } from './components/ModeSelect'
import { ProfileModal } from './components/ProfileModal'
import { RankingModal, type RankScope } from './components/RankingModal'
import { MailboxModal } from './components/MailboxModal'
import { ShopModal, type ShopTab } from './components/ShopModal'
import { DIFFICULTY_META } from './data/words'
import { useAuth } from './hooks/useAuth'
import { useBoardTheme } from './hooks/useBoardTheme'
import { useGame, MAX_ATTEMPTS } from './hooks/useGame'
import { formatSeconds, saveHistoryRecord } from './lib/history'
import { shareChallenge } from './lib/challenge'
import { getHold } from './lib/levels'
import { hasUnclaimedMail } from './lib/mailbox'
import { awardMatchXp } from './lib/progress'
import { getPersonalStats } from './lib/stats'
import { DEFAULT_OWNED_THEME_IDS } from './lib/themes'
import './App.css'

type XpFlash = {
  gained: number
  tokensGained: number
  leveledUp: boolean
  newLevel: number
}

function App() {
  const game = useGame()
  const auth = useAuth()
  const boardTheme = useBoardTheme({
    accountKey: auth.user?.uid ?? 'guest',
    ownedThemeIds: auth.user?.ownedThemeIds ?? DEFAULT_OWNED_THEME_IDS,
    equippedFromCloud: auth.user?.equippedThemeId ?? null,
  })
  const themeAttr =
    boardTheme.themeId === 'default' ? undefined : boardTheme.themeId
  const [howto, setHowto] = useState(false)
  const [historyOpen, setHistoryOpen] = useState(false)
  const [rankingOpen, setRankingOpen] = useState(false)
  const [rankingScope, setRankingScope] = useState<RankScope>('week')

  const openRanking = (scope: RankScope = 'week') => {
    setRankingScope(scope)
    setRankingOpen(true)
  }
  const [profileOpen, setProfileOpen] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)
  const [modePickerOpen, setModePickerOpen] = useState(false)
  const [shopOpen, setShopOpen] = useState(false)
  const [shopTab, setShopTab] = useState<ShopTab>('hints')
  const [mailboxOpen, setMailboxOpen] = useState(false)
  const [xpFlash, setXpFlash] = useState<XpFlash | null>(null)
  const [hintBusy, setHintBusy] = useState(false)
  const [hintPickMode, setHintPickMode] = useState(false)
  const [hintConfirm, setHintConfirm] = useState<{
    row: number
    col: number
  } | null>(null)
  const [giveUpConfirm, setGiveUpConfirm] = useState(false)
  const prevGameStatus = useRef(game.status)
  const mailAutoShownFor = useRef<string | null>(null)
  const patchProgress = auth.patchProgress

  useEffect(() => {
    const seen = localStorage.getItem('wordle-hangul-howto')
    if (!seen) {
      setHowto(true)
      localStorage.setItem('wordle-hangul-howto', '1')
    }
  }, [])

  const refreshStreak = game.refreshStreak
  useEffect(() => {
    if (!auth.ready || !auth.user) return
    refreshStreak()
  }, [auth.ready, auth.user, refreshStreak])

  // 로그인 유저 미수령 우편 있으면 홈에서 한 번 자동으로 열어줌
  useEffect(() => {
    if (!auth.ready || !auth.user) {
      if (!auth.user) mailAutoShownFor.current = null
      return
    }
    if (!hasUnclaimedMail(auth.user.claimedMailIds ?? [])) return
    if (mailAutoShownFor.current === auth.user.uid) return
    mailAutoShownFor.current = auth.user.uid
    setMailboxOpen(true)
  }, [auth.ready, auth.user])

  useEffect(() => {
    if (game.status !== 'playing') {
      setHintPickMode(false)
      setHintConfirm(null)
    }
  }, [game.status])

  useEffect(() => {
    const prev = prevGameStatus.current
    prevGameStatus.current = game.status
    if (game.status === 'playing') {
      setXpFlash(null)
      return
    }
    // 세션 복원이 아니라, 플레이 중 → 종료로 바뀐 순간에만 XP (지금부터)
    if (prev !== 'playing') return

    // 테마 체험: 한 판이 끝나면 1판 차감
    boardTheme.consumeTrialGame()

    if (!auth.user || !game.difficulty || !game.playMode) return

    let cancelled = false
    awardMatchXp({
      uid: auth.user.uid,
      nickname: auth.user.nickname,
      won: game.status === 'won',
      attempts: game.rows.length,
      seconds: game.seconds,
      difficulty: game.difficulty,
      playMode: game.playMode,
      streakAfter: game.currentStreak,
    })
      .then((result) => {
        if (cancelled || !result) return
        patchProgress(result.progress)
        setXpFlash({
          gained: result.gained,
          tokensGained: result.tokensGained,
          leveledUp: result.leveledUp,
          newLevel: result.newLevel,
        })
      })
      .catch(() => undefined)

    return () => {
      cancelled = true
    }
  }, [
    auth.user,
    patchProgress,
    boardTheme.consumeTrialGame,
    game.status,
    game.difficulty,
    game.playMode,
    game.rows.length,
    game.seconds,
    game.currentStreak,
  ])

  const autoSaveKey = useRef<string | null>(null)
  useEffect(() => {
    if (game.status === 'playing' || game.recordSaved || !game.difficulty) {
      if (game.status === 'playing') autoSaveKey.current = null
      return
    }
    // 클라우드 기록은 로그인 계정만 (비로그인은 이름만으로 섞이지 않게)
    const nick = auth.user?.nickname?.trim().slice(0, 20)
    const uid = auth.user?.uid
    if (!nick || !uid) return
    if (!game.playMode) return

    const key = `${game.playMode}:${game.answerWord}:${game.dateKey}:${game.difficulty}:${game.status}:${game.rows.length}`
    if (autoSaveKey.current === key) return
    autoSaveKey.current = key

    // 성공/실패(5회) 직후 1회 저장. 데일리는 정답 단어 없이 저장
    void saveHistoryRecord({
      name: nick,
      word: game.playMode === 'daily' ? '' : game.answerWord,
      seconds: game.seconds,
      attempts: game.rows.length,
      maxAttempts: MAX_ATTEMPTS,
      won: game.status === 'won',
      dateKey: game.dateKey,
      difficulty: game.difficulty,
      wordLength: game.wordLength,
      playMode: game.playMode,
      hintUsed: game.hintUsedThisGame,
      uid,
    })
      .then(() => {
        game.markRecordSaved()
      })
      .catch(() => {
        if (autoSaveKey.current === key) autoSaveKey.current = null
      })
  }, [
    game.status,
    game.recordSaved,
    game.difficulty,
    game.playMode,
    game.answerWord,
    game.dateKey,
    game.seconds,
    game.rows.length,
    game.wordLength,
    game.hintUsedThisGame,
    game.markRecordSaved,
    auth.user?.nickname,
    auth.user?.uid,
  ])

  const finished = game.status !== 'playing'
  const modeLabel =
    game.challengeMode
      ? '친구 도전'
      : game.playMode === 'daily'
        ? '오늘의 단어'
        : game.playMode === 'practice'
          ? '메인게임'
          : null

  if (game.dictError) {
    return (
      <div className="app" data-theme={themeAttr}>
        <div className="boot-card">
          <h1>사전을 불러오지 못했어요</h1>
          <p>{game.dictError}</p>
        </div>
      </div>
    )
  }

  if (!game.dictReady) {
    return (
      <div className="app" data-theme={themeAttr}>
        <div className="boot-card">
          <div className="boot-spinner" aria-hidden />
          <h1>사전 불러오는 중</h1>
          <p>단어를 준비하고 있어요</p>
        </div>
      </div>
    )
  }

  const openProfile = () => {
    auth.clearError()
    setMenuOpen(false)
    setProfileOpen(true)
  }

  const profileMenuItem = (
    <button type="button" onClick={openProfile}>
      내 정보
    </button>
  )

  const profileModal = (
    <ProfileModal
      open={profileOpen}
      profile={auth.user}
      authEnabled={auth.enabled}
      busy={auth.busy}
      error={auth.error}
      onClose={() => {
        setProfileOpen(false)
        auth.clearError()
      }}
      onSignIn={async (nickname, password) => {
        const profile = await auth.signIn(nickname, password)
        if (profile) game.refreshStreak()
        return profile
      }}
      onSignUp={async (nickname, password) => {
        const profile = await auth.signUp(nickname, password)
        if (profile) game.refreshStreak()
        return profile
      }}
      onSignOut={async () => {
        await auth.signOut()
        setProfileOpen(false)
      }}
      onUpdateNickname={auth.rename}
      onClaimReward={auth.claimReward}
    />
  )

  const openShop = (tab: ShopTab = 'hints') => {
    setShopTab(tab)
    setShopOpen(true)
  }

  const shopModal = (
    <ShopModal
      open={shopOpen}
      onClose={() => {
        setShopOpen(false)
        auth.clearError()
      }}
      initialTab={shopTab}
      hints={auth.user?.hints ?? 0}
      tokens={auth.user?.tokens ?? 0}
      lastDailyHintDate={auth.user?.lastDailyHintDate ?? ''}
      loggedIn={Boolean(auth.user)}
      busy={auth.busy}
      error={auth.error}
      onBuyHint={auth.buyItem}
      onRefresh={auth.refreshEconomy}
      onNeedLogin={() => {
        setShopOpen(false)
        openProfile()
      }}
      theme={{
        themeId: boardTheme.themeId,
        equippedId: boardTheme.equippedId,
        ownedThemeIds: auth.user?.ownedThemeIds ?? [...DEFAULT_OWNED_THEME_IDS],
        tokens: auth.user?.tokens ?? 0,
        loggedIn: Boolean(auth.user),
        busy: auth.busy,
        error: auth.error,
        trialStore: boardTheme.trialStore,
        gamesLeftFor: boardTheme.gamesLeftFor,
        canTrial: boardTheme.canTrial,
        onPreview: boardTheme.preview,
        onEquip: async (id) => {
          const owned = auth.user?.ownedThemeIds ?? []
          // 보유 테마만 클라우드 장착. 체험 테마는 로컬 장착
          if (auth.user && owned.includes(id)) {
            const ok = await auth.wearTheme(id)
            if (ok) boardTheme.setEquippedId(id)
            return
          }
          boardTheme.equipLocal(id)
        },
        onBuy: async (id) => {
          const ok = await auth.purchaseTheme(id)
          if (ok) {
            boardTheme.endTrial(id)
            boardTheme.setEquippedId(id)
          }
          return ok
        },
        onTrial: (id) => {
          boardTheme.startTrial(id)
        },
        onNeedLogin: () => {
          setShopOpen(false)
          openProfile()
        },
      }}
    />
  )

  const headerAuthButton = !auth.ready ? (
    <span className="header-auth is-loading" aria-hidden>
      ···
    </span>
  ) : auth.user ? (
    <button
      type="button"
      className="header-auth is-user"
      aria-label={`${auth.user.nickname} · Lv.${auth.user.level} · 내 정보`}
      onClick={openProfile}
    >
      <span className="header-auth-chip">
        {auth.user.photoURL ? (
          <img
            className="header-auth-avatar"
            src={auth.user.photoURL}
            alt=""
            referrerPolicy="no-referrer"
          />
        ) : (
          <span className="header-auth-avatar is-fallback" aria-hidden>
            {auth.user.nickname.trim().slice(0, 1) || '?'}
          </span>
        )}
        <HoldBadge
          level={auth.user.level}
          size="sm"
          className="header-hold"
        />
      </span>
    </button>
  ) : (
    <button
      type="button"
      className="header-auth"
      aria-label="로그인"
      onClick={openProfile}
    >
      로그인
    </button>
  )

  if (game.needMode) {
    const localStats = getPersonalStats()
    const homePlayed = Math.max(auth.user?.played ?? 0, localStats.played)
    const homeWins = Math.max(auth.user?.wins ?? 0, localStats.wins)

    return (
      <div className="app is-home" data-theme={themeAttr}>
        <header className="header">
          {headerAuthButton}
          <div className="brand brand-home" aria-hidden />
          <button
            type="button"
            className="icon-btn"
            aria-label="메뉴"
            aria-expanded={menuOpen}
            onClick={() => setMenuOpen((v) => !v)}
          >
            <MenuIcon />
          </button>
          {menuOpen && (
            <div className="menu-pop">
              <button
                type="button"
                onClick={() => {
                  game.changeMode()
                  setModePickerOpen(false)
                  setMenuOpen(false)
                }}
              >
                홈
              </button>
              {profileMenuItem}
              <button
                type="button"
                onClick={() => {
                  openRanking('week')
                  setMenuOpen(false)
                }}
              >
                랭킹
              </button>
              <button
                type="button"
                onClick={() => {
                  openShop('hints')
                  setMenuOpen(false)
                }}
              >
                상점
              </button>
              <button
                type="button"
                onClick={() => {
                  setHowto(true)
                  setMenuOpen(false)
                }}
              >
                게임 방법
              </button>
              {auth.user && (
                <button
                  type="button"
                  onClick={() => {
                    setMailboxOpen(true)
                    setMenuOpen(false)
                  }}
                >
                  우편함
                  {hasUnclaimedMail(auth.user.claimedMailIds ?? [])
                    ? ' · NEW'
                    : ''}
                </button>
              )}
            </div>
          )}
        </header>
        {modePickerOpen ? (
          <ModeSelect
            open
            onBack={() => setModePickerOpen(false)}
            onSelect={(mode, difficulty) => {
              setModePickerOpen(false)
              game.startGame(mode, difficulty)
            }}
          />
        ) : !auth.ready ? (
          <div className="home-dash home-dash-loading" aria-busy="true">
            <div className="home-dash-hero">
              <h2 className="home-hero-title">푸들푸들</h2>
              <p className="home-hero-sub">불러오는 중…</p>
            </div>
          </div>
        ) : (
          <>
            <HomeDashboard
              profile={auth.user}
              streak={game.currentStreak}
              played={homePlayed}
              wins={homeWins}
              onOpenProfile={openProfile}
              onOpenRanking={() => openRanking('week')}
              onOpenShop={() => openShop('hints')}
              onOpenMailbox={
                auth.user
                  ? () => {
                      setMailboxOpen(true)
                    }
                  : undefined
              }
              onClaimReward={auth.user ? auth.claimReward : undefined}
              claimBusy={auth.busy}
            />
            <div className="home-start-bar">
              <button
                type="button"
                className="cta home-start-btn"
                onClick={() => setModePickerOpen(true)}
              >
                게임시작
              </button>
            </div>
          </>
        )}
        {game.toast && <div className="toast">{game.toast}</div>}
        {auth.error && !profileOpen && !shopOpen && !mailboxOpen && (
          <div className="toast">{auth.error}</div>
        )}
        <HowTo
          open={howto}
          onClose={() => setHowto(false)}
          guessCount={game.guessCount}
          answerCount={game.answerCount}
        />
        <HistoryModal open={historyOpen} onClose={() => setHistoryOpen(false)} />
        <RankingModal
          open={rankingOpen}
          onClose={() => setRankingOpen(false)}
          initialScope={rankingScope}
          initialDifficulty="easy"
          onOpenHistory={() => {
            setRankingOpen(false)
            setHistoryOpen(true)
          }}
        />
        {auth.user && (
          <MailboxModal
            open={mailboxOpen}
            onClose={() => {
              setMailboxOpen(false)
              auth.clearError()
            }}
            claimedMailIds={auth.user.claimedMailIds ?? []}
            busy={auth.busy}
            error={auth.error}
            onClaim={auth.claimMail}
          />
        )}
        {shopModal}
        {profileModal}
      </div>
    )
  }

  const startHintPick = () => {
    if (!auth.user || hintBusy || game.status !== 'playing') return
    if (hintPickMode) {
      setHintPickMode(false)
      setHintConfirm(null)
      return
    }
    if (game.hintUsedThisGame) {
      return
    }
    if (game.hintCandidatesLeft() <= 0) {
      return
    }
    if (auth.user.hints < 1) {
      openShop('hints')
      return
    }
    setHintConfirm(null)
    setHintPickMode(true)
  }

  const confirmHintUse = async () => {
    if (!auth.user || !hintConfirm || hintBusy) return
    const { row, col } = hintConfirm
    if (!game.canHintAt(row, col)) {
      setHintConfirm(null)
      return
    }
    setHintBusy(true)
    try {
      const progress = await auth.useHint()
      if (!progress) return
      game.applyHintAt(row, col)
      setHintPickMode(false)
      setHintConfirm(null)
    } finally {
      setHintBusy(false)
    }
  }

  return (
    <div className="app" data-theme={themeAttr}>
      <header className="header">
        {headerAuthButton}
        <div className="brand">
          <p className="brand-kicker is-challenge">
            {modeLabel}
            {game.difficulty
              ? ` · ${DIFFICULTY_META[game.difficulty].label}`
              : ''}
          </p>
          <h1>
            {game.playMode === 'daily'
              ? '푸들푸들 오늘의 단어'
              : '푸들푸들 메인게임'}
          </h1>
        </div>
        <button
          type="button"
          className="icon-btn"
          aria-label="메뉴"
          aria-expanded={menuOpen}
          onClick={() => setMenuOpen((v) => !v)}
        >
          <MenuIcon />
        </button>
        {menuOpen && (
          <div className="menu-pop">
            <button
              type="button"
              onClick={() => {
                game.changeMode()
                setModePickerOpen(false)
                setMenuOpen(false)
              }}
            >
              홈
            </button>
            {profileMenuItem}
            <button
              type="button"
              onClick={() => {
                openRanking('week')
                setMenuOpen(false)
              }}
            >
              랭킹
            </button>
            <button
              type="button"
              onClick={() => {
                openShop('hints')
                setMenuOpen(false)
              }}
            >
              상점
            </button>
            <button
              type="button"
              onClick={() => {
                setHowto(true)
                setMenuOpen(false)
              }}
            >
              게임 방법
            </button>
            {auth.user && (
              <button
                type="button"
                onClick={() => {
                  setMailboxOpen(true)
                  setMenuOpen(false)
                }}
              >
                우편함
                {hasUnclaimedMail(auth.user.claimedMailIds ?? [])
                  ? ' · NEW'
                  : ''}
              </button>
            )}
            {finished && (
              <button
                type="button"
                onClick={() => {
                  game.nextRound()
                  setMenuOpen(false)
                }}
              >
                {game.playMode === 'daily' ? '메인게임 이어하기' : '다음 문제 풀기'}
              </button>
            )}
          </div>
        )}
      </header>

      <main className="main">
        <Board
          rows={game.rows}
          current={game.current}
          shake={game.shake}
          revealingRow={game.revealingRow}
          wordLength={game.wordLength}
          bounce={game.celebrate}
          hintGrid={game.hintGrid}
          pickMode={hintPickMode && !finished}
          canHintAt={game.canHintAt}
          onPickCell={(row, col) => {
            if (!game.canHintAt(row, col)) return
            setHintConfirm({ row, col })
          }}
        />

        <div className="hint-bar">
          <span className="hint-pill soft">
            기회 {MAX_ATTEMPTS - game.attemptsUsed}/{MAX_ATTEMPTS}
          </span>
          <span
            className={`hint-pill soft timer-pill${
              game.startedAt && !finished ? ' is-live' : ''
            }`}
          >
            {game.startedAt ? formatSeconds(game.seconds) : '0초'}
          </span>
          {game.challengeMode && (
            <span className="hint-pill challenge-pill">친구 도전</span>
          )}
          {game.playMode === 'daily' && !game.challengeMode && (
            <span className="hint-pill challenge-pill">오늘</span>
          )}
          {game.currentStreak >= 2 && (
            <span
              className={`hint-pill streak-pill${
                game.currentStreak >= 5 ? ' is-hot' : ''
              }`}
              title={
                auth.isLoggedIn
                  ? '계정 기준 연속 승리'
                  : '이 브라우저 기준 연속 승리'
              }
            >
              <span className="streak-fire tiny" aria-hidden>
                🔥
              </span>
              {game.currentStreak}연승
            </span>
          )}
          {auth.user && !finished && (
            <button
              type="button"
              className={`hint-pill hint-use-btn${hintPickMode ? ' is-on' : ''}`}
              disabled={
                hintBusy ||
                auth.busy ||
                game.revealingRow !== null ||
                game.hintUsedThisGame
              }
              onClick={startHintPick}
            >
              {hintPickMode
                ? '취소'
                : game.hintUsedThisGame
                  ? '힌트 사용함'
                  : `보유힌트 ${auth.user.hints}`}
            </button>
          )}
          {!finished && (
            <button
              type="button"
              className="hint-pill giveup-btn"
              disabled={game.revealingRow !== null || giveUpConfirm}
              onClick={() => setGiveUpConfirm(true)}
            >
              포기
            </button>
          )}
        </div>

        {giveUpConfirm && (
          <div
            className="modal-backdrop hint-confirm-backdrop"
            role="presentation"
            onClick={() => setGiveUpConfirm(false)}
          >
            <div
              className="modal hint-confirm-modal"
              role="dialog"
              aria-modal="true"
              aria-labelledby="giveup-confirm-title"
              onClick={(e) => e.stopPropagation()}
            >
              <h2 id="giveup-confirm-title">포기할까요?</h2>
              <p className="modal-sub">
                정답이 공개되고 이 판은 패배로 기록돼요
              </p>
              <div className="modal-actions">
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={() => setGiveUpConfirm(false)}
                >
                  계속하기
                </button>
                <button
                  type="button"
                  className="btn-primary"
                  onClick={() => {
                    setGiveUpConfirm(false)
                    setHintPickMode(false)
                    setHintConfirm(null)
                    game.giveUp()
                  }}
                >
                  포기하기
                </button>
              </div>
            </div>
          </div>
        )}

        {hintConfirm && (
          <div
            className="modal-backdrop hint-confirm-backdrop"
            role="presentation"
            onClick={() => setHintConfirm(null)}
          >
            <div
              className="modal hint-confirm-modal"
              role="dialog"
              aria-modal="true"
              aria-labelledby="hint-confirm-title"
              onClick={(e) => e.stopPropagation()}
            >
              <h2 id="hint-confirm-title">힌트 사용</h2>
              <p className="modal-sub">이 칸에 힌트를 쓸까요?</p>
              <div className="modal-actions">
                <button
                  type="button"
                  className="btn-secondary"
                  disabled={hintBusy}
                  onClick={() => setHintConfirm(null)}
                >
                  취소
                </button>
                <button
                  type="button"
                  className="btn-primary"
                  disabled={hintBusy}
                  onClick={() => void confirmHintUse()}
                >
                  {hintBusy ? '사용 중...' : '확인'}
                </button>
              </div>
            </div>
          </div>
        )}

        {finished ? (
          <>
            <div
              className={`finish-card ${game.status === 'won' ? 'is-win' : 'is-lose'}`}
            >
              <p className="finish-answer-line">
                정답은 <span>{game.answerWord}</span>
              </p>
              <p className="finish-jamo">{game.answerJamo.join(' · ')}</p>
              <p className="finish-meta">
                {game.status === 'won' ? '성공' : '실패'}
                {' · '}
                {modeLabel}
                {game.difficulty
                  ? ` · ${DIFFICULTY_META[game.difficulty].label}`
                  : ''}
                {' · '}
                {game.status === 'won'
                  ? `${game.attemptsUsed}/${MAX_ATTEMPTS}번`
                  : `${MAX_ATTEMPTS}번 실패`}
                {' · '}
                {formatSeconds(game.seconds)}
              </p>
              {game.status === 'won' && game.currentStreak >= 2 && (
                <p
                  className={`finish-streak${
                    game.currentStreak >= 5 ? ' is-hot' : ''
                  }`}
                >
                  <span className="streak-fire" aria-hidden>
                    🔥
                  </span>
                  {game.currentStreak}연속 승리 중!
                </p>
              )}
              {xpFlash && (
                <p
                  className={`finish-xp${xpFlash.leveledUp ? ' is-levelup' : ''}`}
                >
                  +{xpFlash.gained} XP
                  {xpFlash.tokensGained > 0 && (
                    <> · +{xpFlash.tokensGained} 초크가루</>
                  )}
                  {xpFlash.leveledUp && (
                    <>
                      {' · '}
                      <HoldBadge level={xpFlash.newLevel} size="sm" />
                      Lv.{xpFlash.newLevel} {getHold(xpFlash.newLevel).name}
                    </>
                  )}
                </p>
              )}
              {game.definition && (
                <p className="finish-def">
                  <span className="finish-def-label">사전 뜻</span>
                  {game.definition}
                </p>
              )}
            </div>

            <div className="finish-actions">
              <button
                type="button"
                className="cta cta-secondary"
                onClick={() => {
                  setModePickerOpen(false)
                  game.changeMode()
                }}
              >
                홈
              </button>
              {game.playMode !== 'daily' && (
                <button
                  type="button"
                  className="cta cta-secondary"
                  onClick={async () => {
                    if (!game.difficulty) return
                    const result = await shareChallenge({
                      difficulty: game.difficulty,
                      word: game.answerWord,
                      fromName: auth.user?.nickname,
                    })
                    if (result === 'copied') alert('도전 링크가 복사되었어요!')
                  }}
                >
                  도전 보내기
                </button>
              )}
              <button
                type="button"
                className="cta finish-continue"
                onClick={() => game.nextRound()}
              >
                {game.playMode === 'daily' ? '메인게임 이어하기' : '다음 문제 풀기'}
              </button>
            </div>
          </>
        ) : (
          <>
            <Keyboard
              keyStatuses={game.keyStatuses}
              onKey={game.onKey}
              disabled={
                game.revealingRow !== null ||
                hintPickMode ||
                Boolean(hintConfirm)
              }
            />
            <button
              type="button"
              className="cta"
              onClick={() => game.onKey('Enter')}
              disabled={
                game.revealingRow !== null || hintPickMode || Boolean(hintConfirm)
              }
            >
              입력
            </button>
          </>
        )}
      </main>

      {game.toast && <div className="toast">{game.toast}</div>}
      {auth.error && !profileOpen && !shopOpen && !mailboxOpen && (
        <div className="toast">{auth.error}</div>
      )}
      <Confetti active={game.celebrate} streak={game.currentStreak} />

      <HowTo
        open={howto}
        onClose={() => setHowto(false)}
        guessCount={game.guessCount}
        answerCount={game.answerCount}
      />
      <HistoryModal open={historyOpen} onClose={() => setHistoryOpen(false)} />
      <RankingModal
        open={rankingOpen}
        onClose={() => setRankingOpen(false)}
        initialScope={rankingScope}
        initialDifficulty={game.difficulty ?? 'easy'}
        onOpenHistory={() => {
          setRankingOpen(false)
          setHistoryOpen(true)
        }}
      />
      {auth.user && (
        <MailboxModal
          open={mailboxOpen}
          onClose={() => {
            setMailboxOpen(false)
            auth.clearError()
          }}
          claimedMailIds={auth.user.claimedMailIds ?? []}
          busy={auth.busy}
          error={auth.error}
          onClaim={auth.claimMail}
        />
      )}
      {shopModal}
      {profileModal}
    </div>
  )
}

function MenuIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden>
      <circle cx="12" cy="6" r="1.6" fill="currentColor" />
      <circle cx="12" cy="12" r="1.6" fill="currentColor" />
      <circle cx="12" cy="18" r="1.6" fill="currentColor" />
    </svg>
  )
}

export default App
