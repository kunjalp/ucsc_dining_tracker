// web-app/app/dashboard/SetTargetsModal.tsx
'use client';

import { useState } from 'react';
import { X } from 'lucide-react';
import { calculateRecommendedTargets, lbsToKg, inchesToCm, BiologicalSex, Goal } from '@/lib/utils';

export interface DailyTargets {
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
}

interface RecommendedProfile {
  age: number;
  height: number; // inches
  weight: number; // lbs
  sex: BiologicalSex;
  goal: Goal;
  rate: number;
}

interface SetTargetsModalProps {
  currentTargets?: DailyTargets;
  onClose: () => void;
  onSave: (targets: DailyTargets, mode: 'recommended' | 'manual') => void;
}

const DEFAULT_TARGETS: DailyTargets = { calories: 2000, protein: 120, carbs: 250, fat: 70 };

const DEFAULT_PROFILE: RecommendedProfile = {
  age: 20,
  height: 68,
  weight: 150,
  sex: 'male',
  goal: 'maintain',
  rate: 1,
};

const PROFILE_STORAGE_KEY = 'ucsc_target_profile';

// Reads whatever profile the user last used to calculate their targets, so
// reopening the modal doesn't reset age/height/weight/sex/goal to defaults.
function loadSavedProfile(): RecommendedProfile {
  if (typeof window === 'undefined') return DEFAULT_PROFILE;
  try {
    const raw = window.localStorage.getItem(PROFILE_STORAGE_KEY);
    if (!raw) return DEFAULT_PROFILE;
    const parsed = JSON.parse(raw);
    return { ...DEFAULT_PROFILE, ...parsed };
  } catch {
    return DEFAULT_PROFILE;
  }
}

// Strips leading zeros as the user types (e.g. "0" + "7" => "7", not "07"),
// while still allowing a single "0" or an empty field mid-edit.
function sanitizeDigits(raw: string): string {
  const digitsOnly = raw.replace(/[^\d]/g, '');
  if (digitsOnly === '') return '';
  const stripped = digitsOnly.replace(/^0+(?=\d)/, '');
  return stripped;
}

export default function SetTargetsModal({ currentTargets, onClose, onSave }: SetTargetsModalProps) {
  const [mode, setMode] = useState<'recommended' | 'manual'>('recommended');

  // Recommended Form State — seeded from the last profile the user entered,
  // not hardcoded defaults, so it survives the modal closing/reopening.
  const savedProfile = loadSavedProfile();
  const [age, setAge] = useState<string>(String(savedProfile.age));
  const [height, setHeight] = useState<string>(String(savedProfile.height)); // inches
  const [weight, setWeight] = useState<string>(String(savedProfile.weight)); // lbs
  const [sex, setSex] = useState<BiologicalSex>(savedProfile.sex);
  const [goal, setGoal] = useState<Goal>(savedProfile.goal);
  const [rate, setRate] = useState<number>(savedProfile.rate); // 0.5, 1, 1.5, 2

  // Manual Form State — seeded from whatever the user already has set
  const [manualTargets, setManualTargets] = useState<DailyTargets>(currentTargets ?? DEFAULT_TARGETS);

  const handleSave = () => {
    if (mode === 'recommended') {
      const ageNum = Number(age) || DEFAULT_PROFILE.age;
      const heightNum = Number(height) || DEFAULT_PROFILE.height;
      const weightNum = Number(weight) || DEFAULT_PROFILE.weight;

      // Remember this profile for next time the modal is opened.
      const profileToSave: RecommendedProfile = {
        age: ageNum,
        height: heightNum,
        weight: weightNum,
        sex,
        goal,
        rate,
      };
      if (typeof window !== 'undefined') {
        window.localStorage.setItem(PROFILE_STORAGE_KEY, JSON.stringify(profileToSave));
      }

      const calculated = calculateRecommendedTargets(
        ageNum,
        inchesToCm(heightNum),
        lbsToKg(weightNum),
        sex,
        goal,
        goal === 'maintain' ? 0 : rate
      );
      onSave(calculated, 'recommended');
    } else {
      onSave(manualTargets, 'manual');
    }
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center px-5"
      role="dialog"
      aria-modal="true"
      aria-labelledby="set-targets-title"
    >
      {/* Backdrop */}
      <div className="absolute inset-0 bg-[#060e20]/70 backdrop-blur-sm" onClick={onClose} />

      {/* Modal panel */}
      <div className="relative w-full max-w-md rounded-2xl p-6 bg-[#171f33] border-t border-l border-white/15 border-b border-r border-white/5 shadow-[0_20px_60px_-10px_rgba(0,0,0,0.6)] text-[#dae2fd] max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-5">
          <h2 id="set-targets-title" className="text-lg font-bold tracking-tight text-[#dae2fd]">
            Set Your Targets
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-full text-[#c2c6d0] hover:text-[#dae2fd] hover:bg-white/10 transition"
            aria-label="Close"
          >
            <X size={18} />
          </button>
        </div>

        {/* Toggle Mode */}
        <div className="flex bg-[#0b1326] rounded-xl p-1.5 gap-1 mb-6 border border-white/10">
          <button
            type="button"
            onClick={() => setMode('recommended')}
            className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all ${
              mode === 'recommended'
                ? 'bg-[#d6b93a] text-[#6b5300] shadow-md shadow-[#d6b93a]/20'
                : 'text-[#c2c6d0] hover:text-[#dae2fd]'
            }`}
          >
            Recommended
          </button>
          <button
            type="button"
            onClick={() => setMode('manual')}
            className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all ${
              mode === 'manual'
                ? 'bg-[#d6b93a] text-[#6b5300] shadow-md shadow-[#d6b93a]/20'
                : 'text-[#c2c6d0] hover:text-[#dae2fd]'
            }`}
          >
            Manual
          </button>
        </div>

        {mode === 'recommended' ? (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-[10px] font-bold text-[#c2c6d0] uppercase tracking-wider mb-1">Age</label>
                <input
                  type="text"
                  inputMode="numeric"
                  value={age}
                  onChange={(e) => setAge(sanitizeDigits(e.target.value))}
                  className="w-full bg-[#0b1326] border border-white/10 rounded-lg p-2.5 text-sm font-bold text-[#dae2fd] focus:outline-none focus:ring-2 focus:ring-[#d6b93a]/40"
                />
              </div>
              <div>
                <label className="block text-[10px] font-bold text-[#c2c6d0] uppercase tracking-wider mb-1">Biological Sex</label>
                <select
                  value={sex}
                  onChange={(e) => setSex(e.target.value as BiologicalSex)}
                  className="w-full bg-[#0b1326] border border-white/10 rounded-lg p-2.5 text-sm font-bold text-[#dae2fd] focus:outline-none focus:ring-2 focus:ring-[#d6b93a]/40"
                >
                  <option value="male">Male</option>
                  <option value="female">Female</option>
                </select>
              </div>
              <div>
                <label className="block text-[10px] font-bold text-[#c2c6d0] uppercase tracking-wider mb-1">Height (in)</label>
                <input
                  type="text"
                  inputMode="numeric"
                  value={height}
                  onChange={(e) => setHeight(sanitizeDigits(e.target.value))}
                  className="w-full bg-[#0b1326] border border-white/10 rounded-lg p-2.5 text-sm font-bold text-[#dae2fd] focus:outline-none focus:ring-2 focus:ring-[#d6b93a]/40"
                />
              </div>
              <div>
                <label className="block text-[10px] font-bold text-[#c2c6d0] uppercase tracking-wider mb-1">Weight (lbs)</label>
                <input
                  type="text"
                  inputMode="numeric"
                  value={weight}
                  onChange={(e) => setWeight(sanitizeDigits(e.target.value))}
                  className="w-full bg-[#0b1326] border border-white/10 rounded-lg p-2.5 text-sm font-bold text-[#dae2fd] focus:outline-none focus:ring-2 focus:ring-[#d6b93a]/40"
                />
              </div>
            </div>

            <div>
              <label className="block text-[10px] font-bold text-[#c2c6d0] uppercase tracking-wider mb-1 mt-2">Goal</label>
              <select
                value={goal}
                onChange={(e) => setGoal(e.target.value as Goal)}
                className="w-full bg-[#0b1326] border border-white/10 rounded-lg p-2.5 text-sm font-bold text-[#dae2fd] focus:outline-none focus:ring-2 focus:ring-[#d6b93a]/40"
              >
                <option value="lose">Lose Weight</option>
                <option value="maintain">Maintain Current Weight</option>
                <option value="gain">Gain Weight</option>
              </select>
            </div>

            {/* Slider shows only if goal is not maintain */}
            {goal !== 'maintain' && (
              <div className="pt-2">
                <label className="block text-[10px] font-bold text-[#c2c6d0] uppercase tracking-wider mb-2">
                  Rate: {rate} lb{rate > 1 ? 's' : ''} / week
                </label>
                <input
                  type="range"
                  min="0.5"
                  max="2"
                  step="0.5"
                  value={rate}
                  onChange={(e) => setRate(Number(e.target.value))}
                  className="w-full accent-[#d6b93a]"
                />
                <div className="flex justify-between font-['JetBrains_Mono'] text-[10px] text-[#c2c6d0]/70 mt-1">
                  <span>0.5 lb</span><span>1.0 lb</span><span>1.5 lb</span><span>2.0 lb</span>
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-4">
            {Object.entries(manualTargets).map(([key, val]) => (
              <div key={key}>
                <label className="block text-[10px] font-bold text-[#c2c6d0] uppercase tracking-wider mb-1">
                  {key === 'calories' ? 'Calories (kcal)' : `${key} (g)`}
                </label>
                <input
                  type="text"
                  inputMode="numeric"
                  value={val === 0 ? '' : String(val)}
                  onChange={(e) =>
                    setManualTargets({
                      ...manualTargets,
                      [key]: Number(sanitizeDigits(e.target.value)) || 0,
                    })
                  }
                  className="w-full bg-[#0b1326] border border-white/10 rounded-lg p-2.5 text-sm font-bold text-[#dae2fd] focus:outline-none focus:ring-2 focus:ring-[#d6b93a]/40"
                />
              </div>
            ))}
          </div>
        )}

        <div className="flex gap-3 mt-6">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 text-xs font-bold text-[#c2c6d0] bg-white/5 hover:bg-white/10 px-4 py-2.5 rounded-xl transition border border-white/10"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSave}
            className="flex-1 bg-[#d6b93a] hover:brightness-105 text-[#6b5300] font-bold text-xs py-2.5 px-4 rounded-xl transition shadow-md shadow-[#d6b93a]/20"
          >
            Save Targets
          </button>
        </div>
      </div>
    </div>
  );
}