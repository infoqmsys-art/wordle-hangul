import { useEffect, useState } from 'react'
import { Board } from './components/Board'
import { DifficultySelect } from './components/DifficultySelect'
import { HistoryModal } from './components/HistoryModal'
import { HowTo } from './components/HowTo'
import { Keyboard } from './components/Keyboard'
import { RankingModal } from './components/RankingModal'
import { ResultModal } from './components/ResultModal'
import { DIFFICULTY_META } from './data/words'
import { useGame, MAX_ATTEMPTS } from './hooks/useGame'
import { formatSeconds } from './lib/history'
import './App.css'

function App() {
  const game = useGame()
  const [howto, setHowto] = useState(false)
  const [historyOpen, setHistoryOpen] = useState(false)
  const [rankingOpen, setRankingOpen] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)

  useEffect(() => {
    const seen = localStorage.getItem('wordle-hangul-howto')
    if (!seen) {
      setHowto(true)
      localStorage.setItem('wordle-hangul-howto', '1')
    }
  }, [])

  const finished = game.status !== 'playing'

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

  if (game.needDifficulty) {
    return (
      <div className="app">
        <DifficultySelect open onSelect={game.startDifficulty} />
        {game.toast && <div className="toast">{game.toast}</div>}
      </div>
    )
  }

  return (
    <div className="app">
      <header className="header">
        <button
          type="button"
          className="icon-btn"
          aria-label="도움말"
          onClick={() => setHowto(true)}
        >
          <HelpIcon />
        </button>
        <div className="brand">
          <p className="brand-kicker">
            {game.difficulty
              ? DIFFICULTY_META[game.difficulty].label
              : '연습'}
          </p>
          <h1>푸들푸들 오늘의 단어 연습</h1>
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
                game.changeDifficulty()
                setMenuOpen(false)
              }}
            >
              난이도 선택
            </button>
            {finished && (
              <button
                type="button"
                onClick={() => {
                  game.nextRound()
                  setMenuOpen(false)
                }}
              >
                다음 문제 풀기
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
        />

        <div className="hint-bar">
          <span className="hint-pill soft">
            기회 {MAX_ATTEMPTS - game.attemptsUsed}/{MAX_ATTEMPTS}
          </span>
          <span className="hint-pill soft">자모 {game.wordLength}칸</span>
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
                {game.difficulty
                  ? DIFFICULTY_META[game.difficulty].label
                  : ''}
                {' · '}
                {game.status === 'won'
                  ? `${game.attemptsUsed}/${MAX_ATTEMPTS}번`
                  : `${MAX_ATTEMPTS}번 실패`}
                {' · '}
                {formatSeconds(game.seconds)}
              </p>
              {game.definition && (
                <p className="finish-def">{game.definition}</p>
              )}
            </div>

            <div className="finish-actions">
              <button
                type="button"
                className="cta cta-secondary"
                onClick={() => game.setShowResult(true)}
              >
                결과보기
              </button>
              <button
                type="button"
                className="cta"
                onClick={() => game.nextRound()}
              >
                다음 문제 풀기
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
      {game.difficulty && (
        <ResultModal
          open={game.showResult}
          status={game.status}
          answerWord={game.answerWord}
          answerJamo={game.answerJamo}
          definition={game.definition}
          rows={game.rows}
          seconds={game.seconds}
          dateKey={game.dateKey}
          difficulty={game.difficulty}
          wordLength={game.wordLength}
          recordSaved={game.recordSaved}
          onRecordSaved={game.markRecordSaved}
          onNextRound={game.nextRound}
          onOpenHistory={() => setHistoryOpen(true)}
          onClose={() => game.setShowResult(false)}
        />
      )}
    </div>
  )
}

function HelpIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden>
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.8" />
      <path
        d="M9.8 9.4a2.4 2.4 0 1 1 3.5 2.1c-.7.4-1.1.9-1.1 1.7V14"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
      <circle cx="12" cy="17" r="1" fill="currentColor" />
    </svg>
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
