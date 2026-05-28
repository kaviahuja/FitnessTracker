import { useState, useMemo, useEffect } from 'react'
import { storage } from '../lib/storage'
import type { WorkoutLog, Exercise, WorkoutSet, WeightUnit, WeeklyRoutine, RoutineDay } from '../types'

function todayStr() { return new Date().toISOString().split('T')[0] }
function uid() { return Date.now().toString(36) + Math.random().toString(36).slice(2) }

function formatFullDate(dateStr: string) {
  return new Date(dateStr + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })
}

function getWeekDays(dateStr: string): string[] {
  const date = new Date(dateStr + 'T00:00:00')
  const day = date.getDay()
  const diff = day === 0 ? -6 : 1 - day
  const monday = new Date(date)
  monday.setDate(date.getDate() + diff)
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(monday)
    d.setDate(monday.getDate() + i)
    return d.toISOString().split('T')[0]
  })
}

// 0 = Mon … 6 = Sun
function weekdayIndex(dateStr: string): number {
  return (new Date(dateStr + 'T00:00:00').getDay() + 6) % 7
}

function shortDay(dateStr: string) {
  return new Date(dateStr + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'short' })
}

const DAY_NAMES = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

type DraftExercise = { name: string; sets: WorkoutSet[]; weightUnit: WeightUnit }

// ─── Exercise library ────────────────────────────────────────────────
const EXERCISE_LIBRARY: Record<string, string[]> = {
  Chest: ['Bench Press', 'Incline Bench Press', 'Decline Bench Press', 'Dumbbell Fly', 'Cable Fly', 'Incline Dumbbell Press', 'Push-Up', 'Chest Dip', 'Pec Deck', 'Landmine Press'],
  Back: ['Pull-Up', 'Chin-Up', 'Lat Pulldown', 'Seated Cable Row', 'Bent-Over Row', 'T-Bar Row', 'Dumbbell Row', 'Deadlift', 'Romanian Deadlift', 'Rack Pull', 'Face Pull', 'Straight-Arm Pulldown', 'Meadows Row', 'Chest-Supported Row'],
  Shoulders: ['Overhead Press', 'Dumbbell Shoulder Press', 'Arnold Press', 'Lateral Raise', 'Cable Lateral Raise', 'Front Raise', 'Rear Delt Fly', 'Upright Row', 'Barbell Shrugs', 'Dumbbell Shrugs'],
  Biceps: ['Barbell Curl', 'Dumbbell Curl', 'Hammer Curl', 'Incline Dumbbell Curl', 'Cable Curl', 'Preacher Curl', 'Concentration Curl', 'EZ-Bar Curl', 'Spider Curl'],
  Triceps: ['Tricep Pushdown', 'Close-Grip Bench Press', 'Skull Crusher', 'Overhead Tricep Extension', 'Tricep Dip', 'Cable Overhead Extension', 'Diamond Push-Up', 'Kickback', 'JM Press'],
  Legs: ['Squat', 'Front Squat', 'Hack Squat', 'Leg Press', 'Romanian Deadlift', 'Leg Extension', 'Leg Curl', 'Standing Calf Raise', 'Seated Calf Raise', 'Bulgarian Split Squat', 'Lunges', 'Step-Up', 'Hip Thrust', 'Glute Bridge', 'Sumo Deadlift', 'Goblet Squat', 'Nordic Curl'],
  Core: ['Plank', 'Side Plank', 'Crunch', 'Sit-Up', 'Leg Raise', 'Hanging Leg Raise', 'Russian Twist', 'Ab Rollout', 'Cable Crunch', 'Mountain Climber', 'Hollow Body Hold'],
  'Full Body': ['Burpee', 'Box Jump', 'Kettlebell Swing', 'Battle Rope', 'Sled Push', "Farmer's Walk", 'Clean and Press', 'Thruster', 'Turkish Get-Up'],
}

const CATEGORY_COLORS: Record<string, string> = {
  Chest: '#ff453a', Back: '#0071e3', Shoulders: '#bf5af2',
  Biceps: '#30d158', Triceps: '#ff9500', Legs: '#ffd60a',
  Core: '#64d2ff', 'Full Body': '#ff375f', Custom: '#8e8e93',
}

function isInLibrary(name: string): boolean {
  return Object.values(EXERCISE_LIBRARY).flat().some(e => e.toLowerCase() === name.toLowerCase())
}

function getExerciseCategory(name: string): string {
  for (const [cat, exercises] of Object.entries(EXERCISE_LIBRARY)) {
    if (exercises.some(e => e.toLowerCase() === name.toLowerCase())) return cat
  }
  return storage.getCustomExercises()[name.toLowerCase()] ?? 'Custom'
}

function groupByCategory<T>(items: T[], getName: (t: T) => string): { category: string; items: { item: T; idx: number }[] }[] {
  const map = new Map<string, { item: T; idx: number }[]>()
  items.forEach((item, idx) => {
    const cat = getExerciseCategory(getName(item))
    if (!map.has(cat)) map.set(cat, [])
    map.get(cat)!.push({ item, idx })
  })
  return Array.from(map.entries()).map(([category, items]) => ({ category, items }))
}

function CategoryHeader({ category, count }: { category: string; count: number }) {
  return (
    <div className="flex items-center gap-2 px-1 mb-1.5 mt-1">
      <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: CATEGORY_COLORS[category] ?? '#8e8e93' }} />
      <span className="text-[#8e8e93] text-xs font-semibold uppercase tracking-wider">{category}</span>
      <span className="text-[#c7c7cc] text-xs">· {count} exercise{count !== 1 ? 's' : ''}</span>
    </div>
  )
}

// ─── Exercise picker ─────────────────────────────────────────────────
function ExercisePicker({ query, onSelect, onAddCustom }: {
  query: string
  onSelect: (name: string) => void
  onAddCustom?: (name: string) => void
}) {
  const filtered = useMemo(() => {
    const q = query.toLowerCase().trim()
    if (!q) return EXERCISE_LIBRARY
    const result: Record<string, string[]> = {}
    for (const [cat, exercises] of Object.entries(EXERCISE_LIBRARY)) {
      const matches = exercises.filter(e => e.toLowerCase().includes(q))
      if (matches.length > 0) result[cat] = matches
    }
    return result
  }, [query])

  const trimmed = query.trim()
  const categories = Object.keys(filtered)
  const exactMatch = Object.values(EXERCISE_LIBRARY).flat().some(e => e.toLowerCase() === trimmed.toLowerCase())

  // "Add custom" button — shown when typed name isn't in the library
  const AddCustomButton = trimmed && !exactMatch && onAddCustom ? (
    <button
      onClick={() => onAddCustom(trimmed)}
      className="flex items-center gap-2 w-full bg-[#f5f5f7] border border-dashed border-[#c7c7cc] text-[#1d1d1f] text-sm font-semibold px-4 py-3 rounded-xl active:bg-[#e5e5ea] transition-colors"
    >
      <span className="w-6 h-6 bg-[#0071e3] rounded-full flex items-center justify-center flex-shrink-0">
        <svg width="10" height="10" viewBox="0 0 12 12" fill="none">
          <path d="M6 1v10M1 6h10" stroke="white" strokeWidth="2" strokeLinecap="round" />
        </svg>
      </span>
      Add "{trimmed}"
    </button>
  ) : null

  if (categories.length === 0) {
    return (
      <div className="flex flex-col gap-2">
        {AddCustomButton ?? <p className="text-[#8e8e93] text-sm text-center py-2">No matches found.</p>}
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-3">
      {/* Custom add button at the top when searching */}
      {AddCustomButton}
      {categories.map(cat => (
        <div key={cat}>
          <div className="flex items-center gap-2 mb-1.5">
            <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: CATEGORY_COLORS[cat] ?? '#8e8e93' }} />
            <span className="text-[#8e8e93] text-xs font-semibold uppercase tracking-wider">{cat}</span>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {filtered[cat].map(ex => (
              <button key={ex} onClick={() => onSelect(ex)}
                className="bg-[#f5f5f7] border border-[#e5e5ea] text-[#1d1d1f] text-sm font-medium px-3 py-1.5 rounded-xl active:bg-[#e5e5ea] transition-colors">
                {ex}
              </button>
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}

// ─── Set row (shared between sheet and editable cards) ───────────────
function SetRow({ set, index, onChange, onDelete, weightUnit }: {
  set: WorkoutSet; index: number
  onChange: (s: WorkoutSet) => void; onDelete: () => void; weightUnit: string
}) {
  return (
    <div className="flex items-center gap-2">
      <span className="w-7 h-7 bg-[#0071e3]/10 text-[#0071e3] rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0">
        {index + 1}
      </span>
      <div className="flex-1 flex items-center gap-1 bg-[#f5f5f7] border border-[#e5e5ea] rounded-xl px-3 py-2.5 min-w-0">
        <input type="number" inputMode="numeric" value={set.reps || ''} placeholder="0"
          onChange={e => onChange({ ...set, reps: Number(e.target.value) })}
          className="w-full bg-transparent text-[#0071e3] font-semibold text-base outline-none placeholder-[#c7c7cc] min-w-0" />
        <span className="text-[#8e8e93] text-xs flex-shrink-0">reps</span>
      </div>
      <div className="flex-1 flex items-center gap-1 bg-[#f5f5f7] border border-[#e5e5ea] rounded-xl px-3 py-2.5 min-w-0">
        <input type="number" inputMode="decimal" value={set.weight ?? ''} placeholder="–"
          onChange={e => onChange({ ...set, weight: e.target.value ? Number(e.target.value) : undefined })}
          className="w-full bg-transparent text-[#30d158] font-semibold text-base outline-none placeholder-[#c7c7cc] min-w-0" />
        <span className="text-[#8e8e93] text-xs flex-shrink-0">{weightUnit}</span>
      </div>
      <div className="w-6 flex-shrink-0 flex items-center justify-center">
        {index > 0 ? (
          <button onClick={onDelete} className="w-6 h-6 flex items-center justify-center text-[#c7c7cc] active:text-[#ff3b30]">
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
              <path d="M1 1l10 10M11 1L1 11" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
            </svg>
          </button>
        ) : <div className="w-6 h-6" />}
      </div>
    </div>
  )
}

// ─── Editable exercise card (drafting state) ─────────────────────────
function EditableExerciseCard({ draft, index, onChange, onRemove, onSwapName }: {
  draft: DraftExercise; index: number
  onChange: (d: DraftExercise) => void
  onRemove: () => void
  onSwapName: (index: number) => void
}) {
  return (
    <div className="bg-white rounded-2xl border border-[#0071e3]/30 overflow-hidden shadow-sm">
      <div className="flex items-center justify-between px-4 py-3 border-b border-[#f5f5f7] bg-[#0071e3]/4">
        <div className="flex items-center gap-2 flex-1 min-w-0">
          <p className="text-[#1d1d1f] font-semibold truncate">{draft.name}</p>
          <button onClick={() => onSwapName(index)}
            className="flex-shrink-0 w-6 h-6 bg-white border border-[#e5e5ea] rounded-full flex items-center justify-center shadow-sm">
            <svg width="11" height="11" fill="none" stroke="#8e8e93" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">
              <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7" />
              <path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z" />
            </svg>
          </button>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0 ml-2">
          <div className="flex bg-white border border-[#e5e5ea] rounded-lg p-0.5 shadow-sm">
            {(['kg', 'lbs'] as WeightUnit[]).map(u => (
              <button key={u} onClick={() => onChange({ ...draft, weightUnit: u })}
                className={`px-2 py-0.5 rounded-md text-[10px] font-bold transition-all ${draft.weightUnit === u ? 'bg-[#0071e3] text-white' : 'text-[#8e8e93]'}`}>
                {u}
              </button>
            ))}
          </div>
          <button onClick={onRemove} className="w-7 h-7 bg-white border border-[#e5e5ea] rounded-full flex items-center justify-center text-[#ff3b30] shadow-sm">
            <svg width="11" height="11" viewBox="0 0 12 12" fill="none">
              <path d="M1 1l10 10M11 1L1 11" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
            </svg>
          </button>
        </div>
      </div>
      <div className="px-4 py-3 flex flex-col gap-2.5">
        {draft.sets.map((set, i) => (
          <SetRow key={i} set={set} index={i} weightUnit={draft.weightUnit}
            onChange={updated => onChange({ ...draft, sets: draft.sets.map((s, j) => j === i ? updated : s) })}
            onDelete={() => onChange({ ...draft, sets: draft.sets.filter((_, j) => j !== i) })}
          />
        ))}
        <button
          onClick={() => {
            const last = draft.sets[draft.sets.length - 1]
            onChange({ ...draft, sets: [...draft.sets, { reps: 0, weight: last?.weight }] })
          }}
          className="text-[#0071e3] text-sm font-medium text-left py-1"
        >
          + Add set
        </button>
      </div>
    </div>
  )
}

// ─── Read-only exercise card (logged state) ──────────────────────────
function ExerciseCard({ exercise, onDelete, onEdit, weightUnit }: {
  exercise: Exercise; onDelete: () => void; onEdit: () => void; weightUnit: string
}) {
  const unit = exercise.weightUnit ?? weightUnit
  const volume = exercise.sets.reduce((s, set) => s + set.reps * (set.weight ?? 0), 0)
  return (
    <div className="bg-white rounded-2xl border border-[#e5e5ea] overflow-hidden shadow-sm">
      <div className="flex items-center justify-between px-4 py-3 border-b border-[#f5f5f7]">
        <div className="flex-1 min-w-0">
          <p className="text-[#1d1d1f] font-semibold truncate">{exercise.name}</p>
          <p className="text-[#8e8e93] text-xs">{exercise.sets.length} sets{volume > 0 ? ` · ${volume.toLocaleString()} ${unit} vol` : ''}</p>
        </div>
        <div className="flex items-center gap-1.5 flex-shrink-0 ml-2">
          <button onClick={onEdit} className="w-7 h-7 bg-[#f5f5f7] rounded-full flex items-center justify-center">
            <svg width="12" height="12" fill="none" stroke="#8e8e93" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">
              <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7" />
              <path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z" />
            </svg>
          </button>
          <button onClick={onDelete} className="w-7 h-7 bg-[#f5f5f7] rounded-full flex items-center justify-center text-[#8e8e93] text-sm">✕</button>
        </div>
      </div>
      <div className="px-4 py-2">
        <div className="flex text-[10px] text-[#c7c7cc] font-semibold uppercase tracking-wider mb-1.5">
          <span className="w-8">Set</span>
          <span className="flex-1 text-center">Reps</span>
          <span className="flex-1 text-right">Weight</span>
        </div>
        {exercise.sets.map((set, i) => (
          <div key={i} className="flex items-center py-1.5 border-t border-[#f5f5f7] first:border-0">
            <div className="w-7 h-7 bg-[#0071e3]/10 text-[#0071e3] rounded-full flex items-center justify-center text-xs font-bold">{i + 1}</div>
            <span className="flex-1 text-center text-[#0071e3] font-bold text-sm">{set.reps} reps</span>
            <span className="flex-1 text-right text-sm">
              {set.weight != null
                ? <span className="text-[#30d158] font-bold">{set.weight} <span className="text-[#8e8e93] font-normal text-xs">{unit}</span></span>
                : <span className="text-[#c7c7cc]">Bodyweight</span>}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}

// ─── Week strip ──────────────────────────────────────────────────────
function WeekStrip({ days, selectedDate, logs, onSelect }: {
  days: string[]; selectedDate: string; logs: WorkoutLog[]; onSelect: (d: string) => void
}) {
  const today = todayStr()
  return (
    <div className="bg-white rounded-2xl border border-[#e5e5ea] p-3 shadow-sm">
      <div className="flex gap-1">
        {days.map(date => {
          const log = logs.find(w => w.date === date)
          const isSelected = date === selectedDate
          const isToday = date === today
          const isFuture = date > today
          const dateNum = new Date(date + 'T00:00:00').getDate()
          return (
            <button key={date} onClick={() => !isFuture && onSelect(date)} disabled={isFuture}
              className={`flex-1 flex flex-col items-center py-2 rounded-xl transition-all ${isSelected ? 'bg-[#0071e3]' : isToday ? 'bg-[#0071e3]/8' : ''} ${isFuture ? 'opacity-25' : 'active:scale-95'}`}>
              <span className={`text-[10px] font-semibold ${isSelected ? 'text-white/80' : 'text-[#8e8e93]'}`}>{shortDay(date).slice(0, 3).toUpperCase()}</span>
              <span className={`text-sm font-bold mt-0.5 leading-none ${isSelected ? 'text-white' : isToday ? 'text-[#0071e3]' : 'text-[#1d1d1f]'}`}>{dateNum}</span>
              <div className="h-1.5 mt-1.5 flex items-center justify-center">
                {log && <div className={`w-1.5 h-1.5 rounded-full ${isSelected ? 'bg-white' : log.isRestDay ? 'bg-blue-300' : 'bg-[#30d158]'}`} />}
              </div>
            </button>
          )
        })}
      </div>
    </div>
  )
}

// ─── Weekly summary ──────────────────────────────────────────────────
function WeekSummary({ days, logs }: { days: string[]; logs: WorkoutLog[] }) {
  const today = todayStr()
  const hasAnyData = days.some(d => logs.find(l => l.date === d))
  if (!hasAnyData) return null
  return (
    <div className="bg-white rounded-2xl border border-[#e5e5ea] overflow-hidden shadow-sm">
      <p className="text-[#8e8e93] text-xs font-semibold uppercase tracking-wider px-4 pt-3 pb-2">This Week</p>
      <div className="divide-y divide-[#f5f5f7]">
        {days.map(date => {
          const log = logs.find(l => l.date === date)
          const isFuture = date > today
          if (isFuture && !log) return null
          const day = shortDay(date)
          const dateNum = new Date(date + 'T00:00:00').getDate()
          return (
            <div key={date} className="flex items-start gap-3 px-4 py-2.5">
              <div className="flex-shrink-0 text-right" style={{ width: 42 }}>
                <span className="text-[#8e8e93] text-xs font-semibold">{day}</span>
                <span className="text-[#c7c7cc] text-xs ml-1">{dateNum}</span>
              </div>
              <div className="flex-1 min-w-0">
                {!log ? <span className="text-[#c7c7cc] text-sm">—</span>
                  : log.isRestDay ? <span className="text-[#0071e3] text-xs font-semibold bg-blue-50 px-2 py-0.5 rounded-full">Rest</span>
                  : <span className="text-[#1d1d1f] text-sm leading-snug">
                      {log.exercises.map((e, i) => (
                        <span key={i}>{i > 0 && <span className="text-[#c7c7cc]"> · </span>}{e.name}</span>
                      ))}
                    </span>}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ─── Routine editor sheet ────────────────────────────────────────────
function RoutineEditorSheet({ routine, onSave, onClose }: {
  routine: WeeklyRoutine
  onSave: (r: WeeklyRoutine) => void
  onClose: () => void
}) {
  const [draft, setDraft] = useState<WeeklyRoutine>(() => {
    // Deep clone so edits don't mutate the prop
    const clone: WeeklyRoutine = {}
    for (let i = 0; i < 7; i++) {
      const day = routine[i]
      clone[i] = day
        ? { isRestDay: day.isRestDay, exercises: day.exercises.map(e => ({ ...e })), name: day.name }
        : { isRestDay: false, exercises: [] }
    }
    return clone
  })
  const [activeDay, setActiveDay] = useState(0)
  const [showPicker, setShowPicker] = useState(false)
  const [pickerQuery, setPickerQuery] = useState('')
  const [pendingCustomName, setPendingCustomName] = useState<string | null>(null)
  const [pendingCategory, setPendingCategory] = useState('')

  const day: RoutineDay = draft[activeDay] ?? { isRestDay: false, exercises: [] }

  function updateDay(updated: RoutineDay) {
    setDraft(prev => ({ ...prev, [activeDay]: updated }))
  }

  function toggleRest() {
    updateDay({ ...day, isRestDay: !day.isRestDay, exercises: !day.isRestDay ? [] : day.exercises })
  }

  function addExercise(name: string) {
    updateDay({ ...day, exercises: [...day.exercises, { name, setCount: 3 }] })
    setShowPicker(false)
    setPickerQuery('')
    setPendingCustomName(null)
    setPendingCategory('')
  }

  function handleAddCustom(name: string) {
    const alreadyCategorised = storage.getCustomExercises()[name.toLowerCase()]
    if (alreadyCategorised) {
      addExercise(name)
    } else {
      setShowPicker(false)
      setPickerQuery('')
      setPendingCustomName(name)
      setPendingCategory('')
    }
  }

  function confirmCustom() {
    if (!pendingCustomName) return
    if (pendingCategory) storage.saveCustomExercise(pendingCustomName, pendingCategory)
    addExercise(pendingCustomName)
  }

  function removeExercise(i: number) {
    updateDay({ ...day, exercises: day.exercises.filter((_, j) => j !== i) })
  }

  function changeSetCount(i: number, delta: number) {
    const updated = day.exercises.map((e, j) => j === i ? { ...e, setCount: Math.max(1, e.setCount + delta) } : e)
    updateDay({ ...day, exercises: updated })
  }

  return (
    <div className="fixed inset-0 z-50 flex flex-col justify-end">
      <div className="absolute inset-0 bg-black/30" onClick={onClose} />
      <div className="relative bg-white rounded-t-3xl max-h-[92vh] flex flex-col overflow-hidden shadow-2xl">
        {/* Handle */}
        <div className="flex justify-center pt-3 pb-1 flex-shrink-0"><div className="w-10 h-1 bg-[#e5e5ea] rounded-full" /></div>

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3 flex-shrink-0 border-b border-[#f5f5f7]">
          <div>
            <h3 className="text-[#1d1d1f] font-bold text-xl">Weekly Routine</h3>
            <p className="text-[#8e8e93] text-xs mt-0.5">Set your exercises once, log weights daily</p>
          </div>
          <button onClick={onClose} className="w-8 h-8 bg-[#f5f5f7] rounded-full flex items-center justify-center text-[#8e8e93]">
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none"><path d="M1 1l10 10M11 1L1 11" stroke="currentColor" strokeWidth="2" strokeLinecap="round" /></svg>
          </button>
        </div>

        {/* Day selector */}
        <div className="flex gap-1 px-4 pt-3 pb-2 flex-shrink-0">
          {DAY_NAMES.map((name, i) => {
            const d = draft[i] ?? { isRestDay: false, exercises: [] }
            const hasContent = !d.isRestDay ? d.exercises.length > 0 : true
            return (
              <button key={i} onClick={() => setActiveDay(i)}
                className={`flex-1 flex flex-col items-center py-2 rounded-xl transition-all ${activeDay === i ? 'bg-[#0071e3]' : 'bg-[#f5f5f7]'}`}>
                <span className={`text-[10px] font-semibold ${activeDay === i ? 'text-white/80' : 'text-[#8e8e93]'}`}>{name}</span>
                <div className="h-1.5 mt-1 flex items-center justify-center">
                  {hasContent && <div className={`w-1.5 h-1.5 rounded-full ${activeDay === i ? 'bg-white' : d.isRestDay ? 'bg-blue-300' : 'bg-[#30d158]'}`} />}
                </div>
              </button>
            )
          })}
        </div>

        {/* Day content */}
        <div className="flex-1 overflow-y-auto px-5 pb-6">

          {/* Rest day toggle */}
          <div className="flex items-center justify-between py-3 border-b border-[#f5f5f7] mb-3">
            <div>
              <p className="text-[#1d1d1f] font-semibold text-sm">Rest Day</p>
              <p className="text-[#8e8e93] text-xs">No exercises — recovery day</p>
            </div>
            <button onClick={toggleRest}
              className={`w-12 h-6 rounded-full transition-colors ${day.isRestDay ? 'bg-[#0071e3]' : 'bg-[#e5e5ea]'}`}>
              <div className={`w-5 h-5 bg-white rounded-full shadow transition-transform mx-0.5 ${day.isRestDay ? 'translate-x-6' : ''}`} />
            </button>
          </div>

          {/* Day name */}
          <div className="py-3 border-b border-[#f5f5f7] mb-3">
            <p className="text-[#8e8e93] text-xs font-semibold uppercase tracking-wider mb-1.5">
              Day Name <span className="text-[#c7c7cc] font-normal normal-case tracking-normal">(optional)</span>
            </p>
            <input
              type="text"
              value={day.name ?? ''}
              onChange={e => updateDay({ ...day, name: e.target.value || undefined })}
              placeholder={day.isRestDay ? 'e.g. Rest' : 'e.g. Push, Pull, Legs…'}
              maxLength={20}
              className="w-full bg-[#f5f5f7] border border-[#e5e5ea] rounded-xl px-4 py-2.5 text-[#1d1d1f] text-sm font-semibold outline-none placeholder-[#c7c7cc]"
            />
          </div>

          {!day.isRestDay && (
            <>
              {/* Exercise list grouped by muscle */}
              {day.exercises.length > 0 && (
                <div className="flex flex-col gap-1 mb-3">
                  {groupByCategory(day.exercises, e => e.name).map(group => (
                    <div key={group.category}>
                      <div className="flex items-center gap-1.5 px-0.5 py-1.5">
                        <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: CATEGORY_COLORS[group.category] ?? '#8e8e93' }} />
                        <span className="text-[#8e8e93] text-xs font-semibold uppercase tracking-wider">{group.category}</span>
                      </div>
                      <div className="flex flex-col gap-1.5">
                        {group.items.map(({ item: ex, idx: i }) => (
                          <div key={i} className="bg-[#f5f5f7] border border-[#e5e5ea] rounded-xl px-4 py-3 flex items-center gap-3">
                            <p className="flex-1 text-[#1d1d1f] font-semibold text-sm truncate">{ex.name}</p>
                            <div className="flex items-center gap-1">
                              <button onClick={() => changeSetCount(i, -1)}
                                className="w-7 h-7 bg-white border border-[#e5e5ea] rounded-full flex items-center justify-center text-[#8e8e93] font-bold text-base shadow-sm">−</button>
                              <span className="w-7 text-center text-[#1d1d1f] font-bold text-sm">{ex.setCount}</span>
                              <button onClick={() => changeSetCount(i, +1)}
                                className="w-7 h-7 bg-white border border-[#e5e5ea] rounded-full flex items-center justify-center text-[#8e8e93] font-bold text-base shadow-sm">+</button>
                              <span className="text-[#8e8e93] text-xs ml-1">sets</span>
                            </div>
                            <button onClick={() => removeExercise(i)} className="text-[#ff3b30] w-6 h-6 flex items-center justify-center">
                              <svg width="12" height="12" viewBox="0 0 12 12" fill="none"><path d="M1 1l10 10M11 1L1 11" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" /></svg>
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Add exercise */}
              {pendingCustomName ? (
                /* Step 2: pick muscle group for custom exercise */
                <div className="bg-[#f5f5f7] border border-[#e5e5ea] rounded-2xl p-4 mb-3">
                  <div className="mb-3">
                    <p className="text-[#1d1d1f] font-semibold text-sm">"{pendingCustomName}"</p>
                    <p className="text-[#8e8e93] text-xs mt-0.5">Which muscle group does this target?</p>
                  </div>
                  <div className="flex flex-wrap gap-1.5 mb-4">
                    {Object.keys(EXERCISE_LIBRARY).map(cat => (
                      <button
                        key={cat}
                        onClick={() => setPendingCategory(cat)}
                        className={`px-3 py-1.5 rounded-xl text-sm font-semibold border transition-all active:scale-95 ${
                          pendingCategory === cat ? 'text-white border-transparent' : 'bg-white border-[#e5e5ea] text-[#1d1d1f]'
                        }`}
                        style={pendingCategory === cat ? { backgroundColor: CATEGORY_COLORS[cat] } : undefined}
                      >
                        {cat}
                      </button>
                    ))}
                  </div>
                  <button
                    onClick={confirmCustom}
                    disabled={!pendingCategory}
                    className="w-full bg-[#0071e3] disabled:bg-[#e5e5ea] disabled:text-[#c7c7cc] text-white font-semibold py-2.5 rounded-xl text-sm mb-2 active:scale-95 transition-all"
                  >
                    Add to Routine
                  </button>
                  <button
                    onClick={() => { setPendingCustomName(null); setShowPicker(true) }}
                    className="w-full text-[#8e8e93] text-sm font-medium py-1"
                  >
                    ← Back to search
                  </button>
                </div>
              ) : showPicker ? (
                /* Step 1: search / browse exercises */
                <div className="bg-[#f5f5f7] border border-[#e5e5ea] rounded-2xl p-4 mb-3">
                  <div className="flex items-center gap-2 bg-white border border-[#e5e5ea] rounded-xl px-3 py-2.5 mb-3">
                    <svg width="13" height="13" fill="none" stroke="#8e8e93" strokeWidth="1.5" viewBox="0 0 24 24">
                      <circle cx="11" cy="11" r="8" /><path d="M21 21l-4.35-4.35" strokeLinecap="round" />
                    </svg>
                    <input type="text" value={pickerQuery} onChange={e => setPickerQuery(e.target.value)}
                      placeholder="Search exercises" autoFocus
                      className="flex-1 bg-transparent text-[#1d1d1f] text-sm outline-none placeholder-[#c7c7cc]" />
                    {pickerQuery && (
                      <button onClick={() => setPickerQuery('')} className="text-[#c7c7cc]">
                        <svg width="12" height="12" viewBox="0 0 12 12" fill="none"><path d="M1 1l10 10M11 1L1 11" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" /></svg>
                      </button>
                    )}
                  </div>
                  <ExercisePicker
                    query={pickerQuery}
                    onSelect={addExercise}
                    onAddCustom={handleAddCustom}
                  />
                  <button onClick={() => { setShowPicker(false); setPickerQuery('') }}
                    className="mt-3 w-full text-[#8e8e93] text-sm font-medium">Cancel</button>
                </div>
              ) : (
                <button onClick={() => setShowPicker(true)}
                  className="w-full py-3 border-2 border-dashed border-[#e5e5ea] rounded-xl text-[#0071e3] text-sm font-semibold flex items-center justify-center gap-1.5">
                  <span className="text-lg leading-none">+</span> Add Exercise
                </button>
              )}
            </>
          )}
        </div>

        {/* Save */}
        <div className="px-5 pb-8 pt-3 border-t border-[#f5f5f7] flex-shrink-0">
          <button onClick={() => { onSave(draft); onClose() }}
            className="w-full bg-[#30d158] text-white font-semibold py-4 rounded-2xl active:scale-95 transition-all">
            Save Routine
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Add / Edit exercise sheet ───────────────────────────────────────
function ExerciseSheet({ initial, weightUnit, onSave, onClose }: {
  initial?: { name: string; sets: WorkoutSet[]; weightUnit?: WeightUnit }
  weightUnit: WeightUnit
  onSave: (name: string, sets: WorkoutSet[], unit: WeightUnit) => void
  onClose: () => void
}) {
  const [exName, setExName] = useState(initial?.name ?? '')
  const [sets, setSets] = useState<WorkoutSet[]>(initial?.sets ?? [{ reps: 0 }, { reps: 0 }, { reps: 0 }])
  const [sheetWeightUnit, setSheetWeightUnit] = useState<WeightUnit>(initial?.weightUnit ?? weightUnit)
  const [showPicker, setShowPicker] = useState(!initial)
  const [customCategory, setCustomCategory] = useState<string>(() => {
    const name = initial?.name ?? ''
    if (!name || isInLibrary(name)) return ''
    return storage.getCustomExercises()[name.toLowerCase()] ?? ''
  })

  // Sync category state when exercise name changes
  useEffect(() => {
    const name = exName.trim()
    if (!name || isInLibrary(name)) { setCustomCategory(''); return }
    setCustomCategory(storage.getCustomExercises()[name.toLowerCase()] ?? '')
  }, [exName])

  const trimmedName = exName.trim()
  const needsCategoryPick = trimmedName.length > 0 && !isInLibrary(trimmedName)

  function handleSave() {
    const valid = sets.filter(s => s.reps > 0)
    if (!trimmedName || !valid.length) return
    if (needsCategoryPick && customCategory) {
      storage.saveCustomExercise(trimmedName, customCategory)
    }
    onSave(trimmedName, valid, sheetWeightUnit)
  }

  return (
    <div className="fixed inset-0 z-40 flex flex-col justify-end">
      <div className="absolute inset-0 bg-black/30" onClick={onClose} />
      <div className="relative bg-white rounded-t-3xl max-h-[92vh] flex flex-col overflow-hidden shadow-2xl">
        <div className="flex justify-center pt-3 pb-1 flex-shrink-0"><div className="w-10 h-1 bg-[#e5e5ea] rounded-full" /></div>
        <div className="flex items-center justify-between px-5 py-3 flex-shrink-0 border-b border-[#f5f5f7]">
          <h3 className="text-[#1d1d1f] font-bold text-xl">{initial ? 'Edit Exercise' : 'Add Exercise'}</h3>
          <button onClick={onClose} className="w-8 h-8 bg-[#f5f5f7] rounded-full flex items-center justify-center text-[#8e8e93]">
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none"><path d="M1 1l10 10M11 1L1 11" stroke="currentColor" strokeWidth="2" strokeLinecap="round" /></svg>
          </button>
        </div>
        <div className="overflow-y-auto flex-1 px-5 pb-10">
          <div className="flex flex-col gap-5 py-4">
            {/* Name field */}
            <div>
              <p className="text-[#8e8e93] text-xs font-semibold uppercase tracking-wider mb-2">Exercise</p>
              <div className="flex items-center gap-2 bg-[#f5f5f7] border border-[#e5e5ea] rounded-xl px-4 py-3">
                <svg width="14" height="14" fill="none" stroke="#8e8e93" strokeWidth="1.5" viewBox="0 0 24 24">
                  <circle cx="11" cy="11" r="8" /><path d="M21 21l-4.35-4.35" strokeLinecap="round" />
                </svg>
                <input type="text" value={exName} onChange={e => { setExName(e.target.value); setShowPicker(true) }}
                  onFocus={() => setShowPicker(true)} placeholder="Search or type exercise name" autoFocus={!initial}
                  className="flex-1 bg-transparent text-[#1d1d1f] font-semibold text-base outline-none placeholder-[#c7c7cc]" />
                {exName && <button onClick={() => { setExName(''); setShowPicker(true) }} className="text-[#c7c7cc]">
                  <svg width="14" height="14" viewBox="0 0 12 12" fill="none"><path d="M1 1l10 10M11 1L1 11" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" /></svg>
                </button>}
              </div>
              {exName && !showPicker && (
                <button onClick={() => setShowPicker(true)} className="mt-1.5 text-[#0071e3] text-xs font-medium px-1">Browse exercises</button>
              )}
            </div>

            {/* Exercise library picker */}
            {showPicker && (
              <div>
                <p className="text-[#8e8e93] text-xs font-semibold uppercase tracking-wider mb-3">{exName ? 'Matching exercises' : 'Browse by muscle'}</p>
                <ExercisePicker
                  query={exName}
                  onSelect={name => { setExName(name); setShowPicker(false) }}
                  onAddCustom={name => { setExName(name); setShowPicker(false) }}
                />
              </div>
            )}

            {/* Muscle group picker — only for custom (non-library) exercises */}
            {needsCategoryPick && !showPicker && (
              <div>
                <p className="text-[#8e8e93] text-xs font-semibold uppercase tracking-wider mb-2">Muscle Group</p>
                <div className="flex flex-wrap gap-1.5">
                  {Object.keys(EXERCISE_LIBRARY).map(cat => (
                    <button
                      key={cat}
                      onClick={() => setCustomCategory(cat)}
                      className={`px-3 py-1.5 rounded-xl text-sm font-semibold border transition-all active:scale-95 ${
                        customCategory === cat ? 'text-white border-transparent' : 'bg-[#f5f5f7] border-[#e5e5ea] text-[#1d1d1f]'
                      }`}
                      style={customCategory === cat ? { backgroundColor: CATEGORY_COLORS[cat] } : undefined}
                    >
                      {cat}
                    </button>
                  ))}
                </div>
                {!customCategory && (
                  <p className="text-[#c7c7cc] text-xs mt-2 px-0.5">Select a muscle group to categorise this exercise</p>
                )}
              </div>
            )}

            {/* Sets */}
            <div>
              <div className="flex items-center justify-between mb-3">
                <p className="text-[#8e8e93] text-xs font-semibold uppercase tracking-wider">Sets</p>
                <div className="flex bg-[#f5f5f7] rounded-lg p-0.5">
                  {(['kg', 'lbs'] as WeightUnit[]).map(u => (
                    <button key={u} onClick={() => setSheetWeightUnit(u)}
                      className={`px-3 py-1 rounded-md text-xs font-semibold transition-all ${sheetWeightUnit === u ? 'bg-white text-[#1d1d1f] shadow-sm' : 'text-[#8e8e93]'}`}>
                      {u}
                    </button>
                  ))}
                </div>
              </div>
              <div className="flex flex-col gap-2.5">
                {sets.map((set, i) => (
                  <SetRow key={i} set={set} index={i} weightUnit={sheetWeightUnit}
                    onChange={updated => setSets(prev => prev.map((s, j) => j === i ? updated : s))}
                    onDelete={() => setSets(prev => prev.filter((_, j) => j !== i))} />
                ))}
              </div>
              <button onClick={() => { const last = sets[sets.length - 1]; setSets(prev => [...prev, { reps: 0, weight: last.weight }]) }}
                className="mt-3 w-full py-2.5 border border-dashed border-[#c7c7cc] text-[#8e8e93] rounded-xl text-sm">
                + Add set
              </button>
            </div>

            <button onClick={handleSave}
              disabled={!trimmedName || !sets.some(s => s.reps > 0)}
              className="w-full bg-[#0071e3] disabled:bg-[#e5e5ea] disabled:text-[#c7c7cc] text-white font-semibold py-4 rounded-2xl active:scale-95 transition-all">
              {initial ? 'Update Exercise' : 'Add to Workout'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── Main screen ─────────────────────────────────────────────────────
export default function LogWorkout() {
  const [selectedDate, setSelectedDate] = useState(todayStr())
  const [, setRefresh] = useState(0)
  const [draftExercises, setDraftExercises] = useState<DraftExercise[]>([])
  const [showRoutineEditor, setShowRoutineEditor] = useState(false)
  // sheet: null = closed, { mode:'add' } = adding new, { mode:'edit', index } = editing existing, { mode:'swap', draftIndex } = swapping draft name
  const [sheet, setSheet] = useState<
    null
    | { mode: 'add' }
    | { mode: 'edit'; index: number; exercise: Exercise }
    | { mode: 'swap'; draftIndex: number; name: string; sets: WorkoutSet[]; weightUnit: WeightUnit }
  >(null)

  const profile = storage.getProfile()
  const [workoutUnit, setWorkoutUnit] = useState<WeightUnit>(profile?.weightUnit ?? 'kg')

  const allLogs = storage.getWorkoutLogs()
  const log = allLogs.find(w => w.date === selectedDate)
  const weekDays = getWeekDays(selectedDate)

  const hasExercises = !!log && !log.isRestDay && log.exercises.length > 0
  const isDrafting = !log && draftExercises.length > 0
  const totalSets = log?.exercises.reduce((s, e) => s + e.sets.length, 0) ?? 0
  const totalVolume = log?.exercises.reduce((s, e) => s + e.sets.reduce((ss, set) => ss + set.reps * (set.weight ?? 0), 0), 0) ?? 0

  // Auto-populate from routine when date changes and day is unlogged
  useEffect(() => {
    const currentLog = storage.getWorkoutLogs().find(w => w.date === selectedDate)
    if (currentLog) { setDraftExercises([]); return }
    const routine = storage.getRoutine()
    const dayIdx = weekdayIndex(selectedDate)
    const routineDay = routine[dayIdx]
    if (!routineDay) { setDraftExercises([]); return }
    if (routineDay.isRestDay) {
      storage.saveWorkoutLog({ id: uid(), date: selectedDate, isRestDay: true, exercises: [] })
      setRefresh(r => r + 1)
      setDraftExercises([])
    } else {
      setDraftExercises(routineDay.exercises.map(e => ({
        name: e.name,
        sets: Array.from({ length: e.setCount }, () => ({ reps: 0 })),
        weightUnit: profile?.weightUnit ?? 'kg',
      })))
    }
  }, [selectedDate])

  function saveDraft() {
    const exercises: Exercise[] = draftExercises
      .map(d => ({ name: d.name, sets: d.sets.filter(s => s.reps > 0), weightUnit: d.weightUnit }))
      .filter(e => e.sets.length > 0)
    if (!exercises.length) return
    storage.saveWorkoutLog({ id: uid(), date: selectedDate, isRestDay: false, exercises })
    setDraftExercises([])
    setRefresh(r => r + 1)
  }

  function logRestDay() {
    storage.saveWorkoutLog({ id: log?.id ?? uid(), date: selectedDate, isRestDay: true, exercises: [] })
    setDraftExercises([])
    setRefresh(r => r + 1)
  }

  function clearLog() {
    storage.deleteWorkoutLog(selectedDate)
    setRefresh(r => r + 1)
    // Re-trigger routine population
    const routine = storage.getRoutine()
    const dayIdx = weekdayIndex(selectedDate)
    const routineDay = routine[dayIdx]
    if (routineDay && !routineDay.isRestDay) {
      setDraftExercises(routineDay.exercises.map(e => ({
        name: e.name,
        sets: Array.from({ length: e.setCount }, () => ({ reps: 0 })),
        weightUnit: profile?.weightUnit ?? 'kg',
      })))
    } else {
      setDraftExercises([])
    }
  }

  function deleteExercise(index: number) {
    if (!log) return
    const exercises = log.exercises.filter((_, i) => i !== index)
    if (exercises.length === 0) storage.deleteWorkoutLog(selectedDate)
    else storage.saveWorkoutLog({ ...log, exercises })
    setRefresh(r => r + 1)
  }

  function handleSheetSave(name: string, sets: WorkoutSet[], unit: WeightUnit) {
    if (!sheet) return
    if (sheet.mode === 'add') {
      if (isDrafting || !log) {
        setDraftExercises(prev => [...prev, { name, sets, weightUnit: unit }])
      } else {
        storage.saveWorkoutLog({
          id: log!.id, date: selectedDate, isRestDay: false,
          exercises: [...log!.exercises, { name, sets, weightUnit: unit }],
        })
        setRefresh(r => r + 1)
      }
    } else if (sheet.mode === 'edit') {
      const updated = log!.exercises.map((e, i) => i === sheet.index ? { name, sets, weightUnit: unit } : e)
      storage.saveWorkoutLog({ ...log!, exercises: updated })
      setRefresh(r => r + 1)
    } else if (sheet.mode === 'swap') {
      setDraftExercises(prev => prev.map((d, i) => i === sheet.draftIndex ? { name, sets, weightUnit: unit } : d))
    }
    setSheet(null)
  }

  function editWorkout() {
    if (!log) return
    // Convert saved exercises back to editable drafts, preserving all entered data
    const drafts: DraftExercise[] = log.exercises.map(e => ({
      name: e.name,
      sets: e.sets.length ? [...e.sets] : [{ reps: 0 }],
      weightUnit: e.weightUnit ?? workoutUnit,
    }))
    // Re-append any routine exercises not yet logged
    const routine = storage.getRoutine()
    const dayIdx = weekdayIndex(selectedDate)
    const routineDay = routine[dayIdx]
    if (routineDay && !routineDay.isRestDay) {
      const loggedNames = new Set(log.exercises.map(e => e.name.toLowerCase()))
      for (const re of routineDay.exercises) {
        if (!loggedNames.has(re.name.toLowerCase())) {
          drafts.push({ name: re.name, sets: Array.from({ length: re.setCount }, () => ({ reps: 0 })), weightUnit: profile?.weightUnit ?? 'kg' })
        }
      }
    }
    storage.deleteWorkoutLog(selectedDate)
    setDraftExercises(drafts)
    setRefresh(r => r + 1)
  }

  function saveRoutine(r: WeeklyRoutine) {
    storage.saveRoutine(r)
  }

  const canSaveDraft = draftExercises.some(d => d.sets.some(s => s.reps > 0))

  return (
    <div className="flex flex-col h-full bg-[#f5f5f7]">
      {/* Header */}
      <div className="px-4 pt-14 pb-3 flex-shrink-0">
        <div className="flex items-center justify-between mb-0.5">
          <h1 className="text-[28px] font-bold text-[#1d1d1f] tracking-tight">Workout</h1>
          <div className="flex items-center gap-2">
            {/* Routine editor button */}
            <button onClick={() => setShowRoutineEditor(true)}
              className="flex items-center gap-1.5 bg-white border border-[#e5e5ea] px-3 py-1.5 rounded-xl shadow-sm">
              <svg width="14" height="14" fill="none" stroke="#8e8e93" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">
                <rect x="3" y="4" width="18" height="4" rx="1" />
                <rect x="3" y="10" width="18" height="4" rx="1" />
                <rect x="3" y="16" width="18" height="4" rx="1" />
              </svg>
              <span className="text-[#1d1d1f] text-sm font-medium">Routine</span>
            </button>
            {/* Date picker */}
            <button onClick={() => (document.getElementById('workout-date-input') as HTMLInputElement)?.showPicker?.()}
              className="flex items-center gap-1.5 bg-white border border-[#e5e5ea] px-3 py-1.5 rounded-xl shadow-sm">
              <svg width="14" height="14" fill="none" stroke="#8e8e93" strokeWidth="1.5" viewBox="0 0 24 24">
                <rect x="3" y="4" width="18" height="18" rx="2" />
                <path d="M16 2v4M8 2v4M3 10h18" strokeLinecap="round" />
              </svg>
              <span className="text-[#1d1d1f] text-sm font-medium">
                {new Date(selectedDate + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
              </span>
              <span className="text-[#8e8e93] text-xs">▾</span>
            </button>
          </div>
          <input id="workout-date-input" type="date" value={selectedDate} max={todayStr()}
            onChange={e => { if (e.target.value) setSelectedDate(e.target.value) }}
            className="absolute opacity-0 pointer-events-none w-0 h-0" />
        </div>
        <div className="flex items-center justify-between">
          <p className="text-[#8e8e93] text-sm">{formatFullDate(selectedDate)}</p>
          <div className="flex bg-[#f0f0f5] rounded-lg p-0.5">
            {(['kg', 'lbs'] as WeightUnit[]).map(u => (
              <button key={u} onClick={() => setWorkoutUnit(u)}
                className={`px-2.5 py-1 rounded-md text-xs font-semibold transition-all ${workoutUnit === u ? 'bg-white text-[#1d1d1f] shadow-sm' : 'text-[#8e8e93]'}`}>
                {u}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Scrollable content */}
      <div className="flex-1 overflow-y-auto px-4 pb-36 flex flex-col gap-3">
        <WeekStrip days={weekDays} selectedDate={selectedDate} logs={allLogs} onSelect={setSelectedDate} />
        <WeekSummary days={weekDays} logs={allLogs} />

        {/* Summary strip (logged state) */}
        {hasExercises && (
          <div className="bg-white rounded-xl border border-[#e5e5ea] px-4 py-2.5 flex items-center gap-3 shadow-sm">
            <div className="flex-1 text-center">
              <p className="text-[#1d1d1f] font-bold text-lg leading-none">{log!.exercises.length}</p>
              <p className="text-[#8e8e93] text-[11px] mt-0.5">exercises</p>
            </div>
            <div className="w-px h-8 bg-[#e5e5ea]" />
            <div className="flex-1 text-center">
              <p className="text-[#0071e3] font-bold text-lg leading-none">{totalSets}</p>
              <p className="text-[#8e8e93] text-[11px] mt-0.5">sets</p>
            </div>
            <div className="w-px h-8 bg-[#e5e5ea]" />
            <div className="flex-1 text-center">
              <p className="text-[#30d158] font-bold text-lg leading-none">{totalVolume.toLocaleString()}</p>
              <p className="text-[#8e8e93] text-[11px] mt-0.5">{workoutUnit} vol</p>
            </div>
          </div>
        )}

        {/* Drafting banner */}
        {isDrafting && (
          <div className="bg-[#0071e3]/8 border border-[#0071e3]/20 rounded-xl px-4 py-2.5 flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-[#0071e3] animate-pulse flex-shrink-0" />
            <p className="text-[#0071e3] text-sm font-medium">Routine loaded — fill in your weights, sets and reps</p>
          </div>
        )}

        {/* Day content */}
        {log?.isRestDay ? (
          <div className="bg-blue-50 border border-blue-100 rounded-2xl px-5 py-7 flex flex-col items-center gap-3 text-center">
            <div className="w-14 h-14 bg-white border border-blue-100 rounded-full flex items-center justify-center shadow-sm">
              <svg width="26" height="26" fill="none" stroke="#0071e3" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">
                <path d="M12 3a6 6 0 009 9 9 9 0 11-9-9z" />
              </svg>
            </div>
            <div>
              <p className="text-[#1d1d1f] font-bold text-lg">Rest Day</p>
              <p className="text-[#6e6e73] text-sm mt-0.5">Recovery is part of the process.</p>
            </div>
            <button onClick={clearLog} className="text-[#0071e3] text-sm font-medium underline underline-offset-2">Switch to workout day</button>
          </div>
        ) : isDrafting ? (
          <div className="flex flex-col gap-2">
            {groupByCategory(draftExercises, d => d.name).map(group => (
              <div key={group.category}>
                <CategoryHeader category={group.category} count={group.items.length} />
                <div className="flex flex-col gap-2">
                  {group.items.map(({ item: d, idx: i }) => (
                    <EditableExerciseCard key={i} draft={d} index={i}
                      onChange={updated => setDraftExercises(prev => prev.map((x, j) => j === i ? updated : x))}
                      onRemove={() => setDraftExercises(prev => prev.filter((_, j) => j !== i))}
                      onSwapName={idx => setSheet({ mode: 'swap', draftIndex: idx, name: d.name, sets: d.sets, weightUnit: d.weightUnit })}
                    />
                  ))}
                </div>
              </div>
            ))}
          </div>
        ) : hasExercises ? (
          <div className="flex flex-col gap-2">
            {/* Edit banner — visible at top of saved workout */}
            <button
              onClick={editWorkout}
              className="bg-[#0071e3]/8 border border-[#0071e3]/20 rounded-xl px-4 py-3 flex items-center gap-3 w-full text-left active:bg-[#0071e3]/15 transition-colors"
            >
              <div className="flex-1">
                <p className="text-[#0071e3] text-sm font-semibold">Workout saved — {log!.exercises.length} exercise{log!.exercises.length !== 1 ? 's' : ''} logged</p>
                <p className="text-[#0071e3]/70 text-xs mt-0.5">Tap to edit or add remaining exercises</p>
              </div>
              <svg width="16" height="16" fill="none" stroke="#0071e3" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24" className="flex-shrink-0">
                <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7" />
                <path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z" />
              </svg>
            </button>
            {groupByCategory(log!.exercises, e => e.name).map(group => (
              <div key={group.category}>
                <CategoryHeader category={group.category} count={group.items.length} />
                <div className="flex flex-col gap-2">
                  {group.items.map(({ item: exercise, idx: i }) => (
                    <ExerciseCard key={i} exercise={exercise} weightUnit={workoutUnit}
                      onDelete={() => deleteExercise(i)}
                      onEdit={() => setSheet({ mode: 'edit', index: i, exercise })}
                    />
                  ))}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-10 gap-3">
            <div className="w-16 h-16 bg-white border border-[#e5e5ea] rounded-2xl flex items-center justify-center shadow-sm">
              <svg width="32" height="32" fill="none" stroke="#c7c7cc" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">
                <path d="M6 4v16M18 4v16M3 8h4M17 8h4M3 16h4M17 16h4" />
              </svg>
            </div>
            <p className="text-[#8e8e93] text-sm">Nothing logged for this day</p>
          </div>
        )}
      </div>

      {/* Action buttons */}
      {!log?.isRestDay && (
        <div className="fixed bottom-20 inset-x-4 flex gap-3 z-20">
          {isDrafting ? (
            <>
              <button onClick={() => setSheet({ mode: 'add' })}
                className="bg-white border border-[#e5e5ea] text-[#0071e3] font-semibold py-3.5 px-5 rounded-2xl shadow-sm active:scale-95 transition-transform">
                + Exercise
              </button>
              <button onClick={saveDraft} disabled={!canSaveDraft}
                className="flex-1 bg-[#30d158] disabled:bg-[#e5e5ea] disabled:text-[#c7c7cc] text-white font-semibold py-3.5 rounded-2xl shadow-md active:scale-95 transition-transform">
                Save Workout
              </button>
            </>
          ) : (
            <>
              {!hasExercises && (
                <button onClick={logRestDay}
                  className="flex-1 bg-white border border-[#e5e5ea] text-[#6e6e73] font-semibold py-3.5 rounded-2xl shadow-sm active:scale-95 transition-transform">
                  Rest Day
                </button>
              )}
              <button onClick={() => setSheet({ mode: 'add' })}
                className="flex-1 bg-[#0071e3] text-white font-semibold py-3.5 rounded-2xl shadow-md active:scale-95 transition-transform">
                + Exercise
              </button>
            </>
          )}
        </div>
      )}

      {/* Exercise sheet */}
      {sheet && (
        <ExerciseSheet
          initial={
            sheet.mode === 'edit' ? { name: sheet.exercise.name, sets: sheet.exercise.sets, weightUnit: sheet.exercise.weightUnit }
            : sheet.mode === 'swap' ? { name: sheet.name, sets: sheet.sets, weightUnit: sheet.weightUnit }
            : undefined
          }
          weightUnit={workoutUnit}
          onSave={handleSheetSave}
          onClose={() => setSheet(null)}
        />
      )}

      {/* Routine editor */}
      {showRoutineEditor && (
        <RoutineEditorSheet
          routine={storage.getRoutine()}
          onSave={saveRoutine}
          onClose={() => setShowRoutineEditor(false)}
        />
      )}
    </div>
  )
}
