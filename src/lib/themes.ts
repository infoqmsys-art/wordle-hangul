export type BoardThemeId =
  | 'default'
  | 'cat'
  | 'sakura'
  | 'lemon'
  | 'mint'
  | 'sky'
  | 'candy'

export type BoardTheme = {
  id: BoardThemeId
  name: string
  description: string
  /** 0이면 기본 무료 */
  tokenCost: number
}

export const THEME_TOKEN_COST = 150
export const THEME_TRIAL_GAMES = 3

export const BOARD_THEMES: BoardTheme[] = [
  {
    id: 'default',
    name: '기본',
    description: '푸들푸들 기본 톤',
    tokenCost: 0,
  },
  {
    id: 'cat',
    name: '고양이',
    description: '크림·살구빛 귀여운 톤',
    tokenCost: THEME_TOKEN_COST,
  },
  {
    id: 'sakura',
    name: '벚꽃',
    description: '분홍·라벤더 파스텔',
    tokenCost: THEME_TOKEN_COST,
  },
  {
    id: 'lemon',
    name: '레몬',
    description: '상큼한 노랑·시트러스',
    tokenCost: THEME_TOKEN_COST,
  },
  {
    id: 'mint',
    name: '민트',
    description: '시원한 민트·연두',
    tokenCost: THEME_TOKEN_COST,
  },
  {
    id: 'sky',
    name: '하늘',
    description: '맑은 하늘색·구름톤',
    tokenCost: THEME_TOKEN_COST,
  },
  {
    id: 'candy',
    name: '캔디',
    description: '통통 튀는 사탕 색',
    tokenCost: THEME_TOKEN_COST,
  },
]

export const DEFAULT_THEME: BoardThemeId = 'default'
const EQUIP_KEY = 'wordle-hangul-board-theme'
const TRIAL_KEY = 'wordle-hangul-theme-trial-v2'

export type ThemeTrial = {
  themeId: BoardThemeId
  gamesLeft: number
}

export function isBoardThemeId(value: string): value is BoardThemeId {
  return BOARD_THEMES.some((t) => t.id === value)
}

export function getBoardTheme(id: string): BoardTheme | undefined {
  return BOARD_THEMES.find((t) => t.id === id)
}

export function freeThemeIds(): BoardThemeId[] {
  return BOARD_THEMES.filter((t) => t.tokenCost <= 0).map((t) => t.id)
}

export function parseOwnedThemeIds(raw: unknown): BoardThemeId[] {
  const free = freeThemeIds()
  const owned = new Set<BoardThemeId>(free)
  if (Array.isArray(raw)) {
    for (const id of raw) {
      if (typeof id === 'string' && isBoardThemeId(id)) owned.add(id)
    }
  }
  return [...owned]
}

export function loadEquippedTheme(): BoardThemeId {
  try {
    const raw = localStorage.getItem(EQUIP_KEY) ?? ''
    if (isBoardThemeId(raw)) return raw
  } catch {
    /* ignore */
  }
  return DEFAULT_THEME
}

export function saveEquippedTheme(id: BoardThemeId) {
  try {
    localStorage.setItem(EQUIP_KEY, id)
  } catch {
    /* ignore */
  }
}

export function loadThemeTrial(): ThemeTrial | null {
  try {
    const raw = localStorage.getItem(TRIAL_KEY)
    if (!raw) return null
    const data = JSON.parse(raw) as ThemeTrial
    if (!isBoardThemeId(data.themeId)) return null
    const left = Math.floor(Number(data.gamesLeft ?? 0))
    if (left <= 0) {
      localStorage.removeItem(TRIAL_KEY)
      return null
    }
    return { themeId: data.themeId, gamesLeft: left }
  } catch {
    return null
  }
}

export function startThemeTrial(themeId: BoardThemeId): ThemeTrial {
  const trial: ThemeTrial = {
    themeId,
    gamesLeft: THEME_TRIAL_GAMES,
  }
  try {
    localStorage.setItem(TRIAL_KEY, JSON.stringify(trial))
  } catch {
    /* ignore */
  }
  return trial
}

export function clearThemeTrial() {
  try {
    localStorage.removeItem(TRIAL_KEY)
  } catch {
    /* ignore */
  }
}

/** 한 판 종료 시 체험 차감. 만료되면 null */
export function consumeThemeTrialGame(): ThemeTrial | null {
  const trial = loadThemeTrial()
  if (!trial) return null
  const nextLeft = trial.gamesLeft - 1
  if (nextLeft <= 0) {
    clearThemeTrial()
    return null
  }
  const next: ThemeTrial = { themeId: trial.themeId, gamesLeft: nextLeft }
  try {
    localStorage.setItem(TRIAL_KEY, JSON.stringify(next))
  } catch {
    /* ignore */
  }
  return next
}

export function canUseTheme(
  themeId: BoardThemeId,
  ownedIds: readonly string[],
  trial: ThemeTrial | null,
): boolean {
  if (themeId === DEFAULT_THEME) return true
  if (ownedIds.includes(themeId)) return true
  if (trial && trial.themeId === themeId && trial.gamesLeft > 0) return true
  return false
}

export function resolveActiveTheme(
  equipped: BoardThemeId,
  ownedIds: readonly string[],
  trial: ThemeTrial | null,
  preview: BoardThemeId | null,
): BoardThemeId {
  if (preview && isBoardThemeId(preview)) return preview
  if (canUseTheme(equipped, ownedIds, trial)) return equipped
  if (trial && trial.gamesLeft > 0) return trial.themeId
  return DEFAULT_THEME
}
