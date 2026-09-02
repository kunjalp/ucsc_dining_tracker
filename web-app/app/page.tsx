'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase'
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

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setMessage('')

    if (isSignUp) {
      // 1. Attempt standard signup
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: `${getURL()}auth/callback`,
        }
      })

      if (error) {
        // If user already registered but hasn't verified, attempt to resend the email
        if (error.message.toLowerCase().includes('already registered')) {
          const { error: resendError } = await supabase.auth.resend({
            type: 'signup',
            email,
            options: {
              emailRedirectTo: `${getURL()}auth/callback`,
            }
          })

          if (resendError) {
            setMessage(`Error resending email: ${resendError.message}`)
          } else {
            setMessage('Account exists but unverified. We resent a new confirmation link to your email!')
          }
        } else {
          setMessage(`Sign up error: ${error.message}`)
        }
      } else if (data.user && data.user.identities && data.user.identities.length === 0) {
        // Supabase sometimes returns an empty identities array if user exists
        await supabase.auth.resend({
          type: 'signup',
          email,
          options: {
            emailRedirectTo: `${getURL()}auth/callback`,
          }
        })
        setMessage('Account already registered! A new confirmation link has been sent to your email.')
      } else {
        setMessage('Success! Check your email for a confirmation link.')
      }
    } else {
      // Sign in logic
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


  return (
    <div
      className="flex min-h-screen flex-col items-center justify-center bg-[#0b1326] p-4 text-[#dae2fd] relative overflow-hidden"
      style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}
    >
      {/* Ambient background glow, matches dashboard */}
      <div className="fixed top-0 left-0 w-full h-[512px] bg-gradient-to-b from-[#003c6c]/20 to-transparent pointer-events-none -z-10 blur-3xl" />

      {/* Container Box */}
      <div className="w-full max-w-md rounded-2xl p-8 bg-[rgba(30,41,59,0.6)] backdrop-blur-2xl border-t border-l border-white/15 border-b border-r border-white/5 shadow-[0_10px_40px_-10px_rgba(0,60,108,0.4)]">

        {/* Brand Header */}
        <div className="mb-8 flex items-center justify-center gap-4">
          <img
            src="/sammy-logo-transparent.png"
            alt="Sammy's Palate"
            className="h-20 w-20 object-contain shrink-0"
          />

          <div className="h-14 w-px bg-white/15" />

          <div className="text-left">
            <h1 className="text-2xl font-extrabold tracking-tight text-[#dae2fd] whitespace-nowrap">
              Sammy's Palate
            </h1>
            <p className="mt-1 text-xs font-semibold text-[#dae2fd]/50 tracking-wider uppercase">
              UCSC Macro Tracker
            </p>
          </div>
        </div>

        <p className="mb-8 text-center text-base text-[#c2c6d0]">
          {isSignUp ? 'Create your account to get started' : 'Welcome back! Please sign in.'}
        </p>

        {/* Form */}
        <form onSubmit={handleAuth} className="space-y-4">
          <div>
            <label className="block font-['JetBrains_Mono'] text-xs font-semibold uppercase tracking-wider text-[#c2c6d0]">
              Email Address
            </label>
            <input
              type="email"
              required
              placeholder="slug@ucsc.edu"
              className="mt-1.5 w-full rounded-xl border border-white/10 bg-[#171f33] px-3.5 py-2.5 text-sm text-[#dae2fd] transition focus:border-[#d6b93a]/60 focus:outline-none focus:ring-4 focus:ring-[#d6b93a]/10 placeholder-[#c2c6d0]/40"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>

          <div>
            <label className="block font-['JetBrains_Mono'] text-xs font-semibold uppercase tracking-wider text-[#c2c6d0]">
              Password
            </label>
            <PasswordInput
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="mt-2 w-full rounded-xl bg-[#d6b93a] py-2.5 text-sm font-semibold text-[#6b5300] shadow-md shadow-[#d6b93a]/20 transition hover:brightness-105 active:scale-[0.98] disabled:opacity-60"
          >
            {loading ? 'Processing...' : isSignUp ? 'Create Account' : 'Sign In'}
          </button>
        </form>

        <div className="mt-4 flex items-center gap-3">
          <div className="h-px flex-1 bg-white/10" />
          <span className="text-xs font-semibold text-[#c2c6d0]/50 uppercase tracking-wider">or</span>
          <div className="h-px flex-1 bg-white/10" />
        </div>

        <button
          type="button"
          onClick={handleGoogleSignIn}
          disabled={loading}
          className="mt-4 w-full flex items-center justify-center gap-2.5 rounded-xl border border-white/15 bg-white/5 py-2.5 text-sm font-semibold text-[#dae2fd] transition hover:bg-white/10 active:scale-[0.98] disabled:opacity-60"
        >
          <svg width="16" height="16" viewBox="0 0 24 24">
            <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
            <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
            <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
            <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
          </svg>
          Sign in with Google
        </button>

        {/* Dynamic Alert Message */}
        {message && (
          <div className="mt-4 rounded-lg bg-[#a1c9ff]/10 p-3 text-center text-xs font-medium text-[#a1c9ff] border border-[#a1c9ff]/20">
            {message}
          </div>
        )}

        {/* Footer Toggle */}
        <div className="mt-6 border-t border-white/10 pt-6 text-center">
          <button
            type="button"
            onClick={() => setIsSignUp(!isSignUp)}
            className="text-sm font-medium text-[#c2c6d0] transition hover:text-[#ffe6ab]"
          >
            {isSignUp ? (
              <>Already have an account? <span className="text-[#ffe6ab] font-semibold">Sign In</span></>
            ) : (
              <>Don't have an account? <span className="text-[#ffe6ab] font-semibold">Sign Up</span></>
            )}
          </button>
        </div>

      </div>

      {/* Footer Branding */}
      <p className="mt-8 font-['JetBrains_Mono'] text-xs text-[#c2c6d0]/50">
        UC Santa Cruz • Dining Tracker
      </p>
    </div>
  )
}