'use client'

import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react'
import { AlertCircle, Check } from 'lucide-react'

export type ToastTone = 'info' | 'success' | 'error'

export interface ToastMessage {
  id: number
  message: string
  tone: ToastTone
}

// How long a message toast stays up before dismissing itself
const TOAST_DURATION_MS = 4000

// Queue of short-lived message toasts. showToast() replaces alert() --
// nothing blocks, and errors read in the danger color instead of a system popup.
export function useToasts() {
  const [toasts, setToasts] = useState<ToastMessage[]>([])
  const nextIdRef = useRef(1)
  const timersRef = useRef<Map<number, ReturnType<typeof setTimeout>>>(new Map())

  const dismissToast = useCallback((id: number) => {
    const timer = timersRef.current.get(id)
    if (timer) clearTimeout(timer)
    timersRef.current.delete(id)
    setToasts((prev) => prev.filter((t) => t.id !== id))
  }, [])

  const showToast = useCallback((message: string, tone: ToastTone = 'info') => {
    const id = nextIdRef.current++
    // Keep at most 2 message toasts on screen; the oldest makes room
    setToasts((prev) => [...prev.slice(-1), { id, message, tone }])
    timersRef.current.set(id, setTimeout(() => dismissToast(id), TOAST_DURATION_MS))
  }, [dismissToast])

  useEffect(() => {
    const timers = timersRef.current
    return () => timers.forEach((timer) => clearTimeout(timer))
  }, [])

  return { toasts, showToast, dismissToast }
}

interface ToastProps {
  tone?: ToastTone
  children: ReactNode
  // Optional trailing button, e.g. "Undo"
  action?: { label: string; onClick: () => void }
  onDismiss?: () => void
}

// One toast: navy surface, gold accent (danger red for errors)
export function Toast({ tone = 'info', children, action, onDismiss }: ToastProps) {
  const isError = tone === 'error'
  return (
    <div
      role={isError ? 'alert' : 'status'}
      aria-live={isError ? 'assertive' : 'polite'}
      onClick={action ? undefined : onDismiss}
      className={`pointer-events-auto w-full max-w-md flex items-center gap-3 pl-4 ${action ? 'pr-1 py-1' : 'pr-4 py-3'} rounded-2xl bg-surface-2 border shadow-[0_8px_30px_-6px_rgba(0,0,0,0.6)] animate-ring-toast ${
        isError ? 'border-danger/40' : 'border-gold/30'
      }`}
    >
      {tone === 'error' && <AlertCircle size={16} className="shrink-0 text-danger" aria-hidden="true" />}
      {tone === 'success' && <Check size={16} strokeWidth={2.75} className="shrink-0 text-gold" aria-hidden="true" />}
      <span className={`flex-1 min-w-0 text-sm ${isError ? 'text-danger' : 'text-fg'}`}>{children}</span>
      {action && (
        <button
          type="button"
          onClick={action.onClick}
          className="min-h-tap px-4 rounded-xl text-sm font-semibold text-gold hover:bg-gold/10 active:scale-95 motion-reduce:active:scale-100 transition"
        >
          {action.label}
        </button>
      )}
    </div>
  )
}

// The one place toasts render: stacked just above the floating tab bar
// (12px gap + ~50px bar + 10px, over the home-indicator inset), so the undo
// toast and message toasts share a column and can never overlap.
export function ToastStack({ toasts, onDismiss, children }: {
  toasts: ToastMessage[]
  onDismiss: (id: number) => void
  children?: ReactNode // persistent toasts, e.g. the undo toast
}) {
  return (
    <div
      className="fixed left-0 right-0 z-[60] px-4 flex flex-col-reverse items-center gap-2 pointer-events-none"
      style={{ bottom: 'calc(env(safe-area-inset-bottom) + 72px)' }}
    >
      {children}
      {toasts.map((t) => (
        <Toast key={t.id} tone={t.tone} onDismiss={() => onDismiss(t.id)}>
          {t.message}
        </Toast>
      ))}
    </div>
  )
}
