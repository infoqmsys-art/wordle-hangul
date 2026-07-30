export type PersonalStats = {
  played: number
  wins: number
  /** 승리 판의 시도 합 */
  winAttempts: number
  /** 승리 판의 초 합 */
  winSeconds: number
  /** 현재 연속 승리 */
  currentStreak: number
  /** 최고 연속 승리 */
  maxStreak: number
}

const STATS_KEY = 'wordle-hangul-personal-stats-v1'

const empty: PersonalStats = {
  played: 0,
  wins: 0,
  winAttempts: 0,
  winSeconds: 0,
  currentStreak: 0,
  maxStreak: 0,
}

export function getPersonalStats(): PersonalStats {
  try {
    const raw = localStorage.getItem(STATS_KEY)
    if (!raw) return { ...empty }
    const data = JSON.parse(raw) as Partial<PersonalStats>
    return {
      played: Number(data.played ?? 0),
      wins: Number(data.wins ?? 0),
      winAttempts: Number(data.winAttempts ?? 0),
      winSeconds: Number(data.winSeconds ?? 0),
      currentStreak: Number(data.currentStreak ?? 0),
      maxStreak: Number(data.maxStreak ?? 0),
    }
  } catch {
    return { ...empty }
  }
}

export function setPersonalStats(stats: PersonalStats): void {
  localStorage.setItem(STATS_KEY, JSON.stringify(stats))
}

export function recordPersonalResult(input: {
  won: boolean
  attempts: number
  seconds: number
}): PersonalStats {
  const prev = getPersonalStats()
  const currentStreak = input.won ? prev.currentStreak + 1 : 0
  const next: PersonalStats = {
    played: prev.played + 1,
    wins: prev.wins + (input.won ? 1 : 0),
    winAttempts: prev.winAttempts + (input.won ? input.attempts : 0),
    winSeconds: prev.winSeconds + (input.won ? Math.max(0, input.seconds) : 0),
    currentStreak,
    maxStreak: Math.max(prev.maxStreak, currentStreak),
  }
  setPersonalStats(next)

  // 로그인 상태면 클라우드에도 반영 (실패해도 로컬은 유지)
  void import('./auth')
    .then(({ pushStatsIfLoggedIn }) => pushStatsIfLoggedIn(next))
    .catch(() => undefined)

  return next
}

export function winRate(stats: PersonalStats): number {
  if (stats.played <= 0) return 0
  return Math.round((stats.wins / stats.played) * 100)
}

export function avgWinAttempts(stats: PersonalStats): number | null {
  if (stats.wins <= 0) return null
  return Math.round((stats.winAttempts / stats.wins) * 10) / 10
}

export function avgWinSeconds(stats: PersonalStats): number | null {
  if (stats.wins <= 0) return null
  return stats.winSeconds / stats.wins
}
