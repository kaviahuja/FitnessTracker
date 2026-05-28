export type Goal = 'lose_weight' | 'gain_weight' | 'gain_muscle' | 'maintenance'
export type Gender = 'male' | 'female'
export type WeightUnit = 'kg' | 'lbs'
export type HeightUnit = 'cm' | 'ft'
export type DietPreference = 'non_vegetarian' | 'vegetarian' | 'pescetarian' | 'vegan'

export interface UserProfile {
  name: string
  goal: Goal
  gender: Gender
  age: number
  weight: number
  weightUnit: WeightUnit
  heightCm: number
  heightUnit: HeightUnit
  dietPreference: DietPreference
  calorieGoal: number
  proteinGoal: number
  carbsGoal: number
  fatGoal: number
  onboardingComplete: boolean
}

export interface WeightLog {
  id: string
  date: string
  weight: number
  unit: WeightUnit
}

export interface FoodItem {
  name: string
  calories: number
  protein: number
  carbs: number
  fat: number
  amount: string
}

export interface MealLog {
  id: string
  date: string
  meal: string
  items: FoodItem[]
  photoUrl?: string
}

export interface WorkoutSet {
  reps: number
  weight?: number
}

export interface Exercise {
  name: string
  sets: WorkoutSet[]
}

export interface WorkoutLog {
  id: string
  date: string
  isRestDay: boolean
  exercises: Exercise[]
  notes?: string
}

export interface RoutineExercise {
  name: string
  setCount: number
}

export interface RoutineDay {
  isRestDay: boolean
  exercises: RoutineExercise[]
  name?: string
}

// 0 = Monday … 6 = Sunday
export type WeeklyRoutine = Partial<Record<number, RoutineDay>>
