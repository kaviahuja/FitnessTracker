import type { Goal, Gender } from '../types'

export function calculateGoals(
  gender: Gender,
  age: number,
  weightKg: number,
  heightCm: number,
  goal: Goal
) {
  // Mifflin-St Jeor BMR
  const bmr =
    gender === 'male'
      ? 10 * weightKg + 6.25 * heightCm - 5 * age + 5
      : 10 * weightKg + 6.25 * heightCm - 5 * age - 161

  // Moderate activity multiplier
  const tdee = Math.round(bmr * 1.55)

  let calorieGoal: number
  let proteinGoal: number

  switch (goal) {
    case 'lose_weight':
      calorieGoal = tdee - 500
      proteinGoal = Math.round(weightKg * 2.0)
      break
    case 'gain_weight':
    case 'gain_muscle':
      calorieGoal = tdee + 300
      proteinGoal = Math.round(weightKg * 2.2)
      break
    default:
      calorieGoal = tdee
      proteinGoal = Math.round(weightKg * 1.8)
  }

  const fatGoal = Math.round((calorieGoal * 0.25) / 9)
  const carbsGoal = Math.round((calorieGoal - proteinGoal * 4 - fatGoal * 9) / 4)

  return { calorieGoal, proteinGoal, carbsGoal, fatGoal }
}

export function kgToLbs(kg: number) {
  return Math.round(kg * 2.20462 * 10) / 10
}

export function lbsToKg(lbs: number) {
  return Math.round((lbs / 2.20462) * 10) / 10
}

export function cmToFtIn(cm: number) {
  const totalInches = cm / 2.54
  const ft = Math.floor(totalInches / 12)
  const inches = Math.round(totalInches % 12)
  return { ft, inches }
}

export function ftInToCm(ft: number, inches: number) {
  return Math.round((ft * 12 + inches) * 2.54)
}
