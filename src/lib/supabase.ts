import { createClient } from '@supabase/supabase-js'

export const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL as string,
  import.meta.env.VITE_SUPABASE_ANON_KEY as string
)

const KEYS = {
  profile: 'fittrack_profile',
  weightLogs: 'fittrack_weight',
  mealLogs: 'fittrack_meals',
  workoutLogs: 'fittrack_workouts',
  routine: 'fittrack_routine',
  customExercises: 'fittrack_custom_exercises',
}

let syncTimer: ReturnType<typeof setTimeout> | null = null

export function queueSync() {
  if (syncTimer) clearTimeout(syncTimer)
  syncTimer = setTimeout(async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    await supabase.from('user_data').upsert({
      user_id: user.id,
      profile: JSON.parse(localStorage.getItem(KEYS.profile) ?? 'null'),
      weight_logs: JSON.parse(localStorage.getItem(KEYS.weightLogs) ?? '[]'),
      meal_logs: JSON.parse(localStorage.getItem(KEYS.mealLogs) ?? '[]'),
      workout_logs: JSON.parse(localStorage.getItem(KEYS.workoutLogs) ?? '[]'),
      routine: JSON.parse(localStorage.getItem(KEYS.routine) ?? '{}'),
      custom_exercises: JSON.parse(localStorage.getItem(KEYS.customExercises) ?? '{}'),
      updated_at: new Date().toISOString(),
    })
  }, 1500)
}

export async function loadFromCloud(): Promise<boolean> {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return false

  const { data, error } = await supabase
    .from('user_data')
    .select('*')
    .eq('user_id', user.id)
    .maybeSingle()

  if (error) {
    console.error('loadFromCloud: failed to read user_data', error)
    return false
  }

  console.log('loadFromCloud: data returned from Supabase', data)

  if (!data) {
    // No cloud data yet — migrate existing localStorage data to cloud
    const hasLocal = !!localStorage.getItem(KEYS.profile)
    if (hasLocal) {
      await supabase.from('user_data').upsert({
        user_id: user.id,
        profile: JSON.parse(localStorage.getItem(KEYS.profile) ?? 'null'),
        weight_logs: JSON.parse(localStorage.getItem(KEYS.weightLogs) ?? '[]'),
        meal_logs: JSON.parse(localStorage.getItem(KEYS.mealLogs) ?? '[]'),
        workout_logs: JSON.parse(localStorage.getItem(KEYS.workoutLogs) ?? '[]'),
        routine: JSON.parse(localStorage.getItem(KEYS.routine) ?? '{}'),
        custom_exercises: JSON.parse(localStorage.getItem(KEYS.customExercises) ?? '{}'),
        updated_at: new Date().toISOString(),
      })
    }
    return hasLocal
  }

  // Overwrite localStorage with cloud data
  if (data.profile) localStorage.setItem(KEYS.profile, JSON.stringify(data.profile))
  localStorage.setItem(KEYS.weightLogs, JSON.stringify(data.weight_logs ?? []))
  localStorage.setItem(KEYS.mealLogs, JSON.stringify(data.meal_logs ?? []))
  localStorage.setItem(KEYS.workoutLogs, JSON.stringify(data.workout_logs ?? []))
  localStorage.setItem(KEYS.routine, JSON.stringify(data.routine ?? {}))
  localStorage.setItem(KEYS.customExercises, JSON.stringify(data.custom_exercises ?? {}))
  return true
}
