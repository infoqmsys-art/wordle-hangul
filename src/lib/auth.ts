import {
  createUserWithEmailAndPassword,
  deleteUser,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut,
  type User,
} from 'firebase/auth'
import {
  doc,
  getDoc,
  runTransaction,
  serverTimestamp,
  setDoc,
} from 'firebase/firestore'
import { getLastName, renameUserRecords, setLastName } from './history'
import { getFirebaseAuth, getDb, isFirebaseConfigured } from './firebase'
import type { PendingWeekReward } from './levels'
import { syncEconomy } from './economy'
import {
  emptyProgress,
  parseUserProgress,
  type UserProgress,
} from './progress'
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
  xp: number
  level: number
  weekKey: string
  weekXp: number
  weekWins: number
  weekPlays: number
  weekBestAttempts: number
  weekBestSeconds: number
  lastDailyBonusDate: string
  pendingWeekReward: PendingWeekReward | null
  hints: number
  tokens: number
  lastDailyHintDate: string
  economyVersion: number
  claimedMailIds: string[]
} & PersonalStats

export function getActiveUid(): string | null {
  return activeUid
}

function progressFields(p: UserProgress) {
  return {
    xp: p.xp,
    level: p.level,
    weekKey: p.weekKey,
    weekXp: p.weekXp,
    weekWins: p.weekWins,
    weekPlays: p.weekPlays,
    weekBestAttempts: p.weekBestAttempts,
    weekBestSeconds: p.weekBestSeconds,
    lastDailyBonusDate: p.lastDailyBonusDate,
    pendingWeekReward: p.pendingWeekReward,
    hints: p.hints,
    tokens: p.tokens,
    lastDailyHintDate: p.lastDailyHintDate,
    economyVersion: p.economyVersion,
    claimedMailIds: p.claimedMailIds,
  }
}

/** Firebase Email/Password용 내부 주소 (화면에 안 보임) */
const AUTH_EMAIL_DOMAIN = 'auth.wordle-hangul.web.app'

const USERS = 'users'
const NICKNAMES = 'nicknames'
const MIN_PASSWORD = 6

let activeUid: string | null = null
/** 가입/로그인 처리 중 onAuthStateChanged가 상태를 덮어쓰지 않게 */
let authMutationDepth = 0

function beginAuthMutation() {
  authMutationDepth += 1
}

function endAuthMutation() {
  authMutationDepth = Math.max(0, authMutationDepth - 1)
}

export function authErrorMessage(err: unknown): string | null {
  const code =
    err && typeof err === 'object' && 'code' in err
      ? String((err as { code: string }).code)
      : ''
  const message =
    err instanceof Error ? err.message : typeof err === 'string' ? err : ''

  if (code === 'nickname-taken' || message.includes('nickname-taken')) {
    return '이미 사용 중인 닉네임이에요. 다른 이름을 골라 주세요'
  }
  if (code === 'auth/email-already-in-use') {
    return '이미 가입된 닉네임이에요. 로그인 해 주세요'
  }
  if (
    code === 'auth/invalid-credential' ||
    code === 'auth/wrong-password' ||
    code === 'auth/user-not-found' ||
    code === 'auth/invalid-email'
  ) {
    return '닉네임 또는 비밀번호가 맞지 않아요'
  }
  if (code === 'auth/weak-password') {
    return `비밀번호는 ${MIN_PASSWORD}자만 되면 돼요 (아무 글자나 OK)`
  }
  if (code === 'auth/too-many-requests') {
    return '시도가 너무 많아요. 잠시 후 다시 해 주세요'
  }
  if (code === 'auth/operation-not-allowed') {
    return 'Firebase에서 이메일/비밀번호 로그인을 아직 켜지 않았어요'
  }
  if (code === 'auth/network-request-failed') {
    return '네트워크 연결을 확인해 주세요'
  }
  if (code === 'permission-denied' || message.includes('permission-denied')) {
    return 'Firestorestore 규칙에 users/nicknames 권한이 필요해요 (콘솔에서 규칙 게시)'
  }
  if (message.includes('닉네임을 입력') || message.includes('비밀번호')) {
    return message
  }
  if (code) return `처리 실패 (${code})`
  return '요청 처리에 실패했어요'
}

function nicknameKey(name: string): string {
  return name.trim().normalize('NFC').toLocaleLowerCase('ko-KR')
}

/** 닉네임 → Firebase Auth 이메일 (일관된 매핑) */
export function nicknameToAuthEmail(nickname: string): string {
  const key = nicknameKey(nickname)
  const bytes = new TextEncoder().encode(key)
  let binary = ''
  for (const b of bytes) binary += String.fromCharCode(b)
  const encoded = btoa(binary)
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '')
  return `${encoded}@${AUTH_EMAIL_DOMAIN}`
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

async function readCloudProfile(
  uid: string,
): Promise<{
  nickname: string
  stats: PersonalStats
  progress: UserProgress
} | null> {
  try {
    const snap = await getDoc(doc(getDb(), USERS, uid))
    if (!snap.exists()) return null
    const data = snap.data() as Record<string, unknown>
    const nickname = String(data.nickname ?? '').trim()
    if (!nickname) return null
    return {
      nickname: nickname.slice(0, 20),
      stats: parseCloudStats(data),
      progress: parseUserProgress(data),
    }
  } catch {
    return null
  }
}

function toProfile(
  user: User,
  nickname: string,
  stats: PersonalStats,
  progress: UserProgress = emptyProgress(),
): UserProfile {
  return {
    uid: user.uid,
    nickname,
    email: null,
    photoURL: user.photoURL,
    ...stats,
    ...progressFields(progress),
  }
}

function nicknameTakenError(): Error {
  const err = new Error('nickname-taken') as Error & { code: string }
  err.code = 'nickname-taken'
  return err
}

function validateCredentials(nickname: string, password: string): string {
  const name = nickname.trim()
  if (!name) throw new Error('닉네임을 입력해 주세요')
  if (name.length > 20) throw new Error('닉네임은 20자까지예요')
  if (password.length < MIN_PASSWORD) {
    throw new Error(
      `비밀번호는 ${MIN_PASSWORD}자만 되면 돼요 (아무 글자나 OK)`,
    )
  }
  return name.slice(0, 20)
}

async function saveProfileWithUniqueNickname(input: {
  uid: string
  nickname: string
  previousNickname?: string
  stats: PersonalStats
  progress?: UserProgress
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
        ...(input.progress ? progressFields(input.progress) : {}),
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

  activeUid = user.uid

  let progress = cloud.progress
  try {
    progress = (await syncEconomy(user.uid, cloud.nickname)).progress
  } catch {
    /* offline */
  }

  try {
    await saveProfileWithUniqueNickname({
      uid: user.uid,
      nickname: cloud.nickname,
      previousNickname: cloud.nickname,
      stats,
      progress,
      email: user.email,
      photoURL: user.photoURL,
    })
  } catch {
    /* keep local profile if nickname registry fails */
  }

  return toProfile(user, cloud.nickname, stats, progress)
}

async function completeNicknameSetup(
  user: User,
  rawName: string,
): Promise<UserProfile> {
  const local = getPersonalStats()
  const progress = emptyProgress()
  const nickname = await saveProfileWithUniqueNickname({
    uid: user.uid,
    nickname: rawName,
    stats: local,
    progress,
    email: user.email,
    photoURL: user.photoURL,
  })

  setLastName(nickname)
  setPersonalStats(local)
  activeUid = user.uid
  return toProfile(user, nickname, local, progress)
}

/** 닉네임 + 비밀번호로 회원가입 (인앱 브라우저에서도 동작) */
export async function signUpWithNickname(
  rawNickname: string,
  password: string,
): Promise<UserProfile> {
  if (!isFirebaseConfigured()) throw new Error('Firebase 설정이 없습니다')

  const nickname = validateCredentials(rawNickname, password)
  const email = nicknameToAuthEmail(nickname)
  const nickRef = doc(getDb(), NICKNAMES, nicknameKey(nickname))
  const taken = await getDoc(nickRef)
  if (taken.exists()) throw nicknameTakenError()

  beginAuthMutation()
  try {
    const auth = getFirebaseAuth()
    const cred = await createUserWithEmailAndPassword(auth, email, password)

    try {
      return await completeNicknameSetup(cred.user, nickname)
    } catch (err) {
      try {
        await deleteUser(cred.user)
      } catch {
        await signOut(auth).catch(() => undefined)
      }
      throw err
    }
  } finally {
    endAuthMutation()
  }
}

/** 닉네임 + 비밀번호로 로그인 */
export async function signInWithNickname(
  rawNickname: string,
  password: string,
): Promise<UserProfile> {
  if (!isFirebaseConfigured()) throw new Error('Firebase 설정이 없습니다')

  const nickname = validateCredentials(rawNickname, password)
  const email = nicknameToAuthEmail(nickname)

  beginAuthMutation()
  try {
    const cred = await signInWithEmailAndPassword(
      getFirebaseAuth(),
      email,
      password,
    )

    const existing = await resumeExistingProfile(cred.user)
    if (existing) return existing
    return completeNicknameSetup(cred.user, nickname)
  } finally {
    endAuthMutation()
  }
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
  const progress: UserProgress = {
    xp: current.xp,
    level: current.level,
    weekKey: current.weekKey,
    weekXp: current.weekXp,
    weekWins: current.weekWins,
    weekPlays: current.weekPlays ?? 0,
    weekBestAttempts: current.weekBestAttempts ?? 0,
    weekBestSeconds: current.weekBestSeconds ?? 0,
    lastDailyBonusDate: current.lastDailyBonusDate,
    pendingWeekReward: current.pendingWeekReward,
    hints: current.hints,
    tokens: current.tokens,
    lastDailyHintDate: current.lastDailyHintDate,
    economyVersion: current.economyVersion,
    claimedMailIds: current.claimedMailIds ?? [],
  }

  const nickname = await saveProfileWithUniqueNickname({
    uid,
    nickname: rawName,
    previousNickname: current.nickname,
    stats,
    progress,
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

export function applyProgressToProfile(
  profile: UserProfile,
  progress: UserProgress,
): UserProfile {
  return {
    ...profile,
    ...progressFields(progress),
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

export async function signOutUser(): Promise<void> {
  if (!isFirebaseConfigured()) return
  activeUid = null
  await signOut(getFirebaseAuth())
}

export type AuthListenerState =
  | { status: 'signed-out' }
  | { status: 'ready'; profile: UserProfile }

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
      // 가입 직후 프로필 저장 중이면 건드리지 않음
      if (authMutationDepth > 0) return
      // 프로필 없는 잔여 계정(예: 예전 Google)은 로그아웃
      activeUid = null
      await signOut(getFirebaseAuth())
      onChange({ status: 'signed-out' })
    } catch {
      if (authMutationDepth > 0) return
      onChange({ status: 'signed-out' })
    }
  })
}

export function isAuthEnabled(): boolean {
  return isFirebaseConfigured()
}
