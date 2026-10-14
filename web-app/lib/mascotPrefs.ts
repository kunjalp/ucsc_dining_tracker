// web-app/lib/mascotPrefs.ts
// The "Mascot animations" setting in Edit Profile. Persisted like Text size:
// Supabase user_metadata.mascot_animations (follows the student across
// devices) and localStorage (this device, read on load). Every <Sammy>
// subscribes, so flipping it in Edit Profile applies everywhere at once.

import { useSyncExternalStore } from 'react'

export const MASCOT_ANIMATIONS_STORAGE_KEY = 'ucsc_mascot_animations'

const listeners = new Set<() => void>()

// On unless this device has saved "off" (or storage is blocked -> on)
export function getLocalMascotAnimations(): boolean {
  try {
    return localStorage.getItem(MASCOT_ANIMATIONS_STORAGE_KEY) !== '0'
  } catch {
    return true
  }
}

export function setLocalMascotAnimations(on: boolean) {
  try {
    localStorage.setItem(MASCOT_ANIMATIONS_STORAGE_KEY, on ? '1' : '0')
  } catch {
    // Private mode / storage blocked: nothing to remember it in
  }
  listeners.forEach((notify) => notify())
}

function subscribe(onChange: () => void) {
  listeners.add(onChange)
  // Another tab changing it
  const onStorage = (e: StorageEvent) => {
    if (e.key === MASCOT_ANIMATIONS_STORAGE_KEY) onChange()
  }
  window.addEventListener('storage', onStorage)
  return () => {
    listeners.delete(onChange)
    window.removeEventListener('storage', onStorage)
  }
}

export function useMascotAnimations(): boolean {
  return useSyncExternalStore(subscribe, getLocalMascotAnimations, () => true)
}
