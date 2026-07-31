import type { Difficulty } from '../data/words'
import { formatDateKey } from './game'

/** 버전 올리면 모든 브라우저의 '오늘 완료' 잠금이 초기화됨 */
const DAILY_DONE_KEY = 'wordle-hangul-daily-done-v2'

type DailyDone = {
  dateKey: string
  easy?: boolean
  hard?: boolean
}

function readDone(): DailyDone {
  try {
    const raw = localStorage.getItem(DAILY_DONE_KEY)
    if (!raw) return { dateKey: formatDateKey() }
    const parsed = JSON.parse(raw) as DailyDone
    if (!parsed || typeof parsed !== 'object') {
      return { dateKey: formatDateKey() }
    }
    const today = formatDateKey()
    if (parsed.dateKey !== today) return { dateKey: today }
    return {
      dateKey: today,
      easy: Boolean(parsed.easy),
      hard: Boolean(parsed.hard),
    }
  } catch {
    return { dateKey: formatDateKey() }
  }
}

function writeDone(done: DailyDone) {
  localStorage.setItem(DAILY_DONE_KEY, JSON.stringify(done))
}

/** 오늘 해당 난이도 오늘의 단어를 이미 끝냈는지 */
export function isDailyDone(difficulty: Difficulty): boolean {
  const done = readDone()
  return Boolean(done[difficulty])
}

export function markDailyDone(difficulty: Difficulty) {
  const done = readDone()
  done[difficulty] = true
  writeDone(done)
}

export function getDailyDoneToday(): { easy: boolean; hard: boolean } {
  const done = readDone()
  return {
    easy: Boolean(done.easy),
    hard: Boolean(done.hard),
  }
}
