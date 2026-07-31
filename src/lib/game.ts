export type TileStatus =
  | 'correct'
  | 'present'
  | 'absent'
  | 'empty'
  | 'tbd'
  | 'hint'

export type KeyStatus = 'correct' | 'present' | 'absent' | 'unused'

/** Wordle 방식: 정답 위치 우선 → 남은 글자에서 포함 여부 */
export function evaluateGuess(guess: string[], answer: string[]): TileStatus[] {
  const result: TileStatus[] = Array(guess.length).fill('absent')
  const remaining = [...answer]

  for (let i = 0; i < guess.length; i++) {
    if (guess[i] === answer[i]) {
      result[i] = 'correct'
      remaining[i] = ''
    }
  }

  for (let i = 0; i < guess.length; i++) {
    if (result[i] === 'correct') continue
    const idx = remaining.indexOf(guess[i])
    if (idx !== -1) {
      result[i] = 'present'
      remaining[idx] = ''
    }
  }

  return result
}

const STATUS_RANK: Record<KeyStatus, number> = {
  unused: 0,
  absent: 1,
  present: 2,
  correct: 3,
}

export function mergeKeyStatus(prev: KeyStatus, next: TileStatus): KeyStatus {
  if (next === 'empty' || next === 'tbd') return prev
  if (next === 'hint') {
    return STATUS_RANK.correct > STATUS_RANK[prev] ? 'correct' : prev
  }
  const candidate = next as KeyStatus
  return STATUS_RANK[candidate] > STATUS_RANK[prev] ? candidate : prev
}

/** 날짜 기반 시드로 오늘의 단어 인덱스 선택 */
export function dailyIndex(length: number, date = new Date()): number {
  const y = date.getFullYear()
  const m = date.getMonth() + 1
  const d = date.getDate()
  const seed = y * 10000 + m * 100 + d
  let x = seed ^ 0x9e3779b9
  x = Math.imul(x ^ (x >>> 16), 0x85ebca6b)
  x = Math.imul(x ^ (x >>> 13), 0xc2b2ae35)
  x = (x ^ (x >>> 16)) >>> 0
  return x % length
}

export function formatDateKey(date = new Date()): string {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}
