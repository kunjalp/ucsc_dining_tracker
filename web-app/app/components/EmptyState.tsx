// Empty, loading and error states in the ledger look: one short muted line
// straight on the page, plus at most one quiet text action. No card, no
// inline Sammy (he lives in the header), no pill button.

interface EmptyStateProps {
  children: React.ReactNode
  /** An error that should be announced right away; otherwise it is a polite status */
  alert?: boolean
  action?: { label: string; onClick: () => void }
  className?: string
}

export default function EmptyState({ children, alert, action, className = 'py-10' }: EmptyStateProps) {
  return (
    <div role={alert ? 'alert' : 'status'} className={`flex flex-col items-center text-center ${className}`}>
      <p className={`max-w-xs text-sm font-medium text-balance ${alert ? 'text-danger' : 'text-fg-muted'}`}>{children}</p>
      {action && (
        <button
          type="button"
          onClick={action.onClick}
          className="relative mt-1 min-h-btn px-3 text-sm font-semibold text-sky press active:opacity-70 after:absolute after:-inset-y-1 after:inset-x-0 after:content-['']"
        >
          {action.label}
        </button>
      )}
    </div>
  )
}

// Loading placeholder rows: hairline-divided bars in surface tones. The pulse
// stops under Reduce Motion.
export function LoadingRows({ label, rows = 4 }: { label: string; rows?: number }) {
  return (
    <div role="status" aria-label={label} className="divide-y divide-line">
      {Array.from({ length: rows }, (_, i) => (
        <div
          key={i}
          className="py-4 flex items-center justify-between gap-4 animate-pulse motion-reduce:animate-none"
          style={{ animationDelay: `${i * 120}ms` }}
        >
          <div className="flex-1 space-y-2">
            <div className="h-4 w-2/3 max-w-44 rounded bg-surface-2" />
            <div className="h-3 w-1/3 max-w-24 rounded bg-surface-2" />
          </div>
          <div className="h-8 w-16 rounded-lg bg-surface-2 shrink-0" />
        </div>
      ))}
    </div>
  )
}
