// web-app/lib/utils.ts

export const getURL = () => {
  let url =
    process?.env?.NEXT_PUBLIC_SITE_URL ?? // Set in Vercel
    process?.env?.NEXT_PUBLIC_VERCEL_URL ?? 
    (typeof window !== 'undefined' ? window.location.origin : 'http://localhost:3000/')

  url = url.startsWith('http') ? url : `https://${url}`
  url = url.endsWith('/') ? url : `${url}/`
  return url
}

// Target Calculation Types & Logic
export type BiologicalSex = 'male' | 'female';
export type Goal = 'lose' | 'maintain' | 'gain';

export function calculateRecommendedTargets(
  age: number,
  heightCm: number,
  weightKg: number,
  sex: BiologicalSex,
  goal: Goal,
  rateLbsPerWeek: number // 0.5, 1.0, 1.5, 2.0
) {
  // 1. Calculate BMR (Mifflin-St Jeor)
  let bmr = (10 * weightKg) + (6.25 * heightCm) - (5 * age);
  bmr = sex === 'male' ? bmr + 5 : bmr - 161;

  // 2. Calculate TDEE (Sedentary/Lightly active multiplier)
  const tdee = bmr * 1.2;

  // 3. Caloric Adjustment (1 lb/week = ~500 cal/day deficit/surplus)
  const dailyCaloricAdjustment = rateLbsPerWeek * 500;
  
  let targetCalories = tdee;
  if (goal === 'lose') targetCalories -= dailyCaloricAdjustment;
  if (goal === 'gain') targetCalories += dailyCaloricAdjustment;

  // Minimum floor for health safety
  const minCalories = sex === 'male' ? 1500 : 1200;
  targetCalories = Math.max(Math.round(targetCalories), minCalories);

  // 4. Macro Breakdown (30% Protein, 35% Carbs, 35% Fat)
  return {
    calories: targetCalories,
    protein: Math.round((targetCalories * 0.30) / 4), // 4 cals/g
    carbs: Math.round((targetCalories * 0.35) / 4),   // 4 cals/g
    fat: Math.round((targetCalories * 0.35) / 9)      // 9 cals/g
  };
}

export const lbsToKg = (lbs: number) => lbs * 0.453592;
export const inchesToCm = (inches: number) => inches * 2.54;