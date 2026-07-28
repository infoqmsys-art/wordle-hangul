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

const HISTORY_KEY = 'wordle-hangul-history-v1'
const LAST_NAME_KEY = 'wordle-hangul-last-name'
const MAX_RECORDS = 100

export function loadHistory(): HistoryRecord[] {
  try {
    const raw = localStorage.getItem(HISTORY_KEY)
    if (!raw) return []
    const list = JSON.parse(raw) as HistoryRecord[]
    return Array.isArray(list) ? list : []
  } catch {
    return []
  }
}

export function saveHistoryRecord(record: Omit<HistoryRecord, 'id' | 'savedAt'>): HistoryRecord {
  const next: HistoryRecord = {
    ...record,
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    savedAt: Date.now(),
  }
  const list = [next, ...loadHistory()].slice(0, MAX_RECORDS)
  localStorage.setItem(HISTORY_KEY, JSON.stringify(list))
  localStorage.setItem(LAST_NAME_KEY, record.name)
  return next
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
