import { useEffect, useState } from 'react'

type Piece = {
  id: number
  left: number
  delay: number
  duration: number
  color: string
  rotate: number
  size: number
  kind: 'confetti' | 'flame'
}

const COLORS = ['#ffcd00', '#6aaa64', '#c9b458', '#4a7dff', '#f4a261', '#e07a5f']
const FLAME_COLORS = ['#ff6b1a', '#ff9f1c', '#ffcd00', '#ff3d00', '#ffb347']

type Props = {
  active: boolean
  /** 연속 승리 수 — 2 이상이면 불꽃 파티클 추가 */
  streak?: number
}

export function Confetti({ active, streak = 0 }: Props) {
  const [pieces, setPieces] = useState<Piece[]>([])

  useEffect(() => {
    if (!active) {
      setPieces([])
      return
    }

    const fiery = streak >= 2
    const confettiCount = fiery ? 28 : 36
    const flameCount = fiery ? Math.min(10 + streak * 2, 24) : 0

    const next: Piece[] = [
      ...Array.from({ length: confettiCount }, (_, i) => ({
        id: i,
        left: Math.random() * 100,
        delay: Math.random() * 0.25,
        duration: 1.1 + Math.random() * 0.7,
        color: COLORS[i % COLORS.length],
        rotate: Math.random() * 360,
        size: 6 + Math.random() * 6,
        kind: 'confetti' as const,
      })),
      ...Array.from({ length: flameCount }, (_, i) => ({
        id: 1000 + i,
        left: 12 + Math.random() * 76,
        delay: Math.random() * 0.35,
        duration: 1.2 + Math.random() * 0.9,
        color: FLAME_COLORS[i % FLAME_COLORS.length],
        rotate: -20 + Math.random() * 40,
        size: 14 + Math.random() * 16,
        kind: 'flame' as const,
      })),
    ]

    setPieces(next)
    const t = window.setTimeout(() => setPieces([]), fiery ? 2800 : 2200)
    return () => window.clearTimeout(t)
  }, [active, streak])

  if (pieces.length === 0) return null

  return (
    <div className="confetti" aria-hidden>
      {pieces.map((p) =>
        p.kind === 'flame' ? (
          <span
            key={p.id}
            className="confetti-flame"
            style={{
              left: `${p.left}%`,
              fontSize: p.size,
              color: p.color,
              animationDelay: `${p.delay}s`,
              animationDuration: `${p.duration}s`,
              ['--spin' as string]: `${p.rotate}deg`,
            }}
          >
            🔥
          </span>
        ) : (
          <span
            key={p.id}
            className="confetti-piece"
            style={{
              left: `${p.left}%`,
              width: p.size,
              height: p.size * 0.55,
              background: p.color,
              animationDelay: `${p.delay}s`,
              animationDuration: `${p.duration}s`,
              ['--spin' as string]: `${p.rotate}deg`,
            }}
          />
        ),
      )}
    </div>
  )
}
