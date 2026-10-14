import { useCallback, useEffect, useRef, useState, type AnimationEvent } from 'react'
import { useReducedMotion } from './useReducedMotion'

// Longest the exit can take before onClose runs anyway (it's 0.25s), in case
// animationend never fires -- e.g. Reduce Motion switched on mid-exit
const EXIT_FALLBACK_MS = 400

// Centered modals (SetTargetsModal, the welcome card): every close path --
// Escape, backdrop, buttons -- calls requestClose, which plays the exit
// (.animate-modal-out / .animate-backdrop-out in globals.css) and only then
// calls onClose to unmount. Reduce Motion: closes instantly, as before.
export function useAnimatedClose(onClose: () => void) {
  const reduceMotion = useReducedMotion()
  const [closing, setClosing] = useState(false)
  const closedRef = useRef(false)
  const onCloseRef = useRef(onClose)
  useEffect(() => {
    onCloseRef.current = onClose
  }, [onClose])

  const finish = useCallback(() => {
    if (closedRef.current) return
    closedRef.current = true
    onCloseRef.current()
  }, [])

  const requestClose = useCallback(() => {
    if (reduceMotion) finish()
    else setClosing(true)
  }, [reduceMotion, finish])

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') requestClose()
    }
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [requestClose])

  useEffect(() => {
    if (!closing) return
    const timer = setTimeout(finish, EXIT_FALLBACK_MS)
    return () => clearTimeout(timer)
  }, [closing, finish])

  // Put on the panel: unmounts once its own exit animation ends (not a
  // child's animation bubbling up)
  const onAnimationEnd = useCallback((e: AnimationEvent) => {
    if (closing && e.target === e.currentTarget) finish()
  }, [closing, finish])

  return { closing, requestClose, onAnimationEnd }
}
