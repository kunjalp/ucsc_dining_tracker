'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase'
import PasswordInput from '../../PasswordInput'

export default function UpdatePasswordPage() {
  const supabase = createClient()
  const router = useRouter()

  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState('')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setMessage('')

    if (password.length < 6) {
      setMessage('Password must be at least 6 characters.')
      return
    }
    if (password !== confirmPassword) {
      setMessage('Passwords do not match.')
      return
    }

    setLoading(true)
    const { error } = await supabase.auth.updateUser({ password })
    setLoading(false)

    if (error) {
      setMessage(`Error: ${error.message}`)
    } else {
      router.push('/dashboard')
    }
  }

  return (
    <div
      className="flex min-h-screen flex-col items-center justify-center bg-[#0b1326] p-4 text-[#dae2fd] relative overflow-hidden"
      style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}
    >
      <div className="fixed top-0 left-0 w-full h-[512px] bg-gradient-to-b from-[#003c6c]/20 to-transparent pointer-events-none -z-10 blur-3xl" />

      <div className="w-full max-w-[340px] rounded-2xl p-6 bg-[rgba(30,41,59,0.6)] backdrop-blur-2xl border-t border-l border-white/15 border-b border-r border-white/5 shadow-[0_10px_40px_-10px_rgba(0,60,108,0.4)]">
        <h1 className="text-xl font-extrabold tracking-tight text-[#dae2fd] mb-2 text-center">
          Set a new password
        </h1>
        <p className="text-sm text-[#c2c6d0] mb-6 text-center">
          Choose a new password for your account.
        </p>

        <form onSubmit={handleSubmit} className="space-y-3">
          <div>
            <label className="block font-['JetBrains_Mono'] text-[11px] font-semibold uppercase tracking-wider text-[#c2c6d0]">
              New Password
            </label>
            <PasswordInput
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
            />
          </div>

          <div>
            <label className="block font-['JetBrains_Mono'] text-[11px] font-semibold uppercase tracking-wider text-[#c2c6d0]">
              Confirm Password
            </label>
            <PasswordInput
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="••••••••"
            />
          </div>

          {message && (
            <p className="text-xs font-semibold text-[#ffb4ab] bg-[#ffb4ab]/10 border border-[#ffb4ab]/20 rounded-lg px-3 py-2">
              {message}
            </p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="mt-1 w-full rounded-xl bg-[#d6b93a] py-2.5 text-sm font-semibold text-[#6b5300] shadow-md shadow-[#d6b93a]/20 transition hover:brightness-105 active:scale-[0.98] disabled:opacity-60"
          >
            {loading ? 'Updating...' : 'Update Password'}
          </button>
        </form>
      </div>
    </div>
  )
}