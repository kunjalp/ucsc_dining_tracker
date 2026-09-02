'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Capacitor } from '@capacitor/core'
import { App } from '@capacitor/app'
import { Browser } from '@capacitor/browser'
import { createClient } from '@/lib/supabase'

export default function DeepLinkHandler() {
  const router = useRouter()

  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return

    const supabase = createClient()

    const listenerPromise = App.addListener('appUrlOpen', async (event) => {
      const url = event.url
      if (!url.startsWith('sammyspalate://')) return

      Browser.close().catch(() => {})

      const queryString = url.split('?')[1] || ''
      const params = new URLSearchParams(queryString)
      const code = params.get('code')

      if (!code) return

      const { error } = await supabase.auth.exchangeCodeForSession(code)
      if (!error) {
        router.push('/dashboard')
      } else {
        console.error('Google sign-in exchange failed:', error.message)
        router.push('/auth/auth-code-error')
      }
    })

    return () => {
      listenerPromise.then((listener) => listener.remove())
    }
  }, [router])

  return null
}