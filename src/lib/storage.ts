import type { UserProfile, WeightLog, MealLog, WorkoutLog, WeeklyRoutine } from '../types'

const KEYS = {
  profile: 'fittrack_profile',
  weightLogs: 'fittrack_weight',
  mealLogs: 'fittrack_meals',
  workoutLogs: 'fittrack_workouts',
  routine: 'fittrack_routine',
  customExercises: 'fittrack_custom_exercises',
}

function get<T>(key: string): T | null {
  try {
    const raw = localStorage.getItem(key)
    return raw ? JSON.parse(raw) : null
  } catch {
    return null
  }
}

function set(key: string, value: unknown) {
  localStorage.setItem(key, JSON.stringify(value))
}

export const storage = {
  getProfile: () => get<UserProfile>(KEYS.profile),
  saveProfile: (profile: UserProfile) => set(KEYS.profile, profile),

  getWeightLogs: (): WeightLog[] => get<WeightLog[]>(KEYS.weightLogs) ?? [],
  saveWeightLog: (log: WeightLog) => {
    const logs = storage.getWeightLogs()
    const existing = logs.findIndex(l => l.date === log.date)
    if (existing >= 0) logs[existing] = log
    else logs.push(log)
    set(KEYS.weightLogs, logs)
  },

  getMealLogs: (): MealLog[] => get<MealLog[]>(KEYS.mealLogs) ?? [],
  saveMealLog: (log: MealLog) => {
    const logs = storage.getMealLogs()
    const existing = logs.findIndex(l => l.id === log.id)
    if (existing >= 0) logs[existing] = log
    else logs.push(log)
    set(KEYS.mealLogs, logs)
  },
  deleteMealLog: (id: string) => {
    const logs = storage.getMealLogs().filter(l => l.id !== id)
    set(KEYS.mealLogs, logs)
  },

  getWorkoutLogs: (): WorkoutLog[] => get<WorkoutLog[]>(KEYS.workoutLogs) ?? [],
  saveWorkoutLog: (log: WorkoutLog) => {
    const logs = storage.getWorkoutLogs()
    const existing = logs.findIndex(l => l.date === log.date)
    if (existing >= 0) logs[existing] = log
    else logs.push(log)
    set(KEYS.workoutLogs, logs)
  },
  deleteWorkoutLog: (date: string) => {
    const logs = storage.getWorkoutLogs().filter(l => l.date !== date)
    set(KEYS.workoutLogs, logs)
  },

  getRoutine: (): WeeklyRoutine => get<WeeklyRoutine>(KEYS.routine) ?? {},
  saveRoutine: (routine: WeeklyRoutine) => set(KEYS.routine, routine),

  // Maps exercise name (lowercase) → muscle category
  getCustomExercises: (): Record<string, string> => get<Record<string, string>>(KEYS.customExercises) ?? {},
  saveCustomExercise: (name: string, category: string) => {
    const map = storage.getCustomExercises()
    map[name.toLowerCase()] = category
    set(KEYS.customExercises, map)
  },
}
