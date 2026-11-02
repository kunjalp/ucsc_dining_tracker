'use client'

import { Heart } from 'lucide-react'
import { Haptics, ImpactStyle } from '@capacitor/haptics'
import { toggleFavorite, useFavorites, favoriteKey } from '@/lib/favorites'

// A heart that adds or removes a dish from the student's favorites. The
// visible heart is small; the invisible padding makes the tap target 44px.
export default function FavoriteButton({ name, className = '' }: { name: string; className?: string }) {
  const favorites = useFavorites()
  const isFavorite = favorites.has(favoriteKey(name))
  return (
    <button
      type="button"
      onClick={() => {
        toggleFavorite(name)
        Haptics.impact({ style: ImpactStyle.Light }).catch(() => {})
      }}
      aria-pressed={isFavorite}
      aria-label={isFavorite ? `Remove ${name} from favorites` : `Add ${name} to favorites`}
      className={`relative shrink-0 flex items-center justify-center size-8 rounded-full press active:scale-90 motion-reduce:active:scale-100 after:absolute after:-inset-1.5 after:content-[''] ${isFavorite ? 'text-macro-fat' : 'text-fg-muted hover:text-fg'} ${className}`}
    >
      <Heart size={18} strokeWidth={2.25} fill={isFavorite ? 'currentColor' : 'none'} aria-hidden="true" />
    </button>
  )
}
