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
export const DEFAULT_OWNED_THEME_IDS: readonly BoardThemeId[] = [DEFAULT_THEME]

const EQUIP_KEY = 'wordle-hangul-board-theme'
/** v4: 한 번에 하나의 강제 3판 체험 */
const TRIAL_KEY = 'wordle-hangul-theme-trial-v4'
const LEGACY_TRIAL_KEYS = [
  'wordle-hangul-theme-trial-v3',
  'wordle-hangul-theme-trial-v2',
  'wordle-hangul-theme-trial',
]

/** 진행 중인 강제 체험 */
export type ActiveThemeTrial = {
  themeId: BoardThemeId
  gamesLeft: number
  /** 3판 끝나면 돌아갈 장착 (보유/기본) */
  restoreId: BoardThemeId
}

export type ThemeTrialStore = {
  active: ActiveThemeTrial | null
  /** 이미 3판 체험을 마친 테마 (재체험 불가) */
  used: BoardThemeId[]
}

/** @deprecated UI 호환용 별칭 */
export type ThemeTrial = ActiveThemeTrial

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
  return { active: null, used: [] }
}

export function loadTrialStore(accountKey = 'guest'): ThemeTrialStore {
  wipeLegacyTrialKeys(accountKey)
  try {
    const raw = localStorage.getItem(accountStorageKey(TRIAL_KEY, accountKey))
    if (!raw) return emptyTrialStore()
    const data = JSON.parse(raw) as Partial<ThemeTrialStore>
    const used: BoardThemeId[] = []
    if (Array.isArray(data.used)) {
      for (const id of data.used) {
        if (typeof id === 'string' && isBoardThemeId(id) && !used.includes(id)) {
          used.push(id)
        }
      }
    }
    let active: ActiveThemeTrial | null = null
    const a = data.active
    if (
      a &&
      isBoardThemeId(String(a.themeId)) &&
      isBoardThemeId(String(a.restoreId ?? DEFAULT_THEME))
    ) {
      const gamesLeft = Math.floor(Number(a.gamesLeft ?? 0))
      if (gamesLeft > 0) {
        active = {
          themeId: a.themeId as BoardThemeId,
          gamesLeft,
          restoreId: (a.restoreId as BoardThemeId) || DEFAULT_THEME,
        }
      } else if (!used.includes(a.themeId as BoardThemeId)) {
        used.push(a.themeId as BoardThemeId)
      }
    }
    return { active, used }
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

export function getActiveTrial(store: ThemeTrialStore): ActiveThemeTrial | null {
  if (!store.active || store.active.gamesLeft <= 0) return null
  return store.active
}

export function trialGamesLeft(
  store: ThemeTrialStore,
  themeId?: BoardThemeId,
): number {
  const active = getActiveTrial(store)
  if (!active) return 0
  if (themeId && active.themeId !== themeId) return 0
  return active.gamesLeft
}

export function isThemeTrialUsed(
  store: ThemeTrialStore,
  themeId: BoardThemeId,
): boolean {
  return store.used.includes(themeId)
}

/** 새 체험 시작 가능 여부 (다른 체험 중·이미 사용·보유면 불가) */
export function canStartThemeTrial(
  themeId: BoardThemeId,
  store: ThemeTrialStore,
  ownedIds: readonly string[],
): boolean {
  if (themeId === DEFAULT_THEME) return false
  if (ownedIds.includes(themeId)) return false
  if (getActiveTrial(store)) return false
  if (isThemeTrialUsed(store, themeId)) return false
  return true
}

/**
 * 강제 3판 체험 시작.
 * restoreId = 체험 전 장착(보유 테마만, 아니면 기본)
 */
export function startThemeTrial(
  themeId: BoardThemeId,
  accountKey = 'guest',
  restoreId: BoardThemeId = DEFAULT_THEME,
): ActiveThemeTrial | null {
  const store = loadTrialStore(accountKey)
  if (themeId === DEFAULT_THEME) return null
  if (getActiveTrial(store)) return null
  if (store.used.includes(themeId)) return null

  const restore =
    restoreId !== themeId && isBoardThemeId(restoreId)
      ? restoreId
      : DEFAULT_THEME

  const active: ActiveThemeTrial = {
    themeId,
    gamesLeft: THEME_TRIAL_GAMES,
    restoreId: restore,
  }
  saveTrialStore({ ...store, active }, accountKey)
  saveEquippedTheme(themeId, accountKey)
  return active
}

/** 체험 종료 후 restore 장착 반환. themeId 지정 시 해당 활성만 해제 */
export function endThemeTrial(
  accountKey = 'guest',
  opts: { markUsed?: boolean; themeId?: BoardThemeId } = {},
): BoardThemeId {
  const store = loadTrialStore(accountKey)
  const active = store.active
  if (!active) return loadEquippedTheme(accountKey)
  if (opts.themeId && active.themeId !== opts.themeId) {
    return loadEquippedTheme(accountKey)
  }

  const used = [...store.used]
  if (opts.markUsed !== false && !used.includes(active.themeId)) {
    used.push(active.themeId)
  }
  const restoreId =
    active.restoreId === active.themeId ? DEFAULT_THEME : active.restoreId
  saveTrialStore({ active: null, used }, accountKey)
  saveEquippedTheme(restoreId, accountKey)
  return restoreId
}

/** 구매로 체험 종료 — used 표시 없이 구매 테마 유지 */
export function clearThemeTrial(
  accountKey = 'guest',
  themeId?: BoardThemeId,
) {
  const store = loadTrialStore(accountKey)
  if (!store.active) return
  if (themeId && store.active.themeId !== themeId) {
    // 다른 테마 구매: 진행 중 체험은 복귀 후 유지
    if (getActiveTrial(store)) {
      endThemeTrial(accountKey, { markUsed: false })
    }
    return
  }
  // 체험 중이던 테마를 사면 used로 넣고 체험만 끝냄 (장착은 호출측에서)
  const used = [...store.used]
  if (!used.includes(store.active.themeId)) used.push(store.active.themeId)
  saveTrialStore({ active: null, used }, accountKey)
}

/**
 * 한 판 종료 → 체험 1판 차감.
 * 0이 되면 자동 복귀하고 restoreId를 equipped에 저장.
 * 반환: 남은 체험(없으면 null)
 */
export function consumeThemeTrialGame(
  accountKey = 'guest',
): ActiveThemeTrial | null {
  const store = loadTrialStore(accountKey)
  const active = getActiveTrial(store)
  if (!active) return null

  const nextLeft = active.gamesLeft - 1
  if (nextLeft <= 0) {
    endThemeTrial(accountKey, { markUsed: true })
    return null
  }

  const next: ActiveThemeTrial = { ...active, gamesLeft: nextLeft }
  saveTrialStore({ ...store, active: next }, accountKey)
  // 체험 중엔 항상 체험 테마 강제
  saveEquippedTheme(active.themeId, accountKey)
  return next
}

export function canUseTheme(
  themeId: BoardThemeId,
  ownedIds: readonly string[],
  store: ThemeTrialStore | null,
): boolean {
  if (themeId === DEFAULT_THEME) return true
  if (ownedIds.includes(themeId)) return true
  const active = store ? getActiveTrial(store) : null
  if (active && active.themeId === themeId) return true
  return false
}

/** 체험 중이면 무조건 체험 테마 */
export function resolveActiveTheme(
  equipped: BoardThemeId,
  ownedIds: readonly string[],
  store: ThemeTrialStore | null,
): BoardThemeId {
  const active = store ? getActiveTrial(store) : null
  if (active) return active.themeId
  if (canUseTheme(equipped, ownedIds, store)) return equipped
  return DEFAULT_THEME
}
