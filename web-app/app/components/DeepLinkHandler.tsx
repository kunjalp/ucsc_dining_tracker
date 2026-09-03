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
            Browser.close().catch(() => { })
            const queryString = url.split('?')[1] || ''
            const params = new URLSearchParams(queryString)
            const code = params.get('code')
            const next = params.get('next')

            if (!code) return

            const { error } = await supabase.auth.exchangeCodeForSession(code)
            if (error) {
                console.error('Auth exchange failed:', error.message)
                router.push('/auth/auth-code-error')
                return
            }

            // If the link explicitly requested a destination (like password
            // reset -> /auth/update-password), go there directly and skip
            // the onboarding check entirely.
            if (next) {
                router.push(next)
                return
            }

            // No explicit destination (this is the Google sign-in path) —
            // decide between dashboard vs onboarding based on whether they
            // already have goals set.
            const { data: { user } } = await supabase.auth.getUser()
            if (user) {
                const { data: existingGoals } = await supabase
                    .from('user_goals')
                    .select('user_id')
                    .eq('user_id', user.id)
                    .maybeSingle()
                router.push(existingGoals ? '/dashboard' : '/onboarding')
            } else {
                router.push('/dashboard')
            }
        })
        return () => {
            listenerPromise.then((listener) => listener.remove())
        }
    }, [router])
    return null
}