import {
  addDoc,
  collection,
  getDocs,
  limit,
  orderBy,
  query,
  serverTimestamp,
  where,
  writeBatch,
} from 'firebase/firestore'
import {
  loadDictionary,
  pickDailyAnswer,
  type Difficulty,
  type Dictionary,
} from '../data/words'
import { getDb, isFirebaseConfigured } from './firebase'

export type HistoryPlayMode = 'daily' | 'practice'

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
  playMode?: HistoryPlayMode
  /** 이 판에서 힌트를 썼는지 */
  hintUsed?: boolean
  uid?: string
}

export type RankMode = 'wins' | 'fastest' | 'attempts'

export type RankEntry = {
  name: string
  /** 경쟁 순위 (동일 점수면 같은 등수) */
  rank: number
  /** 표시용 점수 숫자 (승수 / 초 / 시도) */
  score: number
  scoreLabel: string
  wins: number
  lastSavedAt: number
}

/** 동일 score면 같은 등수(1224식). 정렬은 이미 되어 있어야 함 */
function withCompetitionRanks(
  entries: Omit<RankEntry, 'rank'>[],
): RankEntry[] {
  const out: RankEntry[] = []
  for (let i = 0; i < entries.length; i++) {
    const score = entries[i]!.score
    const rank =
      i > 0 && score === entries[i - 1]!.score ? out[i - 1]!.rank : i + 1
    out.push({ ...entries[i]!, rank })
  }
  return out
}

const LAST_NAME_KEY = 'wordle-hangul-last-name'
const MAX_RECORDS = 200
const COLLECTION = 'records'

/**
 * DB 삭제 전에도 최단시간/최단시도·기록에서 빼는 데일리성 문서 ID.
 * (콘솔/스크립트로 지운 뒤에는 없어도 됨)
 */
const HIDDEN_RECORD_IDS = new Set([
  // 2026-07-31 데일리
  'eg6cmpqyAhySRjO960OG', // 갈색
  'osPh5YzPHAJT8bSKjGrI', // 갈색
  'OepNux2iEDI0Pi0J5Ln9', // 온도
  'VOY5727cVWefvjtKKT3u', // 시디롬 1회 6초
  'krwchA99XQlaiaUn09nZ', // 시디롬 1회 5초
  // 2026-07-30 데일리 (갈비/경쟁)
  '440ZfbKnmroqp1Uw1JJD',
  'ClcUZNI6p1LdCAtgS71O',
  'KOoD3pBeNmpy71Am6dFz',
  'O4lIDV9ocQnAsS0ccF1Y',
  'O6HxNKDkhld0O8psOK02',
  'Q8vlZf12XP48O452vpsC',
  'WWvJ0paQ5F7ft2mDde3j',
  'a3HTY3cBRpKzQ6UjQaK9',
  'fMbFbouTA8O8AjDoUDuU',
  'pZqviAKZ0ixkoLootq5i',
  'tkvCykyxd6N5IZnN9Ie2',
  'zSXd7MNiYGXYRsxTOsDw',
  // 2026-07-29 데일리
  'XkPSvg2ciKf4xMnoMU9J',
])

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
  const playMode =
    data.playMode === 'daily' || data.playMode === 'practice'
      ? data.playMode
      : undefined
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
    playMode,
    hintUsed: Boolean(data.hintUsed),
    uid: data.uid ? String(data.uid) : undefined,
  }
}

function parseDateKey(dateKey: string): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateKey)
  if (!m) return null
  return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]))
}

/** 해당 날짜·난이도의 데일리 정답과 같으면 데일리 플레이로 간주 */
function isDailyAnswerWord(
  dict: Dictionary,
  word: string,
  difficulty: Difficulty,
  dateKey: string,
): boolean {
  const date = parseDateKey(dateKey)
  if (!date) return false
  return pickDailyAnswer(dict, difficulty, date).word === word
}

/**
 * 공유 기록용 필터.
 * - 데일리: 목록에는 보이되 정답 단어는 비움
 * - 메인게임: 오늘/해당일 데일리 정답 단어는 스포일러라 숨김
 */
async function filterPublicRecords(
  records: HistoryRecord[],
): Promise<HistoryRecord[]> {
  let dict: Dictionary | null = null
  let todaySpoilers = new Set<string>()
  try {
    dict = await loadDictionary()
    todaySpoilers = new Set([
      pickDailyAnswer(dict, 'easy').word,
      pickDailyAnswer(dict, 'hard').word,
    ])
  } catch {
    /* 사전 실패 시 playMode만으로 걸러냄 */
  }

  return records.flatMap((r) => {
    if (HIDDEN_RECORD_IDS.has(r.id)) return []
    // 비로그인(게스트) 기록은 공유 목록·랭킹에 노출하지 않음
    if (!r.uid) return []
    if (r.playMode === 'daily') {
      return [{ ...r, word: '' }]
    }
    if (r.word && todaySpoilers.has(r.word)) return []
    if (
      r.word &&
      dict &&
      isDailyAnswerWord(dict, r.word, r.difficulty, r.dateKey)
    ) {
      return []
    }
    return [r]
  })
}

export async function loadHistory(): Promise<HistoryRecord[]> {
  if (!isFirebaseConfigured()) return []

  const q = query(
    collection(getDb(), COLLECTION),
    orderBy('savedAt', 'desc'),
    limit(MAX_RECORDS),
  )
  const snap = await getDocs(q)
  const list = snap.docs.map((d) =>
    parseRecord(d.id, d.data() as Record<string, unknown>),
  )
  return filterPublicRecords(list)
}

type Agg = {
  name: string
  wins: number
  lastSavedAt: number
  /** 메인게임 기준. 없으면 Infinity */
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
  const parsed = await filterPublicRecords(
    snap.docs.map((d) =>
      parseRecord(d.id, d.data() as Record<string, unknown>),
    ),
  )

  const map = new Map<string, Agg>()
  for (const r of parsed) {
    if (!r.won) continue
    if (r.difficulty !== difficulty) continue
    // 로그인 계정 기록만 (uid 없는 게스트 이름은 집계 제외)
    if (!r.uid) continue
    const name = r.name.trim()
    if (!name) continue

    // 승수: 데일리+메인게임 / 최단시간·최단시도: 메인게임만
    const isDaily = r.playMode === 'daily'
    const prev = map.get(name)
    if (!prev) {
      map.set(name, {
        name,
        wins: 1,
        lastSavedAt: r.savedAt,
        bestSeconds: isDaily ? Number.POSITIVE_INFINITY : r.seconds,
        bestAttempts: isDaily ? Number.POSITIVE_INFINITY : r.attempts,
        bestAttemptsSeconds: isDaily ? Number.POSITIVE_INFINITY : r.seconds,
      })
      continue
    }

    prev.wins += 1
    prev.lastSavedAt = Math.max(prev.lastSavedAt, r.savedAt)
    if (isDaily) continue
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
    return withCompetitionRanks(
      list
        .filter((r) => Number.isFinite(r.bestSeconds))
        .sort((a, b) => {
          if (a.bestSeconds !== b.bestSeconds) {
            return a.bestSeconds - b.bestSeconds
          }
          return b.lastSavedAt - a.lastSavedAt
        })
        .slice(0, 50)
        .map((r) => ({
          name: r.name,
          score: r.bestSeconds,
          scoreLabel: formatSeconds(r.bestSeconds),
          wins: r.wins,
          lastSavedAt: r.lastSavedAt,
        })),
    )
  }

  if (mode === 'attempts') {
    return withCompetitionRanks(
      list
        .filter((r) => Number.isFinite(r.bestAttempts))
        .sort((a, b) => {
          if (a.bestAttempts !== b.bestAttempts) {
            return a.bestAttempts - b.bestAttempts
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
        })),
    )
  }

  return withCompetitionRanks(
    list
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
      })),
  )
}

export async function saveHistoryRecord(
  record: Omit<HistoryRecord, 'id' | 'savedAt'> & { uid?: string },
): Promise<HistoryRecord> {
  if (!isFirebaseConfigured()) {
    throw new Error('공유 기록이 아직 설정되지 않았어요')
  }

  const playMode: HistoryPlayMode =
    record.playMode === 'daily' ? 'daily' : 'practice'
  // 데일리는 정답 단어를 DB에도 남기지 않음
  const word = playMode === 'daily' ? '' : record.word
  const savedAt = Date.now()
  const name = record.name.trim().slice(0, 20)
  const hintUsed = Boolean(record.hintUsed)
  const payload: Record<string, unknown> = {
    name,
    word,
    seconds: Math.max(0, Math.round(record.seconds)),
    attempts: record.attempts,
    maxAttempts: record.maxAttempts,
    won: record.won,
    dateKey: record.dateKey,
    difficulty: record.difficulty,
    wordLength: record.wordLength,
    playMode,
    hintUsed,
    savedAt,
    createdAt: serverTimestamp(),
  }
  if (record.uid) payload.uid = record.uid

  const ref = await addDoc(collection(getDb(), COLLECTION), payload)
  setLastName(name)

  return {
    id: ref.id,
    name,
    word,
    seconds: Number(payload.seconds),
    attempts: record.attempts,
    maxAttempts: record.maxAttempts,
    won: record.won,
    dateKey: record.dateKey,
    difficulty: record.difficulty,
    wordLength: record.wordLength,
    playMode,
    hintUsed,
    savedAt,
    uid: record.uid,
  }
}

/** 계정 닉네임 변경 시 해당 uid 기록의 표시 이름도 함께 갱신 */
export async function renameUserRecords(
  uid: string,
  newName: string,
): Promise<void> {
  if (!isFirebaseConfigured() || !uid) return
  const name = newName.trim().slice(0, 20)
  if (!name) return

  const snap = await getDocs(
    query(collection(getDb(), COLLECTION), where('uid', '==', uid), limit(500)),
  )
  if (snap.empty) return

  const db = getDb()
  let batch = writeBatch(db)
  let count = 0
  for (const d of snap.docs) {
    batch.update(d.ref, { name })
    count += 1
    if (count >= 450) {
      await batch.commit()
      batch = writeBatch(db)
      count = 0
    }
  }
  if (count > 0) await batch.commit()
}

export function getLastName(): string {
  return localStorage.getItem(LAST_NAME_KEY) ?? ''
}

export function setLastName(name: string): void {
  const trimmed = name.trim().slice(0, 20)
  if (trimmed) localStorage.setItem(LAST_NAME_KEY, trimmed)
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
