import {
  addDoc,
  collection,
  getDocs,
  limit,
  orderBy,
  query,
  serverTimestamp,
} from 'firebase/firestore'
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
}

const LAST_NAME_KEY = 'wordle-hangul-last-name'
const MAX_RECORDS = 100
const COLLECTION = 'records'

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
  return snap.docs.map((doc) => {
    const data = doc.data()
    return {
      id: doc.id,
      name: String(data.name ?? ''),
      word: String(data.word ?? ''),
      seconds: Number(data.seconds ?? 0),
      attempts: Number(data.attempts ?? 0),
      maxAttempts: Number(data.maxAttempts ?? 5),
      won: Boolean(data.won),
      dateKey: String(data.dateKey ?? ''),
      savedAt: Number(data.savedAt ?? Date.now()),
    }
  })
}

export async function saveHistoryRecord(
  record: Omit<HistoryRecord, 'id' | 'savedAt'>,
): Promise<HistoryRecord> {
  if (!isFirebaseConfigured()) {
    throw new Error('공유 기록이 아직 설정되지 않았어요')
  }

  const savedAt = Date.now()
  const payload = {
    name: record.name.trim().slice(0, 20),
    word: record.word,
    seconds: Math.max(0, Math.round(record.seconds)),
    attempts: record.attempts,
    maxAttempts: record.maxAttempts,
    won: record.won,
    dateKey: record.dateKey,
    savedAt,
    createdAt: serverTimestamp(),
  }

  const ref = await addDoc(collection(getDb(), COLLECTION), payload)
  localStorage.setItem(LAST_NAME_KEY, payload.name)

  return {
    id: ref.id,
    name: payload.name,
    word: payload.word,
    seconds: payload.seconds,
    attempts: payload.attempts,
    maxAttempts: payload.maxAttempts,
    won: payload.won,
    dateKey: payload.dateKey,
    savedAt,
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
