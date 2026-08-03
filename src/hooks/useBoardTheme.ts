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

function resolveForAccount(
  accountKey: string,
  ownedThemeIds: readonly string[],
  equippedFromCloud: string | null | undefined,
): { equippedId: BoardThemeId; store: ThemeTrialStore } {
  const store = loadTrialStore(accountKey)
  const cloud =
    equippedFromCloud && isBoardThemeId(equippedFromCloud)
      ? equippedFromCloud
      : null

  if (cloud && canUseTheme(cloud, ownedThemeIds, store)) {
    saveEquippedTheme(cloud, accountKey)
    return { equippedId: cloud, store }
  }

  const local = loadEquippedTheme(accountKey)
  if (canUseTheme(local, ownedThemeIds, store)) {
    return { equippedId: local, store }
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
  const [equippedId, setEquippedId] = useState<BoardThemeId>(
    () => initial.equippedId,
  )
  const [previewId, setPreviewId] = useState<BoardThemeId | null>(null)
  const [trialStore, setTrialStore] = useState<ThemeTrialStore>(
    () => initial.store,
  )
  const accountRef = useRef(accountKey)

  // 계정 전환 시 해당 계정 로컬+클라우드 상태로 리셋
  useEffect(() => {
    if (accountRef.current === accountKey) return
    accountRef.current = accountKey
    setPreviewId(null)
    const next = resolveForAccount(
      accountKey,
      ownedThemeIds,
      options.equippedFromCloud,
    )
    setTrialStore(next.store)
    setEquippedId(next.equippedId)
  }, [accountKey, ownedThemeIds, options.equippedFromCloud])

  // 같은 계정에서 클라우드 장착/보유 목록이 갱신될 때 (구매·장착 후)
  useEffect(() => {
    if (accountRef.current !== accountKey) return
    const cloud = options.equippedFromCloud
    if (!cloud || !isBoardThemeId(cloud)) return
    if (cloud !== DEFAULT_THEME && !ownedThemeIds.includes(cloud)) return

    const local = loadEquippedTheme(accountKey)
    const localTrialLeft = trialGamesLeft(trialStore, local)
    // 체험 중인 테마를 기본/다른 장착으로 덮지 않음
    if (
      localTrialLeft > 0 &&
      !ownedThemeIds.includes(local) &&
      cloud !== local
    ) {
      return
    }

    setEquippedId(cloud)
    saveEquippedTheme(cloud, accountKey)
  }, [accountKey, options.equippedFromCloud, ownedThemeIds, trialStore])

  // 체험 종료 후 장착이 막히면 기본으로
  useEffect(() => {
    if (!canUseTheme(equippedId, ownedThemeIds, trialStore)) {
      setEquippedId(DEFAULT_THEME)
      saveEquippedTheme(DEFAULT_THEME, accountKey)
    }
  }, [accountKey, equippedId, ownedThemeIds, trialStore])

  const themeId = useMemo(
    () =>
      resolveActiveTheme(equippedId, ownedThemeIds, trialStore, previewId),
    [equippedId, ownedThemeIds, trialStore, previewId],
  )

  const trial: ThemeTrial | null = useMemo(() => {
    if (ownedThemeIds.includes(equippedId)) return null
    return getActiveTrial(trialStore, equippedId)
  }, [equippedId, ownedThemeIds, trialStore])

  const equipLocal = useCallback(
    (id: BoardThemeId) => {
      if (!canUseTheme(id, ownedThemeIds, trialStore)) return false
      setEquippedId(id)
      saveEquippedTheme(id, accountKey)
      setPreviewId(null)
      return true
    },
    [accountKey, ownedThemeIds, trialStore],
  )

  const preview = useCallback((id: BoardThemeId | null) => {
    setPreviewId(id)
  }, [])

  const startTrial = useCallback(
    (id: BoardThemeId) => {
      if (!canStartThemeTrial(id, loadTrialStore(accountKey), ownedThemeIds)) {
        return null
      }
      const next = startThemeTrial(id, accountKey)
      if (!next) return null
      setTrialStore(loadTrialStore(accountKey))
      setEquippedId(id)
      saveEquippedTheme(id, accountKey)
      setPreviewId(null)
      return next
    },
    [accountKey, ownedThemeIds],
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
      setEquippedId((prev) => {
        if (prev === equipped && !ownedThemeIds.includes(prev)) {
          saveEquippedTheme(DEFAULT_THEME, accountKey)
          return DEFAULT_THEME
        }
        return prev
      })
    }
  }, [accountKey, ownedThemeIds])

  /** 구매한 테마의 체험만 제거 */
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
    previewId,
    trial,
    trialStore,
    trialGamesLeft: trial?.gamesLeft ?? 0,
    gamesLeftFor,
    canTrial,
    equipLocal,
    preview,
    startTrial,
    consumeTrialGame,
    endTrial,
    setEquippedId: (id: BoardThemeId) => {
      setEquippedId(id)
      saveEquippedTheme(id, accountKey)
    },
  }
}
