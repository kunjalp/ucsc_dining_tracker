'use client'

import { useState, useEffect } from 'react'
import { createClient, setRememberMe } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
import { getURL } from '@/lib/utils'
import { Settings, User } from 'lucide-react';
import PasswordInput from './PasswordInput'
import Sammy from './components/Sammy'
import { Capacitor } from '@capacitor/core'
import { Browser } from '@capacitor/browser'

export default function AuthPage() {
  const supabase = createClient()

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [isSignUp, setIsSignUp] = useState(false)
  const [message, setMessage] = useState('')
  const router = useRouter()
  const [rememberMe, setRememberMeState] = useState(true)
  const [showForgotPassword, setShowForgotPassword] = useState(false)

  useEffect(() => {
    const checkExistingSession = async () => {
      const { data: { session } } = await supabase.auth.getSession()
      if (session) {
        router.push('/dashboard')
      }
    }
    checkExistingSession()
  }, [])

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault()
    setRememberMe(rememberMe)
    setLoading(true)
    setMessage('')

    if (isSignUp) {
      const { data, error } = await supabase.auth.signUp({ email, password })

      if (error) {
        if (error.message.toLowerCase().includes('already registered')) {
          setMessage('An account with this email already exists. Try signing in instead.')
        } else {
          setMessage(`Sign up error: ${error.message}`)
        }
      } else if (data.session) {
        router.push('/onboarding')
      } else {
        setMessage('Success! Tap the confirmation link in your email on this device.')
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

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setMessage('')

    const redirectTo = Capacitor.isNativePlatform()
      ? 'sammyspalate://auth-callback?next=/auth/update-password'
      : `${getURL()}auth/callback?next=/auth/update-password`

    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo,
    })

    if (error) {
      setMessage(`Error: ${error.message}`)
    } else {
      setMessage('Check your email on this device and tap the link to reset your password.')
    }
    setLoading(false)
  }

  return (

    <div
      className="flex min-h-dvh flex-col items-center justify-center bg-app px-4 pt-[calc(env(safe-area-inset-top)+1rem)] pb-[calc(env(safe-area-inset-bottom)+1rem)] text-fg relative overflow-hidden"
    >

      {/* Sammy the mascot, waiting by the sign-in card */}
      <Sammy mood="idle" size={4} className="mb-3" />

      {/* Container Box */}
      <div className="w-full max-w-[340px] rounded-2xl p-4 bg-surface border border-white/10">

        {/* Brand Header */}
        <div className="mb-4 flex items-center justify-center gap-3">
          <img
            src="/sammy-logo-transparent.png"
            alt="Sammy's Palate"
            className="h-16 w-16 object-contain shrink-0"
          />

          <div className="h-11 w-px bg-white/15" />

          <div className="text-left">
            <h1 className="text-xl font-extrabold tracking-tight text-fg whitespace-nowrap">
              Sammy's Palate
            </h1>
            <p className="mt-0.5 text-[11px] font-semibold text-fg/50 tracking-wider uppercase">
              UCSC Macro Tracker
            </p>
          </div>
        </div>

        <p className="mb-4 text-center text-sm text-fg-subtle">
          {isSignUp ? 'Create your account to get started.' : 'Welcome back! Please sign in.'}
        </p>

        {/* Form */}
        {showForgotPassword ? (
          <form onSubmit={handleForgotPassword} className="space-y-3">
            <div>
              <label className="block text-[11px] font-semibold uppercase tracking-wider text-fg-subtle">
                Email Address
              </label>
              <input
                type="email"
                required
                placeholder="slug@email.com"
                autoComplete="email"
                autoCapitalize="none"
                className="mt-1 w-full rounded-xl border border-white/10 bg-[#171f33] px-3.5 py-2 text-input leading-5 text-fg transition focus:border-gold/60 focus:outline-none focus:ring-4 focus:ring-gold/10 placeholder-fg-subtle/40"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="mt-1 w-full rounded-xl bg-gold py-2 text-sm font-semibold text-[#6b5300] transition hover:brightness-105 active:scale-[0.98] disabled:opacity-60"
            >
              {loading ? 'Sending...' : 'Send Reset Link'}
            </button>

            <button
              type="button"
              onClick={() => { setShowForgotPassword(false); setMessage('') }}
              className="w-full text-center text-xs font-medium text-fg-subtle hover:text-[#ffe6ab] transition"
            >
              Back to sign in
            </button>
          </form>
        ) : (
          <form onSubmit={handleAuth} className="space-y-3">
            <div>
              <label className="block text-[11px] font-semibold uppercase tracking-wider text-fg-subtle">
                Email Address
              </label>
              <input
                type="email"
                required
                placeholder="slug@email.com"
                autoComplete="email"
                autoCapitalize="none"
                className="mt-1 w-full rounded-xl border border-white/10 bg-[#171f33] px-3.5 py-2 text-input leading-5 text-fg transition focus:border-gold/60 focus:outline-none focus:ring-4 focus:ring-gold/10 placeholder-fg-subtle/40"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>

            <div>
              <label className="block text-[11px] font-semibold uppercase tracking-wider text-fg-subtle">
                Password
              </label>
              <PasswordInput
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
              />
            </div>

            <div className="flex items-center justify-between">
              {/* Box + label are one control; the invisible ::after stretches the
                  tap area to 44px tall without changing the row's layout */}
              <button
                type="button"
                role="checkbox"
                aria-checked={rememberMe}
                onClick={() => setRememberMeState(!rememberMe)}
                className="relative flex items-center gap-2 after:absolute after:-inset-x-2 after:-inset-y-3 after:content-['']"
              >
                <span
                  aria-hidden="true"
                  className={`w-5 h-5 rounded-md border flex items-center justify-center transition ${rememberMe
                    ? 'bg-gold border-gold'
                    : 'bg-[#171f33] border-white/20'
                    }`}
                >
                  {rememberMe && (
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#6b5300" strokeWidth="3">
                      <path d="M20 6L9 17l-5-5" />
                    </svg>
                  )}
                </span>
                <span className="text-xs font-medium text-fg-subtle">Stay signed in</span>
              </button>

              {!isSignUp && (
                <button
                  type="button"
                  onClick={() => { setShowForgotPassword(true); setMessage('') }}
                  className="relative after:absolute after:-inset-x-2 after:-inset-y-3 after:content-[''] text-xs font-medium text-sky hover:text-fg transition"
                >
                  Forgot password?
                </button>
              )}
            </div>

            <button
              type="submit"
              disabled={loading}
              className="mt-1 w-full rounded-xl bg-gold py-2 text-sm font-semibold text-[#6b5300] transition hover:brightness-105 active:scale-[0.98] disabled:opacity-60"
            >
              {loading ? 'Processing...' : isSignUp ? 'Create Account' : 'Sign In'}
            </button>
          </form>
        )}

        <div className="mt-4 flex bg-[#171f33] p-1 rounded-xl gap-1">
          <button
            type="button"
            onClick={() => setIsSignUp(false)}
            className={`flex-1 py-1.5 text-sm font-bold rounded-lg transition-all ${!isSignUp
              ? 'bg-[#2a3a5c] text-sky shadow-sm'
              : 'text-fg-subtle hover:text-fg'
              }`}
          >
            Sign In
          </button>
          <button
            type="button"
            onClick={() => setIsSignUp(true)}
            className={`flex-1 py-1.5 text-sm font-bold rounded-lg transition-all ${isSignUp
              ? 'bg-[#2a3a5c] text-sky shadow-sm'
              : 'text-fg-subtle hover:text-fg'
              }`}
          >
            Sign Up
          </button>
        </div>

        {/* Dynamic Alert Message */}
        {message && (
          <div className="mt-3 rounded-lg bg-sky/10 p-2.5 text-center text-xs font-medium text-sky border border-sky/20">
            {message}
          </div>
        )}

      </div>

      {/* Footer Branding */}
      <p className="mt-8 text-xs text-fg-subtle/50">
        UC Santa Cruz • Dining Tracker
      </p>
      <p className="mt-2 text-xs text-fg-subtle/50 max-w-xs text-center leading-relaxed">
        Built for UCSC dining. See the daily menu, log what you eat, track detailed macros.
      </p>
    </div>
  )
}