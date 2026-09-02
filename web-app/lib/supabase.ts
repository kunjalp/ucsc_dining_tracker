import { createBrowserClient } from '@supabase/ssr'

const REMEMBER_KEY = 'sammyspalate_remember_me'

// Called from the sign-in form when the user toggles "Stay signed in".
// Stored in localStorage so every createClient() call anywhere in the app
// (dashboard, DeepLinkHandler, etc.) picks up the same preference.
export function setRememberMe(remember: boolean) {
  if (typeof window !== 'undefined') {
    localStorage.setItem(REMEMBER_KEY, remember ? 'true' : 'false')
  }
}

export function getRememberMe(): boolean {
  if (typeof window === 'undefined') return true
  const stored = localStorage.getItem(REMEMBER_KEY)
  // Default to "remembered" if never set, so existing users aren't logged out
  return stored === null ? true : stored === 'true'
}

export function createClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  if (!supabaseUrl || !supabaseAnonKey) {
    // This provides a helpful error message instead of crashing silently
    throw new Error('Supabase environment variables are missing! Check Vercel settings.')
  }

  const remember = getRememberMe()

  return createBrowserClient(supabaseUrl, supabaseAnonKey, {
    cookieOptions: remember
      ? { maxAge: 60 * 60 * 24 * 30 } // 30 days
      : {}, // no maxAge = session cookie, cleared when the browser/app truly quits
  })
}