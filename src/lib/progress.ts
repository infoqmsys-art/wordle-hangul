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

const DAY_MS = 24 * 60 * 60 * 1000
const RECORDS = 'records'

const USERS = 'users'
const WEEKLY = 'weeklyRank'

export type UserProgress = {
  xp: number
  level: number
  weekKey: string
  weekXp: number
  weekWins: number
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
}

export const emptyProgress = (): UserProgress => ({
  xp: 0,
  level: 1,
  weekKey: getWeekKey(),
  weekXp: 0,
  weekWins: 0,
  lastDailyBonusDate: '',
  pendingWeekReward: null,
  hints: 0,
  tokens: 0,
  lastDailyHintDate: '',
  economyVersion: 0,
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
    lastDailyBonusDate: String(data.lastDailyBonusDate ?? ''),
    pendingWeekReward: parsePending(data.pendingWeekReward),
    hints: Math.max(0, Number(data.hints ?? 0)),
    tokens: Math.max(0, Number(data.tokens ?? 0)),
    lastDailyHintDate: String(data.lastDailyHintDate ?? ''),
    economyVersion: Math.max(0, Number(data.economyVersion ?? 0)),
  }
}

function progressWriteFields(progress: UserProgress) {
  return {
    xp: progress.xp,
    level: progress.level,
    weekKey: progress.weekKey,
    weekXp: progress.weekXp,
    weekWins: progress.weekWins,
    lastDailyBonusDate: progress.lastDailyBonusDate,
    pendingWeekReward: progress.pendingWeekReward,
    hints: progress.hints,
    tokens: progress.tokens,
    lastDailyHintDate: progress.lastDailyHintDate,
    economyVersion: progress.economyVersion,
  }
}

export type WeeklyRankEntry = {
  uid: string
  nickname: string
  weekXp: number
  weekWins: number
  rank: number
  updatedAt: number
}

type WeekEntryRaw = {
  uid: string
  nickname: string
  weekXp: number
  weekWins: number
  updatedAt: number
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
    if (data.playMode === 'daily') continue
    const uid = data.uid ? String(data.uid) : ''
    const nickname = String(data.name ?? '').trim()
    if (!uid && !nickname) continue
    const wordLength = Number(data.wordLength ?? 5)
    const difficulty: Difficulty =
      data.difficulty === 'hard' || wordLength === 7 ? 'hard' : 'easy'
    const won =
      data.won === true ||
      data.won === 1 ||
      data.won === 'true' ||
      data.won === '1'
    out.push({
      uid: uid || `name:${nickname.toLowerCase()}`,
      nickname: nickname || '플레이어',
      won,
      attempts: Math.max(0, Number(data.attempts ?? 0)),
      difficulty,
      savedAt: Number(data.savedAt ?? 0),
    })
  }
  return out
}

/** 해당 주(월 09:00 KST~) 연습 기록으로 weekXp 집계 */
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
    let nickname = '플레이어'
    let updatedAt = 0
    for (const r of sorted) {
      nickname = r.nickname || nickname
      updatedAt = Math.max(updatedAt, r.savedAt)
      if (r.won) {
        streak += 1
        weekWins += 1
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
    if (weekXp > 0) {
      out.push({ uid, nickname, weekXp, weekWins, updatedAt })
    }
  }
  return out
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
  weekXp: number,
  weekWins: number,
) {
  await setDoc(
    doc(getDb(), WEEKLY, weekKey, 'entries', uid),
    {
      uid,
      nickname: nickname.slice(0, 20),
      weekXp,
      weekWins,
      updatedAt: Date.now(),
      savedAt: serverTimestamp(),
    },
    { merge: true },
  )
}

function rankWeekEntries(entries: WeekEntryRaw[]): WeeklyRankEntry[] {
  const participants = entries.filter((e) => e.weekXp > 0)
  // 동점: weekXp만으로 순위. 표시 순서는 weekXp desc → weekWins desc
  const ordered = [...participants].sort((a, b) => {
    if (b.weekXp !== a.weekXp) return b.weekXp - a.weekXp
    if (b.weekWins !== a.weekWins) return b.weekWins - a.weekWins
    return b.updatedAt - a.updatedAt
  })
  const ranked = assignCompetitionRanks(ordered, (e) => e.weekXp, true)
  return ranked.map(({ item, rank }) => ({
    ...item,
    rank,
  }))
}

export async function loadWeeklyRanking(
  weekKey: string = getWeekKey(),
): Promise<WeeklyRankEntry[]> {
  const entries = await loadWeekEntries(weekKey)
  return rankWeekEntries(entries)
}

async function buildPendingForWeek(
  uid: string,
  settledWeekKey: string,
  nowMs: number,
): Promise<PendingWeekReward | null> {
  const expiresAt = getClaimExpiresAt(settledWeekKey)
  if (nowMs >= expiresAt) return null

  const ranked = rankWeekEntries(await loadWeekEntries(settledWeekKey))
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
 * 이번 주(월 09:00~) 연습 기록이 weekXp보다 많으면 랭킹에 반영.
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

  // 만료된 미수령 보상 제거
  if (isRewardExpired(progress.pendingWeekReward, now)) {
    progress = { ...progress, pendingWeekReward: null }
    changed = true
  }

  if (progress.weekKey !== currentWeek) {
    const prevKey = progress.weekKey
    const participated = progress.weekXp > 0
    let pending = progress.pendingWeekReward

    // 지난 참여 주 정산 (이미 해당 주 pending이 있거나, 미수령 보상이 있으면 유지)
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
      pendingWeekReward: pending,
      level: levelFromTotalXp(progress.xp),
    }
    changed = true
  }

  // 7/27(월 09:00)~ 연습 기록을 이번 주 랭킹에 소급 반영 (레벨 XP는 그대로)
  try {
    const fromRecords = aggregateWeekFromRecords(
      await fetchPracticeRecords(),
      currentWeek,
    ).find((e) => e.uid === uid)
    if (fromRecords && fromRecords.weekXp > progress.weekXp) {
      progress = {
        ...progress,
        weekKey: currentWeek,
        weekXp: fromRecords.weekXp,
        weekWins: Math.max(progress.weekWins, fromRecords.weekWins),
      }
      changed = true
      await writeWeeklyEntry(
        currentWeek,
        uid,
        nickname,
        progress.weekXp,
        progress.weekWins,
      )
    } else if (progress.weekXp > 0) {
      // 이미 있는 주간 XP도 랭킹 문서에 보장
      await writeWeeklyEntry(
        currentWeek,
        uid,
        nickname,
        progress.weekXp,
        progress.weekWins,
      )
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
  const weekXp = (prev.weekKey === weekKey ? prev.weekXp : 0) + gained
  const weekWins =
    (prev.weekKey === weekKey ? prev.weekWins : 0) + (input.won ? 1 : 0)
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

  await writeWeeklyEntry(
    weekKey,
    input.uid,
    input.nickname,
    progress.weekXp,
    progress.weekWins,
  )

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
