import { createBrowserClient } from '@supabase/ssr'

export function createClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  if (!supabaseUrl || !supabaseAnonKey) {
    // This provides a helpful error message instead of crashing silently
    throw new Error('Supabase environment variables are missing! Check Vercel settings.')
  }

  return createBrowserClient(supabaseUrl, supabaseAnonKey)
}