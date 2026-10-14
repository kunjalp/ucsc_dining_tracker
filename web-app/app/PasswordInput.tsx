'use client'

import { useState } from 'react'
import { Eye, EyeOff } from 'lucide-react'

interface PasswordInputProps {
  value: string
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void
  placeholder?: string
}

export default function PasswordInput({
  value,
  onChange,
  placeholder = '••••••••',
}: PasswordInputProps) {
  const [showPassword, setShowPassword] = useState(false)

  return (
    <div className="relative mt-1.5 flex items-center w-full">
      <input
        type={showPassword ? 'text' : 'password'}
        required
        placeholder={placeholder}
        className="w-full rounded-xl border border-white/10 bg-[#171f33] px-3.5 py-2.5 pr-10 text-input leading-5 text-fg transition focus:border-gold/60 focus:outline-none focus:ring-4 focus:ring-gold/10 placeholder-fg-subtle/40"
        value={value}
        onChange={onChange}
      />
      <button
        type="button"
        onClick={() => setShowPassword(!showPassword)}
        className="absolute right-3 after:absolute after:-inset-3 after:content-[''] text-fg-subtle/60 hover:text-fg press focus:outline-none select-none"
        aria-label={showPassword ? 'Hide password' : 'Show password'}
      >
        {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
      </button>
    </div>
  )
}