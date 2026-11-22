'use client'

import type { ReactNode } from 'react'
import { Check, ChevronDown, ChevronRight, Minus, Plus } from 'lucide-react'
import FavoriteButton from './FavoriteButton'

export const SERVING_OPTIONS = [0.25, 0.5, 1, 1.5, 2]

export interface FoodRowFood {
  recipe_id: string
  name: string
  portion: string
  calories: number
  protein: number
  carbs: number
  fat: number
}

interface FoodRowProps {
  food: FoodRowFood
  servings: number
  stepperOpen: boolean
  logged: boolean
  /** Position in the list; only staggers the entrance animation */
  index: number
  /** Extra aria text for the Log button, e.g. " to Lunch" */
  logSuffix?: string
  /** Muted line under the macros, inside the tap target that opens the sheet */
  note?: ReactNode
  /** How many serving sizes this food has. Above 1, the portion becomes a
   *  "6 oz ▾" control that calls onOpenSizes. */
  sizeCount?: number
  onOpenSizes?: () => void
  onOpen: () => void
  onToggleStepper: () => void
  onStep: (dir: -1 | 1) => void
  onLog: () => void
}

// The ledger row shared by Menu and Browse: name and two muted macro lines
// (one tap target that opens the food sheet), a heart, a quiet servings
// count that opens a stepper under the row, and a tinted Log button. Both
// lines scale with the servings, so they show what Log will add.
export default function FoodRow({
  food,
  servings,
  stepperOpen,
  logged,
  index,
  logSuffix = '',
  note,
  sizeCount = 1,
  onOpenSizes,
  onOpen,
  onToggleStepper,
  onStep,
  onLog,
}: FoodRowProps) {
  return (
    <article
      className="py-3 flex flex-wrap items-center gap-x-1 gap-y-1 animate-row-in"
      style={{ animationDelay: `${Math.min(index, 8) * 35}ms` }}
    >
      {/* The name's button stretches over the whole text block (after:inset-0),
          so the block opens the food sheet; the size control sits above it. */}
      <div className="relative min-w-0 flex-1 self-stretch rounded-lg has-[[data-open]:active]:opacity-70">
        <button
          type="button"
          data-open=""
          onClick={onOpen}
          aria-label={`${food.name}, details`}
          className="w-full text-left rounded-lg after:absolute after:inset-0 after:content-['']"
        >
          <span className="flex items-start gap-1 text-base font-semibold text-fg">
            <span className="min-w-0">{food.name}</span>
            <ChevronRight size={16} className="shrink-0 mt-[0.2em] text-fg-muted" aria-hidden="true" />
          </span>
        </button>
        <span className="block text-xs font-medium text-fg-muted mt-0.5 tabular-nums">
          {sizeCount > 1 && onOpenSizes ? (
            <button
              type="button"
              onClick={onOpenSizes}
              aria-haspopup="dialog"
              aria-label={`${food.portion || '1 serving'}, one of ${sizeCount} sizes of ${food.name}. Change size`}
              className="relative z-10 inline-flex items-center gap-0.5 font-semibold text-fg press active:opacity-70 after:absolute after:-inset-x-2 after:-inset-y-4 after:content-['']"
            >
              {food.portion || '1 serving'}
              <ChevronDown size={12} strokeWidth={2.5} className="text-fg-muted" aria-hidden="true" />
            </button>
          ) : (
            food.portion || '1 serving'
          )}
          {servings !== 1 && ` × ${servings}`}
          {' · '}
          {Math.round(food.calories * servings)} cal
        </span>
        <span className="block text-xs font-medium text-fg-muted mt-0.5 tabular-nums">
          P <span className="text-fg-subtle">{Math.round(food.protein * servings)}g</span>
          <span aria-hidden="true" className="mx-1.5">·</span>
          C <span className="text-fg-subtle">{Math.round(food.carbs * servings)}g</span>
          <span aria-hidden="true" className="mx-1.5">·</span>
          F <span className="text-fg-subtle">{Math.round(food.fat * servings)}g</span>
        </span>
        {note}
      </div>
      <FavoriteButton name={food.name} />
      {/* Servings: quiet until tapped, then a - / + stepper opens under the row */}
      <button
        type="button"
        onClick={onToggleStepper}
        aria-expanded={stepperOpen}
        aria-label={`${servings} serving${servings !== 1 ? 's' : ''} of ${food.name}. Change servings`}
        className={`relative after:absolute after:inset-x-0 after:-inset-y-1 after:content-[''] shrink-0 flex min-h-btn min-w-12 items-center justify-center rounded-lg text-sm font-semibold tabular-nums press active:scale-95 motion-reduce:active:scale-100 ${stepperOpen || servings !== 1 ? 'text-fg' : 'text-fg-muted'}`}
      >
        {servings}×
      </button>
      <button
        type="button"
        onClick={onLog}
        disabled={logged}
        aria-label={logged ? `Logged ${food.name}` : `Log ${servings} serving${servings !== 1 ? 's' : ''} of ${food.name}${logSuffix}`}
        className={`relative after:absolute after:inset-x-0 after:-inset-y-1 after:content-[''] shrink-0 flex min-h-btn min-w-12 items-center justify-center rounded-lg px-3.5 text-sm font-bold transition-colors duration-300 active:scale-95 motion-reduce:active:scale-100 ${logged
          ? 'bg-veg/15 text-veg'
          : 'bg-gold/15 text-gold'
          }`}
      >
        {logged ? <Check size={16} strokeWidth={3} className="animate-check-pop" /> : 'Log'}
      </button>
      {stepperOpen && (
        <div role="group" aria-label={`Servings of ${food.name}`} className="basis-full flex items-center justify-end gap-1 pb-1">
          <span className="mr-auto text-xs font-medium text-fg-muted">Servings</span>
          <button
            type="button"
            onClick={() => onStep(-1)}
            disabled={servings <= SERVING_OPTIONS[0]}
            aria-label="Fewer servings"
            className="size-12 flex items-center justify-center rounded-lg bg-surface-2 text-fg press active:scale-95 motion-reduce:active:scale-100 disabled:opacity-40"
          >
            <Minus size={18} aria-hidden="true" />
          </button>
          <span aria-live="polite" className="min-w-14 text-center text-base font-semibold tabular-nums text-fg">
            {servings}×
          </span>
          <button
            type="button"
            onClick={() => onStep(1)}
            disabled={servings >= SERVING_OPTIONS[SERVING_OPTIONS.length - 1]}
            aria-label="More servings"
            className="size-12 flex items-center justify-center rounded-lg bg-surface-2 text-fg press active:scale-95 motion-reduce:active:scale-100 disabled:opacity-40"
          >
            <Plus size={18} aria-hidden="true" />
          </button>
        </div>
      )}
    </article>
  )
}
