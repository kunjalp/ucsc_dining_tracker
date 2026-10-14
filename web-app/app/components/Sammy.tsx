'use client'

import { useEffect, useState } from 'react'
import { useReducedMotion } from '@/lib/useReducedMotion'
import { useMascotAnimations } from '@/lib/mascotPrefs'

// Sammy the banana slug -- soft pixel art drawn from a data grid (no image
// files). Separate from the ring-shaped app logo. Facing right.
//
// Keys: Y body, H highlight, S shade, B spot, E eye, P cheek, M mouth,
// O open mouth. '.' is empty (that's also how the corners get rounded).
const PALETTE: Record<string, string> = {
  Y: '#f7cf5c',
  H: '#fde7a3',
  S: '#d9a63c',
  B: '#9c6b45',
  E: '#18213a',
  P: '#f39aa0',
  M: '#18213a',
  O: '#c24e66',
}

const GRID = [
  '..........HY..HY....',
  '..........YY..YY....',
  '..........S...S.....',
  '........YYYYYYYY....',
  '......YYHHHYYYYYY...',
  '.....YHHHYEEYYYEEY..',
  '....YHHYYYEEYYYEEYY.',
  '...YYBYYYPYYYMYYYPY.',
  '..YYBBYYYYYYYYYYYYY.',
  '.YYYYYYYBBYYYYYYYYY.',
  'SSYYYYYYYYYYYYYYYYS.',
  '.SSSSSSSSSSSSSSSSS..',
]
const COLS = GRID[0].length
const ROWS = GRID.length
// Rows 0-1 are the eyestalk tips -- drawn in their own group so they can wiggle
const TIP_ROWS = 2

type Face = 'idle' | 'blink' | 'happy' | 'celebrate'
type Override = [row: number, col: number, key: string]

const HAPPY_EYES: Override[] = [
  [6, 10, 'Y'], [6, 11, 'Y'], [6, 9, 'E'], [6, 12, 'E'],
  [6, 15, 'Y'], [6, 16, 'Y'], [6, 14, 'E'], [6, 17, 'E'],
]
const FACES: Record<Face, Override[]> = {
  idle: [],
  blink: [[5, 10, 'Y'], [5, 11, 'Y'], [5, 15, 'Y'], [5, 16, 'Y']],
  happy: HAPPY_EYES,
  celebrate: [...HAPPY_EYES, [7, 12, 'O'], [7, 13, 'O'], [7, 14, 'O'], [8, 13, 'O']],
}

// Small "+" sparkles around Sammy for celebrate: [x, y, color, delay ms]
const SPARKLES: [number, number, string, number][] = [
  [-3, 2, '#d6b93a', 0],
  [21, 0, '#fde7a3', 150],
  [5, -2, '#fde7a3', 300],
  [22, 7, '#d6b93a', 450],
  [-2, 8, '#fde7a3', 600],
]

function faceGrid(face: Face): string[][] {
  const rows = GRID.map((r) => r.split(''))
  for (const [r, c, key] of FACES[face]) rows[r][c] = key
  return rows
}

function Pixels({ rows, from, to }: { rows: string[][]; from: number; to: number }) {
  return (
    <>
      {rows.slice(from, to).flatMap((row, i) =>
        row.map((key, x) =>
          key === '.' ? null : <rect key={`${x}-${from + i}`} x={x} y={from + i} width={1} height={1} fill={PALETTE[key]} />
        )
      )}
    </>
  )
}

export type SammyMood = 'idle' | 'happy' | 'celebrate' | 'loading'

interface SammyProps {
  mood?: SammyMood
  // Integer scale: each sprite pixel is `size` CSS px (20x12 grid), so the
  // art stays sharp. 2 = 40x24px, 4 = 80x48px.
  size?: number
  className?: string
  // Screen reader label; without one Sammy is decorative (aria-hidden)
  label?: string
}

export default function Sammy({ mood = 'idle', size = 2, className = '', label }: SammyProps) {
  const reduceMotion = useReducedMotion()
  const animationsOn = useMascotAnimations()
  const still = reduceMotion || !animationsOn
  const px = Math.max(1, Math.round(size))

  // Idle/loading: blink every 3-5s, and every other blink also wiggles the
  // eyestalk tips. Happy/celebrate hold their own face.
  const [blink, setBlink] = useState(false)
  const [wiggle, setWiggle] = useState(false)
  const restless = !still && (mood === 'idle' || mood === 'loading')
  useEffect(() => {
    if (!restless) return
    let count = 0
    const timers: ReturnType<typeof setTimeout>[] = []
    const schedule = () => {
      timers.push(setTimeout(() => {
        count++
        setBlink(true)
        timers.push(setTimeout(() => setBlink(false), 140))
        if (count % 2 === 0) {
          setWiggle(true)
          timers.push(setTimeout(() => setWiggle(false), 480))
        }
        schedule()
      }, 3000 + Math.random() * 2000))
    }
    schedule()
    return () => {
      timers.forEach(clearTimeout)
      setBlink(false)
      setWiggle(false)
    }
  }, [restless])

  const face: Face =
    mood === 'celebrate' ? 'celebrate' : mood === 'happy' ? 'happy' : restless && blink ? 'blink' : 'idle'
  const rows = faceGrid(face)

  // Movement is whole sprite pixels only (steps() keyframes in globals.css,
  // scaled by --sammy-px) so the art never lands between pixels
  const motionClass = still
    ? ''
    : { idle: 'sammy-bob', loading: 'sammy-loading', happy: 'sammy-hop', celebrate: 'sammy-celebrate' }[mood]

  return (
    <span
      className={`inline-block shrink-0 pointer-events-none select-none ${motionClass} ${className}`}
      style={{ ['--sammy-px' as string]: `${px}px`, width: COLS * px, height: ROWS * px }}
      role={label ? 'img' : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
    >
      <svg
        width={COLS * px}
        height={ROWS * px}
        viewBox={`0 0 ${COLS} ${ROWS}`}
        shapeRendering="crispEdges"
        overflow="visible"
        className="block"
      >
        <g className={!still && wiggle ? 'sammy-wiggle' : undefined}>
          <Pixels rows={rows} from={0} to={TIP_ROWS} />
        </g>
        <Pixels rows={rows} from={TIP_ROWS} to={ROWS} />
        {mood === 'celebrate' && !still &&
          SPARKLES.map(([x, y, color, delay], i) => (
            <g key={i} className="sammy-sparkle" style={{ animationDelay: `${delay}ms` }} fill={color}>
              <rect x={x + 1} y={y} width={1} height={3} />
              <rect x={x} y={y + 1} width={3} height={1} />
            </g>
          ))}
      </svg>
    </span>
  )
}
