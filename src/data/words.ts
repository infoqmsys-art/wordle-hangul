import { dailyIndex, formatDateKey } from '../lib/game'

export type Difficulty = 'easy' | 'hard'

/** 특정 날짜 데일리 정답 수동 지정 (word는 해당 난이도 정답 풀에 있어야 함) */
const DAILY_OVERRIDES: Record<
  string,
  Partial<Record<Difficulty, string>>
> = {
  // 2026-07-31: 온도/갈색 → 새로 교체
  '2026-07-31': { easy: '라면', hard: '교과서' },
}

export type WordEntry = {
  word: string
  jamo: string[]
}

export type Dictionary = {
  guesses: Record<string, string>
  answers5: WordEntry[]
  answers7: WordEntry[]
  source: string
}

export const DIFFICULTY_META: Record<
  Difficulty,
  { label: string; wordLength: number; desc: string }
> = {
  easy: { label: '쉬움', wordLength: 5, desc: '자모 5칸' },
  hard: { label: '어려움', wordLength: 7, desc: '자모 7칸' },
}

let cached: Dictionary | null = null
let loading: Promise<Dictionary> | null = null

function jamoKey(jamo: string[]): string {
  return jamo.join('')
}

export async function loadDictionary(): Promise<Dictionary> {
  if (cached) return cached
  if (loading) return loading

  loading = (async () => {
    const base = import.meta.env.BASE_URL
    const [guessRes, a5Res, a7Res] = await Promise.all([
      fetch(`${base}dict/guesses.json`),
      fetch(`${base}dict/answers-5.json`),
      fetch(`${base}dict/answers-7.json`),
    ])
    if (!guessRes.ok || !a5Res.ok || !a7Res.ok) {
      throw new Error('사전 데이터를 불러오지 못했어요')
    }
    cached = {
      guesses: (await guessRes.json()) as Record<string, string>,
      answers5: (await a5Res.json()) as WordEntry[],
      answers7: (await a7Res.json()) as WordEntry[],
      source: '표준국어대사전 명사 + 일상 친숙어',
    }
    return cached
  })()

  try {
    return await loading
  } finally {
    loading = null
  }
}

export function answersForDifficulty(
  dict: Dictionary,
  difficulty: Difficulty,
): WordEntry[] {
  return difficulty === 'hard' ? dict.answers7 : dict.answers5
}

export function isValidGuess(dict: Dictionary, jamo: string[]): boolean {
  return Boolean(dict.guesses[jamoKey(jamo)])
}

export function findWordByJamo(
  dict: Dictionary,
  jamo: string[],
): string | undefined {
  return dict.guesses[jamoKey(jamo)]
}

export function pickRandomAnswer(
  dict: Dictionary,
  difficulty: Difficulty,
  avoidWords: string[] = [],
): WordEntry {
  const answers = answersForDifficulty(dict, difficulty)
  const avoid = new Set(avoidWords)
  const pool = answers.filter((a) => !avoid.has(a.word))
  const source = pool.length > 0 ? pool : answers
  return source[Math.floor(Math.random() * source.length)]
}

export function pickDailyAnswer(
  dict: Dictionary,
  difficulty: Difficulty,
  date = new Date(),
): WordEntry {
  const answers = answersForDifficulty(dict, difficulty)
  const overrideWord = DAILY_OVERRIDES[formatDateKey(date)]?.[difficulty]
  if (overrideWord) {
    const found = answers.find((a) => a.word === overrideWord)
    if (found) return found
  }
  return answers[dailyIndex(answers.length, date)]!
}
