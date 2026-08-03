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
/** 비로그인·폴백용 안정 참조 (매 렌더 새 배열 만들지 않기) */
export const DEFAULT_OWNED_THEME_IDS: readonly BoardThemeId[] = [DEFAULT_THEME]

const EQUIP_KEY = 'wordle-hangul-board-theme'
/** v3: 계정별·테마별 체험. 오류 패치로 v2는 버리고 초기화 */
const TRIAL_KEY = 'wordle-hangul-theme-trial-v3'
const LEGACY_TRIAL_KEYS = [
  'wordle-hangul-theme-trial-v2',
  'wordle-hangul-theme-trial',
]

/** UI용 요약 (특정 테마의 남은 체험 판수) */
export type ThemeTrial = {
  themeId: BoardThemeId
  gamesLeft: number
}

/** 계정별 체험 저장 — 테마마다 독립 */
export type ThemeTrialStore = {
  /** themeId → 남은 판수. 없음=미시작(시작 가능), 0=소진 */
  remaining: Partial<Record<BoardThemeId, number>>
}

function accountStorageKey(base: string, accountKey: string): string {
  return `${base}:${accountKey || 'guest'}`
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

export function loadEquippedTheme(accountKey = 'guest'): BoardThemeId {
  try {
    const scoped = localStorage.getItem(accountStorageKey(EQUIP_KEY, accountKey))
    if (scoped && isBoardThemeId(scoped)) return scoped
    if (accountKey === 'guest') {
      const legacy = localStorage.getItem(EQUIP_KEY) ?? ''
      if (isBoardThemeId(legacy)) {
        saveEquippedTheme(legacy, accountKey)
        return legacy
      }
    }
  } catch {
    /* ignore */
  }
  return DEFAULT_THEME
}

export function saveEquippedTheme(id: BoardThemeId, accountKey = 'guest') {
  try {
    localStorage.setItem(accountStorageKey(EQUIP_KEY, accountKey), id)
  } catch {
    /* ignore */
  }
}

function wipeLegacyTrialKeys(accountKey: string) {
  try {
    for (const base of LEGACY_TRIAL_KEYS) {
      localStorage.removeItem(base)
      localStorage.removeItem(accountStorageKey(base, accountKey))
    }
  } catch {
    /* ignore */
  }
}

export function emptyTrialStore(): ThemeTrialStore {
  return { remaining: {} }
}

export function loadTrialStore(accountKey = 'guest'): ThemeTrialStore {
  wipeLegacyTrialKeys(accountKey)
  try {
    const raw = localStorage.getItem(accountStorageKey(TRIAL_KEY, accountKey))
    if (!raw) return emptyTrialStore()
    const data = JSON.parse(raw) as ThemeTrialStore
    const remaining: ThemeTrialStore['remaining'] = {}
    if (data && typeof data.remaining === 'object' && data.remaining) {
      for (const [id, left] of Object.entries(data.remaining)) {
        if (!isBoardThemeId(id)) continue
        const n = Math.floor(Number(left))
        if (Number.isFinite(n) && n >= 0) remaining[id] = n
      }
    }
    return { remaining }
  } catch {
    return emptyTrialStore()
  }
}

export function saveTrialStore(store: ThemeTrialStore, accountKey = 'guest') {
  try {
    localStorage.setItem(
      accountStorageKey(TRIAL_KEY, accountKey),
      JSON.stringify(store),
    )
  } catch {
    /* ignore */
  }
}

export function trialGamesLeft(
  store: ThemeTrialStore,
  themeId: BoardThemeId,
): number {
  return Math.max(0, Math.floor(Number(store.remaining[themeId] ?? 0)))
}

/** 아직 시작 안 했거나 진행 중이면 true. 0(소진)이면 false */
export function canStartThemeTrial(
  themeId: BoardThemeId,
  store: ThemeTrialStore,
  ownedIds: readonly string[],
): boolean {
  if (themeId === DEFAULT_THEME) return false
  if (ownedIds.includes(themeId)) return false
  const left = store.remaining[themeId]
  if (left === 0) return false
  return true
}

export function getActiveTrial(
  store: ThemeTrialStore,
  themeId: BoardThemeId,
): ThemeTrial | null {
  const left = trialGamesLeft(store, themeId)
  if (left <= 0) return null
  return { themeId, gamesLeft: left }
}

/** 테마별 체험 시작(또는 이어하기). 소진된 테마는 null */
export function startThemeTrial(
  themeId: BoardThemeId,
  accountKey = 'guest',
): ThemeTrial | null {
  if (themeId === DEFAULT_THEME) return null
  const store = loadTrialStore(accountKey)
  const cur = store.remaining[themeId]
  if (cur === 0) return null
  if (cur == null) {
    store.remaining[themeId] = THEME_TRIAL_GAMES
    saveTrialStore(store, accountKey)
    return { themeId, gamesLeft: THEME_TRIAL_GAMES }
  }
  return { themeId, gamesLeft: cur }
}

/** 특정 테마 체험 제거(구매 시). 없으면 전체 스토어 유지 */
export function clearThemeTrial(
  accountKey = 'guest',
  themeId?: BoardThemeId,
) {
  const store = loadTrialStore(accountKey)
  if (themeId) {
    delete store.remaining[themeId]
    saveTrialStore(store, accountKey)
    return
  }
  try {
    localStorage.removeItem(accountStorageKey(TRIAL_KEY, accountKey))
  } catch {
    /* ignore */
  }
}

/**
 * 한 판 종료 시 장착 중인 체험 테마만 1판 차감.
 * owned면 차감 안 함. 반환 = 해당 테마 남은 체험(없으면 null)
 */
export function consumeThemeTrialGame(
  accountKey = 'guest',
  equippedThemeId: BoardThemeId,
  ownedIds: readonly string[] = [],
): ThemeTrial | null {
  if (equippedThemeId === DEFAULT_THEME) return null
  if (ownedIds.includes(equippedThemeId)) return null

  const store = loadTrialStore(accountKey)
  const left = store.remaining[equippedThemeId]
  if (left == null || left <= 0) return null

  const nextLeft = left - 1
  store.remaining[equippedThemeId] = nextLeft
  saveTrialStore(store, accountKey)
  if (nextLeft <= 0) return null
  return { themeId: equippedThemeId, gamesLeft: nextLeft }
}

export function canUseTheme(
  themeId: BoardThemeId,
  ownedIds: readonly string[],
  store: ThemeTrialStore | null,
): boolean {
  if (themeId === DEFAULT_THEME) return true
  if (ownedIds.includes(themeId)) return true
  if (store && trialGamesLeft(store, themeId) > 0) return true
  return false
}

export function resolveActiveTheme(
  equipped: BoardThemeId,
  ownedIds: readonly string[],
  store: ThemeTrialStore | null,
): BoardThemeId {
  if (canUseTheme(equipped, ownedIds, store)) return equipped
  return DEFAULT_THEME
}
