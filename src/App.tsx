import { useEffect, useRef, useState } from 'react'
import { AuthStatusBar } from './components/AuthStatusBar'
import { Board } from './components/Board'
import { Confetti } from './components/Confetti'
import { HistoryModal } from './components/HistoryModal'
import { HowTo } from './components/HowTo'
import { Keyboard } from './components/Keyboard'
import { ModeSelect } from './components/ModeSelect'
import { NicknameSetupModal } from './components/NicknameSetupModal'
import { ProfileModal } from './components/ProfileModal'
import { RankingModal } from './components/RankingModal'
import { DIFFICULTY_META } from './data/words'
import { useAuth } from './hooks/useAuth'
import { useGame, MAX_ATTEMPTS } from './hooks/useGame'
import { formatSeconds, getLastName, saveHistoryRecord } from './lib/history'
import { shareChallenge } from './lib/challenge'
import './App.css'

function App() {
  const game = useGame()
  const auth = useAuth()
  const [howto, setHowto] = useState(false)
  const [historyOpen, setHistoryOpen] = useState(false)
  const [rankingOpen, setRankingOpen] = useState(false)
  const [profileOpen, setProfileOpen] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)

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

  const autoSaveKey = useRef<string | null>(null)
  useEffect(() => {
    if (game.status === 'playing' || game.recordSaved || !game.difficulty) {
      if (game.status === 'playing') autoSaveKey.current = null
      return
    }
    const nick = (auth.user?.nickname?.trim() || getLastName().trim()).slice(
      0,
      20,
    )
    if (!nick) return
    const key = `${game.answerWord}:${game.dateKey}:${game.difficulty}`
    if (autoSaveKey.current === key) return
    autoSaveKey.current = key

    let cancelled = false
    saveHistoryRecord({
      name: nick,
      word: game.answerWord,
      seconds: game.seconds,
      attempts: game.rows.length,
      maxAttempts: MAX_ATTEMPTS,
      won: game.status === 'won',
      dateKey: game.dateKey,
      difficulty: game.difficulty,
      wordLength: game.wordLength,
      uid: auth.user?.uid,
    })
      .then(() => {
        if (!cancelled) game.markRecordSaved()
      })
      .catch(() => {
        if (!cancelled) autoSaveKey.current = null
      })

    return () => {
      cancelled = true
    }
  }, [
    game.status,
    game.recordSaved,
    game.difficulty,
    game.answerWord,
    game.dateKey,
    game.seconds,
    game.rows.length,
    game.wordLength,
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
          ? '연습'
          : null

  if (game.dictError) {
    return (
      <div className="app">
        <div className="boot-card">
          <h1>사전을 불러오지 못했어요</h1>
          <p>{game.dictError}</p>
        </div>
      </div>
    )
  }

  if (!game.dictReady) {
    return (
      <div className="app">
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
      inAppHint={auth.inAppHint}
      onClose={() => {
        setProfileOpen(false)
        auth.clearError()
      }}
      onSignIn={async () => {
        const profile = await auth.signIn()
        if (profile) {
          game.refreshStreak()
          setProfileOpen(false)
        }
      }}
      onSignOut={async () => {
        await auth.signOut()
        setProfileOpen(false)
      }}
      onUpdateNickname={auth.rename}
    />
  )

  const headerAuthButton = auth.user ? (
    <button
      type="button"
      className="header-auth is-user"
      aria-label={`${auth.user.nickname} · 내 정보`}
      onClick={openProfile}
    >
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
    </button>
  ) : (
    <button
      type="button"
      className="header-auth"
      aria-label="로그인"
      onClick={() => {
        openProfile()
        // 카톡 인앱이 아니면 바로 Google 로그인까지 진행
        if (!auth.inAppHint) {
          void (async () => {
            const profile = await auth.signIn()
            if (profile) {
              game.refreshStreak()
              setProfileOpen(false)
            }
          })()
        }
      }}
    >
      로그인
    </button>
  )

  if (game.needMode) {
    return (
      <div className="app">
        <header className="header">
          {headerAuthButton}
          <div className="brand">
            <h1>푸들푸들</h1>
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
                  setHowto(true)
                  setMenuOpen(false)
                }}
              >
                게임 방법
              </button>
              <button
                type="button"
                onClick={() => {
                  setRankingOpen(true)
                  setMenuOpen(false)
                }}
              >
                랭킹
              </button>
              <button
                type="button"
                onClick={() => {
                  setHistoryOpen(true)
                  setMenuOpen(false)
                }}
              >
                기록 보기
              </button>
              {profileMenuItem}
            </div>
          )}
        </header>
        {auth.user && (
          <AuthStatusBar
            nickname={auth.user.nickname}
            photoURL={auth.user.photoURL}
            streak={game.currentStreak}
            onClick={openProfile}
          />
        )}
        <ModeSelect open onSelect={game.startGame} />
        {game.toast && <div className="toast">{game.toast}</div>}
        {auth.error && !profileOpen && !auth.nicknameSetup && (
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
          initialDifficulty="easy"
        />
        {profileModal}
        <NicknameSetupModal
          open={Boolean(auth.nicknameSetup)}
          suggested={auth.nicknameSetup?.suggested ?? ''}
          previousName={auth.nicknameSetup?.previousName ?? ''}
          hasLocalStats={Boolean(auth.nicknameSetup?.hasLocalStats)}
          busy={auth.busy}
          error={auth.error}
          onSubmit={async (name) => {
            const profile = await auth.submitNickname(name)
            if (profile) game.refreshStreak()
          }}
          onCancel={() => auth.cancelNicknameSetup()}
        />
      </div>
    )
  }

  return (
    <div className="app">
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
              : '푸들푸들 단어 연습'}
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
                setHowto(true)
                setMenuOpen(false)
              }}
            >
              게임 방법
            </button>
            <button
              type="button"
              onClick={() => {
                setRankingOpen(true)
                setMenuOpen(false)
              }}
            >
              랭킹
            </button>
            <button
              type="button"
              onClick={() => {
                setHistoryOpen(true)
                setMenuOpen(false)
              }}
            >
              기록 보기
            </button>
            <button
              type="button"
              onClick={() => {
                game.changeMode()
                setMenuOpen(false)
              }}
            >
              홈
            </button>
            {finished && (
              <button
                type="button"
                onClick={() => {
                  game.nextRound()
                  setMenuOpen(false)
                }}
              >
                {game.playMode === 'daily' ? '연습 이어하기' : '다음 문제 풀기'}
              </button>
            )}
            {profileMenuItem}
          </div>
        )}
      </header>

      {auth.user && (
        <AuthStatusBar
          nickname={auth.user.nickname}
          photoURL={auth.user.photoURL}
          streak={game.currentStreak}
          onClick={openProfile}
        />
      )}

      <main className="main">
        <Board
          rows={game.rows}
          current={game.current}
          shake={game.shake}
          revealingRow={game.revealingRow}
          wordLength={game.wordLength}
          bounce={game.celebrate}
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
          <span className="hint-pill soft">자모 {game.wordLength}칸</span>
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
        </div>

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
              {game.definition && (
                <p className="finish-def">{game.definition}</p>
              )}
            </div>

            <div className="finish-actions">
              <button
                type="button"
                className="cta cta-secondary"
                onClick={() => game.changeMode()}
              >
                홈
              </button>
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
              <button
                type="button"
                className="cta finish-continue"
                onClick={() => game.nextRound()}
              >
                {game.playMode === 'daily' ? '연습 이어하기' : '다음 문제 풀기'}
              </button>
            </div>
          </>
        ) : (
          <>
            <Keyboard
              keyStatuses={game.keyStatuses}
              onKey={game.onKey}
              disabled={game.revealingRow !== null}
            />
            <button
              type="button"
              className="cta"
              onClick={() => game.onKey('Enter')}
              disabled={game.revealingRow !== null}
            >
              입력
            </button>
          </>
        )}
      </main>

      {game.toast && <div className="toast">{game.toast}</div>}
      {auth.error && !profileOpen && !auth.nicknameSetup && (
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
        initialDifficulty={game.difficulty ?? 'easy'}
      />
      {profileModal}
      <NicknameSetupModal
        open={Boolean(auth.nicknameSetup)}
        suggested={auth.nicknameSetup?.suggested ?? ''}
        previousName={auth.nicknameSetup?.previousName ?? ''}
        hasLocalStats={Boolean(auth.nicknameSetup?.hasLocalStats)}
        busy={auth.busy}
        error={auth.error}
        onSubmit={async (name) => {
          const profile = await auth.submitNickname(name)
          if (profile) game.refreshStreak()
        }}
        onCancel={() => auth.cancelNicknameSetup()}
      />
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
