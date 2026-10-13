'use client'

import { useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { X, User, Camera, LogOut, Trash2, Check, ChevronDown } from 'lucide-react'
import { createClient } from '@/lib/supabase'
import { TEXT_SIZE_OPTIONS, applyTextSize, setLocalTextSize, type TextSize } from '@/lib/textSize'

export interface UserProfile {
  nickname: string
  email: string
  avatarUrl: string | null
  memberSince: string | null // ISO date string from auth.users.created_at
  dietaryPreferences: string[]
  textSize: TextSize
}

interface UserProfileModalProps {
  currentProfile: UserProfile
  onClose: () => void
  onSave: (profile: UserProfile) => void
}

// Only options UCSC's own nutrition site actually publishes data for.
// Two kinds, matched differently in app/dashboard/page.tsx:
//  - DIET_TYPE_OPTIONS: a positive dietary icon on the item's real label
//    (Vegetarian/Vegan) -- include only items carrying that icon.
//  - ALLERGEN_OPTIONS: one of the exact allergen words UCSC lists on the
//    label's ALLERGENS line -- exclude any item whose allergens mention
//    it. Covers the same set the label itself marks.
// Halal, Kosher and Pescatarian have no icon or tag anywhere on UCSC's
// site (e.g. "Halal Chicken" and "Kosher Salt" are just item names) --
// a filter for them would silently do nothing, which is worse than not
// offering it, so they're left out rather than faked.
const DIET_TYPE_OPTIONS = ['Vegetarian', 'Vegan']

const ALLERGEN_OPTIONS = [
  'Milk',
  'Egg',
  'Wheat',
  'Gluten',
  'Soy',
  'Sesame',
  'Peanut',
  'Tree Nut',
  'Fish',
  'Shellfish',
]

const DIETARY_OPTIONS = [...DIET_TYPE_OPTIONS, ...ALLERGEN_OPTIONS]

export default function UserProfileModal({ currentProfile, onClose, onSave }: UserProfileModalProps) {
  const supabase = createClient()
  const router = useRouter()
  const fileInputRef = useRef<HTMLInputElement>(null)

  const [nickname, setNickname] = useState(currentProfile.nickname)
  const [email, setEmail] = useState(currentProfile.email)
  const [avatarUrl, setAvatarUrl] = useState(currentProfile.avatarUrl)
  const [dietaryPreferences, setDietaryPreferences] = useState<string[]>(currentProfile.dietaryPreferences)
  const [dietaryDropdownOpen, setDietaryDropdownOpen] = useState(false)
  // Previewed live as it's picked; Cancel/close puts the saved size back
  const [textSize, setTextSize] = useState<TextSize>(currentProfile.textSize)

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

  const compressImage = (file: File): Promise<Blob> => {
    return new Promise((resolve, reject) => {
      const img = new Image()
      const reader = new FileReader()

      reader.onload = (e) => {
        img.src = e.target?.result as string
      }
      reader.onerror = reject
      reader.readAsDataURL(file)

      img.onload = () => {
        const MAX_SIZE = 800
        let { width, height } = img

        if (width > height && width > MAX_SIZE) {
          height = (height / width) * MAX_SIZE
          width = MAX_SIZE
        } else if (height > MAX_SIZE) {
          width = (width / height) * MAX_SIZE
          height = MAX_SIZE
        }

        const canvas = document.createElement('canvas')
        canvas.width = width
        canvas.height = height
        const ctx = canvas.getContext('2d')
        ctx?.drawImage(img, 0, 0, width, height)

        canvas.toBlob(
          (blob) => {
            if (blob) resolve(blob)
            else reject(new Error('Compression failed'))
          },
          'image/jpeg',
          0.85
        )
      }
      img.onerror = reject
    })
  }

  const handleAvatarChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    if (!file.type.startsWith('image/')) {
      setError('Please choose an image file.')
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

    let uploadBlob: Blob
    try {
      uploadBlob = await compressImage(file)
    } catch {
      setUploadingAvatar(false)
      setError('Could not process that image. Try a different one.')
      return
    }

    const filePath = `${user.id}/avatar.jpg`

    const { error: uploadError } = await supabase.storage
      .from('avatars')
      .upload(filePath, uploadBlob, { upsert: true, contentType: 'image/jpeg' })

    if (uploadError) {
      setUploadingAvatar(false)
      setError(`Upload failed: ${uploadError.message}`)
      return
    }

    const { data: publicUrlData } = supabase.storage.from('avatars').getPublicUrl(filePath)
    const freshUrl = `${publicUrlData.publicUrl}?t=${Date.now()}`

    const { error: profileError } = await supabase
      .from('profiles')
      .upsert({ user_id: user.id, avatar_url: freshUrl }, { onConflict: 'user_id' })

    setUploadingAvatar(false)

    if (profileError) {
      setError(`Could not save photo: ${profileError.message}`)
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

  // ---- Text size ----
  const handlePickTextSize = (size: TextSize) => {
    setTextSize(size)
    applyTextSize(size)
  }

  const handleClose = () => {
    applyTextSize(currentProfile.textSize)
    onClose()
  }

  // ---- Save nickname / email / dietary preferences / text size ----
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
      data: { nickname: trimmedNickname, dietary_preferences: dietaryPreferences, text_size: textSize },
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
    setLocalTextSize(textSize)
    onSave({
      nickname: trimmedNickname,
      email: trimmedEmail,
      avatarUrl,
      memberSince: currentProfile.memberSince,
      dietaryPreferences,
      textSize,
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
    <div className="fixed inset-0 z-[100] flex items-center justify-center px-4 bg-black/60 backdrop-blur-sm overflow-y-auto py-6">
      <div className="w-full max-w-sm max-h-[92vh] overflow-y-auto rounded-2xl bg-surface border border-white/10 shadow-2xl p-4 relative my-auto text-fg">
        <button
          onClick={handleClose}
          className="absolute top-1.5 right-1.5 size-tap flex items-center justify-center rounded-full text-fg-muted hover:bg-white/10 hover:text-fg transition active:scale-90"
          aria-label="Close"
        >
          <X size={20} />
        </button>

        <h2 className="text-lg font-bold tracking-tight text-fg mb-3 pr-10">Edit Profile</h2>

        {/* Avatar -- inline row (photo + change link + member since) instead of a
            centered stack, so 44px targets still fit on one screen. */}
        <div className="flex items-center gap-3 mb-3">
          <button
            type="button"
            onClick={handleAvatarClick}
            disabled={uploadingAvatar}
            className="relative size-14 shrink-0 rounded-full bg-white/10 border border-white/20 flex items-center justify-center overflow-hidden group active:scale-95 transition-transform disabled:opacity-60"
            aria-label="Change profile picture"
          >
            {avatarUrl ? (
              <img src={avatarUrl} alt="" className="w-full h-full object-cover" />
            ) : (
              <User size={22} className="text-fg-muted" />
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
          <div className="min-w-0">
            <button
              type="button"
              onClick={handleAvatarClick}
              disabled={uploadingAvatar}
              className="min-h-tap text-sm font-semibold text-sky hover:text-fg transition active:scale-95 disabled:opacity-60"
            >
              {uploadingAvatar ? 'Uploading...' : 'Change photo'}
            </button>
            {memberSinceLabel && (
              <p className="text-xs text-fg-muted -mt-1.5">
                Member since {memberSinceLabel}
              </p>
            )}
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-3">
          <div>
            <label htmlFor="nickname" className="block text-xs font-semibold text-fg-muted uppercase tracking-wider mb-1">
              Nickname
            </label>
            <input
              id="nickname"
              type="text"
              value={nickname}
              onChange={(e) => setNickname(e.target.value)}
              placeholder="e.g. bananaslug23"
              className="w-full min-h-tap rounded-xl border border-white/10 bg-surface-2 px-3 text-input text-fg font-medium focus:outline-none focus:ring-2 focus:ring-gold/40 placeholder:text-fg-muted"
            />
          </div>

          <div>
            <label htmlFor="email" className="block text-xs font-semibold text-fg-muted uppercase tracking-wider mb-1">
              Email
            </label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@ucsc.edu"
              className="w-full min-h-tap rounded-xl border border-white/10 bg-surface-2 px-3 text-input text-fg font-medium focus:outline-none focus:ring-2 focus:ring-gold/40 placeholder:text-fg-muted"
            />
            {emailChanged && (
              <p className="text-xs text-sky mt-1">
                We'll email a confirmation link to the new address before it takes effect.
              </p>
            )}
          </div>

          <div>
            <p id="dietary-label" className="block text-xs font-semibold text-fg-muted uppercase tracking-wider mb-1">
              Dietary Preferences
            </p>
            <button
              type="button"
              onClick={() => setDietaryDropdownOpen((o) => !o)}
              aria-expanded={dietaryDropdownOpen}
              aria-labelledby="dietary-label"
              className="w-full min-h-tap flex items-center justify-between gap-2 rounded-xl border border-white/10 bg-surface-2 px-3 text-base font-medium text-fg active:scale-[0.98] transition"
            >
              <span className={dietaryPreferences.length ? 'text-fg truncate text-left' : 'text-fg-muted text-left'}>
                {dietaryPreferences.length ? dietaryPreferences.join(', ') : 'None selected'}
              </span>
              <ChevronDown size={18} className={`shrink-0 text-fg-muted transition-transform ${dietaryDropdownOpen ? 'rotate-180' : ''}`} />
            </button>
            {dietaryDropdownOpen && (
              <div className="mt-2 flex flex-col gap-3 rounded-xl border border-white/10 bg-surface-2/60 p-3">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wider text-fg-muted mb-1.5">Diet type</p>
                  <div className="flex flex-wrap gap-2">
                    {DIET_TYPE_OPTIONS.map((pref) => {
                      const selected = dietaryPreferences.includes(pref)
                      return (
                      <button
                        key={pref}
                        type="button"
                        aria-pressed={selected}
                        onClick={() => toggleDietaryPreference(pref)}
                        className={`min-h-tap flex items-center gap-1 rounded-full px-3.5 text-sm font-semibold transition active:scale-95 ${
                          selected
                            ? 'bg-gold text-on-gold'
                            : 'bg-white/5 text-fg border border-white/15 hover:bg-white/10'
                        }`}
                      >
                        {selected && <Check size={14} />}
                        {pref}
                      </button>
                      )
                    })}
                  </div>
                </div>
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wider text-fg-muted mb-1.5">Avoid (allergens)</p>
                  <div className="flex flex-wrap gap-2">
                    {ALLERGEN_OPTIONS.map((pref) => {
                      const selected = dietaryPreferences.includes(pref)
                      return (
                      <button
                        key={pref}
                        type="button"
                        aria-pressed={selected}
                        onClick={() => toggleDietaryPreference(pref)}
                        className={`min-h-tap flex items-center gap-1 rounded-full px-3.5 text-sm font-semibold transition active:scale-95 ${
                          selected
                            ? 'bg-gold text-on-gold'
                            : 'bg-white/5 text-fg border border-white/15 hover:bg-white/10'
                        }`}
                      >
                        {selected && <Check size={14} />}
                        {pref}
                      </button>
                      )
                    })}
                  </div>
                </div>
              </div>
            )}
            <p className="text-xs text-fg-muted mt-1">
              Menu shows only your diet type and hides items with these allergens.
            </p>
          </div>
          <div>
            <p id="text-size-label" className="block text-xs font-semibold text-fg-muted uppercase tracking-wider mb-1">
              Text size
            </p>
            <div role="radiogroup" aria-labelledby="text-size-label" className="grid grid-cols-4 gap-1 rounded-xl bg-surface-2 p-1">
              {TEXT_SIZE_OPTIONS.map((option) => {
                const selected = textSize === option.value
                return (
                  <button
                    key={option.value}
                    type="button"
                    role="radio"
                    aria-checked={selected}
                    onClick={() => handlePickTextSize(option.value)}
                    className={`min-h-tap px-1 rounded-lg text-xs font-semibold leading-tight transition active:scale-95 border ${
                      selected
                        ? 'bg-gold/15 text-gold border-gold/40'
                        : 'text-fg-muted hover:text-fg border-transparent'
                    }`}
                  >
                    {option.label}
                  </button>
                )
              })}
            </div>
          </div>

          {error && (
            <p role="alert" className="text-sm font-medium text-danger bg-danger/10 border border-danger/20 rounded-lg px-3 py-2">
              {error}
            </p>
          )}

          <div className="flex gap-3 pt-1">
            <button
              type="button"
              onClick={handleClose}
              className="flex-1 min-h-tap rounded-xl border border-white/15 bg-white/5 text-sm font-semibold text-fg hover:bg-white/10 transition active:scale-95"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="flex-1 min-h-tap rounded-xl bg-gold text-sm font-semibold text-on-gold hover:brightness-105 active:scale-95 transition disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {saving ? 'Saving...' : 'Save changes'}
            </button>
          </div>
        </form>

        {/* Account actions -- Sign out and Delete share one row (moved below Save,
            out of the middle of the form) to keep the modal on one screen. */}
        <div className="mt-3 pt-3 border-t border-white/10">
          {!deleteConfirmOpen ? (
            <div className="flex gap-3">
              <button
                type="button"
                onClick={handleSignOut}
                disabled={signingOut}
                className="flex-1 min-h-tap flex items-center justify-center gap-2 rounded-xl border border-white/15 bg-white/5 text-sm font-semibold text-fg hover:bg-white/10 transition active:scale-95 disabled:opacity-60"
              >
                <LogOut size={16} />
                {signingOut ? 'Signing out...' : 'Sign out'}
              </button>
              <button
                type="button"
                onClick={() => setDeleteConfirmOpen(true)}
                className="flex-1 min-h-tap flex items-center justify-center gap-2 rounded-xl border border-danger/30 bg-danger/5 text-sm font-semibold text-danger hover:bg-danger/10 transition active:scale-95"
              >
                <Trash2 size={16} />
                Delete account
              </button>
            </div>
          ) : (
            <div className="rounded-xl border border-danger/30 bg-danger/5 p-3 space-y-2">
              <p className="text-sm font-semibold text-danger">
                This permanently deletes your account and all logged meals. This cannot be undone.
              </p>
              <label htmlFor="delete-confirm" className="block text-xs text-fg-muted">
                Type <span className="font-bold text-fg">DELETE</span> to confirm.
              </label>
              <input
                id="delete-confirm"
                type="text"
                value={deleteConfirmText}
                onChange={(e) => setDeleteConfirmText(e.target.value)}
                autoCapitalize="characters"
                autoCorrect="off"
                className="w-full min-h-tap rounded-lg border border-danger/30 bg-surface-2 px-3 text-input text-fg focus:outline-none focus:ring-2 focus:ring-danger/40"
                placeholder="DELETE"
              />
              {deleteError && (
                <p role="alert" className="text-sm font-medium text-danger">{deleteError}</p>
              )}
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setDeleteConfirmOpen(false)
                    setDeleteConfirmText('')
                    setDeleteError(null)
                  }}
                  className="flex-1 min-h-tap rounded-lg border border-white/15 bg-white/5 text-sm font-semibold text-fg hover:bg-white/10 transition active:scale-95"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleDeleteAccount}
                  disabled={deleteConfirmText !== 'DELETE' || deleting}
                  className="flex-1 min-h-tap rounded-lg bg-danger text-sm font-semibold text-[#3b0a0a] hover:brightness-105 transition active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed"
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
