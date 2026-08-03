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
export const THEME_TRIAL_MS = 15 * 60 * 1000

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
const TRIAL_KEY = 'wordle-hangul-theme-trial'

export type ThemeTrial = {
  themeId: BoardThemeId
  expiresAt: number
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

export function loadThemeTrial(now = Date.now()): ThemeTrial | null {
  try {
    const raw = localStorage.getItem(TRIAL_KEY)
    if (!raw) return null
    const data = JSON.parse(raw) as ThemeTrial
    if (!isBoardThemeId(data.themeId) || !data.expiresAt) return null
    if (data.expiresAt <= now) {
      localStorage.removeItem(TRIAL_KEY)
      return null
    }
    return data
  } catch {
    return null
  }
}

export function startThemeTrial(themeId: BoardThemeId, now = Date.now()): ThemeTrial {
  const trial: ThemeTrial = {
    themeId,
    expiresAt: now + THEME_TRIAL_MS,
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

export function canUseTheme(
  themeId: BoardThemeId,
  ownedIds: readonly string[],
  trial: ThemeTrial | null,
  now = Date.now(),
): boolean {
  if (themeId === DEFAULT_THEME) return true
  if (ownedIds.includes(themeId)) return true
  if (trial && trial.themeId === themeId && trial.expiresAt > now) return true
  return false
}

export function resolveActiveTheme(
  equipped: BoardThemeId,
  ownedIds: readonly string[],
  trial: ThemeTrial | null,
  preview: BoardThemeId | null,
  now = Date.now(),
): BoardThemeId {
  if (preview && isBoardThemeId(preview)) return preview
  if (canUseTheme(equipped, ownedIds, trial, now)) return equipped
  if (trial && trial.expiresAt > now) return trial.themeId
  return DEFAULT_THEME
}
