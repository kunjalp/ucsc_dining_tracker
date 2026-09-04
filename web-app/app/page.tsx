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

  const handleGoogleSignIn = async () => {
    setRememberMe(rememberMe)
    setLoading(true)
    setMessage('')
    const redirectTo = Capacitor.isNativePlatform()
      ? 'sammyspalate://auth-callback'
      : `${getURL()}auth/callback`
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo,
        skipBrowserRedirect: true,
      },
    })


    if (error) {
      setMessage(`Google sign-in error: ${error.message}`)
      setLoading(false)
      return
    }

    if (data?.url) {
      if (Capacitor.isNativePlatform()) {
        await Browser.open({ url: data.url })
      } else {
        window.location.href = data.url
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
      setMessage('Check your email for a password reset link.')
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

        <div className="mt-3 flex items-center gap-3">
          <div className="h-px flex-1 bg-white/10" />
          <span className="text-[11px] font-semibold text-[#c2c6d0]/50 uppercase tracking-wider">or</span>
          <div className="h-px flex-1 bg-white/10" />
        </div>

        <button
          type="button"
          onClick={handleGoogleSignIn}
          disabled={loading}
          className="mt-3 w-full flex items-center justify-center gap-2.5 rounded-xl border border-white/15 bg-white/5 py-2 text-sm font-semibold text-[#dae2fd] transition hover:bg-white/10 active:scale-[0.98] disabled:opacity-60"
        >
          <svg width="16" height="16" viewBox="0 0 24 24">
            <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
            <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
            <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
            <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
          </svg>
          Sign in with Google
        </button>

        <div className="mt-3 flex bg-[#171f33] p-1 rounded-xl gap-1">
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
        A macro and nutrition tracker for UCSC dining halls — browse menus, log meals, and track macros in real time.
      </p>
    </div>
  )
}