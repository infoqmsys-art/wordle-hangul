import {
  GoogleAuthProvider,
  browserPopupRedirectResolver,
  getRedirectResult,
  onAuthStateChanged,
  signInWithPopup,
  signInWithRedirect,
  signOut,
  type User,
} from 'firebase/auth'
import {
  inAppLoginHint,
  isInAppBrowser,
  openInExternalBrowser,
  preferAuthRedirect,
} from './browser'
import {
  doc,
  getDoc,
  runTransaction,
  serverTimestamp,
  setDoc,
} from 'firebase/firestore'
import { getLastName, renameUserRecords, setLastName } from './history'
import { getFirebaseAuth, getDb, isFirebaseConfigured } from './firebase'
import {
  getPersonalStats,
  setPersonalStats,
  type PersonalStats,
} from './stats'

export type UserProfile = {
  uid: string
  nickname: string
  email: string | null
  photoURL: string | null
} & PersonalStats

export type NicknameSetup = {
  user: User
  suggested: string
  previousName: string
  hasLocalStats: boolean
}

const USERS = 'users'
const NICKNAMES = 'nicknames'

let activeUid: string | null = null

export function authErrorMessage(err: unknown): string | null {
  const code =
    err && typeof err === 'object' && 'code' in err
      ? String((err as { code: string }).code)
      : ''
  const message =
    err instanceof Error ? err.message : typeof err === 'string' ? err : ''

  if (
    code === 'auth/popup-closed-by-user' ||
    code === 'auth/cancelled-popup-request'
  ) {
    return null
  }
  if (code === 'nickname-taken' || message.includes('nickname-taken')) {
    return '이미 사용 중인 닉네임이에요. 다른 이름을 골라 주세요'
  }
  if (code === 'auth/operation-not-allowed') {
    return 'Firebase에서 Google 로그인을 아직 켜지 않았어요'
  }
  if (code === 'auth/unauthorized-domain') {
    const host =
      typeof window !== 'undefined' ? window.location.hostname : ''
    if (host && host !== 'localhost' && host !== '127.0.0.1') {
      return `이 주소(${host})가 Firebase 허용 도메인에 없어요. Authentication → 설정 → 승인된 도메인에 추가해 주세요`
    }
    return '이 주소가 Firebase 허용 도메인에 없어요. Authentication → 설정 → 승인된 도메인에 localhost / 127.0.0.1 / 배포 도메인을 확인해 주세요'
  }
  if (code === 'auth/popup-blocked') {
    return '팝업이 막혔어요. 기본 브라우저(Chrome/Safari)에서 다시 시도해 주세요'
  }
  if (
    code === 'auth/web-storage-unsupported' ||
    message.includes('disallowed_useragent')
  ) {
    return (
      inAppLoginHint() ||
      '이 브라우저에서는 Google 로그인을 쓸 수 없어요. Chrome/Safari로 열어 주세요'
    )
  }
  if (code === 'auth/open-external') {
    return (
      inAppLoginHint() ||
      '기본 브라우저로 열었어요. 거기서 Google 로그인해 주세요'
    )
  }
  if (code === 'permission-denied' || message.includes('permission-denied')) {
    return 'Firestorestore 규칙에 users/nicknames 권한이 필요해요 (콘솔에서 규칙 게시)'
  }
  if (
    message.includes('requested action is invalid') ||
    message.includes('invalid-action')
  ) {
    return 'Google 로그인 설정이 필요해요 (Firebase Authentication → Google 사용)'
  }
  if (message.includes('닉네임을 입력')) return message
  if (code) return `처리 실패 (${code})`
  return '요청 처리에 실패했어요'
}

function nicknameKey(name: string): string {
  return name.trim().normalize('NFC').toLocaleLowerCase('ko-KR')
}

function parseCloudStats(data: Record<string, unknown>): PersonalStats {
  return {
    played: Number(data.played ?? 0),
    wins: Number(data.wins ?? 0),
    winAttempts: Number(data.winAttempts ?? 0),
    winSeconds: Number(data.winSeconds ?? 0),
    currentStreak: Number(data.currentStreak ?? 0),
    maxStreak: Number(data.maxStreak ?? 0),
  }
}

function mergeStats(local: PersonalStats, cloud: PersonalStats): PersonalStats {
  const base = local.played >= cloud.played ? local : cloud
  return {
    ...base,
    maxStreak: Math.max(local.maxStreak, cloud.maxStreak, base.maxStreak),
  }
}

function suggestNickname(user: User): string {
  const previous = getLastName().trim()
  if (previous) return previous.slice(0, 20)
  const fromGoogle = user.displayName?.trim()
  if (fromGoogle) return fromGoogle.slice(0, 20)
  const fromEmail = user.email?.split('@')[0]?.trim()
  if (fromEmail) return fromEmail.slice(0, 20)
  return ''
}

async function readCloudProfile(
  uid: string,
): Promise<{ nickname: string; stats: PersonalStats } | null> {
  try {
    const snap = await getDoc(doc(getDb(), USERS, uid))
    if (!snap.exists()) return null
    const data = snap.data() as Record<string, unknown>
    const nickname = String(data.nickname ?? '').trim()
    if (!nickname) return null
    return { nickname: nickname.slice(0, 20), stats: parseCloudStats(data) }
  } catch {
    return null
  }
}

function toProfile(
  user: User,
  nickname: string,
  stats: PersonalStats,
): UserProfile {
  return {
    uid: user.uid,
    nickname,
    email: user.email,
    photoURL: user.photoURL,
    ...stats,
  }
}

function makeSetup(user: User): NicknameSetup {
  const previousName = getLastName().trim()
  const local = getPersonalStats()
  return {
    user,
    suggested: suggestNickname(user),
    previousName,
    hasLocalStats: local.played > 0 || local.currentStreak > 0,
  }
}

function nicknameTakenError(): Error {
  const err = new Error('nickname-taken') as Error & { code: string }
  err.code = 'nickname-taken'
  return err
}

async function saveProfileWithUniqueNickname(input: {
  uid: string
  nickname: string
  previousNickname?: string
  stats: PersonalStats
  email: string | null
  photoURL: string | null
}): Promise<string> {
  const nickname = input.nickname.trim().slice(0, 20)
  if (!nickname) throw new Error('닉네임을 입력해 주세요')

  const nextKey = nicknameKey(nickname)
  const prevRaw = input.previousNickname?.trim() ?? ''
  const prevKey = prevRaw ? nicknameKey(prevRaw) : ''

  const db = getDb()
  await runTransaction(db, async (tx) => {
    const nickRef = doc(db, NICKNAMES, nextKey)
    const nickSnap = await tx.get(nickRef)
    if (nickSnap.exists()) {
      const owner = String(
        (nickSnap.data() as Record<string, unknown>).uid ?? '',
      )
      if (owner && owner !== input.uid) throw nicknameTakenError()
    }

    if (prevKey && prevKey !== nextKey) {
      const oldRef = doc(db, NICKNAMES, prevKey)
      const oldSnap = await tx.get(oldRef)
      if (oldSnap.exists()) {
        const owner = String(
          (oldSnap.data() as Record<string, unknown>).uid ?? '',
        )
        if (owner === input.uid) tx.delete(oldRef)
      }
    }

    tx.set(
      doc(db, USERS, input.uid),
      {
        nickname,
        email: input.email,
        photoURL: input.photoURL,
        ...input.stats,
        updatedAt: serverTimestamp(),
      },
      { merge: true },
    )
    tx.set(nickRef, {
      uid: input.uid,
      nickname,
      updatedAt: serverTimestamp(),
    })
  })

  return nickname
}

export async function resumeExistingProfile(
  user: User,
): Promise<UserProfile | null> {
  const cloud = await readCloudProfile(user.uid)
  if (!cloud) return null

  const local = getPersonalStats()
  const stats = mergeStats(local, cloud.stats)
  setLastName(cloud.nickname)
  setPersonalStats(stats)

  try {
    await saveProfileWithUniqueNickname({
      uid: user.uid,
      nickname: cloud.nickname,
      previousNickname: cloud.nickname,
      stats,
      email: user.email,
      photoURL: user.photoURL,
    })
  } catch {
    /* keep local profile if nickname registry fails */
  }

  activeUid = user.uid
  return toProfile(user, cloud.nickname, stats)
}

export async function completeNicknameSetup(
  user: User,
  rawName: string,
): Promise<UserProfile> {
  const local = getPersonalStats()
  const nickname = await saveProfileWithUniqueNickname({
    uid: user.uid,
    nickname: rawName,
    stats: local,
    email: user.email,
    photoURL: user.photoURL,
  })

  setLastName(nickname)
  setPersonalStats(local)
  activeUid = user.uid
  return toProfile(user, nickname, local)
}

export async function updateNickname(
  uid: string,
  rawName: string,
  current: UserProfile,
): Promise<UserProfile> {
  const stats: PersonalStats = {
    played: current.played,
    wins: current.wins,
    winAttempts: current.winAttempts,
    winSeconds: current.winSeconds,
    currentStreak: current.currentStreak,
    maxStreak: current.maxStreak,
  }

  const nickname = await saveProfileWithUniqueNickname({
    uid,
    nickname: rawName,
    previousNickname: current.nickname,
    stats,
    email: current.email,
    photoURL: current.photoURL,
  })

  setLastName(nickname)
  try {
    await renameUserRecords(uid, nickname)
  } catch {
    /* account nickname already updated */
  }

  return {
    ...current,
    nickname,
  }
}

export async function pushStatsIfLoggedIn(stats: PersonalStats): Promise<void> {
  if (!activeUid || !isFirebaseConfigured()) return
  try {
    const snap = await getDoc(doc(getDb(), USERS, activeUid))
    const nickname =
      (snap.exists()
        ? String((snap.data() as Record<string, unknown>).nickname ?? '').trim()
        : '') ||
      getLastName().trim() ||
      '플레이어'
    await setDoc(
      doc(getDb(), USERS, activeUid),
      {
        nickname: nickname.slice(0, 20),
        ...stats,
        updatedAt: serverTimestamp(),
      },
      { merge: true },
    )
  } catch {
    /* offline / rules */
  }
}

export type GoogleSignInResult =
  | { status: 'ready'; profile: UserProfile }
  | { status: 'needs-nickname'; setup: NicknameSetup }
  | { status: 'redirecting' }
  | { status: 'needs-external'; hint: string }

function googleProvider(): GoogleAuthProvider {
  const provider = new GoogleAuthProvider()
  provider.setCustomParameters({ prompt: 'select_account' })
  provider.addScope('profile')
  provider.addScope('email')
  return provider
}

async function finishGoogleUser(user: User): Promise<GoogleSignInResult> {
  const existing = await resumeExistingProfile(user)
  if (existing) return { status: 'ready', profile: existing }
  return { status: 'needs-nickname', setup: makeSetup(user) }
}

/** 리다이렉트 로그인 복귀 처리 (앱 시작 시 1회) */
export async function consumeGoogleRedirect(): Promise<GoogleSignInResult | null> {
  if (!isFirebaseConfigured()) return null
  try {
    const result = await getRedirectResult(getFirebaseAuth())
    if (!result?.user) return null
    return finishGoogleUser(result.user)
  } catch (err) {
    console.error('[auth] redirect result failed', err)
    throw err
  }
}

export async function signInWithGoogle(): Promise<GoogleSignInResult> {
  if (!isFirebaseConfigured()) {
    throw new Error('Firebase 설정이 없습니다')
  }

  // 카톡 등 인앱: Google이 OAuth 자체를 차단 → 외부 브라우저 유도
  if (isInAppBrowser()) {
    openInExternalBrowser()
    return {
      status: 'needs-external',
      hint:
        inAppLoginHint() ||
        '기본 브라우저(Chrome/Safari)로 열어 다시 로그인해 주세요',
    }
  }

  const auth = getFirebaseAuth()
  const provider = googleProvider()

  if (preferAuthRedirect()) {
    await signInWithRedirect(auth, provider)
    return { status: 'redirecting' }
  }

  try {
    const result = await signInWithPopup(
      auth,
      provider,
      browserPopupRedirectResolver,
    )
    return finishGoogleUser(result.user)
  } catch (err) {
    const code =
      err && typeof err === 'object' && 'code' in err
        ? String((err as { code: string }).code)
        : ''
    if (code === 'auth/popup-blocked') {
      await signInWithRedirect(auth, provider)
      return { status: 'redirecting' }
    }
    throw err
  }
}

export async function signOutUser(): Promise<void> {
  if (!isFirebaseConfigured()) return
  activeUid = null
  await signOut(getFirebaseAuth())
}

export type AuthListenerState =
  | { status: 'signed-out' }
  | { status: 'ready'; profile: UserProfile }
  | { status: 'needs-nickname'; setup: NicknameSetup }

export function subscribeAuth(
  onChange: (state: AuthListenerState) => void,
): () => void {
  if (!isFirebaseConfigured()) {
    onChange({ status: 'signed-out' })
    return () => undefined
  }

  return onAuthStateChanged(getFirebaseAuth(), async (user) => {
    if (!user) {
      activeUid = null
      onChange({ status: 'signed-out' })
      return
    }
    try {
      const existing = await resumeExistingProfile(user)
      if (existing) {
        onChange({ status: 'ready', profile: existing })
        return
      }
      onChange({ status: 'needs-nickname', setup: makeSetup(user) })
    } catch {
      onChange({ status: 'needs-nickname', setup: makeSetup(user) })
    }
  })
}

export function isAuthEnabled(): boolean {
  return isFirebaseConfigured()
}
