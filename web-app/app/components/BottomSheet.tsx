'use client'

import { useEffect, useRef, useState, type ReactNode } from 'react'

interface BottomSheetProps {
  onClose: () => void
  labelledBy: string
  children: ReactNode
  // Background + max height, e.g. "bg-surface-2 max-h-[85dvh]"
  className?: string
}

// How far the grab handle has to be dragged down before letting go closes the sheet
const DISMISS_DRAG_PX = 90

// iOS-style bottom sheet: docks to the bottom edge, slides up, has a grab
// handle that can be dragged down to dismiss, and pads its content past the
// home indicator (safe-area-inset-bottom) so the last button is never under it.
export default function BottomSheet({ onClose, labelledBy, children, className = 'bg-surface-2 max-h-[85dvh]' }: BottomSheetProps) {
  const [dragY, setDragY] = useState(0)
  const [dragging, setDragging] = useState(false)
  const startYRef = useRef(0)

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [onClose])

  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    startYRef.current = e.clientY
    setDragging(true)
    e.currentTarget.setPointerCapture(e.pointerId)
  }

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!dragging) return
    setDragY(Math.max(0, e.clientY - startYRef.current))
  }

  const handlePointerUp = () => {
    if (!dragging) return
    setDragging(false)
    if (dragY > DISMISS_DRAG_PX) onClose()
    else setDragY(0)
  }

  return (
    <div
      className="fixed inset-0 z-[100] flex items-end justify-center"
      role="dialog"
      aria-modal="true"
      aria-labelledby={labelledBy}
    >
      <div
        className="absolute inset-0 bg-[#060e20]/70 backdrop-blur-sm animate-sheet-backdrop"
        onClick={onClose}
      />
      {/* Entrance animation and drag offset live on separate elements -- an
          animation's fill-mode would otherwise override the inline transform */}
      <div className="relative w-full max-w-md animate-sheet-up">
        <div
          className={`flex flex-col rounded-t-2xl border border-b-0 border-white/10 shadow-[0_-10px_40px_-10px_rgba(0,0,0,0.6)] text-fg motion-reduce:transition-none ${dragging ? 'transition-none' : 'transition-transform duration-200 ease-out'} ${className}`}
          style={{ transform: dragY ? `translateY(${dragY}px)` : undefined }}
        >
          <div
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            onPointerCancel={handlePointerUp}
            className="shrink-0 flex justify-center pt-2 pb-1.5 touch-none cursor-grab active:cursor-grabbing"
            aria-hidden="true"
          >
            <span className="h-1 w-9 rounded-full bg-white/25" />
          </div>
          <div className="relative overflow-y-auto overscroll-contain px-5 pb-[calc(env(safe-area-inset-bottom)+1.25rem)]">
            {children}
          </div>
        </div>
      </div>
    </div>
  )
}
