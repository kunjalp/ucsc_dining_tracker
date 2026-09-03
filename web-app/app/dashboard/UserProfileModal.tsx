'use client'

import { useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { X, User, Camera, LogOut, Trash2, Check } from 'lucide-react'
import { createClient } from '@/lib/supabase'

export interface UserProfile {
  nickname: string
  email: string
  avatarUrl: string | null
  memberSince: string | null // ISO date string from auth.users.created_at
  dietaryPreferences: string[]
}

interface UserProfileModalProps {
  currentProfile: UserProfile
  onClose: () => void
  onSave: (profile: UserProfile) => void
}

const DIETARY_OPTIONS = [
  'Vegetarian',
  'Vegan',
  'Pescatarian',
  'Gluten-Free',
  'Dairy-Free',
  'Halal',
  'Kosher',
  'Nut Allergy',
]

export default function UserProfileModal({ currentProfile, onClose, onSave }: UserProfileModalProps) {
  const supabase = createClient()
  const router = useRouter()
  const fileInputRef = useRef<HTMLInputElement>(null)

  const [nickname, setNickname] = useState(currentProfile.nickname)
  const [email, setEmail] = useState(currentProfile.email)
  const [avatarUrl, setAvatarUrl] = useState(currentProfile.avatarUrl)
  const [dietaryPreferences, setDietaryPreferences] = useState<string[]>(currentProfile.dietaryPreferences)

  const [uploadingAvatar, setUploadingAvatar] = useState(false)
  const [saving, setSaving] = useState(false)
  const [signingOut, setSigningOut] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false)
  const [deleteConfirmText, setDeleteConfirmText] = useState('')
  const [deleting, setDeleting] = useState(false)
  const [deleteError, setDeleteError] = useState<string | null>(null)

  const [newPassword, setNewPassword] = useState('')
  const [confirmNewPassword, setConfirmNewPassword] = useState('')
  const [changingPassword, setChangingPassword] = useState(false)
  const [passwordMessage, setPasswordMessage] = useState<string | null>(null)

  const emailChanged = email.trim().toLowerCase() !== currentProfile.email.trim().toLowerCase()

  const memberSinceLabel = currentProfile.memberSince
    ? new Date(currentProfile.memberSince).toLocaleDateString('en-US', {
      month: 'long',
      year: 'numeric',
    })
    : null

  // ---- Avatar upload ----
  const handleAvatarClick = () => fileInputRef.current?.click()

  const handleAvatarChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    if (!file.type.startsWith('image/')) {
      setError('Please choose an image file.')
      return
    }
    if (file.size > 10 * 1024 * 1024) {
      setError('Image must be under 10MB.')
      return
    }

    setError(null)
    setUploadingAvatar(true)

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      setUploadingAvatar(false)
      setError('You must be signed in to upload a photo.')
      return
    }

    const ext = file.name.split('.').pop()
    const filePath = `${user.id}/avatar.${ext}`

    const { error: uploadError } = await supabase.storage
      .from('avatars')
      .upload(filePath, file, { upsert: true })

    if (uploadError) {
      setUploadingAvatar(false)
      setError(`Upload failed: ${uploadError.message}`)
      return
    }

    const { data: publicUrlData } = supabase.storage.from('avatars').getPublicUrl(filePath)
    const freshUrl = `${publicUrlData.publicUrl}?t=${Date.now()}`

    const { error: metaError } = await supabase.auth.updateUser({
      data: { avatar_url: freshUrl },
    })

    setUploadingAvatar(false)

    if (metaError) {
      setError(`Could not save photo: ${metaError.message}`)
      return
    }

    setAvatarUrl(freshUrl)
  }

  // ---- Sign out ----
  const handleSignOut = async () => {
    setSigningOut(true)
    const { error } = await supabase.auth.signOut()
    if (error) {
      setSigningOut(false)
      setError(`Could not sign out: ${error.message}`)
      return
    }
    router.push('/')
    router.refresh()
  }

  const handleChangePassword = async () => {
    setPasswordMessage(null)

    if (newPassword.length < 6) {
      setPasswordMessage('Password must be at least 6 characters.')
      return
    }
    if (newPassword !== confirmNewPassword) {
      setPasswordMessage('Passwords do not match.')
      return
    }

    setChangingPassword(true)
    const { error } = await supabase.auth.updateUser({ password: newPassword })
    setChangingPassword(false)

    if (error) {
      setPasswordMessage(`Error: ${error.message}`)
    } else {
      setPasswordMessage('Password updated successfully!')
      setNewPassword('')
      setConfirmNewPassword('')
    }
  }

  // ---- Dietary preferences ----
  const toggleDietaryPreference = (pref: string) => {
    setDietaryPreferences((prev) =>
      prev.includes(pref) ? prev.filter((p) => p !== pref) : [...prev, pref]
    )
  }

  // ---- Save nickname / email / dietary preferences ----
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)

    const trimmedNickname = nickname.trim()
    const trimmedEmail = email.trim()

    if (!trimmedNickname) {
      setError('Nickname cannot be empty.')
      return
    }
    if (!trimmedEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail)) {
      setError('Please enter a valid email address.')
      return
    }

    setSaving(true)

    const { error: metaError } = await supabase.auth.updateUser({
      data: { nickname: trimmedNickname, dietary_preferences: dietaryPreferences },
    })

    if (metaError) {
      setSaving(false)
      setError(`Could not update profile: ${metaError.message}`)
      return
    }

    if (emailChanged) {
      const { error: emailError } = await supabase.auth.updateUser({ email: trimmedEmail })
      if (emailError) {
        setSaving(false)
        setError(`Could not update email: ${emailError.message}`)
        return
      }
    }

    setSaving(false)
    onSave({
      nickname: trimmedNickname,
      email: trimmedEmail,
      avatarUrl,
      memberSince: currentProfile.memberSince,
      dietaryPreferences,
    })
  }

  // ---- Delete account ----
  const handleDeleteAccount = async () => {
    if (deleteConfirmText !== 'DELETE') return

    setDeleting(true)
    setDeleteError(null)

    const { data: { session } } = await supabase.auth.getSession()
    if (!session) {
      setDeleting(false)
      setDeleteError('You must be signed in to delete your account.')
      return
    }

    try {
      const res = await fetch('/api/delete-account', {
        method: 'POST',
        headers: { Authorization: `Bearer ${session.access_token}` },
      })
      const result = await res.json()

      if (!res.ok) {
        throw new Error(result.error || 'Failed to delete account')
      }

      await supabase.auth.signOut()
      router.push('/auth')
      router.refresh()
    } catch (err: any) {
      setDeleteError(err.message)
      setDeleting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center px-5 bg-black/60 backdrop-blur-sm overflow-y-auto py-8">
      <div className="w-full max-w-md max-h-[78vh] overflow-y-auto rounded-2xl bg-[#131c33] border border-white/10 shadow-2xl p-4 relative my-auto">
        <button
          onClick={onClose}
          className="absolute top-3 right-3 p-1.5 rounded-full text-[#c2c6d0] hover:bg-white/10 hover:text-[#dae2fd] transition"
          aria-label="Close"
        >
          <X size={18} />
        </button>

        <h2 className="text-base font-bold tracking-tight text-[#dae2fd] mb-3">Edit User Profile</h2>

        {/* Avatar */}
        <div className="flex flex-col items-center mb-3">
          <button
            type="button"
            onClick={handleAvatarClick}
            disabled={uploadingAvatar}
            className="relative w-14 h-14 rounded-full bg-white/10 border border-white/20 flex items-center justify-center overflow-hidden group disabled:opacity-60"
            aria-label="Change profile picture"
          >
            {avatarUrl ? (
              <img src={avatarUrl} alt="Profile" className="w-full h-full object-cover" />
            ) : (
              <User size={22} className="text-[#c2c6d0]" />
            )}
            <div className="absolute inset-0 bg-black/50 flex items-center justify-center opacity-0 group-hover:opacity-100 transition">
              <Camera size={16} className="text-white" />
            </div>
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            onChange={handleAvatarChange}
            className="hidden"
          />
          <button
            type="button"
            onClick={handleAvatarClick}
            disabled={uploadingAvatar}
            className="mt-1.5 text-xs font-bold text-[#a1c9ff] hover:text-[#dae2fd] transition disabled:opacity-60"
          >
            {uploadingAvatar ? 'Uploading...' : 'Change photo'}
          </button>

          {memberSinceLabel && (
            <p className="font-['JetBrains_Mono'] text-[10px] text-[#c2c6d0]/60 mt-1">
              Member since {memberSinceLabel}
            </p>
          )}
        </div>

        <form onSubmit={handleSubmit} className="space-y-2.5">
          <div>
            <label htmlFor="nickname" className="block font-['JetBrains_Mono'] text-[10px] font-bold text-[#c2c6d0] uppercase tracking-wider mb-1">
              Nickname
            </label>
            <input
              id="nickname"
              type="text"
              value={nickname}
              onChange={(e) => setNickname(e.target.value)}
              placeholder="e.g. bananaslug23"
              className="w-full rounded-xl border border-white/10 bg-[#171f33] p-2.5 text-sm text-[#dae2fd] font-medium focus:outline-none focus:ring-2 focus:ring-[#d6b93a]/40 placeholder-[#c2c6d0]/40"
            />
          </div>

          <div>
            <label htmlFor="email" className="block font-['JetBrains_Mono'] text-[10px] font-bold text-[#c2c6d0] uppercase tracking-wider mb-1">
              Email
            </label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@ucsc.edu"
              className="w-full rounded-xl border border-white/10 bg-[#171f33] p-2.5 text-sm text-[#dae2fd] font-medium focus:outline-none focus:ring-2 focus:ring-[#d6b93a]/40 placeholder-[#c2c6d0]/40"
            />
            {emailChanged && (
              <p className="text-[10px] text-[#a1c9ff] mt-1">
                Changing your email will send a confirmation link to the new address before it takes effect.
              </p>
            )}
          </div>

          {error && (
            <p className="text-xs font-semibold text-[#ffb4ab] bg-[#ffb4ab]/10 border border-[#ffb4ab]/20 rounded-lg px-3 py-1.5">
              {error}
            </p>
          )}

          <button
            type="button"
            onClick={handleSignOut}
            disabled={signingOut}
            className="w-full flex items-center justify-center gap-2 rounded-xl border border-white/15 bg-white/5 py-2 text-sm font-bold text-[#c2c6d0] hover:bg-white/10 transition disabled:opacity-60"
          >
            <LogOut size={14} />
            {signingOut ? 'Signing out...' : 'Sign out'}
          </button>

          <div className="pt-1.5 border-t border-white/10 mt-2">
            <p className="font-['JetBrains_Mono'] text-[10px] font-bold text-[#c2c6d0] uppercase tracking-wider mb-1.5 mt-2">
              Change Password
            </p>
            <div className="space-y-2">
              <input
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="New password"
                className="w-full rounded-xl border border-white/10 bg-[#171f33] p-2.5 text-sm text-[#dae2fd] font-medium focus:outline-none focus:ring-2 focus:ring-[#d6b93a]/40 placeholder-[#c2c6d0]/40"
              />
              <input
                type="password"
                value={confirmNewPassword}
                onChange={(e) => setConfirmNewPassword(e.target.value)}
                placeholder="Confirm new password"
                className="w-full rounded-xl border border-white/10 bg-[#171f33] p-2.5 text-sm text-[#dae2fd] font-medium focus:outline-none focus:ring-2 focus:ring-[#d6b93a]/40 placeholder-[#c2c6d0]/40"
              />
              {passwordMessage && (
                <p className="text-[11px] font-semibold text-[#a1c9ff]">{passwordMessage}</p>
              )}
              <button
                type="button"
                onClick={handleChangePassword}
                disabled={changingPassword}
                className="w-full rounded-xl border border-white/15 bg-white/5 py-2 text-sm font-bold text-[#c2c6d0] hover:bg-white/10 transition disabled:opacity-60"
              >
                {changingPassword ? 'Updating...' : 'Update Password'}
              </button>
            </div>
          </div>

          <div className="flex gap-3 pt-1.5">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 rounded-xl border border-white/15 bg-white/5 py-2 text-sm font-bold text-[#c2c6d0] hover:bg-white/10 transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="flex-1 rounded-xl bg-[#d6b93a] py-2 text-sm font-bold text-[#6b5300] hover:brightness-105 active:scale-95 transition shadow-md shadow-[#d6b93a]/20 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {saving ? 'Saving...' : 'Save changes'}
            </button>
          </div>
        </form>

        <div className="mt-3 pt-3 border-t border-[#ffb4ab]/20">
          {!deleteConfirmOpen ? (
            <button
              type="button"
              onClick={() => setDeleteConfirmOpen(true)}
              className="w-full flex items-center justify-center gap-2 rounded-xl border border-[#ffb4ab]/30 bg-[#ffb4ab]/5 py-2 text-sm font-bold text-[#ffb4ab] hover:bg-[#ffb4ab]/10 transition"
            >
              <Trash2 size={14} />
              Delete account
            </button>
          ) : (
            <div className="rounded-xl border border-[#ffb4ab]/30 bg-[#ffb4ab]/5 p-3 space-y-2">
              <p className="text-xs font-semibold text-[#ffb4ab]">
                This permanently deletes your account and all logged meals. This cannot be undone.
              </p>
              <p className="text-[10px] text-[#c2c6d0]">
                Type <span className="font-['JetBrains_Mono'] font-bold text-[#dae2fd]">DELETE</span> to confirm.
              </p>
              <input
                type="text"
                value={deleteConfirmText}
                onChange={(e) => setDeleteConfirmText(e.target.value)}
                className="w-full rounded-lg border border-[#ffb4ab]/30 bg-[#171f33] p-2 text-sm text-[#dae2fd] font-['JetBrains_Mono'] focus:outline-none focus:ring-2 focus:ring-[#ffb4ab]/40"
                placeholder="DELETE"
              />
              {deleteError && (
                <p className="text-xs font-semibold text-[#ffb4ab]">{deleteError}</p>
              )}
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setDeleteConfirmOpen(false)
                    setDeleteConfirmText('')
                    setDeleteError(null)
                  }}
                  className="flex-1 rounded-lg border border-white/15 bg-white/5 py-1.5 text-xs font-bold text-[#c2c6d0] hover:bg-white/10 transition"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleDeleteAccount}
                  disabled={deleteConfirmText !== 'DELETE' || deleting}
                  className="flex-1 rounded-lg bg-[#ffb4ab] py-1.5 text-xs font-bold text-[#4c0519] hover:brightness-105 transition disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  {deleting ? 'Deleting...' : 'Delete permanently'}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}