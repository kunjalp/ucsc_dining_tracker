'use client'

import { Haptics } from '@capacitor/haptics'
import { Check, SlidersHorizontal } from 'lucide-react'
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
  // One-of-many pickers, shown as plain rows with a gold check. Browse only.
  halls?: ChoiceFilter
  sort?: ChoiceFilter
}

export interface ChoiceFilter {
  title: string
  options: { value: string; label: string }[]
  value: string
  onChange: (value: string) => void
}

function ChoiceSection({ title, options, value, onChange }: ChoiceFilter) {
  return (
    <div className="pt-1 pb-1">
      <h3 className="min-h-tap flex items-center text-sm font-semibold text-fg">{title}</h3>
      <div role="radiogroup" aria-label={title} className="divide-y divide-line">
        {options.map((o) => (
          <button
            key={o.value}
            type="button"
            role="radio"
            aria-checked={o.value === value}
            onClick={() => {
              onChange(o.value)
              tick()
            }}
            className={`w-full min-h-tap flex items-center justify-between gap-3 text-left text-sm press active:opacity-70 ${o.value === value ? 'font-semibold text-fg' : 'font-medium text-fg-muted'}`}
          >
            {o.label}
            {o.value === value && <Check size={16} strokeWidth={3} className="text-gold" aria-hidden="true" />}
          </button>
        ))}
      </div>
    </div>
  )
}

// Multi-select station rows. Nested stations ("Parent - Sub") sit under a
// small uppercase section label for their parent.
function StationList({
  stations,
  activeStations,
  onToggleStation,
  stationLabel,
}: {
  stations: string[]
  activeStations: string[]
  onToggleStation: (station: string) => void
  stationLabel: (name: string) => string
}) {
  const groups: { parent: string | null; items: { station: string; label: string }[] }[] = []
  for (const station of stations) {
    const [parent, sub] = station.includes(' - ') ? station.split(' - ') : [null, station]
    let group = groups.find((g) => g.parent === parent)
    if (!group) {
      group = { parent, items: [] }
      groups.push(group)
    }
    group.items.push({ station, label: stationLabel(sub) })
  }
  // Loose stations first, then each parent's group
  groups.sort((x, y) => Number(x.parent !== null) - Number(y.parent !== null))

  return (
    <div>
      {groups.map((g) => (
        <div key={g.parent ?? 'loose'}>
          {g.parent && (
            <h4 className="pt-3 pb-1 text-xs font-bold uppercase tracking-wider text-fg-muted">{g.parent}</h4>
          )}
          <div className="divide-y divide-line">
            {g.items.map(({ station, label }) => {
              const isActive = activeStations.includes(station)
              return (
                <button
                  key={station}
                  type="button"
                  role="checkbox"
                  aria-checked={isActive}
                  onClick={() => {
                    onToggleStation(station)
                    tick()
                  }}
                  className={`w-full min-h-tap py-2 flex items-center justify-between gap-3 text-left text-sm press active:opacity-70 ${isActive ? 'font-semibold text-fg' : 'font-medium text-fg-muted'}`}
                >
                  <span className="min-w-0">{label}</span>
                  {isActive && <Check size={16} strokeWidth={3} className="shrink-0 text-gold" aria-hidden="true" />}
                </button>
              )
            })}
          </div>
        </div>
      ))}
    </div>
  )
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
  halls,
  sort,
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

        {halls && <ChoiceSection {...halls} />}
        {sort && <ChoiceSection {...sort} />}

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
            <StationList
              stations={stations}
              activeStations={activeStations}
              onToggleStation={onToggleStation}
              stationLabel={stationLabel}
            />
          </div>
        )}
      </div>

      <div className="sticky bottom-0 -mb-[calc(env(safe-area-inset-bottom)+1.25rem)] bg-surface-2 pt-3 pb-[calc(env(safe-area-inset-bottom)+1.25rem)]">
        <SheetCloseButton
          className="w-full min-h-tap rounded-xl bg-gold text-sm font-semibold text-on-gold hover:brightness-105 press active:scale-95 motion-reduce:active:scale-100"
        >
          Done
        </SheetCloseButton>
      </div>
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
