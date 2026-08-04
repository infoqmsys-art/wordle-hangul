import { useCallback, useEffect, useState } from 'react'
import {
  DIFFICULTY_META,
  findWordByJamo,
  isValidGuess,
  loadDictionary,
  pickDailyAnswer,
  pickPracticeAnswer,
  type Difficulty,
  type Dictionary,
  type WordEntry,
} from '../data/words'
import {
  evaluateGuess,
  formatDateKey,
  mergeKeyStatus,
  type KeyStatus,
  type TileStatus,
} from '../lib/game'
import {
  clearChallengeFromUrl,
  findChallengeEntry,
  readChallengeFromUrl,
} from '../lib/challenge'
import { isDailyDone, markDailyDone } from '../lib/dailyLock'
import { normalizeInput } from '../lib/hangul'
import { playLoseSound, playWinSound } from '../lib/sfx'
import { getPersonalStats, recordPersonalResult } from '../lib/stats'
import { lookupStdict } from '../lib/stdict'

export const MAX_ATTEMPTS = 5

export type PlayMode = 'daily' | 'practice'

export type Row = {
  jamo: string[]
  statuses: TileStatus[]
}

/** 현재 입력줄을 고정 길이로 맞춤 (빈 칸은 '') */
function padRow(prev: string[], len: number): string[] {
  return Array.from({ length: len }, (_, i) => prev[i] ?? '')
}

/** 힌트 칸을 잠근 채, 기존 입력을 빈 칸에 다시 배치 */
function rowWithLockedHint(
  prev: string[],
  len: number,
  hintCol: number,
  hintCh: string,
): string[] {
  const padded = padRow(prev, len)
  // 힌트 적용 전은 앞에서부터 packed 입력일 수 있음 → 전체를 재배치 큐로
  const packed = prev.length > 0 && prev.length <= len && prev.every(Boolean)
  const queue = packed
    ? [...prev]
    : padded.filter((ch, i) => Boolean(ch) && i !== hintCol)
  const next = Array.from({ length: len }, () => '')
  next[hintCol] = hintCh
  let qi = 0
  for (let i = 0; i < len; i++) {
    if (i === hintCol) continue
    if (qi < queue.length) next[i] = queue[qi++]!
  }
  return next
}

type Persisted = {
  playMode: PlayMode
  dateKey: string
  difficulty: Difficulty
  answerWord: string
  answerJamo: string[]
  guesses: string[][]
  status: 'playing' | 'won' | 'lost'
  startedAt: number | null
  finishedAt: number | null
  recordSaved: boolean
  statsRecorded?: boolean
  /** 힌트로 공개된 칸 [행][열] */
  hintGrid?: (string | null)[][]
}

const SESSION_KEY = 'wordle-hangul-session-v8'

function emptyHintGrid(cols: number): (string | null)[][] {
  return Array.from({ length: MAX_ATTEMPTS }, () =>
    Array.from({ length: cols }, () => null),
  )
}

function normalizeHintGrid(
  raw: unknown,
  cols: number,
): (string | null)[][] {
  if (!Array.isArray(raw) || raw.length !== MAX_ATTEMPTS) {
    return emptyHintGrid(cols)
  }
  return raw.map((row) => {
    if (!Array.isArray(row) || row.length !== cols) {
      return Array.from({ length: cols }, () => null)
    }
    return row.map((ch) => (typeof ch === 'string' && ch ? ch : null))
  })
}
const RECENT_KEY = 'wordle-hangul-recent-v5'
const DIFF_KEY = 'wordle-hangul-difficulty'
const MODE_KEY = 'wordle-hangul-play-mode'
/** 덱을 다시 섞을 때 최근에 본 단어를 뒤로 보내기 위한 기록 길이 */
const RECENT_LIMIT = 120

function loadSession(): Persisted | null {
  try {
    const raw = localStorage.getItem(SESSION_KEY)
    if (!raw) return null
    return JSON.parse(raw) as Persisted
  } catch {
    return null
  }
}

function saveSession(data: Persisted) {
  localStorage.setItem(SESSION_KEY, JSON.stringify(data))
}

function clearSession() {
  localStorage.removeItem(SESSION_KEY)
}

function loadRecentWords(): string[] {
  try {
    const raw = localStorage.getItem(RECENT_KEY)
    if (!raw) return []
    const list = JSON.parse(raw) as string[]
    return Array.isArray(list) ? list : []
  } catch {
    return []
  }
}

function pushRecentWord(word: string) {
  const next = [word, ...loadRecentWords().filter((w) => w !== word)].slice(
    0,
    RECENT_LIMIT,
  )
  localStorage.setItem(RECENT_KEY, JSON.stringify(next))
}

function restoreRows(guesses: string[][], answerJamo: string[]): Row[] {
  return guesses.map((guess) => ({
    jamo: guess,
    statuses: evaluateGuess(guess, answerJamo),
  }))
}

function buildKeyStatuses(rows: Row[]): Record<string, KeyStatus> {
  const map: Record<string, KeyStatus> = {}
  for (const row of rows) {
    row.jamo.forEach((ch, i) => {
      map[ch] = mergeKeyStatus(map[ch] ?? 'unused', row.statuses[i])
    })
  }
  return map
}

function isValidSavedSession(
  saved: Persisted,
  today: string,
): boolean {
  if (!saved.difficulty || !saved.answerWord || !saved.answerJamo?.length) {
    return false
  }
  if (
    saved.answerJamo.length !== DIFFICULTY_META[saved.difficulty].wordLength
  ) {
    return false
  }
  if (saved.playMode === 'daily' && saved.dateKey !== today) return false
  return true
}

export function useGame() {
  const dateKey = formatDateKey()
  const [dict, setDict] = useState<Dictionary | null>(null)
  const [dictError, setDictError] = useState<string | null>(null)
  const [playMode, setPlayMode] = useState<PlayMode | null>(null)
  const [difficulty, setDifficulty] = useState<Difficulty | null>(null)
  const [answerEntry, setAnswerEntry] = useState<WordEntry | null>(null)
  const [rows, setRows] = useState<Row[]>([])
  const [current, setCurrent] = useState<string[]>([])
  const [status, setStatus] = useState<'playing' | 'won' | 'lost'>('playing')
  const [shake, setShake] = useState(false)
  const [toast, setToast] = useState<string | null>(null)
  const [revealingRow, setRevealingRow] = useState<number | null>(null)
  const [definition, setDefinition] = useState<string | null>(null)
  const [keyStatuses, setKeyStatuses] = useState<Record<string, KeyStatus>>({})
  const [startedAt, setStartedAt] = useState<number | null>(null)
  const [finishedAt, setFinishedAt] = useState<number | null>(null)
  const [recordSaved, setRecordSaved] = useState(false)
  const [statsRecorded, setStatsRecorded] = useState(false)
  const [celebrate, setCelebrate] = useState(false)
  const [currentStreak, setCurrentStreak] = useState(
    () => getPersonalStats().currentStreak,
  )
  const [challengeMode, setChallengeMode] = useState(false)
  const [tick, setTick] = useState(0)
  const [hintGrid, setHintGrid] = useState<(string | null)[][]>(() =>
    emptyHintGrid(5),
  )

  const wordLength = difficulty
    ? DIFFICULTY_META[difficulty].wordLength
    : 5

  const applyRound = useCallback(
    (
      mode: PlayMode,
      diff: Difficulty,
      answer: WordEntry,
      saved?: Persisted | null,
    ) => {
      setPlayMode(mode)
      setDifficulty(diff)
      localStorage.setItem(DIFF_KEY, diff)
      localStorage.setItem(MODE_KEY, mode)
      const cols = answer.jamo.length

      if (saved && saved.answerWord === answer.word) {
        const restored = restoreRows(saved.guesses, answer.jamo)
        setAnswerEntry(answer)
        setRows(restored)
        setStatus(saved.status)
        const grid = normalizeHintGrid(saved.hintGrid, cols)
        setHintGrid(grid)
        const keys = buildKeyStatuses(restored)
        grid.forEach((row) => {
          row.forEach((ch) => {
            if (ch) keys[ch] = mergeKeyStatus(keys[ch] ?? 'unused', 'hint')
          })
        })
        setKeyStatuses(keys)
        setStartedAt(saved.startedAt)
        setFinishedAt(saved.finishedAt)
        setRecordSaved(saved.recordSaved)
        setStatsRecorded(
          Boolean(saved.statsRecorded) || saved.status !== 'playing',
        )
        setCelebrate(false)
        setCurrentStreak(getPersonalStats().currentStreak)
        if (saved.status === 'playing') {
          const hintRow = grid[restored.length] ?? []
          setCurrent(
            Array.from({ length: cols }, (_, i) => hintRow[i] ?? ''),
          )
        } else {
          setCurrent([])
        }
        setDefinition(null)
        return
      }

      setAnswerEntry(answer)
      setRows([])
      setCurrent([])
      setStatus('playing')
      setKeyStatuses({})
      setHintGrid(emptyHintGrid(cols))
      setStartedAt(null)
      setFinishedAt(null)
      setRecordSaved(false)
      setStatsRecorded(false)
      setCelebrate(false)
      setCurrentStreak(getPersonalStats().currentStreak)
      setDefinition(null)
      setRevealingRow(null)
    },
    [],
  )

  const showToast = useCallback((message: string) => {
    setToast(message)
    window.setTimeout(() => setToast(null), 1800)
  }, [])

  useEffect(() => {
    let alive = true
    loadDictionary()
      .then((loaded) => {
        if (!alive) return
        setDict(loaded)

        const challenge = readChallengeFromUrl()
        if (challenge) {
          const entry = findChallengeEntry(loaded, challenge)
          clearChallengeFromUrl()
          if (entry) {
            clearSession()
            setChallengeMode(true)
            applyRound('practice', challenge.difficulty, entry)
            showToast('친구가 보낸 도전!')
            return
          }
          showToast('도전 링크를 열 수 없어요')
        }

        const saved = loadSession()
        if (saved && isValidSavedSession(saved, formatDateKey())) {
          const mode = saved.playMode === 'daily' ? 'daily' : 'practice'
          // 데일리 정답이 바뀌었으면 이전 세션 폐기
          if (
            mode === 'daily' &&
            saved.answerWord !==
              pickDailyAnswer(loaded, saved.difficulty).word
          ) {
            clearSession()
          } else {
            applyRound(
              mode,
              saved.difficulty,
              { word: saved.answerWord, jamo: saved.answerJamo },
              saved,
            )
          }
        } else if (saved) {
          clearSession()
        }
      })
      .catch((err: unknown) => {
        if (!alive) return
        setDictError(err instanceof Error ? err.message : '사전 로드 실패')
      })
    return () => {
      alive = false
    }
  }, [applyRound, showToast])

  useEffect(() => {
    if (!answerEntry || !difficulty || !playMode) return
    saveSession({
      playMode,
      dateKey,
      difficulty,
      answerWord: answerEntry.word,
      answerJamo: answerEntry.jamo,
      guesses: rows.map((r) => r.jamo),
      status,
      startedAt,
      finishedAt,
      recordSaved,
      statsRecorded,
      hintGrid,
    })
  }, [
    rows,
    status,
    answerEntry,
    startedAt,
    finishedAt,
    recordSaved,
    statsRecorded,
    difficulty,
    playMode,
    dateKey,
    hintGrid,
  ])

  useEffect(() => {
    if (status !== 'playing' || startedAt == null) return
    const id = window.setInterval(() => setTick((n) => n + 1), 250)
    return () => window.clearInterval(id)
  }, [status, startedAt])

  useEffect(() => {
    if (!answerEntry || (status !== 'won' && status !== 'lost')) return
    // 빌드에 포함된 사전 뜻 우선, 없으면(로컬 등) API 조회
    if (answerEntry.definition) {
      setDefinition(answerEntry.definition)
      return
    }
    const cached = dict
      ? [...dict.answers5, ...dict.answers7].find(
          (a) => a.word === answerEntry.word,
        )?.definition
      : undefined
    if (cached) {
      setDefinition(cached)
      return
    }
    lookupStdict(answerEntry.word).then((result) => {
      if (result?.definition) setDefinition(result.definition)
    })
  }, [answerEntry, status, dict])

  const triggerShake = useCallback(() => {
    setShake(true)
    window.setTimeout(() => setShake(false), 500)
  }, [])

  const startGame = useCallback(
    async (mode: PlayMode, diff: Difficulty) => {
      let loaded = dict
      if (!loaded) {
        try {
          loaded = await loadDictionary()
          setDict(loaded)
          setDictError(null)
        } catch (err: unknown) {
          const message =
            err instanceof Error ? err.message : '사전을 불러오지 못했어요'
          setDictError(message)
          showToast(message)
          return
        }
      }
      if (mode === 'daily' && isDailyDone(diff)) {
        showToast('오늘은 이미 플레이했어요')
        return
      }
      clearSession()
      setChallengeMode(false)
      const answer =
        mode === 'daily'
          ? pickDailyAnswer(loaded, diff)
          : pickPracticeAnswer(loaded, diff, loadRecentWords())
      applyRound(mode, diff, answer)
      if (mode === 'practice') pushRecentWord(answer.word)
      if (mode === 'daily') {
        showToast(
          diff === 'hard' ? '오늘의 단어 · 어려움' : '오늘의 단어 · 쉬움',
        )
      } else {
        showToast(diff === 'hard' ? '메인게임 · 어려움' : '메인게임 · 쉬움')
      }
    },
    [dict, applyRound, showToast],
  )

  const nextRound = useCallback(() => {
    if (!dict || !difficulty) return
    clearSession()
    setChallengeMode(false)
    // 오늘의 단어가 끝나면 같은 난이도 메인게임으로 이어감
    const answer = pickPracticeAnswer(dict, difficulty, loadRecentWords())
    applyRound('practice', difficulty, answer)
    pushRecentWord(answer.word)
    showToast(playMode === 'daily' ? '메인게임으로 이어갈게요!' : '다음 문제!')
  }, [dict, difficulty, playMode, applyRound, showToast])

  const changeMode = useCallback(() => {
    clearSession()
    setChallengeMode(false)
    setPlayMode(null)
    setDifficulty(null)
    setAnswerEntry(null)
    setRows([])
    setCurrent([])
    setStatus('playing')
    setKeyStatuses({})
    setHintGrid(emptyHintGrid(5))
    setCelebrate(false)
    setStatsRecorded(false)
  }, [])

  const refreshStreak = useCallback(() => {
    setCurrentStreak(getPersonalStats().currentStreak)
  }, [])

  const markRecordSaved = useCallback(() => {
    setRecordSaved(true)
  }, [])

  const locked =
    !dict ||
    !answerEntry ||
    !difficulty ||
    !playMode ||
    status !== 'playing' ||
    revealingRow !== null

  const ensureTimer = useCallback(() => {
    setStartedAt((prev) => prev ?? Date.now())
  }, [])

  /** 한 판에 힌트 1회만 */
  const hintUsedThisGame = hintGrid.some((row) => row.some((ch) => Boolean(ch)))

  /** 힌트: 지금 풀고 있는 줄 · 아직 안 쓴 판만 */
  const canHintAt = useCallback(
    (row: number, col: number): boolean => {
      if (!answerEntry || status !== 'playing') return false
      if (hintGrid.some((r) => r.some((ch) => Boolean(ch)))) return false
      if (row !== rows.length) return false
      if (col < 0 || col >= answerEntry.jamo.length) return false
      if (hintGrid[row]?.[col]) return false
      return true
    },
    [answerEntry, status, hintGrid, rows.length],
  )

  const hintCandidatesLeft = useCallback((): number => {
    if (!answerEntry || status !== 'playing') return 0
    if (hintGrid.some((r) => r.some((ch) => Boolean(ch)))) return 0
    let n = 0
    const row = rows.length
    for (let c = 0; c < answerEntry.jamo.length; c++) {
      if (canHintAt(row, c)) n += 1
    }
    return n
  }, [answerEntry, status, rows.length, hintGrid, canHintAt])

  /** 선택한 칸에 정답 자모 힌트 표시 */
  const applyHintAt = useCallback(
    (row: number, col: number): string | null => {
      if (!answerEntry || status !== 'playing') return null
      if (hintGrid.some((r) => r.some((ch) => Boolean(ch)))) {
        showToast('이 판에서는 힌트를 이미 썼어요')
        return null
      }
      if (!canHintAt(row, col)) {
        showToast('이 칸에는 힌트를 쓸 수 없어요')
        return null
      }
      const ch = answerEntry.jamo[col]!
      const len = answerEntry.jamo.length
      setHintGrid((prev) => {
        const next = prev.map((r) => [...r])
        while (next.length < MAX_ATTEMPTS) {
          next.push(Array.from({ length: len }, () => null))
        }
        next[row] = next[row] ?? Array.from({ length: len }, () => null)
        next[row]![col] = ch
        return next
      })
      // 힌트 칸은 입력줄에도 고정 — 지우기/덮어쓰기 불가
      setCurrent((prev) => rowWithLockedHint(prev, len, col, ch))
      setKeyStatuses((prev) => ({
        ...prev,
        [ch]: mergeKeyStatus(prev[ch] ?? 'unused', 'hint'),
      }))
      ensureTimer()
      return ch
    },
    [answerEntry, status, hintGrid, canHintAt, showToast, ensureTimer],
  )

  const finishGame = useCallback(
    (next: 'won' | 'lost', message: string, word: string, attempts: number) => {
      const end = Date.now()
      setFinishedAt(end)
      setStatus(next)
      pushRecentWord(word)
      showToast(message)

      if (playMode === 'daily' && difficulty) {
        markDailyDone(difficulty)
      }

      const elapsed =
        startedAt == null ? 0 : Math.max(0, (end - startedAt) / 1000)

      setStatsRecorded((already) => {
        if (!already) {
          const stats = recordPersonalResult({
            won: next === 'won',
            attempts,
            seconds: elapsed,
          })
          setCurrentStreak(stats.currentStreak)
        }
        return true
      })

      if (next === 'won') {
        setCelebrate(true)
        playWinSound()
        window.setTimeout(() => setCelebrate(false), 2600)
      } else {
        setCurrentStreak(0)
        playLoseSound()
      }
    },
    [showToast, startedAt, playMode, difficulty],
  )

  /** 플레이 중 포기 → 정답 공개 + 패배 처리 */
  const giveUp = useCallback(() => {
    if (status !== 'playing' || !answerEntry || locked) return
    finishGame(
      'lost',
      `정답은 ${answerEntry.word}`,
      answerEntry.word,
      Math.max(1, rows.length),
    )
  }, [status, answerEntry, locked, rows.length, finishGame])

  const onKey = useCallback(
    (key: string) => {
      if (locked || !dict || !answerEntry) return

      const rowIndex = rows.length
      const hintRow = hintGrid[rowIndex] ?? []
      const guess = padRow(current, wordLength)

      if (key === 'Backspace') {
        setCurrent((prev) => {
          const next = padRow(prev, wordLength)
          for (let i = wordLength - 1; i >= 0; i--) {
            if (hintRow[i]) continue // 힌트 칸 고정
            if (next[i]) {
              next[i] = ''
              break
            }
          }
          return next
        })
        return
      }

      if (key === 'Enter') {
        if (guess.some((ch) => !ch)) {
          showToast(`자모 ${wordLength}개를 입력해 주세요`)
          triggerShake()
          return
        }
        // 힌트 칸은 정답 자모로 확정
        for (let i = 0; i < wordLength; i++) {
          const hintCh = hintRow[i]
          if (hintCh) guess[i] = hintCh
        }
        if (!isValidGuess(dict, guess)) {
          showToast('사전에 없는 단어예요')
          triggerShake()
          return
        }

        const statuses = evaluateGuess(guess, answerEntry.jamo)
        const nextRow: Row = { jamo: [...guess], statuses }
        const won = statuses.every((s) => s === 'correct')
        const word = answerEntry.word

        setRows((prev) => [...prev, nextRow])
        setKeyStatuses((prev) => {
          const next = { ...prev }
          nextRow.jamo.forEach((ch, i) => {
            next[ch] = mergeKeyStatus(next[ch] ?? 'unused', statuses[i])
          })
          return next
        })
        setCurrent([])
        setRevealingRow(rowIndex)

        window.setTimeout(() => {
          setRevealingRow(null)
          if (won) finishGame('won', '정답!', word, rowIndex + 1)
          else if (rowIndex + 1 >= MAX_ATTEMPTS) {
            finishGame('lost', `정답은 ${word}`, word, rowIndex + 1)
          }
        }, 180 * wordLength + 120)
        return
      }

      const parts = normalizeInput(key)
      if (parts.length === 0) return
      ensureTimer()
      setCurrent((prev) => {
        const next = padRow(prev, wordLength)
        // 힌트 칸이 비어 보이면 안 되므로 잠금 문자 유지
        for (let i = 0; i < wordLength; i++) {
          if (hintRow[i]) next[i] = hintRow[i]!
        }
        for (const part of parts) {
          const idx = next.findIndex((ch, i) => !ch && !hintRow[i])
          if (idx === -1) break
          next[idx] = part
        }
        return next
      })
    },
    [
      locked,
      dict,
      answerEntry,
      current,
      rows.length,
      wordLength,
      hintGrid,
      showToast,
      triggerShake,
      ensureTimer,
      finishGame,
    ],
  )

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey || e.altKey) return

      const target = e.target
      if (
        target instanceof HTMLElement &&
        (target.tagName === 'INPUT' ||
          target.tagName === 'TEXTAREA' ||
          target.isContentEditable ||
          target.closest('input, textarea, [contenteditable="true"]'))
      ) {
        return
      }

      if (e.key === 'Backspace') {
        e.preventDefault()
        onKey('Backspace')
      } else if (e.key === 'Enter') {
        e.preventDefault()
        onKey('Enter')
      } else if (e.key.length === 1) {
        const parts = normalizeInput(e.key)
        if (parts.length > 0) {
          e.preventDefault()
          onKey(e.key)
        }
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [onKey])

  const answerWord = answerEntry
    ? findWordByJamo(dict!, answerEntry.jamo) ?? answerEntry.word
    : ''

  void tick
  const seconds =
    startedAt == null
      ? 0
      : Math.max(0, ((finishedAt ?? Date.now()) - startedAt) / 1000)

  return {
    startedAt,
    dictReady: Boolean(dict),
    ready: Boolean(dict && answerEntry && difficulty && playMode),
    needMode: !difficulty || !playMode,
    dictError,
    playMode,
    difficulty,
    wordLength,
    guessCount: dict ? Object.keys(dict.guesses).length : 0,
    answerCount: dict
      ? difficulty === 'hard'
        ? dict.answers7.length
        : dict.answers5.length
      : 0,
    rows,
    current,
    status,
    keyStatuses,
    shake,
    toast,
    revealingRow,
    answerWord,
    answerJamo: answerEntry?.jamo ?? [],
    definition,
    onKey,
    attemptsUsed: rows.length,
    seconds,
    dateKey,
    recordSaved,
    markRecordSaved,
    statsRecorded,
    nextRound,
    startGame,
    changeMode,
    giveUp,
    refreshStreak,
    celebrate,
    currentStreak,
    challengeMode,
    hintGrid,
    hintUsedThisGame,
    canHintAt,
    hintCandidatesLeft,
    applyHintAt,
  }
}
