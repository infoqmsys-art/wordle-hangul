import { useCallback, useEffect, useState } from 'react'
import {
  findWordByJamo,
  getAnswerByIndex,
  isValidGuess,
  loadDictionary,
  type Dictionary,
  type WordEntry,
} from '../data/words'
import {
  dailyIndex,
  evaluateGuess,
  formatDateKey,
  mergeKeyStatus,
  type KeyStatus,
  type TileStatus,
} from '../lib/game'
import { normalizeInput } from '../lib/hangul'
import { lookupStdict } from '../lib/stdict'

export const MAX_ATTEMPTS = 4
export const WORD_LENGTH = 5

export type Row = {
  jamo: string[]
  statuses: TileStatus[]
}

type Persisted = {
  dateKey: string
  guesses: string[][]
  status: 'playing' | 'won' | 'lost'
}

const STORAGE_KEY = 'wordle-hangul-daily-v2'

function loadPersisted(dateKey: string): Persisted | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    const data = JSON.parse(raw) as Persisted
    if (data.dateKey !== dateKey) return null
    return data
  } catch {
    return null
  }
}

function savePersisted(data: Persisted) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data))
}

export function useGame() {
  const dateKey = formatDateKey()
  const [dict, setDict] = useState<Dictionary | null>(null)
  const [dictError, setDictError] = useState<string | null>(null)
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

  useEffect(() => {
    let alive = true
    loadDictionary()
      .then((loaded) => {
        if (!alive) return
        const answer = getAnswerByIndex(
          loaded,
          dailyIndex(loaded.answers.length),
        )
        const saved = loadPersisted(dateKey)
        const restoredRows =
          saved?.guesses.map((guess) => ({
            jamo: guess,
            statuses: evaluateGuess(guess, answer.jamo),
          })) ?? []

        const map: Record<string, KeyStatus> = {}
        for (const row of restoredRows) {
          row.jamo.forEach((ch, i) => {
            map[ch] = mergeKeyStatus(map[ch] ?? 'unused', row.statuses[i])
          })
        }

        setDict(loaded)
        setAnswerEntry(answer)
        setRows(restoredRows)
        setStatus(saved?.status ?? 'playing')
        setKeyStatuses(map)
        if (saved?.status && saved.status !== 'playing') {
          setShowResult(true)
        }
      })
      .catch((err: unknown) => {
        if (!alive) return
        setDictError(err instanceof Error ? err.message : '사전 로드 실패')
      })
    return () => {
      alive = false
    }
  }, [dateKey])

  useEffect(() => {
    if (!answerEntry) return
    if (rows.length === 0 && status === 'playing') return
    savePersisted({
      dateKey,
      guesses: rows.map((r) => r.jamo),
      status,
    })
  }, [rows, status, dateKey, answerEntry])

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

  const locked =
    !dict || !answerEntry || status !== 'playing' || revealingRow !== null

  const onKey = useCallback(
    (key: string) => {
      if (locked || !dict || !answerEntry) return

      if (key === 'Backspace') {
        setCurrent((prev) => prev.slice(0, -1))
        return
      }

      if (key === 'Enter') {
        if (current.length !== WORD_LENGTH) {
          showToast('자모 5개를 입력해 주세요')
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
          if (won) {
            setStatus('won')
            showToast('정답!')
            window.setTimeout(() => setShowResult(true), 400)
          } else if (rowIndex + 1 >= MAX_ATTEMPTS) {
            setStatus('lost')
            showToast(`정답은 ${answerEntry.word}`)
            window.setTimeout(() => setShowResult(true), 400)
          }
        }, 180 * WORD_LENGTH + 120)
        return
      }

      const parts = normalizeInput(key)
      if (parts.length === 0) return
      setCurrent((prev) => {
        const next = [...prev]
        for (const part of parts) {
          if (next.length >= WORD_LENGTH) break
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
      showToast,
      triggerShake,
    ],
  )

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey || e.altKey) return
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

  return {
    ready: Boolean(dict && answerEntry),
    dictError,
    dictSource: dict?.source ?? '',
    guessCount: dict ? Object.keys(dict.guesses).length : 0,
    answerCount: dict?.answers.length ?? 0,
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
  }
}
