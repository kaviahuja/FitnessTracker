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

const API_KEYS = {
  // Generic "nutrition" so a future provider switch is a code-only change.
  // Currently used for API Ninjas (api-ninjas.com/v1/nutrition).
  nutrition: 'fittrack_nutrition_key',
  claude: 'fittrack_claude_key',
}

async function syncToCloud(): Promise<boolean> {
  const { data: { user }, error: userErr } = await supabase.auth.getUser()
  if (userErr) {
    console.error('syncToCloud: getUser failed', userErr)
    return false
  }
  if (!user) return false

  const { error } = await supabase.from('user_data').upsert({
    user_id: user.id,
    profile: JSON.parse(localStorage.getItem(KEYS.profile) ?? 'null'),
    weight_logs: JSON.parse(localStorage.getItem(KEYS.weightLogs) ?? '[]'),
    meal_logs: JSON.parse(localStorage.getItem(KEYS.mealLogs) ?? '[]'),
    workout_logs: JSON.parse(localStorage.getItem(KEYS.workoutLogs) ?? '[]'),
    routine: JSON.parse(localStorage.getItem(KEYS.routine) ?? '{}'),
    custom_exercises: JSON.parse(localStorage.getItem(KEYS.customExercises) ?? '{}'),
    api_keys: {
      nutrition: localStorage.getItem(API_KEYS.nutrition) ?? null,
      claude: localStorage.getItem(API_KEYS.claude) ?? null,
    },
    updated_at: new Date().toISOString(),
  })

  if (error) {
    console.error('syncToCloud: upsert failed', error)
    return false
  }
  return true
}

let syncTimer: ReturnType<typeof setTimeout> | null = null

export function queueSync() {
  if (syncTimer) clearTimeout(syncTimer)
  syncTimer = setTimeout(() => {
    syncTimer = null
    syncToCloud()
  }, 1500)
}

export async function flushSync(): Promise<boolean> {
  if (syncTimer) {
    clearTimeout(syncTimer)
    syncTimer = null
  }
  return syncToCloud()
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
    // New user — no cloud data exists. Wipe any leftover localStorage from a
    // previous user on this browser so onboarding runs and we don't leak
    // their data into this account on the next sync.
    Object.values(KEYS).forEach(k => localStorage.removeItem(k))
    return false
  }

  // Overwrite localStorage with cloud data
  if (data.profile) localStorage.setItem(KEYS.profile, JSON.stringify(data.profile))
  localStorage.setItem(KEYS.weightLogs, JSON.stringify(data.weight_logs ?? []))
  localStorage.setItem(KEYS.mealLogs, JSON.stringify(data.meal_logs ?? []))
  localStorage.setItem(KEYS.workoutLogs, JSON.stringify(data.workout_logs ?? []))
  localStorage.setItem(KEYS.routine, JSON.stringify(data.routine ?? {}))
  localStorage.setItem(KEYS.customExercises, JSON.stringify(data.custom_exercises ?? {}))
  // Restore API keys from cloud — so they survive sign-outs, "Clear site data",
  // and switching devices. Only set if cloud has a value (don't overwrite a
  // local key with null).
  if (data.api_keys?.nutrition) localStorage.setItem(API_KEYS.nutrition, data.api_keys.nutrition)
  if (data.api_keys?.claude) localStorage.setItem(API_KEYS.claude, data.api_keys.claude)
  return true
}
