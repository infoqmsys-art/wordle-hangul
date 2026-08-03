import { doc, getDoc, serverTimestamp, setDoc } from 'firebase/firestore'
import { getDb, isFirebaseConfigured } from './firebase'
import {
  parseUserProgress,
  syncWeekProgress,
  type UserProgress,
} from './progress'

const USERS = 'users'

export type MailItem = {
  id: string
  title: string
  body: string
  hints: number
  tokens: number
}

/** 새 보상 넣을 때 여기 id만 추가하면 됨 (이미 받은 id는 다시 안 줌) */
export const MAIL_CATALOG: MailItem[] = [
  {
    id: 'patch-2026-08-02-hint-fix',
    title: '패치 보상',
    body: '힌트 칸이 지워지던 오류를 고쳤어요. 로그인 모험가에게 힌트 1개를 드려요.',
    hints: 1,
    tokens: 0,
  },
  {
    id: 'patch-2026-08-03-tokens-10',
    title: '패치 보상',
    body: '초크백 테마·상점 정리 패치 기념으로 초크가루 10개를 드려요.',
    hints: 0,
    tokens: 10,
  },
]

export function parseClaimedMailIds(raw: unknown): string[] {
  if (!Array.isArray(raw)) return []
  return raw.filter((id): id is string => typeof id === 'string' && id.length > 0)
}

export function unclaimedMail(claimedIds: string[] = []): MailItem[] {
  const claimed = new Set(claimedIds)
  return MAIL_CATALOG.filter((m) => !claimed.has(m.id))
}

export function hasUnclaimedMail(claimedIds: string[] = []): boolean {
  return unclaimedMail(claimedIds).length > 0
}

export async function claimMailItem(
  uid: string,
  nickname: string,
  mailId: string,
): Promise<{ progress: UserProgress; mail: MailItem }> {
  if (!isFirebaseConfigured()) throw new Error('우편함을 아직 쓸 수 없어요')

  const mail = MAIL_CATALOG.find((m) => m.id === mailId)
  if (!mail) throw new Error('우편을 찾을 수 없어요')

  await syncWeekProgress(uid, nickname)
  const ref = doc(getDb(), USERS, uid)
  const snap = await getDoc(ref)
  const data = (snap.exists() ? snap.data() : {}) as Record<string, unknown>
  const prev = parseUserProgress(data)

  if (prev.claimedMailIds.includes(mail.id)) {
    throw new Error('이미 받은 우편이에요')
  }

  const progress: UserProgress = {
    ...prev,
    hints: prev.hints + mail.hints,
    tokens: prev.tokens + mail.tokens,
    claimedMailIds: [...prev.claimedMailIds, mail.id],
  }

  await setDoc(
    ref,
    {
      nickname: nickname.slice(0, 20),
      hints: progress.hints,
      tokens: progress.tokens,
      claimedMailIds: progress.claimedMailIds,
      updatedAt: serverTimestamp(),
    },
    { merge: true },
  )

  return { progress, mail }
}
