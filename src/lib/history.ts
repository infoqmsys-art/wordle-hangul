import {
  addDoc,
  collection,
  getDocs,
  limit,
  orderBy,
  query,
  serverTimestamp,
} from 'firebase/firestore'
import type { Difficulty } from '../data/words'
import { getDb, isFirebaseConfigured } from './firebase'

export type HistoryRecord = {
  id: string
  name: string
  word: string
  seconds: number
  attempts: number
  maxAttempts: number
  won: boolean
  dateKey: string
  savedAt: number
  difficulty: Difficulty
  wordLength: number
}

export type RankMode = 'wins' | 'fastest' | 'attempts'

export type RankEntry = {
  name: string
  /** 표시용 점수 숫자 (승수 / 초 / 시도) */
  score: number
  scoreLabel: string
  wins: number
  lastSavedAt: number
}

const LAST_NAME_KEY = 'wordle-hangul-last-name'
const MAX_RECORDS = 200
const COLLECTION = 'records'

export function isSharedHistoryEnabled(): boolean {
  return isFirebaseConfigured()
}

function isWon(value: unknown): boolean {
  return value === true || value === 1 || value === 'true' || value === '1'
}

function parseRecord(id: string, data: Record<string, unknown>): HistoryRecord {
  const wordLength = Number(data.wordLength ?? 5)
  const difficulty = (
    data.difficulty === 'hard' || wordLength === 7 ? 'hard' : 'easy'
  ) as Difficulty
  return {
    id,
    name: String(data.name ?? ''),
    word: String(data.word ?? ''),
    seconds: Number(data.seconds ?? 0),
    attempts: Number(data.attempts ?? 0),
    maxAttempts: Number(data.maxAttempts ?? 5),
    won: isWon(data.won),
    dateKey: String(data.dateKey ?? ''),
    savedAt: Number(data.savedAt ?? Date.now()),
    difficulty,
    wordLength,
  }
}

export async function loadHistory(): Promise<HistoryRecord[]> {
  if (!isFirebaseConfigured()) return []

  const q = query(
    collection(getDb(), COLLECTION),
    orderBy('savedAt', 'desc'),
    limit(MAX_RECORDS),
  )
  const snap = await getDocs(q)
  return snap.docs.map((d) => parseRecord(d.id, d.data() as Record<string, unknown>))
}

type Agg = {
  name: string
  wins: number
  lastSavedAt: number
  bestSeconds: number
  bestAttempts: number
  bestAttemptsSeconds: number
}

async function fetchRecordsSnap() {
  try {
    return await getDocs(
      query(
        collection(getDb(), COLLECTION),
        orderBy('savedAt', 'desc'),
        limit(1000),
      ),
    )
  } catch {
    // savedAt 인덱스가 없거나 일부 문서에 필드가 없어도 랭킹은 보이게
    return await getDocs(query(collection(getDb(), COLLECTION), limit(1000)))
  }
}

async function loadWinRecords(difficulty: Difficulty): Promise<Agg[]> {
  const snap = await fetchRecordsSnap()

  const map = new Map<string, Agg>()
  for (const d of snap.docs) {
    const r = parseRecord(d.id, d.data() as Record<string, unknown>)
    if (!r.won) continue
    if (r.difficulty !== difficulty) continue
    const name = r.name.trim()
    if (!name) continue

    const prev = map.get(name)
    if (!prev) {
      map.set(name, {
        name,
        wins: 1,
        lastSavedAt: r.savedAt,
        bestSeconds: r.seconds,
        bestAttempts: r.attempts,
        bestAttemptsSeconds: r.seconds,
      })
      continue
    }

    prev.wins += 1
    prev.lastSavedAt = Math.max(prev.lastSavedAt, r.savedAt)
    if (r.seconds < prev.bestSeconds) prev.bestSeconds = r.seconds
    if (
      r.attempts < prev.bestAttempts ||
      (r.attempts === prev.bestAttempts && r.seconds < prev.bestAttemptsSeconds)
    ) {
      prev.bestAttempts = r.attempts
      prev.bestAttemptsSeconds = r.seconds
    }
  }

  return [...map.values()]
}

/** records 성공 기록을 이름별로 집계한 랭킹 */
export async function loadRanking(
  difficulty: Difficulty,
  mode: RankMode = 'wins',
): Promise<RankEntry[]> {
  if (!isFirebaseConfigured()) return []

  const list = await loadWinRecords(difficulty)

  if (mode === 'fastest') {
    return list
      .sort((a, b) => {
        if (a.bestSeconds !== b.bestSeconds) return a.bestSeconds - b.bestSeconds
        if (b.wins !== a.wins) return b.wins - a.wins
        return b.lastSavedAt - a.lastSavedAt
      })
      .slice(0, 50)
      .map((r) => ({
        name: r.name,
        score: r.bestSeconds,
        scoreLabel: formatSeconds(r.bestSeconds),
        wins: r.wins,
        lastSavedAt: r.lastSavedAt,
      }))
  }

  if (mode === 'attempts') {
    return list
      .sort((a, b) => {
        if (a.bestAttempts !== b.bestAttempts) {
          return a.bestAttempts - b.bestAttempts
        }
        if (a.bestAttemptsSeconds !== b.bestAttemptsSeconds) {
          return a.bestAttemptsSeconds - b.bestAttemptsSeconds
        }
        return b.lastSavedAt - a.lastSavedAt
      })
      .slice(0, 50)
      .map((r) => ({
        name: r.name,
        score: r.bestAttempts,
        scoreLabel: `${r.bestAttempts}회`,
        wins: r.wins,
        lastSavedAt: r.lastSavedAt,
      }))
  }

  return list
    .sort((a, b) => {
      if (b.wins !== a.wins) return b.wins - a.wins
      return b.lastSavedAt - a.lastSavedAt
    })
    .slice(0, 50)
    .map((r) => ({
      name: r.name,
      score: r.wins,
      scoreLabel: `${r.wins}승`,
      wins: r.wins,
      lastSavedAt: r.lastSavedAt,
    }))
}

export async function saveHistoryRecord(
  record: Omit<HistoryRecord, 'id' | 'savedAt'>,
): Promise<HistoryRecord> {
  if (!isFirebaseConfigured()) {
    throw new Error('공유 기록이 아직 설정되지 않았어요')
  }

  const savedAt = Date.now()
  const name = record.name.trim().slice(0, 20)
  const payload = {
    name,
    word: record.word,
    seconds: Math.max(0, Math.round(record.seconds)),
    attempts: record.attempts,
    maxAttempts: record.maxAttempts,
    won: record.won,
    dateKey: record.dateKey,
    difficulty: record.difficulty,
    wordLength: record.wordLength,
    savedAt,
    createdAt: serverTimestamp(),
  }

  const ref = await addDoc(collection(getDb(), COLLECTION), payload)
  localStorage.setItem(LAST_NAME_KEY, name)

  return {
    id: ref.id,
    ...payload,
  }
}

export function getLastName(): string {
  return localStorage.getItem(LAST_NAME_KEY) ?? ''
}

export function formatSeconds(total: number): string {
  const s = Math.max(0, Math.round(total))
  const m = Math.floor(s / 60)
  const r = s % 60
  if (m <= 0) return `${r}초`
  return `${m}분 ${r}초`
}

export function formatRecordDate(ts: number): string {
  const d = new Date(ts)
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  const dd = String(d.getDate()).padStart(2, '0')
  const hh = String(d.getHours()).padStart(2, '0')
  const mi = String(d.getMinutes()).padStart(2, '0')
  return `${mm}.${dd} ${hh}:${mi}`
}
