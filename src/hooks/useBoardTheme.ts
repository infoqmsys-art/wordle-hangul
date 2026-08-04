import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  DEFAULT_THEME,
  canStartThemeTrial,
  canUseTheme,
  clearThemeTrial,
  consumeThemeTrialGame,
  endThemeTrial,
  getActiveTrial,
  isBoardThemeId,
  loadEquippedTheme,
  loadTrialStore,
  resolveActiveTheme,
  saveEquippedTheme,
  startThemeTrial,
  trialGamesLeft,
  type ActiveThemeTrial,
  type BoardThemeId,
  type ThemeTrialStore,
} from '../lib/themes'

type Options = {
  accountKey?: string
  ownedThemeIds?: readonly string[]
  equippedFromCloud?: string | null
}

function resolveForAccount(
  accountKey: string,
  ownedThemeIds: readonly string[],
  equippedFromCloud: string | null | undefined,
): { equippedId: BoardThemeId; store: ThemeTrialStore } {
  const store = loadTrialStore(accountKey)
  const active = getActiveTrial(store)
  // 체험 중이면 무조건 체험 테마
  if (active) {
    saveEquippedTheme(active.themeId, accountKey)
    return { equippedId: active.themeId, store }
  }

  const local = loadEquippedTheme(accountKey)
  if (canUseTheme(local, ownedThemeIds, store)) {
    return { equippedId: local, store }
  }

  const cloud =
    equippedFromCloud && isBoardThemeId(equippedFromCloud)
      ? equippedFromCloud
      : null
  if (cloud && canUseTheme(cloud, ownedThemeIds, store)) {
    saveEquippedTheme(cloud, accountKey)
    return { equippedId: cloud, store }
  }

  saveEquippedTheme(DEFAULT_THEME, accountKey)
  return { equippedId: DEFAULT_THEME, store }
}

export function useBoardTheme(options: Options = {}) {
  const accountKey = options.accountKey || 'guest'
  const ownedThemeIds = options.ownedThemeIds ?? [DEFAULT_THEME]
  const initial = resolveForAccount(
    accountKey,
    ownedThemeIds,
    options.equippedFromCloud,
  )
  const [equippedId, setEquippedIdState] = useState<BoardThemeId>(
    () => initial.equippedId,
  )
  const [trialStore, setTrialStore] = useState<ThemeTrialStore>(
    () => initial.store,
  )
  const accountRef = useRef(accountKey)
  const ownedKey = ownedThemeIds.slice().sort().join(',')

  useEffect(() => {
    if (accountRef.current === accountKey) return
    accountRef.current = accountKey
    const next = resolveForAccount(
      accountKey,
      ownedThemeIds,
      options.equippedFromCloud,
    )
    setTrialStore(next.store)
    setEquippedIdState(next.equippedId)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [accountKey])

  // 체험 중이면 장착 강제 / 보유 변경 후에도 유효성만 맞춤
  useEffect(() => {
    const active = getActiveTrial(trialStore)
    if (active) {
      if (equippedId !== active.themeId) {
        setEquippedIdState(active.themeId)
        saveEquippedTheme(active.themeId, accountKey)
      }
      return
    }
    if (!canUseTheme(equippedId, ownedThemeIds, trialStore)) {
      const fallback = resolveForAccount(
        accountKey,
        ownedThemeIds,
        options.equippedFromCloud,
      )
      setEquippedIdState(fallback.equippedId)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [accountKey, equippedId, ownedKey, trialStore])

  const trial: ActiveThemeTrial | null = useMemo(
    () => getActiveTrial(trialStore),
    [trialStore],
  )
  const trialLocked = Boolean(trial)

  const themeId = useMemo(
    () => resolveActiveTheme(equippedId, ownedThemeIds, trialStore),
    [equippedId, ownedThemeIds, trialStore],
  )

  const setEquippedId = useCallback(
    (id: BoardThemeId) => {
      const store = loadTrialStore(accountKey)
      if (getActiveTrial(store)) return // 체험 중 장착 변경 불가
      setEquippedIdState(id)
      saveEquippedTheme(id, accountKey)
    },
    [accountKey],
  )

  const equipLocal = useCallback(
    (id: BoardThemeId) => {
      if (getActiveTrial(loadTrialStore(accountKey))) return false
      if (!canUseTheme(id, ownedThemeIds, trialStore)) return false
      setEquippedId(id)
      return true
    },
    [accountKey, ownedThemeIds, setEquippedId, trialStore],
  )

  const startTrial = useCallback(
    (id: BoardThemeId) => {
      const store = loadTrialStore(accountKey)
      if (!canStartThemeTrial(id, store, ownedThemeIds)) return null

      const current = loadEquippedTheme(accountKey)
      const restoreId =
        ownedThemeIds.includes(current) || current === DEFAULT_THEME
          ? current
          : DEFAULT_THEME

      const next = startThemeTrial(id, accountKey, restoreId)
      if (!next) return null
      setTrialStore(loadTrialStore(accountKey))
      setEquippedIdState(id)
      return next
    },
    [accountKey, ownedThemeIds],
  )

  const consumeTrialGame = useCallback(() => {
    if (!getActiveTrial(loadTrialStore(accountKey))) return
    const next = consumeThemeTrialGame(accountKey)
    const after = loadTrialStore(accountKey)
    setTrialStore(after)
    if (!next) {
      // 3판 끝 → restore 장착
      const restored = loadEquippedTheme(accountKey)
      setEquippedIdState(restored)
    } else {
      setEquippedIdState(next.themeId)
    }
  }, [accountKey])

  const endTrial = useCallback(
    (themeId?: BoardThemeId) => {
      if (themeId) {
        clearThemeTrial(accountKey, themeId)
      } else {
        endThemeTrial(accountKey, { markUsed: false })
      }
      const after = loadTrialStore(accountKey)
      setTrialStore(after)
      setEquippedIdState(loadEquippedTheme(accountKey))
    },
    [accountKey],
  )

  const gamesLeftFor = useCallback(
    (id: BoardThemeId) => trialGamesLeft(trialStore, id),
    [trialStore],
  )

  const canTrial = useCallback(
    (id: BoardThemeId) => canStartThemeTrial(id, trialStore, ownedThemeIds),
    [trialStore, ownedThemeIds],
  )

  return {
    themeId,
    equippedId,
    trial,
    trialLocked,
    trialStore,
    trialGamesLeft: trial?.gamesLeft ?? 0,
    gamesLeftFor,
    canTrial,
    equipLocal,
    preview: (_id: BoardThemeId | null) => {},
    startTrial,
    consumeTrialGame,
    endTrial,
    setEquippedId,
  }
}
