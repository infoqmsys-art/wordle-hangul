import { initializeApp, type FirebaseApp } from 'firebase/app'
import { getFirestore, type Firestore } from 'firebase/firestore'

const config = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY as string | undefined,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN as string | undefined,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID as string | undefined,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET as string | undefined,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID as string | undefined,
  appId: import.meta.env.VITE_FIREBASE_APP_ID as string | undefined,
}

export function isFirebaseConfigured(): boolean {
  return Boolean(config.apiKey && config.projectId && config.appId)
}

let app: FirebaseApp | null = null
let db: Firestore | null = null

export function getDb(): Firestore {
  if (!isFirebaseConfigured()) {
    throw new Error('Firebase 설정이 없습니다')
  }
  if (!app) {
    app = initializeApp({
      apiKey: config.apiKey!,
      authDomain: config.authDomain,
      projectId: config.projectId!,
      storageBucket: config.storageBucket,
      messagingSenderId: config.messagingSenderId,
      appId: config.appId!,
    })
    db = getFirestore(app)
  }
  return db!
}
