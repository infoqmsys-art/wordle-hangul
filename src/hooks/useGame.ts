import { useCallback, useEffect, useState } from 'react'
import {
  DIFFICULTY_META,
  findWordByJamo,
  isValidGuess,
  loadDictionary,
  pickRandomAnswer,
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
import { normalizeInput } from '../lib/hangul'
import { playLoseSound, playWinSound } from '../lib/sfx'
import { recordPersonalResult } from '../lib/stats'
import { lookupStdict } from '../lib/stdict'

export const MAX_ATTEMPTS = 5

export type Row = {
  jamo: string[]
  statuses: TileStatus[]
}

type Persisted = {
  difficulty: Difficulty
  answerWord: string
  answerJamo: string[]
  guesses: string[][]
  status: 'playing' | 'won' | 'lost'
  startedAt: number | null
  finishedAt: number | null
  recordSaved: boolean
  statsRecorded?: boolean
}

const SESSION_KEY = 'wordle-hangul-session-v5'
const RECENT_KEY = 'wordle-hangul-recent-v5'
const DIFF_KEY = 'wordle-hangul-difficulty'
const RECENT_LIMIT = 40

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

export function useGame() {
  const dateKey = formatDateKey()
  const [dict, setDict] = useState<Dictionary | null>(null)
  const [dictError, setDictError] = useState<string | null>(null)
  const [difficulty, setDifficulty] = useState<Difficulty | null>(null)
  const [answerEntry, setAnswerEntry] = useState<WordEntry | null>(null)
  const [rows, setRows] = useState<Row[]>([])
  const [current, setCurrent] = useState<string[]>([])
  const [status, setStatus] = useState<'playing' | 'won' | 'lost'>('playing')
  const [shake, setShake] = useState(false)
  const [toast, setToast] = useState<string | null>(null)
  const [revealingRow, setRevealingRow] = useState<number | null>(null)
  const [showResult, setShowResult] = useState(false)
  const [definition, setDefinition] = useState<string | null>(null)
  const [keyStatuses, setKeyStatuses] = useState<Record<string, KeyStatus>>({})
  const [startedAt, setStartedAt] = useState<number | null>(null)
  const [finishedAt, setFinishedAt] = useState<number | null>(null)
  const [recordSaved, setRecordSaved] = useState(false)
  const [statsRecorded, setStatsRecorded] = useState(false)
  const [celebrate, setCelebrate] = useState(false)
  const [tick, setTick] = useState(0)

  const wordLength = difficulty
    ? DIFFICULTY_META[difficulty].wordLength
    : 5

  const applyRound = useCallback(
    (diff: Difficulty, answer: WordEntry, saved?: Persisted | null) => {
      setDifficulty(diff)
      localStorage.setItem(DIFF_KEY, diff)

      if (saved && saved.answerWord === answer.word) {
        const restored = restoreRows(saved.guesses, answer.jamo)
        setAnswerEntry(answer)
        setRows(restored)
        setStatus(saved.status)
        setKeyStatuses(buildKeyStatuses(restored))
        setStartedAt(saved.startedAt)
        setFinishedAt(saved.finishedAt)
        setRecordSaved(saved.recordSaved)
        setStatsRecorded(Boolean(saved.statsRecorded) || saved.status !== 'playing')
        setCelebrate(false)
        setCurrent([])
        setDefinition(null)
        setShowResult(saved.status !== 'playing')
        return
      }

      setAnswerEntry(answer)
      setRows([])
      setCurrent([])
      setStatus('playing')
      setKeyStatuses({})
      setStartedAt(null)
      setFinishedAt(null)
      setRecordSaved(false)
      setStatsRecorded(false)
      setCelebrate(false)
      setDefinition(null)
      setShowResult(false)
      setRevealingRow(null)
    },
    [],
  )

  useEffect(() => {
    let alive = true
    loadDictionary()
      .then((loaded) => {
        if (!alive) return
        setDict(loaded)

        const saved = loadSession()
        if (
          saved?.difficulty &&
          saved.answerWord &&
          saved.answerJamo?.length === DIFFICULTY_META[saved.difficulty].wordLength
        ) {
          applyRound(
            saved.difficulty,
            { word: saved.answerWord, jamo: saved.answerJamo },
            saved,
          )
        }
      })
      .catch((err: unknown) => {
        if (!alive) return
        setDictError(err instanceof Error ? err.message : '사전 로드 실패')
      })
    return () => {
      alive = false
    }
  }, [applyRound])

  useEffect(() => {
    if (!answerEntry || !difficulty) return
    saveSession({
      difficulty,
      answerWord: answerEntry.word,
      answerJamo: answerEntry.jamo,
      guesses: rows.map((r) => r.jamo),
      status,
      startedAt,
      finishedAt,
      recordSaved,
      statsRecorded,
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
  ])

  useEffect(() => {
    if (status !== 'playing' || startedAt == null) return
    const id = window.setInterval(() => setTick((n) => n + 1), 250)
    return () => window.clearInterval(id)
  }, [status, startedAt])

  useEffect(() => {
    if (!answerEntry || (status !== 'won' && status !== 'lost')) return
    lookupStdict(answerEntry.word).then((result) => {
      if (result?.definition) setDefinition(result.definition)
    })
  }, [answerEntry, status])

  const showToast = useCallback((message: string) => {
    setToast(message)
    window.setTimeout(() => setToast(null), 1600)
  }, [])

  const triggerShake = useCallback(() => {
    setShake(true)
    window.setTimeout(() => setShake(false), 500)
  }, [])

  const startDifficulty = useCallback(
    (diff: Difficulty) => {
      if (!dict) return
      clearSession()
      const answer = pickRandomAnswer(dict, diff, loadRecentWords())
      applyRound(diff, answer)
      showToast(
        diff === 'hard' ? '어려움 · 자모 7칸!' : '쉬움 · 자모 5칸!',
      )
    },
    [dict, applyRound, showToast],
  )

  const nextRound = useCallback(() => {
    if (!dict || !difficulty) return
    clearSession()
    const answer = pickRandomAnswer(dict, difficulty, loadRecentWords())
    applyRound(difficulty, answer)
    showToast('다음 문제!')
  }, [dict, difficulty, applyRound, showToast])

  const changeDifficulty = useCallback(() => {
    clearSession()
    setDifficulty(null)
    setAnswerEntry(null)
    setRows([])
    setCurrent([])
    setStatus('playing')
    setShowResult(false)
    setKeyStatuses({})
    setCelebrate(false)
    setStatsRecorded(false)
  }, [])

  const locked =
    !dict ||
    !answerEntry ||
    !difficulty ||
    status !== 'playing' ||
    revealingRow !== null

  const ensureTimer = useCallback(() => {
    setStartedAt((prev) => prev ?? Date.now())
  }, [])

  const finishGame = useCallback(
    (next: 'won' | 'lost', message: string, word: string, attempts: number) => {
      const end = Date.now()
      setFinishedAt(end)
      setStatus(next)
      pushRecentWord(word)
      showToast(message)

      const elapsed =
        startedAt == null ? 0 : Math.max(0, (end - startedAt) / 1000)

      setStatsRecorded((already) => {
        if (!already) {
          recordPersonalResult({
            won: next === 'won',
            attempts,
            seconds: elapsed,
          })
        }
        return true
      })

      if (next === 'won') {
        setCelebrate(true)
        playWinSound()
        window.setTimeout(() => setCelebrate(false), 2200)
      } else {
        playLoseSound()
      }

      window.setTimeout(() => setShowResult(true), next === 'won' ? 900 : 400)
    },
    [showToast, startedAt],
  )

  const onKey = useCallback(
    (key: string) => {
      if (locked || !dict || !answerEntry) return

      if (key === 'Backspace') {
        setCurrent((prev) => prev.slice(0, -1))
        return
      }

      if (key === 'Enter') {
        if (current.length !== wordLength) {
          showToast(`자모 ${wordLength}개를 입력해 주세요`)
          triggerShake()
          return
        }
        if (!isValidGuess(dict, current)) {
          showToast('사전에 없는 단어예요')
          triggerShake()
          return
        }

        const statuses = evaluateGuess(current, answerEntry.jamo)
        const nextRow: Row = { jamo: [...current], statuses }
        const rowIndex = rows.length
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
        const next = [...prev]
        for (const part of parts) {
          if (next.length >= wordLength) break
          next.push(part)
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
    ready: Boolean(dict && answerEntry && difficulty),
    needDifficulty: Boolean(dict) && !difficulty,
    dictError,
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
    showResult,
    setShowResult,
    answerWord,
    answerJamo: answerEntry?.jamo ?? [],
    definition,
    onKey,
    attemptsUsed: rows.length,
    seconds,
    dateKey,
    recordSaved,
    markRecordSaved: () => setRecordSaved(true),
    nextRound,
    startDifficulty,
    changeDifficulty,
    celebrate,
  }
}
