'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase' 
import { useRouter } from 'next/navigation'
import { getURL } from '@/lib/utils'

export default function AuthPage() {
  const supabase = createClient()

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [isSignUp, setIsSignUp] = useState(false)
  const [message, setMessage] = useState('')
  const router = useRouter()

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setMessage('')

    if (isSignUp) {
      const { error } = await supabase.auth.signUp({ 
        email, 
        password,
        options: {
          emailRedirectTo: `${getURL()}auth/callback`,
        }
      })
      if (error) {
        setMessage(`Sign up error: ${error.message}`)
      } else {
        setMessage('Success! Check your email for a confirmation link.')
      }
    } else {
      const { error } = await supabase.auth.signInWithPassword({ email, password })
      if (error) {
        setMessage(`Login error: ${error.message}`)
      } else {
        router.push('/dashboard')
      }
    }
    setLoading(false)
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-slate-50 p-4 text-slate-800">
      
      {/* Container Box */}
      <div className="w-full max-w-md rounded-2xl bg-white p-8 shadow-xl shadow-slate-200/50 border border-slate-100">
        
        {/* Brand Header */}
        <div className="mb-8 text-center">
          <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-xl bg-blue-600 text-white font-bold text-xl shadow-md shadow-blue-500/20">
            🍽️
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">
            UCSC Dining Tracker
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            {isSignUp ? 'Create your account to get started' : 'Welcome back! Please sign in'}
          </p>
        </div>

        {/* Form */}
        <form onSubmit={handleAuth} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500">
              Email Address
            </label>
            <input
              type="email"
              required
              placeholder="slug@ucsc.edu"
              className="mt-1.5 w-full rounded-xl border border-slate-200 bg-slate-50/50 px-3.5 py-2.5 text-sm text-slate-900 transition focus:border-blue-500 focus:bg-white focus:outline-none focus:ring-4 focus:ring-blue-500/10"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>

          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500">
              Password
            </label>
            <input
              type="password"
              required
              placeholder="••••••••"
              className="mt-1.5 w-full rounded-xl border border-slate-200 bg-slate-50/50 px-3.5 py-2.5 text-sm text-slate-900 transition focus:border-blue-500 focus:bg-white focus:outline-none focus:ring-4 focus:ring-blue-500/10"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="mt-2 w-full rounded-xl bg-blue-600 py-2.5 text-sm font-semibold text-white shadow-md shadow-blue-500/20 transition hover:bg-blue-700 active:scale-[0.98] disabled:opacity-70"
          >
            {loading ? 'Processing...' : isSignUp ? 'Create Account' : 'Sign In'}
          </button>
        </form>

        {/* Dynamic Alert Message */}
        {message && (
          <div className="mt-4 rounded-lg bg-blue-50 p-3 text-center text-xs font-medium text-blue-700 border border-blue-100">
            {message}
          </div>
        )}

        {/* Footer Toggle */}
        <div className="mt-6 border-t border-slate-100 pt-6 text-center">
          <button
            type="button"
            onClick={() => setIsSignUp(!isSignUp)}
            className="text-sm font-medium text-slate-600 transition hover:text-blue-600"
          >
            {isSignUp ? (
              <>Already have an account? <span className="text-blue-600 font-semibold">Sign In</span></>
            ) : (
              <>Don't have an account? <span className="text-blue-600 font-semibold">Sign Up</span></>
            )}
          </button>
        </div>

      </div>

      {/* Footer Branding */}
      <p className="mt-8 text-xs text-slate-400">
        UC Santa Cruz • Dining Tracker
      </p>
    </div>
  )
}