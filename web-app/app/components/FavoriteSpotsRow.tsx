'use client'

import { useId, useState } from 'react'
import { ChevronDown } from 'lucide-react'
import { Haptics } from '@capacitor/haptics'
import FavoriteButton from './FavoriteButton'
import { MEAL_ORDER } from '@/lib/favoriteAlerts'

export type FavoriteSpot = { hall: string; meal: string }

const cleanHall = (hall: string) => hall.replace(/ Dining Hall$/, '')

// One line per hall (alphabetical) with that hall's meals in serving order.
export function groupSpotsByHall(spots: FavoriteSpot[]): { hall: string; meals: string[] }[] {
  const byHall = new Map<string, Set<string>>()
  for (const s of spots) {
    const meals = byHall.get(s.hall) ?? new Set<string>()
    meals.add(s.meal)
    byHall.set(s.hall, meals)
  }
  return Array.from(byHall, ([hall, meals]) => ({
    hall,
    meals: Array.from(meals).sort((a, b) => MEAL_ORDER.indexOf(a) - MEAL_ORDER.indexOf(b)),
  })).sort((a, b) => cleanHall(a.hall).localeCompare(cleanHall(b.hall)))
}

// A favorite shown once. The row is a button that opens a list of the halls
// serving it today. The heart sits beside the button (not inside it), so
// unfavoriting never toggles the dropdown.
export default function FavoriteSpotsRow({
  name,
  detail,
  spots,
  onPickSpot,
}: {
  name: string
  detail?: string
  spots: FavoriteSpot[] | null // null while today's menus load
  onPickSpot?: (hall: string, meal: string) => void
}) {
  const [open, setOpen] = useState(false)
  const panelId = useId()
  const halls = spots ? groupSpotsByHall(spots) : []
  const summary = !spots
    ? 'Checking…'
    : halls.length === 0
      ? "Not on today's menu"
      : `${halls.length} location${halls.length !== 1 ? 's' : ''} today`

  return (
    <li>
      <div className="flex items-start gap-1">
        <button
          type="button"
          onClick={() => {
            setOpen((o) => !o)
            Haptics.selectionChanged().catch(() => {})
          }}
          aria-expanded={open}
          aria-controls={panelId}
          className="flex-1 min-w-0 min-h-tap py-2.5 flex items-start justify-between gap-3 text-left press active:opacity-70"
        >
          <span className="min-w-0">
            <span className="block font-semibold text-fg break-words">{name}</span>
            {detail && <span className="block text-xs text-fg-muted tabular-nums">{detail}</span>}
          </span>
          <span className="shrink-0 max-w-[50%] flex items-center gap-1 pt-0.5 text-xs font-medium text-fg-muted text-right">
            {summary}
            <ChevronDown
              size={16}
              aria-hidden="true"
              className={`shrink-0 transition-transform motion-reduce:transition-none ${open ? 'rotate-180' : ''}`}
            />
          </span>
        </button>
        <div className="shrink-0 min-h-tap flex items-center" onClick={(e) => e.stopPropagation()}>
          <FavoriteButton name={name} />
        </div>
      </div>

      {open && (
        <div id={panelId} className="pb-3 pr-9">
          {!spots ? (
            <p className="text-xs font-medium text-fg-muted">Checking today&apos;s menus…</p>
          ) : halls.length === 0 ? (
            <p className="text-xs font-medium text-fg-muted">Not on today&apos;s menu</p>
          ) : (
            <ul className="space-y-1">
              {halls.map(({ hall, meals }) => {
                const line = (
                  <>
                    <span className="min-w-0 text-sm text-fg break-words">{cleanHall(hall)}</span>
                    <span className="shrink-0 max-w-[50%] text-xs font-medium text-fg-muted text-right break-words">
                      {meals.join(', ')}
                    </span>
                  </>
                )
                return (
                  <li key={hall}>
                    {onPickSpot ? (
                      <button
                        type="button"
                        onClick={() => onPickSpot(hall, meals[0])}
                        className="w-full min-h-tap flex items-center justify-between gap-3 text-left press active:opacity-70"
                      >
                        {line}
                      </button>
                    ) : (
                      <div className="flex items-baseline justify-between gap-3">{line}</div>
                    )}
                  </li>
                )
              })}
            </ul>
          )}
        </div>
      )}
    </li>
  )
}
