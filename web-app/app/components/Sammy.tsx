'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { useReducedMotion } from '@/lib/useReducedMotion'
import { useMascotAnimations } from '@/lib/mascotPrefs'

// Sammy the banana slug -- soft pixel art drawn from a data grid (no image
// files). Separate from the ring-shaped app logo. Facing right.
//
// Keys: Y body, H highlight, S shade, B spot, E eye, P cheek, M mouth,
// O open mouth, D sweat drop. '.' is empty (that's also how the corners
// get rounded). The rest are accessory colors: W/G chef hat and band,
// N/K/c nightcap, star and cream band, Q/q/V pumpkin, shade and stem,
// R/r scarf, F/f flame and its core.
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
  W: '#fbf6ea',
  G: '#d9cfb8',
  N: '#a1c9ff',
  K: '#d6b93a',
  c: '#fde7a3',
  Q: '#f0a04b',
  q: '#c97a2c',
  V: '#86d9a5',
  R: '#fb7185',
  r: '#d9566a',
  F: '#f0a04b',
  f: '#fde7a3',
}
const BUBBLE_BG = '#fde7a3'
const THOUGHT_COLOR = '#fde7a3'
const Z_COLOR = '#a1c9ff'
// Matches .sammy-bubble-out in globals.css
const BUBBLE_FADE_MS = 150
// How long a speech bubble stays up
const BUBBLE_MS = 2500

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
// Extra pixels drawn on top of (or around) the sprite: [x, y, key]
type Cell = [x: number, y: number, key: string]

// Text rows -> cells at (ox, oy); '.' is transparent
const shape = (rows: string[], ox: number, oy: number): Cell[] =>
  rows.flatMap((row, y) => row.split('').flatMap((key, x): Cell[] => (key === '.' ? [] : [[ox + x, oy + y, key]])))

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
// Eyes up a row, into the forehead. (Down a row crowds them into the
// cheeks, so there's no lookDown -- a touch below gets left/right.)
const LOOK_UP: Override[] = [
  [4, 10, 'E'], [4, 11, 'E'], [6, 10, 'Y'], [6, 11, 'Y'],
  [4, 15, 'E'], [4, 16, 'E'], [6, 15, 'Y'], [6, 16, 'Y'],
]
// Dizzy: each eye a diagonal, slanted opposite ways
const DIZZY_EYES: Override[] = [
  [5, 10, 'E'], [6, 11, 'E'], [5, 11, 'Y'], [6, 10, 'Y'],
  [5, 16, 'E'], [6, 15, 'E'], [5, 15, 'Y'], [6, 16, 'Y'],
]
const OPEN_MOUTH: Override[] = [[7, 12, 'O'], [7, 13, 'O'], [7, 14, 'O'], [8, 13, 'O']]

type Face =
  | 'idle' | 'blink' | 'happy' | 'celebrate' | 'munch' | 'sleep' | 'oops'
  | 'lookLeft' | 'lookRight' | 'lookUp' | 'stretch' | 'yawn'
  | 'flex' | 'dizzy' | 'hiccup' | 'sneeze'

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
  lookUp: LOOK_UP,
  stretch: CLOSED_EYES,
  yawn: [...CLOSED_EYES, [7, 12, 'O'], [7, 13, 'O'], [7, 14, 'O'], [8, 12, 'O'], [8, 13, 'O'], [8, 14, 'O']],
  flex: HAPPY_EYES,
  dizzy: DIZZY_EYES,
  // A small "hic" mouth
  hiccup: [[7, 13, 'O']],
  // Squeezed shut; the open mouth is a separate layer timed with the burst
  sneeze: CLOSED_EYES,
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

// Flex: a raised arm with a bicep bump off his back, plus sparkles in the
// closed ring's color around the fist
const FLEX_ARM = shape(['.HY...', '.YY.YY', '.SYYYY', '..SSS.'], 0, 2)
const FLEX_SPARKLES: [number, number, number][] = [[-3, 0, 0], [3, -1, 200], [-3, 5, 400]]
// Pet: three hearts rising, staggered: [x, y, delay ms]
const HEART = ['P.P', 'PPP', '.P.']
const HEARTS: [number, number, number][] = [[2, 1, 0], [17, -2, 200], [7, -3, 400]]
// Dizzy: three stars orbiting the head, a third of a lap apart (negative
// delays start them part-way round); the orbit path is in globals.css
const STAR_CENTER: [number, number] = [11, -2]
const STAR_DELAYS_MS = [0, -267, -533]
// Sneeze: spray in front of the mouth
const SNEEZE_SPRAY: Cell[] = [[19, 7, 'D'], [20, 6, 'D'], [21, 8, 'D']]
// Double-blink: eyelids (body-colored) over both eyes' top row
const LIDS: Cell[] = [[10, 5, 'Y'], [11, 5, 'Y'], [15, 5, 'Y'], [16, 5, 'Y']]

// Accessories: at most one, picked from local time and date
type Accessory = 'chef' | 'nightcap' | 'pumpkin' | 'scarf'
const ACCESSORIES: Record<Accessory, Cell[]> = {
  // Chef hat at breakfast, tipped back behind the eyestalks
  chef: shape(['.WWW.', 'WWWWW', 'WWWWW', '.GGG.'], 5, 0),
  // Late night: floppy nightcap, star pom on the tip, a tiny cream moon
  nightcap: shape(['.K....', 'KNK...', '.NN...', '..NcN.', '..cccc'], 2, -1),
  // October: a little pumpkin riding on the back of his head
  pumpkin: shape(['..V..', '.QQQ.', 'QqQqQ', '.QQQ.'], 4, 0),
  // December-February: scarf with a hanging tail
  scarf: shape(['RRRRRRR', '.Rr....', '.Rr....'], 11, 9),
}
// Hats are for the time of day first (they come and go), then the season
function pickAccessory(d: Date): Accessory | null {
  const hour = d.getHours()
  const month = d.getMonth()
  if (hour >= 22 || hour < 5) return 'nightcap'
  if (hour >= 6 && hour < 11) return 'chef'
  if (month === 9) return 'pumpkin'
  if (month === 11 || month <= 1) return 'scarf'
  return null
}

// Streak flame beside his tail: small from 3 days, bigger from 7
const FLAME_SMALL = shape(['.F.', 'FFF', 'FfF'], -4, 8)
const FLAME_LARGE = shape(['..F..', '.FF..', '.FFF.', 'FFfFF', 'FfffF'], -6, 6)

function Cells({ cells }: { cells: Cell[] }) {
  return (
    <>
      {cells.map(([x, y, key]) => <rect key={`${x}-${y}`} x={x} y={y} width={1} height={1} fill={PALETTE[key]} />)}
    </>
  )
}

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

function Sparkle({ x, y, delay, color }: { x: number; y: number; delay: number; color: string }) {
  return (
    <g className="sammy-sparkle" style={{ animationDelay: `${delay}ms` }} fill={color}>
      <rect x={x + 1} y={y} width={1} height={3} />
      <rect x={x} y={y + 1} width={3} height={1} />
    </g>
  )
}

export type SammyMood = 'idle' | 'happy' | 'celebrate' | 'loading' | 'munch' | 'sleep' | 'think' | 'oops' | 'flex'

// One-shot moods the parent plays and then returns to a resting mood
const ONE_SHOT: SammyMood[] = ['happy', 'celebrate', 'munch', 'oops', 'flex']

type IdleVariety = 'lookLeft' | 'lookRight' | 'stretch' | 'yawn'
const VARIETIES: IdleVariety[] = ['lookLeft', 'lookRight', 'stretch', 'yawn']
const VARIETY_MS: Record<IdleVariety, number> = { lookLeft: 1500, lookRight: 1500, stretch: 1200, yawn: 1400 }

// Sammy's own short animations, one at a time. The parent's one-shot moods
// always win over these.
type Act = 'hop' | 'pet' | 'dizzy' | 'wave' | 'doubleBlink' | 'hiccup' | 'sneeze'
const ACT_MS: Record<Act, number> = { hop: 600, pet: 1300, dizzy: 1700, wave: 1300, doubleBlink: 450, hiccup: 500, sneeze: 1000 }
// Started by a finger: can't be cut short by a hop or an ambient act
const HELD_ACTS: Act[] = ['pet', 'dizzy']
const ACT_FACE: Record<Act, Face> = {
  hop: 'happy', pet: 'happy', dizzy: 'dizzy', wave: 'happy', doubleBlink: 'idle', hiccup: 'hiccup', sneeze: 'sneeze',
}
const ACT_MOTION: Record<Act, string> = {
  hop: 'sammy-hop', pet: '', dizzy: 'sammy-spin', wave: '', doubleBlink: '', hiccup: 'sammy-hiccup', sneeze: 'sammy-sneeze',
}

// Rare idle quirks, one every 20-40s at most
type Quirk = 'doubleBlink' | 'hiccup' | 'sneeze'
const QUIRKS: Quirk[] = ['doubleBlink', 'hiccup', 'sneeze']
const QUIRK_GAP_MIN_MS = 20_000
const QUIRK_GAP_MAX_MS = 40_000

// Long press (pet) and the five-quick-taps easter egg (dizzy)
const LONG_PRESS_MS = 500
const PRESS_SLOP_PX = 10
const DIZZY_TAPS = 5
const DIZZY_WINDOW_MS = 2000
const DIZZY_COOLDOWN_MS = 20_000

// Eye follow: a finger down within this distance of Sammy (but not on him)
const GAZE_RADIUS_PX = 160

// Greeting: once per session, a beat after the dashboard opens
const GREETED_SESSION_KEY = 'sammy_greeted'
const GREET_DELAY_MS = 700
function greetingFor(d: Date): string {
  const hour = d.getHours()
  if (hour >= 5 && hour < 12) return 'Good morning!'
  if (hour >= 12 && hour < 17) return 'Good afternoon!'
  if (hour >= 17 && hour < 22) return 'Good evening!'
  return 'Hey there, night owl!'
}

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
  // Celebrate/flex sparkle colors, cycled across the sparkles (e.g. the
  // closed rings' macro colors)
  sparkleColors?: string[]
  // Every 6-12s while idle: look left/right, stretch or yawn -- and every
  // 20-40s instead, a rare quirk (double-blink, hiccup, sneeze)
  variety?: boolean
  // Makes Sammy tappable (44px+ target): hops and says this in a bubble.
  // Long press pets him; five quick taps make him dizzy.
  onTapMessage?: () => string
  // Which edge the speech bubble lines up with
  bubbleAlign?: 'left' | 'right'
  // Waves hello (with a time-of-day bubble) once per session on mount
  greet?: boolean
  // Eyes follow a finger held down nearby
  watchTouches?: boolean
  // Wears a time/season accessory
  dressUp?: boolean
  // Days logged in a row: a flame from 3, a bigger one from 7
  streak?: number
  // Says this in a bubble whenever `key` changes
  message?: { text: string; key: number } | null
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
  greet = false,
  watchTouches = false,
  dressUp = false,
  streak = 0,
  message = null,
}: SammyProps) {
  const reduceMotion = useReducedMotion()
  const animationsOn = useMascotAnimations()
  const still = reduceMotion || !animationsOn
  const px = Math.max(1, Math.round(size))
  const parentOneShot = ONE_SHOT.includes(mood)

  // Latest values for timers and listeners set up earlier
  const stillRef = useRef(still)
  const parentOneShotRef = useRef(parentOneShot)
  useEffect(() => {
    stillRef.current = still
    parentOneShotRef.current = parentOneShot
  }, [still, parentOneShot])

  // ---- Speech bubble ----
  const [bubble, setBubble] = useState<string | null>(null)
  const [bubbleLeaving, setBubbleLeaving] = useState(false)
  const bubbleTimersRef = useRef<ReturnType<typeof setTimeout>[]>([])
  const say = useCallback((text: string) => {
    bubbleTimersRef.current.forEach(clearTimeout)
    bubbleTimersRef.current = []
    setBubble(text)
    setBubbleLeaving(false)
    bubbleTimersRef.current.push(setTimeout(() => {
      // Reduce Motion: the bubble just disappears, as before
      if (reduceMotion) {
        setBubble(null)
        return
      }
      setBubbleLeaving(true)
      bubbleTimersRef.current.push(setTimeout(() => {
        setBubble(null)
        setBubbleLeaving(false)
      }, BUBBLE_FADE_MS))
    }, BUBBLE_MS))
  }, [reduceMotion])
  useEffect(() => () => bubbleTimersRef.current.forEach(clearTimeout), [])

  // A new message key says it (on the next tick, like any other timer-driven
  // bubble, rather than re-rendering in the middle of this commit)
  useEffect(() => {
    if (!message) return
    const timer = setTimeout(() => say(message.text), 0)
    return () => clearTimeout(timer)
    // Only a new key says it again
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [message?.key])

  // ---- Acts: one of Sammy's own short animations at a time ----
  const [act, setAct] = useState<{ kind: Act; key: number } | null>(null)
  const actRef = useRef<Act | null>(null)
  const actTimerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  useEffect(() => () => clearTimeout(actTimerRef.current), [])
  const playAct = useCallback((kind: Act) => {
    if (stillRef.current || parentOneShotRef.current) return
    const current = actRef.current
    if (current && HELD_ACTS.includes(current) && !HELD_ACTS.includes(kind)) return
    clearTimeout(actTimerRef.current)
    actRef.current = kind
    setAct((prev) => ({ kind, key: (prev?.key ?? 0) + 1 }))
    actTimerRef.current = setTimeout(() => {
      actRef.current = null
      setAct(null)
    }, ACT_MS[kind])
  }, [])

  // A parent one-shot (munch, celebrate...) takes over: drop whatever act
  // was playing rather than resuming it afterwards
  useEffect(() => {
    if (!parentOneShot || !actRef.current) return
    clearTimeout(actTimerRef.current)
    actRef.current = null
    setAct(null)
  }, [parentOneShot, moodKey])

  const activeAct = !still && !parentOneShot && act ? act : null

  // ---- Tap, long press (pet) and five quick taps (dizzy) ----
  // Finger down on Sammy: he dips a sprite pixel right away, before the
  // tap (and its hop) lands on release
  const [pressed, setPressed] = useState(false)
  const pressRef = useRef<{ x: number; y: number; timer?: ReturnType<typeof setTimeout> } | null>(null)
  const longPressFiredRef = useRef(false)
  const tapTimesRef = useRef<number[]>([])
  const lastDizzyRef = useRef(-Infinity)

  const endPress = () => {
    clearTimeout(pressRef.current?.timer)
    pressRef.current = null
    setPressed(false)
  }
  useEffect(() => () => clearTimeout(pressRef.current?.timer), [])

  const handlePointerDown = (e: React.PointerEvent) => {
    setPressed(!still)
    longPressFiredRef.current = false
    pressRef.current = {
      x: e.clientX,
      y: e.clientY,
      timer: setTimeout(() => {
        // Held ~500ms: a pet, and the click that follows isn't a tap
        longPressFiredRef.current = true
        setPressed(false)
        say('Aww, thanks!')
        playAct('pet')
      }, LONG_PRESS_MS),
    }
  }
  const handlePointerMove = (e: React.PointerEvent) => {
    const p = pressRef.current
    if (p && Math.hypot(e.clientX - p.x, e.clientY - p.y) > PRESS_SLOP_PX) endPress()
  }

  const handleTap = () => {
    if (!onTapMessage) return
    if (longPressFiredRef.current) {
      longPressFiredRef.current = false
      return
    }
    const now = Date.now()
    tapTimesRef.current = [...tapTimesRef.current.filter((t) => now - t < DIZZY_WINDOW_MS), now]
    if (!still && tapTimesRef.current.length >= DIZZY_TAPS && now - lastDizzyRef.current >= DIZZY_COOLDOWN_MS) {
      tapTimesRef.current = []
      lastDizzyRef.current = now
      say('Whoa, the room is spinning!')
      playAct('dizzy')
      return
    }
    say(onTapMessage())
    playAct('hop')
  }

  const resting = !still && !parentOneShot && !activeAct && (mood === 'idle' || mood === 'loading' || mood === 'think')

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
  // only while plain idle (the timer stops whenever another mood plays).
  // Once the quirk gap (a fresh 20-40s each time) has passed, the next slot
  // is a quirk instead -- one scheduler, so a pose and a quirk never overlap.
  const [pose, setPose] = useState<IdleVariety | null>(null)
  const lastPoseRef = useRef<IdleVariety | null>(null)
  const lastQuirkRef = useRef<{ kind: Quirk | null; at: number; gap: number } | null>(null)
  const varietyOn = variety && resting && mood === 'idle'
  useEffect(() => {
    if (!varietyOn) return
    const timers: ReturnType<typeof setTimeout>[] = []
    const schedule = () => {
      timers.push(setTimeout(() => {
        const now = Date.now()
        const quirkGap = () => QUIRK_GAP_MIN_MS + Math.random() * (QUIRK_GAP_MAX_MS - QUIRK_GAP_MIN_MS)
        // The clock starts the first time Sammy sits idle
        lastQuirkRef.current ??= { kind: null, at: now, gap: quirkGap() }
        const last = lastQuirkRef.current
        if (now - last.at >= last.gap) {
          const options = QUIRKS.filter((q) => q !== last.kind)
          const kind = options[Math.floor(Math.random() * options.length)]
          lastQuirkRef.current = { kind, at: now, gap: quirkGap() }
          // Ends this effect (no longer resting); it restarts after the act
          playAct(kind)
          return
        }
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
  }, [varietyOn, playAct])

  // ---- Eye follow ----
  const spriteBoxRef = useRef<HTMLSpanElement>(null)
  const [gaze, setGaze] = useState<'lookLeft' | 'lookRight' | 'lookUp' | null>(null)
  const gazeOn = watchTouches && resting
  useEffect(() => {
    if (!gazeOn) return
    let down = false
    const aim = (e: PointerEvent) => {
      const box = spriteBoxRef.current?.getBoundingClientRect()
      if (!box) return
      const onSammy = e.clientX >= box.left && e.clientX <= box.right && e.clientY >= box.top && e.clientY <= box.bottom
      const dx = e.clientX - (box.left + box.width / 2)
      const dy = e.clientY - (box.top + box.height / 2)
      if (onSammy || Math.hypot(dx, dy) > GAZE_RADIUS_PX) {
        setGaze(null)
        return
      }
      setGaze(-dy > Math.abs(dx) ? 'lookUp' : dx < 0 ? 'lookLeft' : 'lookRight')
    }
    const handleDown = (e: PointerEvent) => {
      down = true
      aim(e)
    }
    const handleMove = (e: PointerEvent) => {
      if (down) aim(e)
    }
    const handleUp = () => {
      down = false
      setGaze(null)
    }
    window.addEventListener('pointerdown', handleDown, { passive: true })
    window.addEventListener('pointermove', handleMove, { passive: true })
    window.addEventListener('pointerup', handleUp)
    window.addEventListener('pointercancel', handleUp)
    return () => {
      window.removeEventListener('pointerdown', handleDown)
      window.removeEventListener('pointermove', handleMove)
      window.removeEventListener('pointerup', handleUp)
      window.removeEventListener('pointercancel', handleUp)
      setGaze(null)
    }
  }, [gazeOn])

  // ---- Greeting wave: once per session ----
  useEffect(() => {
    if (!greet) return
    try {
      if (sessionStorage.getItem(GREETED_SESSION_KEY)) return
    } catch {
      // Storage blocked: still greet, just maybe again next visit
    }
    const timer = setTimeout(() => {
      try {
        sessionStorage.setItem(GREETED_SESSION_KEY, '1')
      } catch {}
      say(greetingFor(new Date()))
      // Still (Reduce Motion / animations off): the hello, without the wave
      playAct('wave')
    }, GREET_DELAY_MS)
    return () => clearTimeout(timer)
    // Mount only
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // ---- Accessory, from the local clock (rechecked every minute) ----
  const [accessory, setAccessory] = useState<Accessory | null>(null)
  useEffect(() => {
    if (!dressUp) return
    const check = () => setAccessory(pickAccessory(new Date()))
    const first = setTimeout(check, 0)
    const id = setInterval(check, 60_000)
    return () => {
      clearTimeout(first)
      clearInterval(id)
    }
  }, [dressUp])

  // What's actually on screen, highest priority first: the parent's
  // one-shot, then Sammy's own act, then his resting mood
  const shown: SammyMood = mood
  const activePose = varietyOn ? pose : null
  const face: Face =
    shown === 'celebrate' ? 'celebrate'
      : shown === 'flex' ? 'flex'
        : shown === 'happy' ? 'happy'
          : shown === 'munch' ? 'munch'
            : shown === 'oops' ? 'oops'
              : activeAct ? ACT_FACE[activeAct.kind]
                : shown === 'sleep' ? 'sleep'
                  : (gazeOn ? gaze : null) ?? activePose ?? (resting && blink ? 'blink' : 'idle')
  const rows = faceGrid(face)

  // Movement is whole sprite pixels only (steps() keyframes in globals.css,
  // scaled by --sammy-px). One class at a time, so animations never stack.
  const motionClass = still
    ? ''
    : !parentOneShot && activeAct
      ? ACT_MOTION[activeAct.kind]
      : {
          idle: 'sammy-bob',
          think: 'sammy-bob',
          loading: 'sammy-loading',
          sleep: 'sammy-sleep',
          happy: 'sammy-hop',
          celebrate: 'sammy-celebrate',
          munch: 'sammy-munch',
          oops: 'sammy-shake',
          flex: 'sammy-flex',
        }[shown]
  // Remounting the moving span restarts its one-shot animation cleanly
  const motionKey = parentOneShot ? `${shown}-${moodKey}` : activeAct ? `act-${activeAct.kind}-${activeAct.key}` : 'rest'

  // Sparkles, hearts and stars get the space to themselves: the accessory
  // and streak flame step aside while they play
  const effectsPlaying = shown === 'celebrate' || shown === 'flex' || activeAct?.kind === 'pet' || activeAct?.kind === 'dizzy'
  const showAccessory = dressUp && accessory && !effectsPlaying
  const flame = streak >= 7 ? FLAME_LARGE : streak >= 3 ? FLAME_SMALL : null
  // Behind the tips, which wave for the greeting and wiggle on some blinks
  const tipsClass = activeAct?.kind === 'wave' ? 'sammy-wave' : !still && wiggle && !activePose && !activeAct ? 'sammy-wiggle' : undefined

  const width = COLS * px
  const height = ROWS * px
  const sprite = (
    <span
      key={motionKey}
      className={`block ${motionClass}`}
      style={{ ['--sammy-px' as string]: `${px}px`, width, height }}
    >
      {/* pointer-events none: hats, sparkles, hearts and stars spill past
          the sprite, but only the button's own box is tappable */}
      <svg width={width} height={height} viewBox={`0 0 ${COLS} ${ROWS}`} shapeRendering="crispEdges" overflow="visible" className="block pointer-events-none">
        {flame && !effectsPlaying && <Cells cells={flame} />}
        <g className={tipsClass} transform={face === 'stretch' ? 'translate(0 -1)' : undefined}>
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
        {showAccessory && <Cells cells={ACCESSORIES[accessory]} />}

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

        {shown === 'sleep' && !activeAct && (
          <g className={still ? undefined : 'sammy-z'} fill={Z_COLOR} opacity={still ? 0.8 : undefined}>
            {Z_PIXELS.map(([x, y]) => <rect key={`${x}-${y}`} x={18 + x} y={-3 + y} width={1} height={1} />)}
          </g>
        )}

        {shown === 'think' && !activeAct && (
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
            <Sparkle key={i} x={x} y={y} delay={delay} color={sparkleColors[i % sparkleColors.length]} />
          ))}

        {shown === 'flex' && (
          <>
            <Cells cells={FLEX_ARM} />
            {!still && FLEX_SPARKLES.map(([x, y, delay], i) => (
              <Sparkle key={i} x={x} y={y} delay={delay} color={sparkleColors[i % sparkleColors.length]} />
            ))}
          </>
        )}

        {activeAct?.kind === 'pet' && HEARTS.map(([x, y, delay], i) => (
          <g key={i} className="sammy-heart" style={{ animationDelay: `${delay}ms` }}>
            <Cells cells={shape(HEART, x, y)} />
          </g>
        ))}

        {activeAct?.kind === 'dizzy' && STAR_DELAYS_MS.map((delay, i) => (
          <g key={i} className="sammy-orbit" style={{ animationDelay: `${delay}ms` }} fill={i === 1 ? PALETTE.c : PALETTE.K}>
            <rect x={STAR_CENTER[0] + 1} y={STAR_CENTER[1]} width={1} height={3} />
            <rect x={STAR_CENTER[0]} y={STAR_CENTER[1] + 1} width={3} height={1} />
          </g>
        ))}

        {activeAct?.kind === 'sneeze' && (
          <g className="sammy-burst">
            {OPEN_MOUTH.map(([r, c, key]) => <rect key={`${r}-${c}`} x={c} y={r} width={1} height={1} fill={PALETTE[key]} />)}
            <Cells cells={SNEEZE_SPRAY} />
          </g>
        )}

        {activeAct?.kind === 'doubleBlink' && (
          <g className="sammy-lids">
            <Cells cells={LIDS} />
          </g>
        )}
      </svg>
    </span>
  )

  const speechBubble = bubble && (
    <span
      role="status"
      aria-live="polite"
      className={`absolute bottom-full mb-3 z-50 w-max max-w-[min(14rem,70vw)] px-2 py-1 text-xs font-bold leading-snug text-app text-left pointer-events-none ${
        bubbleAlign === 'right' ? 'right-0' : 'left-0'
      } ${bubbleLeaving ? 'sammy-bubble-out' : 'sammy-bubble-in'}`}
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
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={endPress}
          onPointerCancel={endPress}
          onPointerLeave={endPress}
          // A long press is a pet, not the system's callout/menu
          onContextMenu={(e) => e.preventDefault()}
          aria-label={label ?? 'Sammy. Tap for a progress update'}
          // 44px minimum tap target even when the sprite is smaller
          className="flex items-end justify-center select-none [-webkit-touch-callout:none]"
          style={{ minWidth: 44, minHeight: 44, width: Math.max(44, width), height: Math.max(44, height) }}
        >
          {/* Whole sprite pixel, so the art stays on the pixel grid */}
          <span ref={spriteBoxRef} className="block" style={pressed ? { transform: `translateY(${px}px)` } : undefined}>
            {sprite}
          </span>
        </button>
      </span>
    )
  }

  return (
    <span
      ref={spriteBoxRef}
      className={`relative inline-block shrink-0 pointer-events-none select-none ${className}`}
      style={{ width, height }}
      role={label ? 'img' : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
    >
      {speechBubble}
      {sprite}
    </span>
  )
}
