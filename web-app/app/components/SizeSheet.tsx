'use client'

import { Check } from 'lucide-react'
import { Haptics } from '@capacitor/haptics'
import BottomSheet, { SheetCloseButton } from './BottomSheet'

export interface SizeOption {
  recipe_id: string
  portion: string
  calories: number
}

interface SizeSheetProps {
  name: string
  /** Smallest first */
  sizes: SizeOption[]
  selectedId: string
  onSelect: (recipeId: string) => void
  onClose: () => void
}

// Serving sizes of one food ("6 oz · 108 cal"), opened from a row's size
// control. Same radio list as the "Log to" sheet. Each size is its own
// food_items record, so the numbers are the recorded ones, not scaled.
export default function SizeSheet({ name, sizes, selectedId, onSelect, onClose }: SizeSheetProps) {
  return (
    <BottomSheet onClose={onClose} labelledBy="size-sheet-title">
      <h2 id="size-sheet-title" className="text-lg font-bold tracking-tight text-fg mb-1">
        Size
      </h2>
      <p className="text-sm font-medium text-fg-muted mb-1">{name}</p>
      <div role="radiogroup" aria-label={`Size of ${name}`} className="divide-y divide-line">
        {sizes.map((size) => {
          const selected = size.recipe_id === selectedId
          return (
            <button
              key={size.recipe_id}
              type="button"
              role="radio"
              aria-checked={selected}
              onClick={() => {
                if (!selected) Haptics.selectionChanged().catch(() => {})
                onSelect(size.recipe_id)
              }}
              className={`w-full min-h-tap flex items-center justify-between gap-3 text-left text-sm tabular-nums press active:opacity-70 ${selected ? 'font-semibold text-fg' : 'font-medium text-fg-muted'}`}
            >
              <span>
                {size.portion || '1 serving'} · {Math.round(size.calories)} cal
              </span>
              {selected && <Check size={16} strokeWidth={3} className="text-gold" aria-hidden="true" />}
            </button>
          )
        })}
      </div>
      <SheetCloseButton className="mt-4 w-full min-h-tap rounded-xl bg-gold text-sm font-semibold text-on-gold hover:brightness-105 press active:scale-95 motion-reduce:active:scale-100">
        Done
      </SheetCloseButton>
    </BottomSheet>
  )
}
