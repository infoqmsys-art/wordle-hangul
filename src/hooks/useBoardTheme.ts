import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  DEFAULT_THEME,
  canStartThemeTrial,
  canUseTheme,
  clearThemeTrial,
  consumeThemeTrialGame,
  getActiveTrial,
  isBoardThemeId,
  loadEquippedTheme,
  loadTrialStore,
  resolveActiveTheme,
  saveEquippedTheme,
  startThemeTrial,
  trialGamesLeft,
  type BoardThemeId,
  type ThemeTrial,
  type ThemeTrialStore,
} from '../lib/themes'

type Options = {
  /** 로그인 uid 또는 guest — 로컬 장착/체험 격리 */
  accountKey?: string
  ownedThemeIds?: readonly string[]
  equippedFromCloud?: string | null
}

/**
 * 계정 진입 시에만 클라우드/로컬을 한 번 맞춘다.
 * 이후 세션에서는 로컬 장착이 소스 오브 트루스 (힌트·XP 동기화에 안 덮임).
 */
function resolveForAccount(
  accountKey: string,
  ownedThemeIds: readonly string[],
  equippedFromCloud: string | null | undefined,
): { equippedId: BoardThemeId; store: ThemeTrialStore } {
  const store = loadTrialStore(accountKey)
  const local = loadEquippedTheme(accountKey)
  const cloud =
    equippedFromCloud && isBoardThemeId(equippedFromCloud)
      ? equippedFromCloud
      : null

  // 로컬이 쓸 수 있으면 우선 (체험·보유 장착 유지)
  if (canUseTheme(local, ownedThemeIds, store)) {
    return { equippedId: local, store }
  }

  // 로컬이 막혔을 때만 클라우드
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

  // 계정 전환 시에만 리셋 (owned/cloud 참조 변경으로는 절대 덮지 않음)
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
    // eslint-disable-next-line react-hooks/exhaustive-deps -- 계정 키가 바뀔 때만
  }, [accountKey])

  // 보유 목록이 늘어난 뒤(구매)에도 현재 장착이 유효한지만 검사
  useEffect(() => {
    if (!canUseTheme(equippedId, ownedThemeIds, trialStore)) {
      const fallback = resolveForAccount(
        accountKey,
        ownedThemeIds,
        options.equippedFromCloud,
      )
      setEquippedIdState(fallback.equippedId)
    }
    // ownedKey로 배열 참조  thrash 방지
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [accountKey, equippedId, ownedKey, trialStore])

  const themeId = useMemo(
    () => resolveActiveTheme(equippedId, ownedThemeIds, trialStore),
    [equippedId, ownedThemeIds, trialStore],
  )

  const trial: ThemeTrial | null = useMemo(() => {
    if (ownedThemeIds.includes(equippedId)) return null
    return getActiveTrial(trialStore, equippedId)
  }, [equippedId, ownedThemeIds, trialStore])

  const setEquippedId = useCallback(
    (id: BoardThemeId) => {
      setEquippedIdState(id)
      saveEquippedTheme(id, accountKey)
    },
    [accountKey],
  )

  const equipLocal = useCallback(
    (id: BoardThemeId) => {
      if (!canUseTheme(id, ownedThemeIds, trialStore)) return false
      setEquippedId(id)
      return true
    },
    [ownedThemeIds, setEquippedId, trialStore],
  )

  const startTrial = useCallback(
    (id: BoardThemeId) => {
      if (!canStartThemeTrial(id, loadTrialStore(accountKey), ownedThemeIds)) {
        return null
      }
      const next = startThemeTrial(id, accountKey)
      if (!next) return null
      setTrialStore(loadTrialStore(accountKey))
      setEquippedId(id)
      return next
    },
    [accountKey, ownedThemeIds, setEquippedId],
  )

  const consumeTrialGame = useCallback(() => {
    const equipped = loadEquippedTheme(accountKey)
    const before = loadTrialStore(accountKey)
    if (trialGamesLeft(before, equipped) <= 0) return
    if (ownedThemeIds.includes(equipped)) return

    consumeThemeTrialGame(accountKey, equipped, ownedThemeIds)
    const after = loadTrialStore(accountKey)
    setTrialStore(after)

    if (trialGamesLeft(after, equipped) <= 0) {
      setEquippedIdState((prev) => {
        if (prev === equipped && !ownedThemeIds.includes(prev)) {
          saveEquippedTheme(DEFAULT_THEME, accountKey)
          return DEFAULT_THEME
        }
        return prev
      })
    }
  }, [accountKey, ownedThemeIds])

  const endTrial = useCallback(
    (themeId?: BoardThemeId) => {
      clearThemeTrial(accountKey, themeId)
      setTrialStore(loadTrialStore(accountKey))
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
    trialStore,
    trialGamesLeft: trial?.gamesLeft ?? 0,
    gamesLeftFor,
    canTrial,
    equipLocal,
    /** 미리보기는 상점 미니카드만 — 앱 전역 테마는 바꾸지 않음 */
    preview: (_id: BoardThemeId | null) => {},
    startTrial,
    consumeTrialGame,
    endTrial,
    setEquippedId,
  }
}
