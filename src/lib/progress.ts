import {
  collection,
  doc,
  getDoc,
  getDocs,
  limit,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
} from 'firebase/firestore'
import type { Difficulty } from '../data/words'
import {
  assignCompetitionRanks,
  calcMatchXp,
  getClaimExpiresAt,
  getWeekKey,
  getWeekStartMs,
  isRewardClaimable,
  isRewardExpired,
  kstDateKey,
  levelFromTotalXp,
  progressFromXp,
  rewardXpForRank,
  tokensForMatch,
  type PendingWeekReward,
} from './levels'
import { getDb, isFirebaseConfigured } from './firebase'
import {
  DEFAULT_THEME,
  isBoardThemeId,
  parseOwnedThemeIds,
} from './themes'

const DAY_MS = 24 * 60 * 60 * 1000
const RECORDS = 'records'

const USERS = 'users'
const WEEKLY = 'weeklyRank'

export type UserProgress = {
  xp: number
  level: number
  weekKey: string
  /** 이번 주 획득 XP (레벨용, 주간 랭킹 점수 아님) */
  weekXp: number
  weekWins: number
  /** 이번 주 플레이 판수 (승패 포함) */
  weekPlays: number
  /** 이번 주 승리 중 최소 시도 (없으면 0) */
  weekBestAttempts: number
  /** 이번 주 승리 중 최단 초 (없으면 0) */
  weekBestSeconds: number
  lastDailyBonusDate: string
  pendingWeekReward: PendingWeekReward | null
  /** 보유 힌트 (계정, 쌓임) */
  hints: number
  /** 상점 화폐 */
  tokens: number
  /** 마지막 일일 무료 힌트 수령일 (KST dateKey) */
  lastDailyHintDate: string
  /** 경제 시스템 초기화 여부 (0이면 미초기화) */
  economyVersion: number
  /** 우편함에서 이미 수령한 보상 id */
  claimedMailIds: string[]
  /** 보유 보드 테마 id */
  ownedThemeIds: string[]
  /** 장착 중인 보드 테마 */
  equippedThemeId: string
}

export const emptyProgress = (): UserProgress => ({
  xp: 0,
  level: 1,
  weekKey: getWeekKey(),
  weekXp: 0,
  weekWins: 0,
  weekPlays: 0,
  weekBestAttempts: 0,
  weekBestSeconds: 0,
  lastDailyBonusDate: '',
  pendingWeekReward: null,
  hints: 0,
  tokens: 0,
  lastDailyHintDate: '',
  economyVersion: 0,
  claimedMailIds: [],
  ownedThemeIds: ['default'],
  equippedThemeId: 'default',
})

function parsePending(
  raw: unknown,
): PendingWeekReward | null {
  if (!raw || typeof raw !== 'object') return null
  const data = raw as Record<string, unknown>
  const weekKey = String(data.weekKey ?? '')
  const rank = Number(data.rank ?? 0)
  const xp = Number(data.xp ?? 0)
  const claimed = Boolean(data.claimed)
  const expiresAt = Number(data.expiresAt ?? 0)
  if (!weekKey || rank <= 0 || xp < 0 || !expiresAt) return null
  return { weekKey, rank, xp, claimed, expiresAt }
}

export function parseUserProgress(
  data: Record<string, unknown>,
): UserProgress {
  const xp = Math.max(0, Number(data.xp ?? 0))
  return {
    xp,
    level: levelFromTotalXp(xp),
    weekKey: String(data.weekKey ?? '') || getWeekKey(),
    weekXp: Math.max(0, Number(data.weekXp ?? 0)),
    weekWins: Math.max(0, Number(data.weekWins ?? 0)),
    weekPlays: Math.max(0, Number(data.weekPlays ?? 0)),
    weekBestAttempts: Math.max(0, Number(data.weekBestAttempts ?? 0)),
    weekBestSeconds: Math.max(0, Number(data.weekBestSeconds ?? 0)),
    lastDailyBonusDate: String(data.lastDailyBonusDate ?? ''),
    pendingWeekReward: parsePending(data.pendingWeekReward),
    hints: Math.max(0, Number(data.hints ?? 0)),
    tokens: Math.max(0, Number(data.tokens ?? 0)),
    lastDailyHintDate: String(data.lastDailyHintDate ?? ''),
    economyVersion: Math.max(0, Number(data.economyVersion ?? 0)),
    claimedMailIds: Array.isArray(data.claimedMailIds)
      ? data.claimedMailIds.filter(
          (id): id is string => typeof id === 'string' && id.length > 0,
        )
      : [],
    ownedThemeIds: parseOwnedThemeIds(data.ownedThemeIds),
    equippedThemeId: isBoardThemeId(String(data.equippedThemeId ?? ''))
      ? String(data.equippedThemeId)
      : DEFAULT_THEME,
  }
}

function progressWriteFields(progress: UserProgress) {
  return {
    xp: progress.xp,
    level: progress.level,
    weekKey: progress.weekKey,
    weekXp: progress.weekXp,
    weekWins: progress.weekWins,
    weekPlays: progress.weekPlays,
    weekBestAttempts: progress.weekBestAttempts,
    weekBestSeconds: progress.weekBestSeconds,
    lastDailyBonusDate: progress.lastDailyBonusDate,
    pendingWeekReward: progress.pendingWeekReward,
    hints: progress.hints,
    tokens: progress.tokens,
    lastDailyHintDate: progress.lastDailyHintDate,
    economyVersion: progress.economyVersion,
    claimedMailIds: progress.claimedMailIds,
    ownedThemeIds: progress.ownedThemeIds,
    equippedThemeId: progress.equippedThemeId,
  }
}

/** 주간 랭킹 기준 (월 09:00 리셋) */
export type WeeklyRankMode = 'plays' | 'attempts' | 'fastest'

export type WeeklyRankEntry = {
  uid: string
  nickname: string
  weekXp: number
  weekWins: number
  weekPlays: number
  weekBestAttempts: number
  weekBestSeconds: number
  rank: number
  updatedAt: number
  score: number
  scoreLabel: string
}

/** 누적 XP 유저 랭킹 한 줄 */
export type XpRankEntry = {
  uid: string
  nickname: string
  xp: number
  level: number
  rank: number
}

const NICKNAMES = 'nicknames'

function nicknameKey(name: string): string {
  return name.trim().normalize('NFC').toLocaleLowerCase('ko-KR')
}

/** 로그인 유저(닉네임 계정) 누적 XP 내림차순 — 비로그인/게스트 제외 */
export async function loadXpRanking(limitCount = 50): Promise<XpRankEntry[]> {
  if (!isFirebaseConfigured()) return []

  const [userSnap, nickSnap] = await Promise.all([
    getDocs(query(collection(getDb(), USERS), limit(500))),
    getDocs(query(collection(getDb(), NICKNAMES), limit(500))),
  ])

  /** nickKey → uid (닉네임 계정으로 가입한 유저만) */
  const nickOwner = new Map<string, string>()
  for (const d of nickSnap.docs) {
    const uid = String(d.data().uid ?? '').trim()
    if (uid) nickOwner.set(d.id, uid)
  }

  const rows = userSnap.docs
    .map((d) => {
      const data = d.data() as Record<string, unknown>
      const nickname = String(data.nickname ?? '').trim().slice(0, 20)
      const xp = Math.max(0, Number(data.xp ?? 0))
      return {
        uid: d.id,
        nickname,
        xp,
        level: levelFromTotalXp(xp),
      }
    })
    .filter((r) => {
      if (r.xp <= 0 || !r.nickname) return false
      return nickOwner.get(nicknameKey(r.nickname)) === r.uid
    })

  const ordered = [...rows].sort((a, b) => {
    if (b.xp !== a.xp) return b.xp - a.xp
    if (b.level !== a.level) return b.level - a.level
    return a.nickname.localeCompare(b.nickname, 'ko')
  })

  return assignCompetitionRanks(ordered.slice(0, limitCount), (e) => e.xp, true).map(
    ({ item, rank }) => ({ ...item, rank }),
  )
}

type WeekEntryRaw = {
  uid: string
  nickname: string
  weekXp: number
  weekWins: number
  weekPlays: number
  weekBestAttempts: number
  weekBestSeconds: number
  updatedAt: number
}

function parseBest(raw: unknown): number {
  const n = Number(raw ?? 0)
  return Number.isFinite(n) && n > 0 ? n : 0
}

async function loadWeekEntriesRaw(weekKey: string): Promise<WeekEntryRaw[]> {
  if (!isFirebaseConfigured() || !weekKey) return []
  try {
    const snap = await getDocs(
      query(collection(getDb(), WEEKLY, weekKey, 'entries'), limit(500)),
    )
    return snap.docs.map((d) => {
      const data = d.data() as Record<string, unknown>
      return {
        uid: d.id,
        nickname: String(data.nickname ?? '').trim() || '플레이어',
        weekXp: Math.max(0, Number(data.weekXp ?? 0)),
        weekWins: Math.max(0, Number(data.weekWins ?? 0)),
        weekPlays: Math.max(0, Number(data.weekPlays ?? 0)),
        weekBestAttempts: parseBest(data.weekBestAttempts),
        weekBestSeconds: parseBest(data.weekBestSeconds),
        updatedAt: Number(data.updatedAt ?? 0),
      }
    })
  } catch {
    return []
  }
}

type PracticeRec = {
  uid: string
  nickname: string
  won: boolean
  attempts: number
  seconds: number
  difficulty: Difficulty
  savedAt: number
}

async function fetchPracticeRecords(): Promise<PracticeRec[]> {
  if (!isFirebaseConfigured()) return []
  let snap
  try {
    snap = await getDocs(
      query(
        collection(getDb(), RECORDS),
        orderBy('savedAt', 'desc'),
        limit(1000),
      ),
    )
  } catch {
    snap = await getDocs(query(collection(getDb(), RECORDS), limit(1000)))
  }

  const out: PracticeRec[] = []
  for (const d of snap.docs) {
    const data = d.data() as Record<string, unknown>
    const uid = data.uid ? String(data.uid) : ''
    const nickname = String(data.name ?? '').trim()
    if (!uid || !nickname) continue
    const wordLength = Number(data.wordLength ?? 5)
    const difficulty: Difficulty =
      data.difficulty === 'hard' || wordLength === 7 ? 'hard' : 'easy'
    const won =
      data.won === true ||
      data.won === 1 ||
      data.won === 'true' ||
      data.won === '1'
    out.push({
      uid,
      nickname,
      won,
      attempts: Math.max(0, Number(data.attempts ?? 0)),
      seconds: Math.max(0, Number(data.seconds ?? 0)),
      difficulty,
      savedAt: Number(data.savedAt ?? 0),
    })
  }
  return out
}

/** 해당 주(월 09:00 KST~) 연습 기록으로 주간 스탯 집계 */
function aggregateWeekFromRecords(
  records: PracticeRec[],
  weekKey: string,
): WeekEntryRaw[] {
  const start = getWeekStartMs(weekKey)
  if (!start) return []
  const end = start + 7 * DAY_MS

  const byUid = new Map<string, PracticeRec[]>()
  for (const r of records) {
    if (r.savedAt < start || r.savedAt >= end) continue
    const list = byUid.get(r.uid) ?? []
    list.push(r)
    byUid.set(r.uid, list)
  }

  const out: WeekEntryRaw[] = []
  for (const [uid, list] of byUid) {
    const sorted = [...list].sort((a, b) => a.savedAt - b.savedAt)
    let streak = 0
    let weekXp = 0
    let weekWins = 0
    let weekPlays = 0
    let weekBestAttempts = 0
    let weekBestSeconds = 0
    let nickname = '플레이어'
    let updatedAt = 0
    for (const r of sorted) {
      nickname = r.nickname || nickname
      updatedAt = Math.max(updatedAt, r.savedAt)
      weekPlays += 1
      if (r.won) {
        streak += 1
        weekWins += 1
        if (r.attempts > 0) {
          weekBestAttempts =
            weekBestAttempts === 0
              ? r.attempts
              : Math.min(weekBestAttempts, r.attempts)
        }
        if (r.seconds > 0) {
          weekBestSeconds =
            weekBestSeconds === 0
              ? r.seconds
              : Math.min(weekBestSeconds, r.seconds)
        }
      } else {
        streak = 0
      }
      weekXp += calcMatchXp({
        won: r.won,
        attempts: r.attempts,
        difficulty: r.difficulty,
        playMode: 'practice',
        streakAfter: streak,
        dailyBonusAlready: true,
      }).xp
    }
    if (weekPlays > 0) {
      out.push({
        uid,
        nickname,
        weekXp,
        weekWins,
        weekPlays,
        weekBestAttempts,
        weekBestSeconds,
        updatedAt,
      })
    }
  }
  return out
}

function mergeBest(a: number, b: number): number {
  if (a <= 0) return b
  if (b <= 0) return a
  return Math.min(a, b)
}

function mergeWeekEntries(a: WeekEntryRaw[], b: WeekEntryRaw[]): WeekEntryRaw[] {
  const map = new Map<string, WeekEntryRaw>()
  for (const e of a) map.set(e.uid, e)
  for (const e of b) {
    const prev = map.get(e.uid)
    if (!prev) {
      map.set(e.uid, e)
      continue
    }
    map.set(e.uid, {
      uid: e.uid,
      nickname: e.nickname || prev.nickname,
      weekXp: Math.max(prev.weekXp, e.weekXp),
      weekWins: Math.max(prev.weekWins, e.weekWins),
      weekPlays: Math.max(prev.weekPlays, e.weekPlays),
      weekBestAttempts: mergeBest(prev.weekBestAttempts, e.weekBestAttempts),
      weekBestSeconds: mergeBest(prev.weekBestSeconds, e.weekBestSeconds),
      updatedAt: Math.max(prev.updatedAt, e.updatedAt),
    })
  }
  return [...map.values()]
}

async function loadWeekEntries(weekKey: string): Promise<WeekEntryRaw[]> {
  if (!isFirebaseConfigured() || !weekKey) return []
  const [stored, records] = await Promise.all([
    loadWeekEntriesRaw(weekKey),
    fetchPracticeRecords(),
  ])
  return mergeWeekEntries(stored, aggregateWeekFromRecords(records, weekKey))
}

async function writeWeeklyEntry(
  weekKey: string,
  uid: string,
  nickname: string,
  entry: Omit<WeekEntryRaw, 'uid' | 'nickname' | 'updatedAt'>,
) {
  await setDoc(
    doc(getDb(), WEEKLY, weekKey, 'entries', uid),
    {
      uid,
      nickname: nickname.slice(0, 20),
      weekXp: entry.weekXp,
      weekWins: entry.weekWins,
      weekPlays: entry.weekPlays,
      weekBestAttempts: entry.weekBestAttempts,
      weekBestSeconds: entry.weekBestSeconds,
      updatedAt: Date.now(),
      savedAt: serverTimestamp(),
    },
    { merge: true },
  )
}

function formatWeekSeconds(total: number): string {
  const s = Math.max(0, Math.floor(total))
  const m = Math.floor(s / 60)
  const r = s % 60
  if (m <= 0) return `${r}초`
  return `${m}분 ${r}초`
}

function rankWeekEntries(
  entries: WeekEntryRaw[],
  mode: WeeklyRankMode = 'plays',
): WeeklyRankEntry[] {
  if (mode === 'plays') {
    const participants = entries.filter((e) => e.weekPlays > 0)
    const ordered = [...participants].sort((a, b) => {
      if (b.weekPlays !== a.weekPlays) return b.weekPlays - a.weekPlays
      if (b.weekWins !== a.weekWins) return b.weekWins - a.weekWins
      return b.updatedAt - a.updatedAt
    })
    return assignCompetitionRanks(ordered, (e) => e.weekPlays, true).map(
      ({ item, rank }) => ({
        ...item,
        rank,
        score: item.weekPlays,
        scoreLabel: `${item.weekPlays}판`,
      }),
    )
  }

  if (mode === 'attempts') {
    const participants = entries.filter((e) => e.weekBestAttempts > 0)
    const ordered = [...participants].sort((a, b) => {
      if (a.weekBestAttempts !== b.weekBestAttempts) {
        return a.weekBestAttempts - b.weekBestAttempts
      }
      return b.updatedAt - a.updatedAt
    })
    return assignCompetitionRanks(
      ordered,
      (e) => e.weekBestAttempts,
      false,
    ).map(({ item, rank }) => ({
      ...item,
      rank,
      score: item.weekBestAttempts,
      scoreLabel: `${item.weekBestAttempts}회`,
    }))
  }

  const participants = entries.filter((e) => e.weekBestSeconds > 0)
  const ordered = [...participants].sort((a, b) => {
    if (a.weekBestSeconds !== b.weekBestSeconds) {
      return a.weekBestSeconds - b.weekBestSeconds
    }
    return b.updatedAt - a.updatedAt
  })
  return assignCompetitionRanks(ordered, (e) => e.weekBestSeconds, false).map(
    ({ item, rank }) => ({
      ...item,
      rank,
      score: item.weekBestSeconds,
      scoreLabel: formatWeekSeconds(item.weekBestSeconds),
    }),
  )
}

export async function loadWeeklyRanking(
  weekKey: string = getWeekKey(),
  mode: WeeklyRankMode = 'plays',
): Promise<WeeklyRankEntry[]> {
  const entries = await loadWeekEntries(weekKey)
  return rankWeekEntries(entries, mode)
}

async function buildPendingForWeek(
  uid: string,
  settledWeekKey: string,
  nowMs: number,
): Promise<PendingWeekReward | null> {
  const expiresAt = getClaimExpiresAt(settledWeekKey)
  if (nowMs >= expiresAt) return null

  // 주간 보상은 판수 순위 기준
  const ranked = rankWeekEntries(
    await loadWeekEntries(settledWeekKey),
    'plays',
  )
  const mine = ranked.find((e) => e.uid === uid)
  if (!mine) return null

  const xp = rewardXpForRank(mine.rank)
  if (xp <= 0) return null

  return {
    weekKey: settledWeekKey,
    rank: mine.rank,
    xp,
    claimed: false,
    expiresAt,
  }
}

/**
 * 주 전환·만료 정리. 로그인 유저 문서와 동기화.
 * 이번 주(월 09:00~) 연습 기록이 있으면 랭킹에 반영.
 */
export async function syncWeekProgress(
  uid: string,
  nickname: string,
): Promise<UserProgress> {
  if (!isFirebaseConfigured()) return emptyProgress()

  const ref = doc(getDb(), USERS, uid)
  const snap = await getDoc(ref)
  const data = (snap.exists() ? snap.data() : {}) as Record<string, unknown>
  let progress = parseUserProgress(data)
  const now = Date.now()
  const currentWeek = getWeekKey(now)
  let changed = false

  if (isRewardExpired(progress.pendingWeekReward, now)) {
    progress = { ...progress, pendingWeekReward: null }
    changed = true
  }

  if (progress.weekKey !== currentWeek) {
    const prevKey = progress.weekKey
    const participated = progress.weekPlays > 0 || progress.weekXp > 0
    let pending = progress.pendingWeekReward

    if (participated && prevKey) {
      const hasForPrev = pending?.weekKey === prevKey
      if (!hasForPrev && !isRewardClaimable(pending, now)) {
        const built = await buildPendingForWeek(uid, prevKey, now)
        if (built) pending = built
      }
    }

    progress = {
      ...progress,
      weekKey: currentWeek,
      weekXp: 0,
      weekWins: 0,
      weekPlays: 0,
      weekBestAttempts: 0,
      weekBestSeconds: 0,
      pendingWeekReward: pending,
      level: levelFromTotalXp(progress.xp),
    }
    changed = true
  }

  try {
    const fromRecords = aggregateWeekFromRecords(
      await fetchPracticeRecords(),
      currentWeek,
    ).find((e) => e.uid === uid)
    if (
      fromRecords &&
      (fromRecords.weekPlays > progress.weekPlays ||
        fromRecords.weekXp > progress.weekXp)
    ) {
      progress = {
        ...progress,
        weekKey: currentWeek,
        weekXp: Math.max(progress.weekXp, fromRecords.weekXp),
        weekWins: Math.max(progress.weekWins, fromRecords.weekWins),
        weekPlays: Math.max(progress.weekPlays, fromRecords.weekPlays),
        weekBestAttempts: mergeBest(
          progress.weekBestAttempts,
          fromRecords.weekBestAttempts,
        ),
        weekBestSeconds: mergeBest(
          progress.weekBestSeconds,
          fromRecords.weekBestSeconds,
        ),
      }
      changed = true
      await writeWeeklyEntry(currentWeek, uid, nickname, {
        weekXp: progress.weekXp,
        weekWins: progress.weekWins,
        weekPlays: progress.weekPlays,
        weekBestAttempts: progress.weekBestAttempts,
        weekBestSeconds: progress.weekBestSeconds,
      })
    } else if (progress.weekPlays > 0 || progress.weekXp > 0) {
      await writeWeeklyEntry(currentWeek, uid, nickname, {
        weekXp: progress.weekXp,
        weekWins: progress.weekWins,
        weekPlays: progress.weekPlays,
        weekBestAttempts: progress.weekBestAttempts,
        weekBestSeconds: progress.weekBestSeconds,
      })
    }
  } catch {
    /* 기록 집계 실패해도 동기화는 계속 */
  }

  if (changed) {
    await setDoc(
      ref,
      {
        nickname: nickname.slice(0, 20),
        ...progressWriteFields(progress),
        updatedAt: serverTimestamp(),
      },
      { merge: true },
    )
  }

  return progress
}

export type AwardXpInput = {
  uid: string
  nickname: string
  won: boolean
  attempts: number
  seconds: number
  difficulty: Difficulty
  playMode: 'daily' | 'practice'
  streakAfter: number
}

export type AwardXpResult = {
  progress: UserProgress
  gained: number
  tokensGained: number
  leveledUp: boolean
  prevLevel: number
  newLevel: number
}

export async function awardMatchXp(
  input: AwardXpInput,
): Promise<AwardXpResult | null> {
  if (!isFirebaseConfigured()) return null

  await syncWeekProgress(input.uid, input.nickname)

  const ref = doc(getDb(), USERS, input.uid)
  const snap = await getDoc(ref)
  const data = (snap.exists() ? snap.data() : {}) as Record<string, unknown>
  const prev = parseUserProgress(data)
  const prevLevel = prev.level
  const today = kstDateKey()
  const dailyBonusAlready = prev.lastDailyBonusDate === today

  const { xp: gained, dailyBonusUsed } = calcMatchXp({
    won: input.won,
    attempts: input.attempts,
    difficulty: input.difficulty,
    playMode: input.playMode,
    streakAfter: input.streakAfter,
    dailyBonusAlready,
  })

  const xp = prev.xp + gained
  const level = levelFromTotalXp(xp)
  const weekKey = getWeekKey()
  const sameWeek = prev.weekKey === weekKey
  const weekXp = (sameWeek ? prev.weekXp : 0) + gained
  const weekWins = (sameWeek ? prev.weekWins : 0) + (input.won ? 1 : 0)
  const weekPlays = (sameWeek ? prev.weekPlays : 0) + 1
  let weekBestAttempts = sameWeek ? prev.weekBestAttempts : 0
  let weekBestSeconds = sameWeek ? prev.weekBestSeconds : 0
  if (input.won) {
    if (input.attempts > 0) {
      weekBestAttempts =
        weekBestAttempts === 0
          ? input.attempts
          : Math.min(weekBestAttempts, input.attempts)
    }
    if (input.seconds > 0) {
      weekBestSeconds =
        weekBestSeconds === 0
          ? input.seconds
          : Math.min(weekBestSeconds, input.seconds)
    }
  }
  const tokensGained = tokensForMatch({
    won: input.won,
    playMode: input.playMode,
  })

  const progress: UserProgress = {
    ...prev,
    xp,
    level,
    weekKey,
    weekXp,
    weekWins,
    weekPlays,
    weekBestAttempts,
    weekBestSeconds,
    lastDailyBonusDate: dailyBonusUsed ? today : prev.lastDailyBonusDate,
    tokens: prev.tokens + tokensGained,
  }

  await setDoc(
    ref,
    {
      nickname: input.nickname.slice(0, 20),
      ...progressWriteFields(progress),
      updatedAt: serverTimestamp(),
    },
    { merge: true },
  )

  await writeWeeklyEntry(weekKey, input.uid, input.nickname, {
    weekXp: progress.weekXp,
    weekWins: progress.weekWins,
    weekPlays: progress.weekPlays,
    weekBestAttempts: progress.weekBestAttempts,
    weekBestSeconds: progress.weekBestSeconds,
  })

  return {
    progress,
    gained,
    tokensGained,
    leveledUp: level > prevLevel,
    prevLevel,
    newLevel: level,
  }
}

export async function claimWeekReward(
  uid: string,
  nickname: string,
): Promise<{ progress: UserProgress; gained: number } | null> {
  if (!isFirebaseConfigured()) return null

  const ref = doc(getDb(), USERS, uid)
  const snap = await getDoc(ref)
  if (!snap.exists()) return null
  const data = snap.data() as Record<string, unknown>
  let progress = parseUserProgress(data)
  const now = Date.now()

  if (isRewardExpired(progress.pendingWeekReward, now)) {
    await updateDoc(ref, { pendingWeekReward: null })
    return null
  }
  if (!isRewardClaimable(progress.pendingWeekReward, now)) return null

  const pending = progress.pendingWeekReward!
  const gained = pending.xp
  const xp = progress.xp + gained
  const level = levelFromTotalXp(xp)
  const claimed: PendingWeekReward = { ...pending, claimed: true }

  progress = {
    ...progress,
    xp,
    level,
    pendingWeekReward: claimed,
  }

  await setDoc(
    ref,
    {
      nickname: nickname.slice(0, 20),
      xp,
      level,
      pendingWeekReward: claimed,
      updatedAt: serverTimestamp(),
    },
    { merge: true },
  )

  return { progress, gained }
}

export function formatXpBar(progress: UserProgress): {
  label: string
  ratio: number
  holdName: string
} {
  const view = progressFromXp(progress.xp)
  if (view.xpForNext == null) {
    return {
      label: `${view.totalXp.toLocaleString('ko-KR')} XP`,
      ratio: 1,
      holdName: view.hold.name,
    }
  }
  return {
    label: `${view.xpIntoLevel} / ${view.xpForNext}`,
    ratio: view.xpForNext > 0 ? view.xpIntoLevel / view.xpForNext : 0,
    holdName: view.hold.name,
  }
}
