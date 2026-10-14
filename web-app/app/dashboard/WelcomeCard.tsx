'use client'

import { useAnimatedClose } from '@/lib/useAnimatedClose'

// One-time welcome card for first-time users. Fades in while scaling up
// from 0.96, and plays that in reverse before onClose (Escape, backdrop or
// "Got it").
export default function WelcomeCard({ onClose }: { onClose: () => void }) {
  const { closing, requestClose, onAnimationEnd } = useAnimatedClose(onClose)
  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center px-5"
      role="dialog"
      aria-modal="true"
      aria-labelledby="welcome-title"
    >
      <div
        className={`glass-scrim absolute inset-0 bg-[#060e20]/70 backdrop-blur-sm ${closing ? 'animate-backdrop-out' : 'animate-sheet-backdrop'}`}
        onClick={requestClose}
      />
      <div
        onAnimationEnd={onAnimationEnd}
        className={`relative w-full max-w-sm rounded-2xl p-6 bg-[#171f33] border border-white/10 shadow-[0_20px_60px_-10px_rgba(0,0,0,0.6)] text-fg ${closing ? 'animate-modal-out' : 'animate-modal-in'}`}
      >
        <h2 id="welcome-title" className="text-lg font-bold tracking-tight text-fg mb-3">
          Welcome to Sammy&apos;s Palate
        </h2>
        <ul className="space-y-2.5 text-sm text-fg-subtle mb-5">
          <li>Browse today&apos;s menu, filter by station, and tap + to log what you eat.</li>
          <li>Watch your calories, protein, carbs, and fat fill in below as you log.</li>
          <li>Drag the slug (or tap a letter) to preview a different meal&apos;s menu.</li>
        </ul>
        <button
          type="button"
          onClick={requestClose}
          className="w-full py-2.5 rounded-lg bg-gold text-[#6b5300] text-sm font-bold active:scale-95 press"
        >
          Got it
        </button>
      </div>
    </div>
  )
}
