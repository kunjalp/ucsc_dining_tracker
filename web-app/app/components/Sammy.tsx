'use client'

import { useEffect, useRef, useState } from 'react'
import { useReducedMotion } from '@/lib/useReducedMotion'
import { useMascotAnimations } from '@/lib/mascotPrefs'

// Sammy the banana slug -- soft pixel art drawn from a data grid (no image
// files). Separate from the ring-shaped app logo. Facing right.
//
// Keys: Y body, H highlight, S shade, B spot, E eye, P cheek, M mouth,
// O open mouth, D sweat drop. '.' is empty (that's also how the corners
// get rounded).
const PALETTE: Record<string, string> = {
  Y: '#f7cf5c',
  H: '#fde7a3',
  S: '#d9a63c',
  B: '#9c6b45',
  E: '#18213a',
  P: '#f39aa0',
  M: '#18213a',
  O: '#c24e66',
  D: '#a1c9ff',
}
const BUBBLE_BG = '#fde7a3'
const THOUGHT_COLOR = '#fde7a3'
const Z_COLOR = '#a1c9ff'

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
// Rows 0-1 are the eyestalk tips -- drawn in their own group so they can
// wiggle (and lift for the stretch)
const TIP_ROWS = 2

type Override = [row: number, col: number, key: string]

// Eyes are 2x2 at cols 10-11 and 15-16, rows 5-6
const CLOSED_EYES: Override[] = [[5, 10, 'Y'], [5, 11, 'Y'], [5, 15, 'Y'], [5, 16, 'Y']]
const HAPPY_EYES: Override[] = [
  [6, 10, 'Y'], [6, 11, 'Y'], [6, 9, 'E'], [6, 12, 'E'],
  [6, 15, 'Y'], [6, 16, 'Y'], [6, 14, 'E'], [6, 17, 'E'],
]
const shiftEyes = (dx: -1 | 1): Override[] => {
  const out: Override[] = []
  for (const [left] of [[10], [15]]) {
    for (const row of [5, 6]) {
      out.push([row, left, 'Y'], [row, left + 1, 'Y'])
      out.push([row, left + dx, 'E'], [row, left + 1 + dx, 'E'])
    }
  }
  return out
}
const OPEN_MOUTH: Override[] = [[7, 12, 'O'], [7, 13, 'O'], [7, 14, 'O'], [8, 13, 'O']]

type Face =
  | 'idle' | 'blink' | 'happy' | 'celebrate' | 'munch' | 'sleep' | 'oops'
  | 'lookLeft' | 'lookRight' | 'stretch' | 'yawn'

const FACES: Record<Face, Override[]> = {
  idle: [],
  blink: CLOSED_EYES,
  happy: HAPPY_EYES,
  celebrate: [...HAPPY_EYES, ...OPEN_MOUTH],
  // Mouth closed here; the open mouth is a separate layer that blinks on/off
  munch: HAPPY_EYES,
  sleep: CLOSED_EYES,
  // Worried: brows raised at the inner corners, small frown, sweat drop
  oops: [[4, 11, 'E'], [4, 15, 'E'], [7, 13, 'M'], [8, 12, 'M'], [8, 14, 'M'], [7, 12, 'Y'], [3, 16, 'D'], [4, 17, 'D']],
  lookLeft: shiftEyes(-1),
  lookRight: shiftEyes(1),
  stretch: CLOSED_EYES,
  yawn: [...CLOSED_EYES, [7, 12, 'O'], [7, 13, 'O'], [7, 14, 'O'], [8, 12, 'O'], [8, 13, 'O'], [8, 14, 'O']],
}

// Small "+" sparkles around Sammy for celebrate: [x, y, delay ms]
const SPARKLES: [number, number, number][] = [
  [-3, 2, 0],
  [21, 0, 150],
  [5, -2, 300],
  [22, 7, 450],
  [-2, 8, 600],
]
const DEFAULT_SPARKLE_COLORS = ['#d6b93a', '#fde7a3']
// Crumbs falling from the mouth while munching: [x, y, color, delay ms]
const CRUMBS: [number, number, string, number][] = [
  [19, 8, '#fde7a3', 0],
  [20, 9, '#9c6b45', 300],
  [19, 10, '#fde7a3', 600],
]
// 4x4 pixel "z" for sleep
const Z_PIXELS: [number, number][] = [[0, 0], [1, 0], [2, 0], [3, 0], [2, 1], [1, 2], [0, 3], [1, 3], [2, 3], [3, 3]]

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

export type SammyMood = 'idle' | 'happy' | 'celebrate' | 'loading' | 'munch' | 'sleep' | 'think' | 'oops'

// One-shot moods the parent plays and then returns to a resting mood
const ONE_SHOT: SammyMood[] = ['happy', 'celebrate', 'munch', 'oops']

type IdleVariety = 'lookLeft' | 'lookRight' | 'stretch' | 'yawn'
const VARIETIES: IdleVariety[] = ['lookLeft', 'lookRight', 'stretch', 'yawn']
const VARIETY_MS: Record<IdleVariety, number> = { lookLeft: 1500, lookRight: 1500, stretch: 1200, yawn: 1400 }

interface SammyProps {
  mood?: SammyMood
  // Bump to replay a one-shot mood (e.g. two logs in a row both munch)
  moodKey?: number
  // Integer scale: each sprite pixel is `size` CSS px (20x12 grid), so the
  // art stays sharp. 2 = 40x24px, 4 = 80x48px.
  size?: number
  className?: string
  // Screen reader label; without one (and without onTapMessage) Sammy is
  // decorative (aria-hidden)
  label?: string
  // Celebrate sparkle colors, cycled across the sparkles (e.g. the closed
  // rings' macro colors)
  sparkleColors?: string[]
  // Every 6-12s while idle: look left/right, stretch or yawn
  variety?: boolean
  // Makes Sammy tappable (44px+ target): hops and says this in a bubble
  onTapMessage?: () => string
  // Which edge the speech bubble lines up with
  bubbleAlign?: 'left' | 'right'
}

export default function Sammy({
  mood = 'idle',
  moodKey = 0,
  size = 2,
  className = '',
  label,
  sparkleColors = DEFAULT_SPARKLE_COLORS,
  variety = false,
  onTapMessage,
  bubbleAlign = 'left',
}: SammyProps) {
  const reduceMotion = useReducedMotion()
  const animationsOn = useMascotAnimations()
  const still = reduceMotion || !animationsOn
  const px = Math.max(1, Math.round(size))

  // Tap: a hop (unless a one-shot is already playing) plus a speech bubble
  const [tapHop, setTapHop] = useState(0) // > 0 while hopping; also its replay key
  const [bubble, setBubble] = useState<string | null>(null)
  const tapTimersRef = useRef<ReturnType<typeof setTimeout>[]>([])
  useEffect(() => () => tapTimersRef.current.forEach(clearTimeout), [])
  const handleTap = () => {
    if (!onTapMessage) return
    tapTimersRef.current.forEach(clearTimeout)
    tapTimersRef.current = []
    setBubble(onTapMessage())
    tapTimersRef.current.push(setTimeout(() => setBubble(null), 2500))
    if (!still && !ONE_SHOT.includes(mood)) {
      setTapHop((n) => n + 1)
      tapTimersRef.current.push(setTimeout(() => setTapHop(0), 600))
    }
  }

  const playingOneShot = ONE_SHOT.includes(mood) || tapHop > 0
  const resting = !still && !playingOneShot && (mood === 'idle' || mood === 'loading' || mood === 'think')

  // Blink every 3-5s while resting; every other blink also wiggles the
  // eyestalk tips
  const [blink, setBlink] = useState(false)
  const [wiggle, setWiggle] = useState(false)
  useEffect(() => {
    if (!resting) return
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
  }, [resting])

  // Idle variety: one pose every 6-12s, never the same one twice in a row,
  // only while plain idle (the timer stops whenever another mood plays)
  const [pose, setPose] = useState<IdleVariety | null>(null)
  const lastPoseRef = useRef<IdleVariety | null>(null)
  const varietyOn = variety && resting && mood === 'idle'
  useEffect(() => {
    if (!varietyOn) return
    const timers: ReturnType<typeof setTimeout>[] = []
    const schedule = () => {
      timers.push(setTimeout(() => {
        const options = VARIETIES.filter((v) => v !== lastPoseRef.current)
        const next = options[Math.floor(Math.random() * options.length)]
        lastPoseRef.current = next
        setPose(next)
        timers.push(setTimeout(() => {
          setPose(null)
          schedule()
        }, VARIETY_MS[next]))
      }, 6000 + Math.random() * 6000))
    }
    schedule()
    return () => {
      timers.forEach(clearTimeout)
      setPose(null)
    }
  }, [varietyOn])

  // What's actually on screen, highest priority first
  const shown: SammyMood = tapHop > 0 && !ONE_SHOT.includes(mood) ? 'happy' : mood
  const activePose = varietyOn ? pose : null
  const face: Face =
    shown === 'celebrate' ? 'celebrate'
      : shown === 'happy' ? 'happy'
        : shown === 'munch' ? 'munch'
          : shown === 'oops' ? 'oops'
            : shown === 'sleep' ? 'sleep'
              : activePose ?? (resting && blink ? 'blink' : 'idle')
  const rows = faceGrid(face)

  // Movement is whole sprite pixels only (steps() keyframes in globals.css,
  // scaled by --sammy-px). One class at a time, so animations never stack.
  const motionClass = still
    ? ''
    : {
        idle: 'sammy-bob',
        think: 'sammy-bob',
        loading: 'sammy-loading',
        sleep: 'sammy-sleep',
        happy: 'sammy-hop',
        celebrate: 'sammy-celebrate',
        munch: 'sammy-munch',
        oops: 'sammy-shake',
      }[shown]
  // Remounting the moving span restarts its one-shot animation cleanly
  const motionKey = ONE_SHOT.includes(shown) ? `${shown}-${moodKey}-${tapHop}` : 'rest'

  const width = COLS * px
  const height = ROWS * px
  const sprite = (
    <span
      key={motionKey}
      className={`block ${motionClass}`}
      style={{ ['--sammy-px' as string]: `${px}px`, width, height }}
    >
      <svg width={width} height={height} viewBox={`0 0 ${COLS} ${ROWS}`} shapeRendering="crispEdges" overflow="visible" className="block">
        <g
          className={!still && wiggle && !activePose ? 'sammy-wiggle' : undefined}
          transform={face === 'stretch' ? 'translate(0 -1)' : undefined}
        >
          <Pixels rows={rows} from={0} to={TIP_ROWS} />
        </g>
        {/* Stretch: the tips lift a pixel, so the stalks grow to meet them */}
        {face === 'stretch' && (
          <>
            <rect x={10} y={1} width={1} height={1} fill={PALETTE.S} />
            <rect x={14} y={1} width={1} height={1} fill={PALETTE.S} />
          </>
        )}
        <Pixels rows={rows} from={TIP_ROWS} to={ROWS} />

        {shown === 'munch' && (
          <>
            {/* Open mouth flashes on and off three times */}
            <g className={still ? 'hidden' : 'sammy-munch-mouth'}>
              {OPEN_MOUTH.map(([r, c, key]) => <rect key={`${r}-${c}`} x={c} y={r} width={1} height={1} fill={PALETTE[key]} />)}
            </g>
            {!still && CRUMBS.map(([x, y, color, delay], i) => (
              <rect key={i} x={x} y={y} width={1} height={1} fill={color} className="sammy-crumb" style={{ animationDelay: `${delay}ms` }} />
            ))}
          </>
        )}

        {shown === 'sleep' && (
          <g className={still ? undefined : 'sammy-z'} fill={Z_COLOR} opacity={still ? 0.8 : undefined}>
            {Z_PIXELS.map(([x, y]) => <rect key={`${x}-${y}`} x={18 + x} y={-3 + y} width={1} height={1} />)}
          </g>
        )}

        {shown === 'think' && (
          <g fill={THOUGHT_COLOR}>
            {[0, 1, 2].map((i) => (
              <rect
                key={i}
                x={17 + i * 2}
                y={-2}
                width={1}
                height={1}
                className={still ? undefined : 'sammy-think-dot'}
                style={still ? undefined : { animationDelay: `${i * 300}ms` }}
              />
            ))}
          </g>
        )}

        {shown === 'celebrate' && !still &&
          SPARKLES.map(([x, y, delay], i) => (
            <g key={i} className="sammy-sparkle" style={{ animationDelay: `${delay}ms` }} fill={sparkleColors[i % sparkleColors.length]}>
              <rect x={x + 1} y={y} width={1} height={3} />
              <rect x={x} y={y + 1} width={3} height={1} />
            </g>
          ))}
      </svg>
    </span>
  )

  const speechBubble = bubble && (
    <span
      role="status"
      aria-live="polite"
      className={`absolute bottom-full mb-3 z-50 w-max max-w-[min(14rem,70vw)] px-2 py-1 text-xs font-bold leading-snug text-app text-left pointer-events-none ${
        bubbleAlign === 'right' ? 'right-0' : 'left-0'
      }`}
      // Side-only box-shadows leave the corners empty: pixel-rounded corners
      style={{
        background: BUBBLE_BG,
        boxShadow: `2px 0 0 0 ${BUBBLE_BG}, -2px 0 0 0 ${BUBBLE_BG}, 0 2px 0 0 ${BUBBLE_BG}, 0 -2px 0 0 ${BUBBLE_BG}`,
      }}
    >
      {bubble}
      {/* Stepped pixel tail pointing down at Sammy */}
      <span
        aria-hidden="true"
        className={`absolute top-full mt-0.5 size-1.5 ${bubbleAlign === 'right' ? 'right-4' : 'left-4'}`}
        style={{ background: BUBBLE_BG }}
      />
      <span
        aria-hidden="true"
        className={`absolute top-full mt-2 size-1 ${bubbleAlign === 'right' ? 'right-5' : 'left-5'}`}
        style={{ background: BUBBLE_BG }}
      />
    </span>
  )

  if (onTapMessage) {
    return (
      <span className={`relative inline-block shrink-0 ${className}`}>
        {speechBubble}
        <button
          type="button"
          onClick={handleTap}
          aria-label={label ?? 'Sammy. Tap for a progress update'}
          // 44px minimum tap target even when the sprite is smaller
          className="flex items-end justify-center select-none"
          style={{ minWidth: 44, minHeight: 44, width: Math.max(44, width), height: Math.max(44, height) }}
        >
          {sprite}
        </button>
      </span>
    )
  }

  return (
    <span
      className={`relative inline-block shrink-0 pointer-events-none select-none ${className}`}
      style={{ width, height }}
      role={label ? 'img' : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
    >
      {sprite}
    </span>
  )
}
