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
  /** 표준국어대사전 뜻 (빌드 시 캐시된 경우) */
  definition?: string
}

export type Dictionary = {
  guesses: Record<string, string>
  answers5: WordEntry[]
  answers7: WordEntry[]
  /** 정답 단어 → 사전 뜻 */
  definitions: Record<string, string>
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
    const [guessRes, a5Res, a7Res, defRes] = await Promise.all([
      fetch(`${base}dict/guesses.json`),
      fetch(`${base}dict/answers-5.json`),
      fetch(`${base}dict/answers-7.json`),
      fetch(`${base}dict/definitions.json`),
    ])
    if (!guessRes.ok || !a5Res.ok || !a7Res.ok) {
      throw new Error('사전 데이터를 불러오지 못했어요')
    }
    const answers5 = (await a5Res.json()) as WordEntry[]
    const answers7 = (await a7Res.json()) as WordEntry[]
    let definitions: Record<string, string> = {}
    if (defRes.ok) {
      definitions = (await defRes.json()) as Record<string, string>
    } else {
      for (const entry of [...answers5, ...answers7]) {
        if (entry.definition) definitions[entry.word] = entry.definition
      }
    }
    cached = {
      guesses: (await guessRes.json()) as Record<string, string>,
      answers5,
      answers7,
      definitions,
      source: '표준국어대사전 명사(COMMON) + 일상 친숙어',
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

export function findDefinition(
  dict: Dictionary | null | undefined,
  word: string,
): string | null {
  if (!dict || !word) return null
  const direct = dict.definitions[word]
  if (direct) return direct
  const fromAnswers = [...dict.answers5, ...dict.answers7].find(
    (a) => a.word === word,
  )?.definition
  return fromAnswers ?? null
}

function shuffleWords(words: string[]): string[] {
  const next = [...words]
  for (let i = next.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1))
    const tmp = next[i]!
    next[i] = next[j]!
    next[j] = tmp
  }
  return next
}

function practiceDeckKey(difficulty: Difficulty): string {
  // 정답 풀 규모가 바뀌면 버전을 올려 로컬 덱을 다시 섞는다
  return `wordle-hangul-practice-deck-v2-${difficulty}`
}

function loadPracticeDeck(difficulty: Difficulty): string[] {
  try {
    const raw = localStorage.getItem(practiceDeckKey(difficulty))
    if (!raw) return []
    const list = JSON.parse(raw) as unknown
    return Array.isArray(list)
      ? list.filter((w): w is string => typeof w === 'string' && w.length > 0)
      : []
  } catch {
    return []
  }
}

function savePracticeDeck(difficulty: Difficulty, words: string[]): void {
  localStorage.setItem(practiceDeckKey(difficulty), JSON.stringify(words))
}

/** 난이도별 덱에서 하나씩 뽑음 — 한 바퀴 돌기 전엔 같은 단어 재등장 없음 */
export function pickPracticeAnswer(
  dict: Dictionary,
  difficulty: Difficulty,
  recentWords: string[] = [],
): WordEntry {
  const answers = answersForDifficulty(dict, difficulty)
  const byWord = new Map(answers.map((a) => [a.word, a]))

  let deck = loadPracticeDeck(difficulty).filter((w) => byWord.has(w))
  if (deck.length === 0) {
    const recent = new Set(recentWords)
    const fresh = answers.filter((a) => !recent.has(a.word)).map((a) => a.word)
    const late = answers.filter((a) => recent.has(a.word)).map((a) => a.word)
    deck = [...shuffleWords(fresh), ...shuffleWords(late)]
    if (deck.length === 0) {
      deck = shuffleWords(answers.map((a) => a.word))
    }
  }

  const word = deck[0]!
  savePracticeDeck(difficulty, deck.slice(1))
  return byWord.get(word) ?? answers[0]!
}

export function pickRandomAnswer(
  dict: Dictionary,
  difficulty: Difficulty,
  avoidWords: string[] = [],
): WordEntry {
  return pickPracticeAnswer(dict, difficulty, avoidWords)
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
