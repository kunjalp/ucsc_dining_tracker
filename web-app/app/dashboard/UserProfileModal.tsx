'use client'

import { useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { X, Camera, LogOut, Trash2, Check, ChevronRight } from 'lucide-react'
import { Haptics } from '@capacitor/haptics'
import ConfirmTapButton from '../components/ConfirmTapButton'
import { createClient } from '@/lib/supabase'
import { TEXT_SIZE_OPTIONS, applyTextSize, setLocalTextSize, type TextSize } from '@/lib/textSize'
import { setLocalMascotAnimations } from '@/lib/mascotPrefs'
import BottomSheet, { SheetCloseButton } from '../components/BottomSheet'

export interface UserProfile {
  nickname: string
  email: string
  avatarUrl: string | null
  memberSince: string | null // ISO date string from auth.users.created_at
  dietaryPreferences: string[]
  textSize: TextSize
  mascotAnimations: boolean // Sammy's animations; off = he holds still
}

interface UserProfileModalProps {
  currentProfile: UserProfile
  onClose: () => void
  onSave: (profile: UserProfile) => void
  // Fired when the photo is removed so the header drops it right away
  onAvatarChange?: (avatarUrl: string | null) => void
  // Daily targets shown in the "Daily targets" row; tapping it opens the Set Targets sheet
  targets?: { calories: number; protein: number; carbs: number; fat: number }
  onOpenTargets?: () => void
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

export default function UserProfileModal({ currentProfile, onClose, onSave, onAvatarChange, targets, onOpenTargets }: UserProfileModalProps) {
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
  const [mascotAnimations, setMascotAnimations] = useState(currentProfile.mascotAnimations)

  const [uploadingAvatar, setUploadingAvatar] = useState(false)
  const [removingAvatar, setRemovingAvatar] = useState(false)
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

  // Collapsible "Change password", "Text size" rows
  const [passwordOpen, setPasswordOpen] = useState(false)
  const [textSizeOpen, setTextSizeOpen] = useState(false)

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

  // ---- Avatar remove: runs on the second tap (ConfirmTapButton arms it) ----
  const handleRemoveAvatar = async () => {
    setError(null)
    setRemovingAvatar(true)

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      setRemovingAvatar(false)
      setError('You must be signed in to remove your photo.')
      return
    }

    const { error: profileError } = await supabase
      .from('profiles')
      .upsert({ user_id: user.id, avatar_url: null }, { onConflict: 'user_id' })

    if (profileError) {
      setRemovingAvatar(false)
      setError(`Could not remove photo: ${profileError.message}`)
      return
    }

    // The header falls back to user_metadata.avatar_url, so clear that too or
    // the photo would come back. The stored file is cleaned up best-effort.
    if (user.user_metadata?.avatar_url) {
      await supabase.auth.updateUser({ data: { avatar_url: null } })
    }
    await supabase.storage.from('avatars').remove([`${user.id}/avatar.jpg`])

    setRemovingAvatar(false)
    setAvatarUrl(null)
    onAvatarChange?.(null)
    Haptics.selectionChanged().catch(() => {})
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
      data: { nickname: trimmedNickname, dietary_preferences: dietaryPreferences, text_size: textSize, mascot_animations: mascotAnimations },
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
    setLocalMascotAnimations(mascotAnimations)
    onSave({
      nickname: trimmedNickname,
      email: trimmedEmail,
      avatarUrl,
      memberSince: currentProfile.memberSince,
      dietaryPreferences,
      textSize,
      mascotAnimations,
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

  const inputClass =
    'w-full min-h-tap bg-transparent text-input text-fg font-medium focus:outline-none placeholder:text-fg-muted'
  const fieldClass =
    'w-full min-h-tap bg-transparent text-input text-fg font-medium text-right focus:outline-none placeholder:text-fg-muted'
  // One plain settings row: label left, value + chevron right
  const rowClass =
    'w-full min-h-tap flex items-center justify-between gap-3 text-sm font-semibold text-fg press active:opacity-70'
  const sectionLabelClass = 'text-xs font-bold uppercase tracking-wider text-fg-muted'

  const targetsLabel = targets
    ? `${targets.calories} cal · P ${targets.protein} · C ${targets.carbs} · F ${targets.fat}`
    : ''
  const textSizeLabel = TEXT_SIZE_OPTIONS.find((o) => o.value === textSize)?.label ?? ''

  // Diet / allergen option as a plain tappable row with a gold check
  const renderOption = (pref: string) => {
    const selected = dietaryPreferences.includes(pref)
    return (
      <button
        key={pref}
        type="button"
        role="checkbox"
        aria-checked={selected}
        onClick={() => toggleDietaryPreference(pref)}
        className="w-full min-h-tap flex items-center justify-between gap-3 text-sm font-medium text-fg press active:opacity-70"
      >
        {pref}
        {selected && <Check size={16} className="shrink-0 text-gold" />}
      </button>
    )
  }

  return (
    <BottomSheet
      onClose={handleClose}
      labelledBy="profile-title"
      className="bg-surface max-h-[calc(100dvh-env(safe-area-inset-top)-0.5rem)]"
    >
      <SheetCloseButton
        className="absolute -top-1 right-1.5 size-tap flex items-center justify-center rounded-full text-fg-muted hover:text-fg press active:scale-90"
        aria-label="Close"
      >
        <X size={20} />
      </SheetCloseButton>

      {/* Top row: avatar, name, email, photo actions */}
      <div className="flex items-center gap-3 pb-4 pr-10">
        <button
          type="button"
          onClick={handleAvatarClick}
          disabled={uploadingAvatar}
          className="relative size-tap shrink-0 rounded-full bg-surface-2 flex items-center justify-center overflow-hidden group active:scale-95 press disabled:opacity-60"
          aria-label="Change profile picture"
        >
          {avatarUrl ? (
            <img src={avatarUrl} alt="" className="w-full h-full object-cover" />
          ) : (
            <span className="text-base font-bold text-fg-muted" aria-hidden="true">
              {(currentProfile.nickname || currentProfile.email || '?').trim().charAt(0).toUpperCase()}
            </span>
          )}
          <div className="absolute inset-0 bg-app/60 flex items-center justify-center opacity-0 group-hover:opacity-100 transition motion-reduce:transition-none">
            <Camera size={16} className="text-fg" />
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
          <h2 id="profile-title" className="text-base font-bold tracking-tight text-fg truncate">
            {currentProfile.nickname || currentProfile.email || 'Your profile'}
          </h2>
          {currentProfile.nickname && currentProfile.email && (
            <p className="text-xs font-medium text-fg-muted truncate">{currentProfile.email}</p>
          )}
          <p className="text-xs text-fg-muted truncate">
            <button
              type="button"
              onClick={handleAvatarClick}
              disabled={uploadingAvatar}
              className="relative after:absolute after:-inset-y-3 after:-inset-x-1 after:content-[''] font-semibold text-sky hover:text-fg press disabled:opacity-60"
            >
              {uploadingAvatar ? 'Uploading...' : 'Change photo'}
            </button>
            {avatarUrl && (
              <>
                {' · '}
                <ConfirmTapButton
                  onConfirm={handleRemoveAvatar}
                  disabled={uploadingAvatar || removingAvatar}
                  className="relative after:absolute after:-inset-y-3 after:-inset-x-1 after:content-['']"
                >
                  {removingAvatar ? 'Removing...' : 'Remove photo'}
                </ConfirmTapButton>
              </>
            )}
            {memberSinceLabel && ` · Since ${memberSinceLabel}`}
          </p>
        </div>
      </div>

      {/* Daily targets: opens the Set Targets sheet (state lives in the dashboard) */}
      {targets && onOpenTargets && (
        <section className="border-t border-line pt-3 pb-1">
          <h3 className={sectionLabelClass}>Daily targets</h3>
          <button type="button" onClick={onOpenTargets} className={rowClass}>
            <span className="min-w-0 truncate tabular-nums">{targetsLabel}</span>
            <ChevronRight size={16} className="shrink-0 text-fg-muted" />
          </button>
        </section>
      )}

      {/* Settings -- inside the form so Save submits them */}
      <form id="profile-form" onSubmit={handleSubmit}>
        <section className="border-t border-line pt-3 pb-1">
          <h3 className={sectionLabelClass}>Settings</h3>
          <div className="divide-y divide-line">
            <label htmlFor="nickname" className="flex items-center justify-between gap-3 min-h-tap">
              <span className="text-sm font-semibold text-fg">Nickname</span>
              <input
                id="nickname"
                type="text"
                value={nickname}
                onChange={(e) => setNickname(e.target.value)}
                placeholder="e.g. bananaslug23"
                className={`${fieldClass} min-w-0 flex-1`}
              />
            </label>

            <div>
              <label htmlFor="email" className="flex items-center justify-between gap-3 min-h-tap">
                <span className="text-sm font-semibold text-fg">Email</span>
                <input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@ucsc.edu"
                  autoCapitalize="none"
                  className={`${fieldClass} min-w-0 flex-1`}
                />
              </label>
              {emailChanged && (
                <p className="text-xs text-sky pb-2">
                  We&apos;ll email a confirmation link to the new address before it takes effect.
                </p>
              )}
            </div>

            {/* Dietary preferences */}
            <div>
              <button
                type="button"
                onClick={() => setDietaryDropdownOpen((o) => !o)}
                aria-expanded={dietaryDropdownOpen}
                className={rowClass}
              >
                Dietary preferences
                <span className="flex min-w-0 items-center gap-1.5">
                  <span className="min-w-0 truncate text-sm font-medium text-fg-muted">
                    {dietaryPreferences.length ? dietaryPreferences.join(', ') : 'None'}
                  </span>
                  <ChevronRight size={16} className={`shrink-0 text-fg-muted transition-transform motion-reduce:transition-none ${dietaryDropdownOpen ? 'rotate-90' : ''}`} />
                </span>
              </button>
              {dietaryDropdownOpen && (
                <div className="pb-2">
                  <p className="pt-1 text-xs font-bold uppercase tracking-wider text-fg-muted">Diet type</p>
                  <div className="divide-y divide-line">{DIET_TYPE_OPTIONS.map(renderOption)}</div>
                  <p className="pt-2 text-xs font-bold uppercase tracking-wider text-fg-muted">Avoid (allergens)</p>
                  <div className="divide-y divide-line">{ALLERGEN_OPTIONS.map(renderOption)}</div>
                </div>
              )}
              <p className="text-xs text-fg-muted pb-2">
                Menu shows only your diet type and hides items with these allergens.
              </p>
            </div>

            {/* Text size */}
            <div>
              <button
                type="button"
                onClick={() => setTextSizeOpen((o) => !o)}
                aria-expanded={textSizeOpen}
                className={rowClass}
              >
                Text size
                <span className="flex items-center gap-1.5">
                  <span className="text-sm font-medium text-fg-muted">{textSizeLabel}</span>
                  <ChevronRight size={16} className={`shrink-0 text-fg-muted transition-transform motion-reduce:transition-none ${textSizeOpen ? 'rotate-90' : ''}`} />
                </span>
              </button>
              {textSizeOpen && (
                <div role="radiogroup" aria-label="Text size" className="divide-y divide-line pb-2">
                  {TEXT_SIZE_OPTIONS.map((option) => {
                    const selected = textSize === option.value
                    return (
                      <button
                        key={option.value}
                        type="button"
                        role="radio"
                        aria-checked={selected}
                        onClick={() => handlePickTextSize(option.value)}
                        className="w-full min-h-tap flex items-center justify-between gap-3 text-sm font-medium text-fg press active:opacity-70"
                      >
                        {option.label}
                        {selected && <Check size={16} className="shrink-0 text-gold" />}
                      </button>
                    )
                  })}
                </div>
              )}
            </div>

            {/* Sammy's animations -- off (or iOS Reduce Motion) = he holds still */}
            <button
              type="button"
              role="switch"
              aria-checked={mascotAnimations}
              onClick={() => setMascotAnimations((on) => !on)}
              className={rowClass}
            >
              Mascot animations
              <span
                aria-hidden="true"
                className={`relative h-6 w-10 shrink-0 rounded-full transition-colors motion-reduce:transition-none ${mascotAnimations ? 'bg-gold' : 'bg-fg-subtle'}`}
              >
                <span
                  className={`absolute top-0.5 left-0.5 size-5 rounded-full bg-fg transition-transform motion-reduce:transition-none ${mascotAnimations ? 'translate-x-4' : ''}`}
                />
              </span>
            </button>
          </div>
        </section>
      </form>

      {/* Account -- outside the form so Enter in the password or DELETE
          fields never submits the profile. Save (below) targets the form by id. */}
      <section className="border-t border-line pt-3 pb-1">
        <h3 className={sectionLabelClass}>Account</h3>
        <div className="divide-y divide-line">
          <div>
            <button
              type="button"
              onClick={() => setPasswordOpen((o) => !o)}
              aria-expanded={passwordOpen}
              className={rowClass}
            >
              Change password
              <ChevronRight size={16} className={`shrink-0 text-fg-muted transition-transform motion-reduce:transition-none ${passwordOpen ? 'rotate-90' : ''}`} />
            </button>
            {passwordOpen && (
              <div className="pb-2 divide-y divide-line">
                <input
                  type="password"
                  aria-label="New password"
                  autoComplete="new-password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleChangePassword()
                  }}
                  placeholder="New password"
                  className={inputClass}
                />
                <input
                  type="password"
                  aria-label="Confirm new password"
                  autoComplete="new-password"
                  value={confirmNewPassword}
                  onChange={(e) => setConfirmNewPassword(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleChangePassword()
                  }}
                  placeholder="Confirm new password"
                  className={inputClass}
                />
                {passwordMessage && (
                  <p role="status" className={`py-2 text-xs font-medium ${passwordMessage.includes('successfully') ? 'text-veg' : 'text-danger'}`}>
                    {passwordMessage}
                  </p>
                )}
                <button
                  type="button"
                  onClick={handleChangePassword}
                  disabled={changingPassword || !newPassword}
                  className="w-full min-h-tap text-sm font-bold text-gold press active:opacity-70 disabled:opacity-40"
                >
                  {changingPassword ? 'Updating...' : 'Update password'}
                </button>
              </div>
            )}
          </div>

          <button
            type="button"
            onClick={handleSignOut}
            disabled={signingOut}
            className={`${rowClass} disabled:opacity-60`}
          >
            {signingOut ? 'Signing out...' : 'Sign out'}
            <LogOut size={16} className="shrink-0 text-fg-muted" />
          </button>

          <div>
            {!deleteConfirmOpen ? (
              <button
                type="button"
                onClick={() => setDeleteConfirmOpen(true)}
                className="w-full min-h-tap flex items-center justify-between gap-3 text-sm font-semibold text-danger press active:opacity-70"
              >
                Delete account
                <Trash2 size={16} className="shrink-0" />
              </button>
            ) : (
              <div className="py-3 space-y-2">
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
                  className="w-full min-h-tap rounded-lg bg-surface-2 px-3 text-input text-fg focus:outline-none focus:ring-2 focus:ring-danger/40"
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
                    className="flex-1 min-h-tap rounded-lg text-sm font-semibold text-fg-muted hover:text-fg press active:scale-95"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={handleDeleteAccount}
                    disabled={deleteConfirmText !== 'DELETE' || deleting}
                    className="flex-1 min-h-tap rounded-lg bg-danger text-sm font-semibold text-on-danger hover:brightness-105 press active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    {deleting ? 'Deleting...' : 'Delete permanently'}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </section>

      {error && (
        <p role="alert" className="mt-3 text-sm font-medium text-danger bg-danger/10 rounded-2xl px-3 py-2">
          {error}
        </p>
      )}

      <div className="flex gap-3 mt-4">
        <SheetCloseButton
          className="flex-1 min-h-tap rounded-xl border border-line text-sm font-semibold text-fg press active:scale-95"
        >
          Cancel
        </SheetCloseButton>
        <button
          type="submit"
          form="profile-form"
          disabled={saving}
          className="flex-1 min-h-tap rounded-xl bg-gold text-sm font-semibold text-on-gold hover:brightness-105 active:scale-95 press disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {saving ? 'Saving...' : 'Save changes'}
        </button>
      </div>
    </BottomSheet>
  )
}
