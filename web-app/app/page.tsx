'use client'

import { useState, useEffect } from 'react'
import { createClient, setRememberMe } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
import { getURL } from '@/lib/utils'
import { Settings, User } from 'lucide-react';
import PasswordInput from './PasswordInput'
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
      className="flex min-h-screen flex-col items-center justify-center bg-[#0b1326] p-4 pt-12 text-[#dae2fd] relative overflow-hidden"
      style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}
    >
      {/* Ambient background glow, matches dashboard */}
      <div className="fixed top-0 left-0 w-full h-[512px] bg-gradient-to-b from-[#003c6c]/20 to-transparent pointer-events-none -z-10 blur-3xl" />


      {/* Container Box */}
      <div className="w-full max-w-[340px] rounded-2xl p-4 bg-[rgba(30,41,59,0.6)] backdrop-blur-2xl border-t border-l border-white/15 border-b border-r border-white/5 shadow-[0_10px_40px_-10px_rgba(0,60,108,0.4)]">

        {/* Brand Header */}
        <div className="mb-4 flex items-center justify-center gap-3">
          <img
            src="/sammy-logo-transparent.png"
            alt="Sammy's Palate"
            className="h-16 w-16 object-contain shrink-0"
          />

          <div className="h-11 w-px bg-white/15" />

          <div className="text-left">
            <h1 className="text-xl font-extrabold tracking-tight text-[#dae2fd] whitespace-nowrap">
              Sammy's Palate
            </h1>
            <p className="mt-0.5 text-[11px] font-semibold text-[#dae2fd]/50 tracking-wider uppercase">
              UCSC Macro Tracker
            </p>
          </div>
        </div>

        <p className="mb-4 text-center text-sm text-[#c2c6d0]">
          {isSignUp ? 'Create your account to get started.' : 'Welcome back! Please sign in.'}
        </p>

        {/* Form */}
        {showForgotPassword ? (
          <form onSubmit={handleForgotPassword} className="space-y-3">
            <div>
              <label className="block font-['JetBrains_Mono'] text-[11px] font-semibold uppercase tracking-wider text-[#c2c6d0]">
                Email Address
              </label>
              <input
                type="email"
                required
                placeholder="slug@email.com"
                className="mt-1 w-full rounded-xl border border-white/10 bg-[#171f33] px-3.5 py-2 text-sm text-[#dae2fd] transition focus:border-[#d6b93a]/60 focus:outline-none focus:ring-4 focus:ring-[#d6b93a]/10 placeholder-[#c2c6d0]/40"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="mt-1 w-full rounded-xl bg-[#d6b93a] py-2 text-sm font-semibold text-[#6b5300] shadow-md shadow-[#d6b93a]/20 transition hover:brightness-105 active:scale-[0.98] disabled:opacity-60"
            >
              {loading ? 'Sending...' : 'Send Reset Link'}
            </button>

            <button
              type="button"
              onClick={() => { setShowForgotPassword(false); setMessage('') }}
              className="w-full text-center text-xs font-medium text-[#c2c6d0] hover:text-[#ffe6ab] transition"
            >
              Back to sign in
            </button>
          </form>
        ) : (
          <form onSubmit={handleAuth} className="space-y-3">
            <div>
              <label className="block font-['JetBrains_Mono'] text-[11px] font-semibold uppercase tracking-wider text-[#c2c6d0]">
                Email Address
              </label>
              <input
                type="email"
                required
                placeholder="slug@email.com"
                className="mt-1 w-full rounded-xl border border-white/10 bg-[#171f33] px-3.5 py-2 text-sm text-[#dae2fd] transition focus:border-[#d6b93a]/60 focus:outline-none focus:ring-4 focus:ring-[#d6b93a]/10 placeholder-[#c2c6d0]/40"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>

            <div>
              <label className="block font-['JetBrains_Mono'] text-[11px] font-semibold uppercase tracking-wider text-[#c2c6d0]">
                Password
              </label>
              <PasswordInput
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
              />
            </div>

            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setRememberMeState(!rememberMe)}
                  className={`w-5 h-5 rounded-md border flex items-center justify-center transition ${rememberMe
                    ? 'bg-[#d6b93a] border-[#d6b93a]'
                    : 'bg-[#171f33] border-white/20'
                    }`}
                  aria-label="Stay signed in"
                >
                  {rememberMe && (
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#6b5300" strokeWidth="3">
                      <path d="M20 6L9 17l-5-5" />
                    </svg>
                  )}
                </button>
                <span className="text-xs font-medium text-[#c2c6d0]">Stay signed in</span>
              </div>

              {!isSignUp && (
                <button
                  type="button"
                  onClick={() => { setShowForgotPassword(true); setMessage('') }}
                  className="text-xs font-medium text-[#a1c9ff] hover:text-[#dae2fd] transition"
                >
                  Forgot password?
                </button>
              )}
            </div>

            <button
              type="submit"
              disabled={loading}
              className="mt-1 w-full rounded-xl bg-[#d6b93a] py-2 text-sm font-semibold text-[#6b5300] shadow-md shadow-[#d6b93a]/20 transition hover:brightness-105 active:scale-[0.98] disabled:opacity-60"
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
              ? 'bg-[#2a3a5c] text-[#a1c9ff] shadow-sm'
              : 'text-[#c2c6d0] hover:text-[#dae2fd]'
              }`}
          >
            Sign In
          </button>
          <button
            type="button"
            onClick={() => setIsSignUp(true)}
            className={`flex-1 py-1.5 text-sm font-bold rounded-lg transition-all ${isSignUp
              ? 'bg-[#2a3a5c] text-[#a1c9ff] shadow-sm'
              : 'text-[#c2c6d0] hover:text-[#dae2fd]'
              }`}
          >
            Sign Up
          </button>
        </div>

        {/* Dynamic Alert Message */}
        {message && (
          <div className="mt-3 rounded-lg bg-[#a1c9ff]/10 p-2.5 text-center text-xs font-medium text-[#a1c9ff] border border-[#a1c9ff]/20">
            {message}
          </div>
        )}

      </div>

      {/* Footer Branding */}
      <p className="mt-8 font-['JetBrains_Mono'] text-xs text-[#c2c6d0]/50">
        UC Santa Cruz • Dining Tracker
      </p>
      <p className="mt-2 font-['JetBrains_Mono'] text-xs text-[#c2c6d0]/50 max-w-xs text-center leading-relaxed">
        Built for UCSC dining. See the daily menu, log what you eat, track detailed macros.
      </p>
    </div>
  )
}