'use client'

import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react'
import { Haptics, NotificationType } from '@capacitor/haptics'

// How long the "Tap again" step waits before reverting to the idle label
const ARMED_MS = 3000

interface ConfirmTapButtonProps {
  // Runs on the second tap only
  onConfirm: () => void
  // Idle content (icon + label). Muted by default; red only while armed.
  children: ReactNode
  confirmLabel?: string
  disabled?: boolean
  // Layout and tap target (min-h-btn / after: padding). Color is handled here.
  className?: string
}

// The one inline "tap again" delete pattern (recipe delete, remove photo).
// First tap: the label turns into red "Tap again to delete" for ~3 seconds,
// then reverts on its own. Second tap within that window runs onConfirm,
// with a warning haptic. Red shows only on the confirming step. No motion
// involved, so Reduce Motion needs nothing extra.
export default function ConfirmTapButton({
  onConfirm,
  children,
  confirmLabel = 'Tap again to delete',
  disabled,
  className = '',
}: ConfirmTapButtonProps) {
  const [armed, setArmed] = useState(false)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const clearTimer = () => {
    if (timerRef.current) clearTimeout(timerRef.current)
    timerRef.current = null
  }
  useEffect(() => clearTimer, [])

  const handleClick = useCallback(() => {
    if (!armed) {
      setArmed(true)
      Haptics.selectionChanged().catch(() => {})
      clearTimer()
      timerRef.current = setTimeout(() => setArmed(false), ARMED_MS)
      return
    }
    clearTimer()
    setArmed(false)
    Haptics.notification({ type: NotificationType.Warning }).catch(() => {})
    onConfirm()
  }, [armed, onConfirm])

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={disabled}
      className={`font-semibold press disabled:opacity-40 ${armed ? 'text-danger' : 'text-fg-muted hover:text-fg'} ${className}`}
    >
      {armed ? confirmLabel : children}
    </button>
  )
}
