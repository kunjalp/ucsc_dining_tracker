'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase'
import SetTargetsModal, { DailyTargets } from '../dashboard/SetTargetsModal'

export default function OnboardingPage() {
    const supabase = createClient()
    const router = useRouter()
    const [showModal, setShowModal] = useState(false)
    const [saving, setSaving] = useState(false)

    const goToDashboard = () => router.push('/dashboard')

    const handleSaveGoals = async (targets: DailyTargets) => {
        setSaving(true)

        // Same localStorage keys the dashboard reads on load, so the rings
        // reflect these targets immediately without waiting on a Supabase fetch.
        localStorage.setItem('ucsc_goal_calories', String(targets.calories))
        localStorage.setItem('ucsc_goal_protein', String(targets.protein))
        localStorage.setItem('ucsc_goal_carbs', String(targets.carbs))
        localStorage.setItem('ucsc_goal_fat', String(targets.fat))

        const { data: { user } } = await supabase.auth.getUser()
        if (user) {
            const { error } = await supabase
                .from('user_goals')
                .upsert({
                    user_id: user.id,
                    goal_calories: targets.calories,
                    goal_protein: targets.protein,
                    goal_carbs: targets.carbs,
                    goal_fat: targets.fat,
                }, { onConflict: 'user_id' })

            if (error) {
                console.error('Could not sync targets to Supabase:', error.message)
            }
        }

        setSaving(false)
        router.push('/dashboard')
    }

    return (
        <div
            className="flex min-h-screen flex-col items-center justify-center bg-[#0b1326] p-4 text-[#dae2fd] relative overflow-hidden"
            style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}
        >
            <div className="fixed top-0 left-0 w-full h-[512px] bg-gradient-to-b from-[#003c6c]/20 to-transparent pointer-events-none -z-10 blur-3xl" />

            <div className="w-full max-w-xs rounded-2xl p-6 bg-[rgba(30,41,59,0.6)] backdrop-blur-2xl border-t border-l border-white/15 border-b border-r border-white/5 shadow-[0_10px_40px_-10px_rgba(0,60,108,0.4)] text-center">
                <h1 className="text-xl font-extrabold tracking-tight text-[#dae2fd] mb-2">
                    Welcome to Sammy's Palate!
                </h1>
                <p className="text-sm text-[#c2c6d0] mb-6">
                    Set your daily calorie and macro goals to display your dashboard progress rings. You can change these anytime.
                </p>

                <div className="flex gap-3">
                    <button
                        type="button"
                        onClick={goToDashboard}
                        disabled={saving}
                        className="flex-1 rounded-xl border border-white/15 bg-white/5 py-2.5 text-sm font-bold text-[#c2c6d0] hover:bg-white/10 transition disabled:opacity-60"
                    >
                        Later
                    </button>
                    <button
                        type="button"
                        onClick={() => setShowModal(true)}
                        disabled={saving}
                        className="flex-1 rounded-xl bg-[#d6b93a] py-2.5 text-sm font-bold text-[#6b5300] hover:brightness-105 active:scale-95 transition shadow-md shadow-[#d6b93a]/20 disabled:opacity-60"
                    >
                        Now
                    </button>
                </div>
            </div>

            {showModal && (
                <SetTargetsModal
                    onClose={() => setShowModal(false)}
                    onSave={handleSaveGoals}
                />
            )}
        </div>
    )
}