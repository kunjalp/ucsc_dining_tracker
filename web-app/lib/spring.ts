// Small motion toolkit for gesture-driven UI (bottom sheets, toasts), after
// Apple's "Designing Fluid Interfaces" (WWDC 2018). No library: a spring
// stepped on requestAnimationFrame, a velocity tracker, momentum projection
// and rubber-banding.

export interface Spring {
  stop: () => void
}

interface SpringOptions {
  from: number
  to: number
  // Starting velocity in units per second -- pass the finger's release
  // velocity so there's no seam between dragging and animating
  velocity?: number
  // 1 = settles with no overshoot; below 1 overshoots (only after a flick)
  damping?: number
  // Seconds; lower is snappier. Not a duration -- settle time falls out of
  // damping + response.
  response?: number
  onUpdate: (value: number) => void
  onComplete?: () => void
}

// Done once it's within half a unit of the target and nearly still
const REST_DELTA = 0.5
const REST_SPEED = 20
// Fixed integration step, so a dropped frame doesn't destabilise the spring
const STEP_S = 1 / 240

export function animateSpring({ from, to, velocity = 0, damping = 1, response = 0.3, onUpdate, onComplete }: SpringOptions): Spring {
  // Apple's damping ratio + response -> stiffness and friction (mass 1)
  const stiffness = (2 * Math.PI / response) ** 2
  const friction = (4 * Math.PI * damping) / response
  let x = from
  let v = velocity
  let last = performance.now()
  let frame = 0

  const tick = (now: number) => {
    let dt = Math.min(Math.max(0, (now - last) / 1000), 0.064)
    last = now
    while (dt > 0) {
      const h = Math.min(dt, STEP_S)
      v += (-stiffness * (x - to) - friction * v) * h
      x += v * h
      dt -= h
    }
    if (Math.abs(x - to) < REST_DELTA && Math.abs(v) < REST_SPEED) {
      onUpdate(to)
      onComplete?.()
      return
    }
    onUpdate(x)
    frame = requestAnimationFrame(tick)
  }
  frame = requestAnimationFrame(tick)
  return { stop: () => cancelAnimationFrame(frame) }
}

// Release velocity from the last ~100ms of pointer positions rather than
// just the final two events (one jittery event would read as a flick)
const VELOCITY_WINDOW_MS = 100
// No move for this long before release means the finger had stopped
const VELOCITY_STALE_MS = 60

export function createVelocityTracker() {
  let samples: { value: number; t: number }[] = []
  return {
    reset() {
      samples = []
    },
    add(value: number, t = performance.now()) {
      samples.push({ value, t })
      while (samples.length > 2 && t - samples[0].t > VELOCITY_WINDOW_MS) samples.shift()
    },
    // Units per second
    velocity(now = performance.now()) {
      if (samples.length < 2) return 0
      const first = samples[0]
      const last = samples[samples.length - 1]
      if (now - last.t > VELOCITY_STALE_MS) return 0
      const dt = last.t - first.t
      return dt > 0 ? ((last.value - first.value) / dt) * 1000 : 0
    },
  }
}

// How much further a flick would coast, like scroll deceleration -- Apple's
// projection from the Designing Fluid Interfaces sample code
export function project(velocity: number, decelerationRate = 0.998) {
  return ((velocity / 1000) * decelerationRate) / (1 - decelerationRate)
}

// Past a boundary, follow the finger less and less the further it goes
export function rubberband(overshoot: number, dimension: number, constant = 0.55) {
  return (overshoot * dimension * constant) / (dimension + constant * Math.abs(overshoot))
}
