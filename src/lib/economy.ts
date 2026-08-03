import { doc, getDoc, serverTimestamp, setDoc } from 'firebase/firestore'
import { kstDateKey } from './levels'
import { getDb, isFirebaseConfigured } from './firebase'
import {
  parseUserProgress,
  syncWeekProgress,
  type UserProgress,
} from './progress'
import {
  DEFAULT_THEME,
  getBoardTheme,
  isBoardThemeId,
  parseOwnedThemeIds,
  type BoardThemeId,
} from './themes'

const USERS = 'users'

/** 신규 계정 시작 토큰 */
export const STARTING_TOKENS = 20

/** 하루 무료 힌트 (계정당, 쌓임) */
export const DAILY_FREE_HINTS = 1

export type ShopItem = {
  id: string
  name: string
  description: string
  hintAmount: number
  tokenCost: number
}

export const SHOP_ITEMS: ShopItem[] = [
  {
    id: 'hint-1',
    name: '힌트 1개',
    description: '정답 자모 칸 하나를 알려줘요',
    hintAmount: 1,
    tokenCost: 15,
  },
]

function economyPayload(nickname: string, progress: UserProgress) {
  return {
    nickname: nickname.slice(0, 20),
    hints: progress.hints,
    tokens: progress.tokens,
    lastDailyHintDate: progress.lastDailyHintDate,
    economyVersion: progress.economyVersion,
    claimedMailIds: progress.claimedMailIds,
    ownedThemeIds: progress.ownedThemeIds,
    equippedThemeId: progress.equippedThemeId,
    updatedAt: serverTimestamp(),
  }
}

/** 일일 무료 힌트 + 신규 토큰 시드 */
export function applyDailyEconomyGrant(progress: UserProgress): {
  progress: UserProgress
  grantedHints: number
  seededTokens: boolean
} {
  let next = { ...progress }
  let grantedHints = 0
  let seededTokens = false

  if (!next.economyVersion) {
    next.tokens = Math.max(next.tokens, STARTING_TOKENS)
    next.economyVersion = 1
    seededTokens = true
  }

  const today = kstDateKey()
  if (next.lastDailyHintDate !== today) {
    next.hints += DAILY_FREE_HINTS
    next.lastDailyHintDate = today
    grantedHints = DAILY_FREE_HINTS
  }

  return { progress: next, grantedHints, seededTokens }
}

export async function syncEconomy(
  uid: string,
  nickname: string,
): Promise<{ progress: UserProgress; grantedHints: number }> {
  if (!isFirebaseConfigured()) {
    return { progress: parseUserProgress({}), grantedHints: 0 }
  }

  await syncWeekProgress(uid, nickname)
  const ref = doc(getDb(), USERS, uid)
  const snap = await getDoc(ref)
  const data = (snap.exists() ? snap.data() : {}) as Record<string, unknown>
  const prev = parseUserProgress(data)
  const { progress, grantedHints, seededTokens } = applyDailyEconomyGrant(prev)

  if (grantedHints > 0 || seededTokens || progress.hints !== prev.hints) {
    await setDoc(ref, economyPayload(nickname, progress), { merge: true })
  }

  return { progress, grantedHints }
}

export async function buyShopItem(
  uid: string,
  nickname: string,
  itemId: string,
): Promise<UserProgress> {
  if (!isFirebaseConfigured()) throw new Error('상점을 아직 쓸 수 없어요')

  const item = SHOP_ITEMS.find((i) => i.id === itemId)
  if (!item) throw new Error('상품을 찾을 수 없어요')

  const synced = await syncEconomy(uid, nickname)
  const prev = synced.progress

  if (prev.tokens < item.tokenCost) {
    throw new Error('초크가루가 부족해요')
  }

  const progress: UserProgress = {
    ...prev,
    tokens: prev.tokens - item.tokenCost,
    hints: prev.hints + item.hintAmount,
  }

  await setDoc(
    doc(getDb(), USERS, uid),
    economyPayload(nickname, progress),
    { merge: true },
  )

  return progress
}

export async function buyTheme(
  uid: string,
  nickname: string,
  themeId: string,
): Promise<UserProgress> {
  if (!isFirebaseConfigured()) throw new Error('테마 상점을 아직 쓸 수 없어요')
  if (!isBoardThemeId(themeId)) throw new Error('테마를 찾을 수 없어요')

  const theme = getBoardTheme(themeId)
  if (!theme) throw new Error('테마를 찾을 수 없어요')
  if (theme.tokenCost <= 0) throw new Error('기본 테마는 이미 무료예요')

  const synced = await syncEconomy(uid, nickname)
  const prev = synced.progress
  const owned = parseOwnedThemeIds(prev.ownedThemeIds)

  if (owned.includes(themeId)) {
    throw new Error('이미 보유한 테마예요')
  }
  if (prev.tokens < theme.tokenCost) {
    throw new Error('초크가루가 부족해요')
  }

  const progress: UserProgress = {
    ...prev,
    tokens: prev.tokens - theme.tokenCost,
    ownedThemeIds: [...owned, themeId],
    equippedThemeId: themeId,
  }

  await setDoc(
    doc(getDb(), USERS, uid),
    economyPayload(nickname, progress),
    { merge: true },
  )

  return progress
}

export async function equipTheme(
  uid: string,
  nickname: string,
  themeId: string,
): Promise<UserProgress> {
  if (!isFirebaseConfigured()) throw new Error('테마를 아직 쓸 수 없어요')
  if (!isBoardThemeId(themeId)) throw new Error('테마를 찾을 수 없어요')

  const synced = await syncEconomy(uid, nickname)
  const prev = synced.progress
  const owned = parseOwnedThemeIds(prev.ownedThemeIds)

  if (themeId !== DEFAULT_THEME && !owned.includes(themeId as BoardThemeId)) {
    throw new Error('보유하지 않은 테마예요')
  }

  const progress: UserProgress = {
    ...prev,
    equippedThemeId: themeId,
  }

  await setDoc(
    doc(getDb(), USERS, uid),
    economyPayload(nickname, progress),
    { merge: true },
  )

  return progress
}

export async function consumeHint(
  uid: string,
  nickname: string,
): Promise<UserProgress> {
  if (!isFirebaseConfigured()) throw new Error('힌트를 쓸 수 없어요')

  const synced = await syncEconomy(uid, nickname)
  if (synced.progress.hints < 1) {
    throw new Error('힌트가 없어요')
  }

  const progress: UserProgress = {
    ...synced.progress,
    hints: synced.progress.hints - 1,
  }

  await setDoc(
    doc(getDb(), USERS, uid),
    economyPayload(nickname, progress),
    { merge: true },
  )

  return progress
}
