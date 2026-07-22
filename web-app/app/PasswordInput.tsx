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
        className="w-full rounded-xl border border-white/10 bg-[#171f33] px-3.5 py-2.5 pr-10 text-sm text-[#dae2fd] transition focus:border-[#d6b93a]/60 focus:outline-none focus:ring-4 focus:ring-[#d6b93a]/10 placeholder-[#c2c6d0]/40"
        value={value}
        onChange={onChange}
      />
      <button
        type="button"
        onClick={() => setShowPassword(!showPassword)}
        className="absolute right-3 text-[#c2c6d0]/60 hover:text-[#dae2fd] transition-colors focus:outline-none select-none"
        aria-label={showPassword ? 'Hide password' : 'Show password'}
      >
        {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
      </button>
    </div>
  )
}