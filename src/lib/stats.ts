export type PersonalStats = {
  played: number
  wins: number
  /** 승리 판의 시도 합 */
  winAttempts: number
  /** 승리 판의 초 합 */
  winSeconds: number
}

const STATS_KEY = 'wordle-hangul-personal-stats-v1'

const empty: PersonalStats = {
  played: 0,
  wins: 0,
  winAttempts: 0,
  winSeconds: 0,
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
    }
  } catch {
    return { ...empty }
  }
}

export function recordPersonalResult(input: {
  won: boolean
  attempts: number
  seconds: number
}): PersonalStats {
  const prev = getPersonalStats()
  const next: PersonalStats = {
    played: prev.played + 1,
    wins: prev.wins + (input.won ? 1 : 0),
    winAttempts: prev.winAttempts + (input.won ? input.attempts : 0),
    winSeconds: prev.winSeconds + (input.won ? Math.max(0, input.seconds) : 0),
  }
  localStorage.setItem(STATS_KEY, JSON.stringify(next))
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
