/** 클라이밍 홀드 레벨 · XP · 주간 랭킹 상수/순수 함수 */

export const MAX_LEVEL = 11

/**
 * 레벨 n → n+1 에 필요한 XP (index = 현재 레벨)
 * 합계 약 14,800 XP ≈ 하루 10판(전승·혼합) 기준 만렙 ~30일
 */
export const XP_TO_NEXT: Record<number, number> = {
  1: 170,
  2: 280,
  3: 420,
  4: 620,
  5: 900,
  6: 1260,
  7: 1740,
  8: 2340,
  9: 3060,
  10: 3960,
}

export type HoldLevel = {
  level: number
  name: string
  color: string
  textColor: string
  /** public 경로 홀드 이미지 */
  image: string
}

export const HOLD_LEVELS: HoldLevel[] = [
  { level: 1, name: '하양홀드', color: '#F5F5F5', textColor: '#1a1a1a', image: 'holds/hold-1.png' },
  { level: 2, name: '노랑홀드', color: '#F5D76E', textColor: '#1a1a1a', image: 'holds/hold-2.png' },
  { level: 3, name: '주황홀드', color: '#E67E22', textColor: '#1a1a1a', image: 'holds/hold-3.png' },
  { level: 4, name: '초록홀드', color: '#27AE60', textColor: '#ffffff', image: 'holds/hold-4.png' },
  { level: 5, name: '파랑홀드', color: '#2980B9', textColor: '#ffffff', image: 'holds/hold-5.png' },
  { level: 6, name: '빨강홀드', color: '#E74C3C', textColor: '#ffffff', image: 'holds/hold-6.png' },
  { level: 7, name: '분홍홀드', color: '#F5B7B1', textColor: '#1a1a1a', image: 'holds/hold-7.png' },
  { level: 8, name: '보라홀드', color: '#8E44AD', textColor: '#ffffff', image: 'holds/hold-8.png' },
  { level: 9, name: '회색홀드', color: '#7F8C8D', textColor: '#1a1a1a', image: 'holds/hold-9.png' },
  { level: 10, name: '갈색홀드', color: '#6E2C00', textColor: '#ffffff', image: 'holds/hold-10.png' },
  { level: 11, name: '검정홀드', color: '#1C1C1C', textColor: '#ffffff', image: 'holds/hold-11.png' },
]

export function getHold(level: number): HoldLevel {
  const clamped = Math.min(MAX_LEVEL, Math.max(1, Math.floor(level)))
  return HOLD_LEVELS[clamped - 1]!
}

export function holdImageSrc(level: number): string {
  const base = import.meta.env.BASE_URL || '/'
  const path = getHold(level).image.replace(/^\//, '')
  return `${base}${path}`
}

/** XP바용 — 밝은 홀드는 대비 강한 색으로 */
export function holdXpBarColor(level: number): string {
  const hold = getHold(level)
  if (hold.level === 1) return '#5c6b82'
  if (hold.level === 2) return '#c9a227'
  if (hold.level === 7) return '#d46b8c'
  if (hold.level === 9) return '#5a6570'
  return hold.color
}

export type LevelProgressView = {
  level: number
  totalXp: number
  /** 현재 레벨 안에서 채운 XP */
  xpIntoLevel: number
  /** 다음 레벨까지 필요 XP (11이면 null) */
  xpForNext: number | null
  hold: HoldLevel
}

export function progressFromXp(totalXp: number): LevelProgressView {
  let remaining = Math.max(0, Math.floor(totalXp))
  let level = 1
  while (level < MAX_LEVEL) {
    const need = XP_TO_NEXT[level] ?? 0
    if (remaining < need) {
      return {
        level,
        totalXp: Math.max(0, Math.floor(totalXp)),
        xpIntoLevel: remaining,
        xpForNext: need,
        hold: getHold(level),
      }
    }
    remaining -= need
    level += 1
  }
  return {
    level: MAX_LEVEL,
    totalXp: Math.max(0, Math.floor(totalXp)),
    xpIntoLevel: remaining,
    xpForNext: null,
    hold: getHold(MAX_LEVEL),
  }
}

export function levelFromTotalXp(totalXp: number): number {
  return progressFromXp(totalXp).level
}

export type MatchXpInput = {
  won: boolean
  attempts: number
  difficulty: 'easy' | 'hard'
  playMode: 'daily' | 'practice'
  /** 이 판 반영 후 연속 승리 */
  streakAfter: number
  /** 오늘(KST dateKey) 이미 오늘의 단어 보너스를 받았는지 */
  dailyBonusAlready: boolean
}

export type MatchXpResult = {
  xp: number
  dailyBonusUsed: boolean
}

export function calcMatchXp(input: MatchXpInput): MatchXpResult {
  if (!input.won) {
    return { xp: 5, dailyBonusUsed: false }
  }

  let xp = 25
  if (input.attempts <= 1) xp += 20
  else if (input.attempts === 2) xp += 12
  else if (input.attempts === 3) xp += 6

  if (input.difficulty === 'hard') xp = Math.round(xp * 1.4)

  let dailyBonusUsed = false
  if (input.playMode === 'daily') {
    // 오늘의 단어는 연습보다 많이 (하루 1회 추가 보너스)
    xp = Math.round(xp * 1.35)
    if (!input.dailyBonusAlready) {
      xp += 40
      dailyBonusUsed = true
    }
  }

  const streak = input.streakAfter
  if (streak >= 7) xp += 15
  else if (streak >= 5) xp += 10
  else if (streak >= 3) xp += 5

  return { xp, dailyBonusUsed }
}

/** 판당 토큰 */
export function tokensForMatch(input: {
  won: boolean
  playMode: 'daily' | 'practice'
}): number {
  if (!input.won) return 1
  return input.playMode === 'daily' ? 8 : 3
}

/** 주간 순위 → 보상 XP */
export function rewardXpForRank(rank: number): number {
  if (rank <= 0) return 0
  if (rank === 1) return 300
  if (rank === 2) return 180
  if (rank === 3) return 100
  if (rank <= 10) return 40
  return 15
}

const DAY_MS = 24 * 60 * 60 * 1000
const CLAIM_DAYS = 7

/**
 * 경쟁 순위(1224): 동일 점수면 같은 등수, 다음은 건너뜀.
 * higherIsBetter=true → 점수 높은 순
 */
export function assignCompetitionRanks<T>(
  items: T[],
  scoreOf: (item: T) => number,
  higherIsBetter = true,
): Array<{ item: T; rank: number; score: number }> {
  const sorted = [...items].sort((a, b) => {
    const sa = scoreOf(a)
    const sb = scoreOf(b)
    if (sa === sb) return 0
    return higherIsBetter ? sb - sa : sa - sb
  })

  const out: Array<{ item: T; rank: number; score: number }> = []
  for (let i = 0; i < sorted.length; i++) {
    const score = scoreOf(sorted[i]!)
    const rank =
      i > 0 && score === out[i - 1]!.score ? out[i - 1]!.rank : i + 1
    out.push({ item: sorted[i]!, rank, score })
  }
  return out
}

function kstYmdH(ms: number): {
  year: number
  month: number
  day: number
  hour: number
} {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Seoul',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(new Date(ms))

  const get = (type: string) =>
    Number(parts.find((p) => p.type === type)?.value ?? 0)

  return {
    year: get('year'),
    month: get('month'),
    day: get('day'),
    hour: get('hour'),
  }
}

function isoWeekKeyFromYmd(year: number, month: number, day: number): string {
  const date = new Date(Date.UTC(year, month - 1, day))
  const dayNum = date.getUTCDay() || 7
  date.setUTCDate(date.getUTCDate() + 4 - dayNum)
  const weekYear = date.getUTCFullYear()
  const yearStart = new Date(Date.UTC(weekYear, 0, 1))
  const weekNo = Math.ceil(
    ((date.getTime() - yearStart.getTime()) / DAY_MS + 1) / 7,
  )
  return `${weekYear}-W${String(weekNo).padStart(2, '0')}`
}

/**
 * 주간 키. 경계 = 매주 월요일 09:00 Asia/Seoul.
 * (KST 시각에서 9시간을 빼 ISO 주와 맞춤)
 */
export function getWeekKey(nowMs: number = Date.now()): string {
  const shifted = nowMs - 9 * 60 * 60 * 1000
  const { year, month, day } = kstYmdH(shifted)
  return isoWeekKeyFromYmd(year, month, day)
}

/** 해당 weekKey 주의 시작 시각(월 09:00 KST) epoch ms */
export function getWeekStartMs(weekKey: string): number {
  const match = /^(\d{4})-W(\d{2})$/.exec(weekKey)
  if (!match) return 0
  const weekYear = Number(match[1])
  const weekNo = Number(match[2])
  // ISO: week 1의 목요일이 있는 주 → 그 주 월요일
  const jan4 = new Date(Date.UTC(weekYear, 0, 4))
  const jan4Day = jan4.getUTCDay() || 7
  const mondayUtc = new Date(jan4)
  mondayUtc.setUTCDate(jan4.getUTCDate() - (jan4Day - 1) + (weekNo - 1) * 7)
  // 월요일 00:00 UTC로 구한 Y-M-D를 KST 월 09:00으로 해석
  const y = mondayUtc.getUTCFullYear()
  const m = mondayUtc.getUTCMonth() + 1
  const d = mondayUtc.getUTCDate()
  // KST = UTC+9 → 월 09:00 KST = 월 00:00 UTC
  return Date.UTC(y, m - 1, d, 0, 0, 0)
}

export function getPreviousWeekKey(nowMs: number = Date.now()): string {
  return getWeekKey(nowMs - 7 * DAY_MS)
}

/** 클레임 만료: 해당 주 종료(다음 주 시작) 후 7일 */
export function getClaimExpiresAt(settledWeekKey: string): number {
  return getWeekStartMs(settledWeekKey) + (7 + CLAIM_DAYS) * DAY_MS
}

export function kstDateKey(nowMs: number = Date.now()): string {
  const { year, month, day } = kstYmdH(nowMs)
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
}

export type PendingWeekReward = {
  weekKey: string
  rank: number
  xp: number
  claimed: boolean
  expiresAt: number
}

export function isRewardClaimable(
  pending: PendingWeekReward | null | undefined,
  nowMs: number = Date.now(),
): boolean {
  if (!pending || pending.claimed) return false
  if (pending.xp <= 0) return false
  return nowMs < pending.expiresAt
}

export function isRewardExpired(
  pending: PendingWeekReward | null | undefined,
  nowMs: number = Date.now(),
): boolean {
  if (!pending || pending.claimed) return false
  return nowMs >= pending.expiresAt
}
