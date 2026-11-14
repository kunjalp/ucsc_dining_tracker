'use client'

import { Haptics } from '@capacitor/haptics'
import { SlidersHorizontal } from 'lucide-react'
import BottomSheet, { SheetCloseButton } from './BottomSheet'

// The dietary filter built from the student's saved preferences. Leave it
// out when they have none saved.
export interface DietFilter {
  // "Vegan · Milk-free"
  label: string
  // How many items the preferences hide (or would hide, while showing)
  hiddenCount: number
  // True while the student has chosen to see those items anyway
  showing: boolean
  onToggle: () => void
}

interface FiltersSheetProps {
  onClose: () => void
  diet?: DietFilter
  favoritesOnly: boolean
  onToggleFavorites: () => void
  // Station names, "Parent - Sub" for nested ones
  stations: string[]
  activeStations: string[]
  onToggleStation: (station: string) => void
  onClearStations: () => void
  // Tidies a raw station name for display
  stationLabel?: (name: string) => string
}

const tick = () => {
  Haptics.selectionChanged().catch(() => {})
}

// One sheet for everything that narrows a food list: the dietary Show/Hide,
// favorites only, and the station picker. Changes apply as they're tapped;
// Done just closes. Each tap gives its own selection haptic, so the
// handlers passed in only need to update state.
export default function FiltersSheet({
  onClose,
  diet,
  favoritesOnly,
  onToggleFavorites,
  stations,
  activeStations,
  onToggleStation,
  onClearStations,
  stationLabel = (name) => name,
}: FiltersSheetProps) {
  return (
    <BottomSheet onClose={onClose} labelledBy="filters-sheet-title">
      <h2 id="filters-sheet-title" className="text-lg font-bold tracking-tight text-fg mb-1">
        Filters
      </h2>

      <div className="divide-y divide-line">
        {diet && (
          <div className="py-2 min-h-tap flex items-center gap-3">
            <p className="min-w-0 flex-1 text-sm font-semibold text-fg">
              {diet.label}
              <span className="block text-xs font-medium text-fg-muted tabular-nums">
                {diet.hiddenCount === 0
                  ? 'Nothing hidden on this menu'
                  : `${diet.hiddenCount} ${diet.showing ? 'shown anyway' : 'hidden'}`}
              </span>
            </p>
            {diet.hiddenCount > 0 && (
              <button
                type="button"
                onClick={() => {
                  diet.onToggle()
                  tick()
                }}
                aria-label={diet.showing ? 'Hide items that do not match your dietary preferences' : `Show ${diet.hiddenCount} hidden items`}
                className="shrink-0 min-h-tap min-w-tap px-2 text-sm font-bold text-gold press active:scale-95 motion-reduce:active:scale-100"
              >
                {diet.showing ? 'Hide' : 'Show'}
              </button>
            )}
          </div>
        )}

        <button
          type="button"
          role="switch"
          aria-checked={favoritesOnly}
          onClick={() => {
            onToggleFavorites()
            tick()
          }}
          className="w-full min-h-tap py-2 flex items-center justify-between gap-3 text-left text-sm font-semibold text-fg press active:opacity-70"
        >
          Favorites only
          <span
            aria-hidden="true"
            className={`relative h-6 w-10 shrink-0 rounded-full transition-colors motion-reduce:transition-none ${favoritesOnly ? 'bg-gold' : 'bg-white/15'}`}
          >
            <span
              className={`absolute top-0.5 left-0.5 size-5 rounded-full bg-fg transition-transform motion-reduce:transition-none ${favoritesOnly ? 'translate-x-4' : ''}`}
            />
          </span>
        </button>

        {stations.length > 0 && (
          <div className="pt-1 pb-2">
            <div className="flex items-center justify-between gap-3">
              <h3 className="text-sm font-semibold text-fg">
                Stations
                <span className="font-medium text-fg-muted tabular-nums"> · {activeStations.length || 'All'}</span>
              </h3>
              <button
                type="button"
                onClick={() => {
                  onClearStations()
                  tick()
                }}
                disabled={activeStations.length === 0}
                className="min-h-tap min-w-tap px-2 text-sm font-bold text-gold press active:scale-95 motion-reduce:active:scale-100 disabled:opacity-40"
              >
                Clear
              </button>
            </div>
            {/* Wrapping multi-select chips; ::after pads each tap area to 44px */}
            <div className="flex flex-wrap gap-x-2 gap-y-3 pt-1">
              {stations.map((station) => {
                const isActive = activeStations.includes(station)
                const [parentLabel, subLabel] = station.includes(' - ') ? station.split(' - ') : [null, station]
                return (
                  <button
                    key={station}
                    type="button"
                    onClick={() => {
                      onToggleStation(station)
                      tick()
                    }}
                    aria-pressed={isActive}
                    className={`relative after:absolute after:inset-x-0 after:-inset-y-1.5 after:content-[''] px-3 py-2 rounded-full border press active:scale-95 motion-reduce:active:scale-100 flex flex-col items-center leading-tight ${isActive
                      ? 'bg-gold/15 text-gold border-gold/40'
                      : 'bg-white/5 text-fg-muted hover:bg-white/10 border-white/15'
                      }`}
                  >
                    {parentLabel && (
                      <span className={`text-9 font-semibold uppercase tracking-wide ${isActive ? 'text-gold/70' : 'text-sky'}`}>
                        {parentLabel}
                      </span>
                    )}
                    <span className="text-xs font-bold">{stationLabel(subLabel)}</span>
                  </button>
                )
              })}
            </div>
          </div>
        )}
      </div>

      <SheetCloseButton
        className="mt-4 w-full min-h-tap rounded-xl bg-gold text-sm font-semibold text-on-gold hover:brightness-105 press active:scale-95 motion-reduce:active:scale-100"
      >
        Done
      </SheetCloseButton>
    </BottomSheet>
  )
}

// The button that opens the sheet. Sits beside a search field and matches
// its height; a small gold dot on the icon says a filter is on.
export function FiltersButton({ activeCount, onClick }: { activeCount: number; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={() => {
        onClick()
        tick()
      }}
      aria-haspopup="dialog"
      aria-label={activeCount > 0 ? `Filters, ${activeCount} on` : 'Filters'}
      className="shrink-0 self-stretch min-h-tap px-3 flex items-center gap-1.5 rounded-lg bg-surface-2 text-sm font-semibold text-fg-muted hover:text-fg press active:scale-95 motion-reduce:active:scale-100"
    >
      <span className="relative flex">
        <SlidersHorizontal size={16} aria-hidden="true" />
        {activeCount > 0 && (
          <span aria-hidden="true" className="absolute -top-1 -right-1 size-2 rounded-full bg-gold ring-2 ring-surface-2" />
        )}
      </span>
      Filters
    </button>
  )
}
