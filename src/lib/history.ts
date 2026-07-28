import {
  addDoc,
  collection,
  doc,
  getDocs,
  increment,
  limit,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  where,
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

export type RankEntry = {
  name: string
  wins: number
  lastSavedAt: number
}

const LAST_NAME_KEY = 'wordle-hangul-last-name'
const MAX_RECORDS = 200
const COLLECTION = 'records'
const RANK_COLLECTION = 'rankStats'

export function isSharedHistoryEnabled(): boolean {
  return isFirebaseConfigured()
}

export async function loadHistory(): Promise<HistoryRecord[]> {
  if (!isFirebaseConfigured()) return []

  const q = query(
    collection(getDb(), COLLECTION),
    orderBy('savedAt', 'desc'),
    limit(MAX_RECORDS),
  )
  const snap = await getDocs(q)
  return snap.docs.map((d) => {
    const data = d.data()
    const wordLength = Number(data.wordLength ?? 5)
    return {
      id: d.id,
      name: String(data.name ?? ''),
      word: String(data.word ?? ''),
      seconds: Number(data.seconds ?? 0),
      attempts: Number(data.attempts ?? 0),
      maxAttempts: Number(data.maxAttempts ?? 5),
      won: Boolean(data.won),
      dateKey: String(data.dateKey ?? ''),
      savedAt: Number(data.savedAt ?? Date.now()),
      difficulty: (data.difficulty === 'hard' || wordLength === 7
        ? 'hard'
        : 'easy') as Difficulty,
      wordLength,
    }
  })
}

export async function loadRanking(difficulty: Difficulty): Promise<RankEntry[]> {
  if (!isFirebaseConfigured()) return []

  const q = query(
    collection(getDb(), RANK_COLLECTION),
    where('difficulty', '==', difficulty),
    orderBy('wins', 'desc'),
    limit(50),
  )

  try {
    const snap = await getDocs(q)
    return snap.docs
      .map((d) => {
        const data = d.data()
        return {
          name: String(data.name ?? ''),
          wins: Number(data.wins ?? 0),
          lastSavedAt: Number(data.lastSavedAt ?? 0),
        }
      })
      .filter((r) => r.name && r.wins > 0)
  } catch {
    // 복합 인덱스가 아직 없으면 전체 불러와 필터
    const snap = await getDocs(collection(getDb(), RANK_COLLECTION))
    return snap.docs
      .map((d) => {
        const data = d.data()
        return {
          name: String(data.name ?? ''),
          wins: Number(data.wins ?? 0),
          lastSavedAt: Number(data.lastSavedAt ?? 0),
          difficulty: data.difficulty as Difficulty,
        }
      })
      .filter((r) => r.difficulty === difficulty && r.name && r.wins > 0)
      .sort((a, b) => {
        if (b.wins !== a.wins) return b.wins - a.wins
        return b.lastSavedAt - a.lastSavedAt
      })
      .slice(0, 50)
      .map(({ name, wins, lastSavedAt }) => ({ name, wins, lastSavedAt }))
  }
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

  if (record.won && name) {
    const rankId = `${record.difficulty}_${name}`
    await setDoc(
      doc(getDb(), RANK_COLLECTION, rankId),
      {
        name,
        difficulty: record.difficulty,
        wins: increment(1),
        lastSavedAt: savedAt,
        updatedAt: serverTimestamp(),
      },
      { merge: true },
    )
  }

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
