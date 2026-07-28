import { useEffect, useState } from 'react'

type Piece = {
  id: number
  left: number
  delay: number
  duration: number
  color: string
  rotate: number
  size: number
}

const COLORS = ['#ffcd00', '#6aaa64', '#c9b458', '#4a7dff', '#f4a261', '#e07a5f']

type Props = {
  active: boolean
}

export function Confetti({ active }: Props) {
  const [pieces, setPieces] = useState<Piece[]>([])

  useEffect(() => {
    if (!active) {
      setPieces([])
      return
    }
    const next: Piece[] = Array.from({ length: 36 }, (_, i) => ({
      id: i,
      left: Math.random() * 100,
      delay: Math.random() * 0.25,
      duration: 1.1 + Math.random() * 0.7,
      color: COLORS[i % COLORS.length],
      rotate: Math.random() * 360,
      size: 6 + Math.random() * 6,
    }))
    setPieces(next)
    const t = window.setTimeout(() => setPieces([]), 2200)
    return () => window.clearTimeout(t)
  }, [active])

  if (pieces.length === 0) return null

  return (
    <div className="confetti" aria-hidden>
      {pieces.map((p) => (
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
      ))}
    </div>
  )
}
