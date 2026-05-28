import { useState } from 'react'
import { storage } from '../lib/storage'
import { supabase } from '../lib/supabase'
import { calculateGoals, kgToLbs, lbsToKg, cmToFtIn, ftInToCm } from '../lib/calories'
import type { Goal, Gender, WeightUnit, HeightUnit, DietPreference } from '../types'

const GOAL_OPTIONS: { value: Goal; label: string; sub: string }[] = [
  { value: 'lose_weight', label: 'Lose Weight', sub: 'Calorie deficit' },
  { value: 'gain_weight', label: 'Gain Weight', sub: 'Calorie surplus' },
  { value: 'gain_muscle', label: 'Build Muscle', sub: 'High protein' },
  { value: 'maintenance', label: 'Maintenance', sub: 'Stay at TDEE' },
]

const DIET_OPTIONS: { value: DietPreference; label: string }[] = [
  { value: 'non_vegetarian', label: 'Non-Veg' },
  { value: 'vegetarian', label: 'Vegetarian' },
  { value: 'pescetarian', label: 'Pescetarian' },
  { value: 'vegan', label: 'Vegan' },
]

function Avatar({ name }: { name: string }) {
  const initials = name.trim().split(' ').filter(Boolean).map(w => w[0]).slice(0, 2).join('').toUpperCase()
  return (
    <div className="w-20 h-20 rounded-full bg-gradient-to-br from-[#30d158] to-[#0071e3] flex items-center justify-center shadow-lg">
      <span className="text-white text-2xl font-bold tracking-wide">{initials || '?'}</span>
    </div>
  )
}

function SectionLabel({ children }: { children: string }) {
  return <p className="text-[#8e8e93] text-xs font-semibold uppercase tracking-wider px-1 mb-2">{children}</p>
}

function FieldRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center px-4 py-3 gap-3 border-t border-[#f5f5f7] first:border-0">
      <span className="text-[#6e6e73] text-sm w-24 flex-shrink-0">{label}</span>
      <div className="flex-1 flex justify-end">{children}</div>
    </div>
  )
}

function TextInput({ value, onChange, placeholder }: { value: string; onChange: (v: string) => void; placeholder?: string }) {
  return (
    <input
      type="text"
      value={value}
      onChange={e => onChange(e.target.value)}
      placeholder={placeholder}
      className="text-[#1d1d1f] font-semibold text-sm text-right bg-transparent outline-none w-full placeholder-[#c7c7cc]"
    />
  )
}

function NumberInput({ value, onChange, placeholder }: { value: string; onChange: (v: string) => void; placeholder?: string }) {
  return (
    <input
      type="number"
      inputMode="decimal"
      value={value}
      onChange={e => onChange(e.target.value)}
      placeholder={placeholder}
      className="text-[#1d1d1f] font-semibold text-sm text-right bg-transparent outline-none w-20 placeholder-[#c7c7cc]"
    />
  )
}

function UnitToggle<T extends string>({ options, value, onChange }: { options: T[]; value: T; onChange: (v: T) => void }) {
  return (
    <div className="flex bg-[#f5f5f7] rounded-lg p-0.5">
      {options.map(opt => (
        <button
          key={opt}
          onClick={() => onChange(opt)}
          className={`px-3 py-1 rounded-md text-xs font-semibold transition-all ${
            value === opt ? 'bg-white text-[#1d1d1f] shadow-sm' : 'text-[#8e8e93]'
          }`}
        >
          {opt}
        </button>
      ))}
    </div>
  )
}

function MacroInput({ label, value, onChange, color }: { label: string; value: string; onChange: (v: string) => void; color: string }) {
  return (
    <div className="flex-1 bg-[#f5f5f7] rounded-xl px-3 py-3 flex flex-col items-center gap-1">
      <span className={`text-[10px] font-bold uppercase tracking-wider ${color}`}>{label}</span>
      <input
        type="number"
        inputMode="numeric"
        value={value}
        onChange={e => onChange(e.target.value)}
        className="w-full text-center text-[#1d1d1f] font-bold text-base bg-transparent outline-none"
      />
      <span className="text-[#8e8e93] text-[10px]">g</span>
    </div>
  )
}

export default function Profile() {
  const stored = storage.getProfile()!
  if (!stored) return <div className="flex items-center justify-center h-full text-[#8e8e93]">No profile found.</div>

  const ftIn = cmToFtIn(stored.heightCm)
  const [name, setName] = useState(stored.name)
  const [goal, setGoal] = useState<Goal>(stored.goal)
  const [gender, setGender] = useState<Gender>(stored.gender)
  const [age, setAge] = useState(String(stored.age))
  const [weightUnit, setWeightUnit] = useState<WeightUnit>(stored.weightUnit)
  const [weightDisplay, setWeightDisplay] = useState(
    stored.weightUnit === 'lbs' ? String(kgToLbs(stored.weight)) : String(stored.weight)
  )
  const [heightUnit, setHeightUnit] = useState<HeightUnit>(stored.heightUnit)
  const [heightCm, setHeightCm] = useState(String(stored.heightCm))
  const [heightFt, setHeightFt] = useState(String(ftIn.ft))
  const [heightIn, setHeightIn] = useState(String(ftIn.inches))
  const [diet, setDiet] = useState<DietPreference>(stored.dietPreference)
  const [calorieGoal, setCalorieGoal] = useState(String(stored.calorieGoal))
  const [proteinGoal, setProteinGoal] = useState(String(stored.proteinGoal))
  const [carbsGoal, setCarbsGoal] = useState(String(stored.carbsGoal))
  const [fatGoal, setFatGoal] = useState(String(stored.fatGoal))
  const [saved, setSaved] = useState(false)

  const goalLabel = GOAL_OPTIONS.find(g => g.value === goal)?.label ?? ''
  const dietLabel = DIET_OPTIONS.find(d => d.value === diet)?.label ?? ''

  function handleWeightUnitChange(u: WeightUnit) {
    const current = parseFloat(weightDisplay)
    if (!isNaN(current)) {
      setWeightDisplay(u === 'lbs' ? String(kgToLbs(current)) : String(lbsToKg(current)))
    }
    setWeightUnit(u)
  }

  function handleHeightUnitChange(u: HeightUnit) {
    if (u === 'ft' && heightUnit === 'cm') {
      const cm = parseFloat(heightCm) || stored.heightCm
      const { ft, inches } = cmToFtIn(cm)
      setHeightFt(String(ft))
      setHeightIn(String(inches))
    } else if (u === 'cm' && heightUnit === 'ft') {
      const cm = ftInToCm(parseInt(heightFt) || 0, parseInt(heightIn) || 0)
      setHeightCm(String(cm))
    }
    setHeightUnit(u)
  }

  function recalculate() {
    const wKg = weightUnit === 'lbs' ? lbsToKg(parseFloat(weightDisplay) || stored.weight) : (parseFloat(weightDisplay) || stored.weight)
    const hCm = heightUnit === 'ft'
      ? ftInToCm(parseInt(heightFt) || 0, parseInt(heightIn) || 0)
      : (parseFloat(heightCm) || stored.heightCm)
    const goals = calculateGoals(gender, parseInt(age) || stored.age, wKg, hCm, goal)
    setCalorieGoal(String(goals.calorieGoal))
    setProteinGoal(String(goals.proteinGoal))
    setCarbsGoal(String(goals.carbsGoal))
    setFatGoal(String(goals.fatGoal))
  }

  function save() {
    const wKg = weightUnit === 'lbs' ? lbsToKg(parseFloat(weightDisplay) || stored.weight) : (parseFloat(weightDisplay) || stored.weight)
    const hCm = heightUnit === 'ft'
      ? ftInToCm(parseInt(heightFt) || 0, parseInt(heightIn) || 0)
      : (parseFloat(heightCm) || stored.heightCm)
    storage.saveProfile({
      ...stored,
      onboardingComplete: true,
      name: name.trim() || stored.name,
      goal,
      gender,
      age: parseInt(age) || stored.age,
      weight: wKg,
      weightUnit,
      heightCm: hCm,
      heightUnit,
      dietPreference: diet,
      calorieGoal: parseInt(calorieGoal) || stored.calorieGoal,
      proteinGoal: parseInt(proteinGoal) || stored.proteinGoal,
      carbsGoal: parseInt(carbsGoal) || stored.carbsGoal,
      fatGoal: parseInt(fatGoal) || stored.fatGoal,
    })
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  return (
    <div className="flex flex-col h-full bg-[#f5f5f7] overflow-y-auto">
      {/* Header */}
      <div className="px-4 pt-14 pb-4">
        <h1 className="text-[28px] font-bold text-[#1d1d1f] tracking-tight">Profile</h1>
      </div>

      <div className="px-4 pb-32 flex flex-col gap-5">

        {/* Avatar card */}
        <div className="bg-white rounded-2xl border border-[#e5e5ea] px-5 py-6 flex flex-col items-center gap-3 shadow-sm">
          <Avatar name={name} />
          <div className="text-center">
            <p className="text-[#1d1d1f] font-bold text-xl leading-tight">{name || 'Your Name'}</p>
            <p className="text-[#8e8e93] text-sm mt-1">{goalLabel} · {dietLabel}</p>
          </div>
        </div>

        {/* Personal */}
        <div>
          <SectionLabel>Personal</SectionLabel>
          <div className="bg-white rounded-2xl border border-[#e5e5ea] shadow-sm">
            <FieldRow label="Name">
              <TextInput value={name} onChange={setName} placeholder="Your name" />
            </FieldRow>
            <FieldRow label="Age">
              <div className="flex items-center gap-1">
                <NumberInput value={age} onChange={setAge} placeholder="–" />
                <span className="text-[#8e8e93] text-sm">yrs</span>
              </div>
            </FieldRow>
            <FieldRow label="Gender">
              <UnitToggle options={['male', 'female'] as Gender[]} value={gender} onChange={setGender} />
            </FieldRow>
          </div>
        </div>

        {/* Body */}
        <div>
          <SectionLabel>Body</SectionLabel>
          <div className="bg-white rounded-2xl border border-[#e5e5ea] shadow-sm">
            <FieldRow label="Weight">
              <div className="flex items-center gap-2">
                <NumberInput value={weightDisplay} onChange={setWeightDisplay} placeholder="–" />
                <UnitToggle options={['kg', 'lbs'] as WeightUnit[]} value={weightUnit} onChange={handleWeightUnitChange} />
              </div>
            </FieldRow>
            <FieldRow label="Height">
              <div className="flex items-center gap-2">
                {heightUnit === 'cm' ? (
                  <div className="flex items-center gap-1">
                    <NumberInput value={heightCm} onChange={setHeightCm} placeholder="–" />
                    <span className="text-[#8e8e93] text-sm">cm</span>
                  </div>
                ) : (
                  <div className="flex items-center gap-1">
                    <NumberInput value={heightFt} onChange={setHeightFt} placeholder="–" />
                    <span className="text-[#8e8e93] text-sm">ft</span>
                    <NumberInput value={heightIn} onChange={setHeightIn} placeholder="–" />
                    <span className="text-[#8e8e93] text-sm">in</span>
                  </div>
                )}
                <UnitToggle options={['cm', 'ft'] as HeightUnit[]} value={heightUnit} onChange={handleHeightUnitChange} />
              </div>
            </FieldRow>
          </div>
        </div>

        {/* Goal */}
        <div>
          <SectionLabel>Goal</SectionLabel>
          <div className="grid grid-cols-2 gap-2">
            {GOAL_OPTIONS.map(opt => (
              <button
                key={opt.value}
                onClick={() => setGoal(opt.value)}
                className={`rounded-2xl border px-4 py-3.5 text-left transition-all active:scale-95 ${
                  goal === opt.value
                    ? 'bg-[#30d158]/10 border-[#30d158]'
                    : 'bg-white border-[#e5e5ea]'
                }`}
              >
                <div className="flex items-start justify-between">
                  <div>
                    <p className={`text-sm font-semibold ${goal === opt.value ? 'text-[#1d1d1f]' : 'text-[#1d1d1f]'}`}>{opt.label}</p>
                    <p className="text-[#8e8e93] text-xs mt-0.5">{opt.sub}</p>
                  </div>
                  {goal === opt.value && (
                    <div className="w-5 h-5 rounded-full bg-[#30d158] flex items-center justify-center flex-shrink-0 mt-0.5">
                      <svg width="10" height="10" viewBox="0 0 12 12" fill="none">
                        <path d="M2 6l3 3 5-5" stroke="white" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    </div>
                  )}
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* Diet */}
        <div>
          <SectionLabel>Diet Preference</SectionLabel>
          <div className="grid grid-cols-2 gap-2">
            {DIET_OPTIONS.map(opt => (
              <button
                key={opt.value}
                onClick={() => setDiet(opt.value)}
                className={`rounded-2xl border px-4 py-3 text-left transition-all active:scale-95 flex items-center justify-between ${
                  diet === opt.value
                    ? 'bg-[#0071e3]/8 border-[#0071e3]'
                    : 'bg-white border-[#e5e5ea]'
                }`}
              >
                <span className={`text-sm font-semibold ${diet === opt.value ? 'text-[#0071e3]' : 'text-[#1d1d1f]'}`}>{opt.label}</span>
                {diet === opt.value && (
                  <div className="w-5 h-5 rounded-full bg-[#0071e3] flex items-center justify-center flex-shrink-0">
                    <svg width="10" height="10" viewBox="0 0 12 12" fill="none">
                      <path d="M2 6l3 3 5-5" stroke="white" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </div>
                )}
              </button>
            ))}
          </div>
        </div>

        {/* Targets */}
        <div>
          <div className="flex items-center justify-between px-1 mb-2">
            <SectionLabel>Daily Targets</SectionLabel>
            <button
              onClick={recalculate}
              className="text-[#0071e3] text-xs font-semibold"
            >
              Recalculate
            </button>
          </div>
          <div className="bg-white rounded-2xl border border-[#e5e5ea] shadow-sm">
            <FieldRow label="Calories">
              <div className="flex items-center gap-1">
                <input
                  type="number"
                  inputMode="numeric"
                  value={calorieGoal}
                  onChange={e => setCalorieGoal(e.target.value)}
                  className="text-[#1d1d1f] font-bold text-base text-right bg-transparent outline-none w-20"
                />
                <span className="text-[#8e8e93] text-sm">kcal</span>
              </div>
            </FieldRow>
            <div className="px-4 py-3 border-t border-[#f5f5f7]">
              <p className="text-[#6e6e73] text-sm mb-3">Macros</p>
              <div className="flex gap-2">
                <MacroInput label="Protein" value={proteinGoal} onChange={setProteinGoal} color="text-[#0071e3]" />
                <MacroInput label="Carbs" value={carbsGoal} onChange={setCarbsGoal} color="text-[#ff9500]" />
                <MacroInput label="Fat" value={fatGoal} onChange={setFatGoal} color="text-[#ff453a]" />
              </div>
            </div>
          </div>
        </div>

        {/* Save button */}
        <button
          onClick={save}
          className={`w-full font-semibold py-4 rounded-2xl transition-all active:scale-95 shadow-sm ${
            saved ? 'bg-[#30d158] text-white' : 'bg-[#1d1d1f] text-white'
          }`}
        >
          {saved ? 'Saved' : 'Save Changes'}
        </button>

        {/* Sign out */}
        <button
          onClick={async () => {
            await supabase.auth.signOut()
            localStorage.clear()
            window.location.reload()
          }}
          className="w-full font-semibold py-4 rounded-2xl border border-[#ff3b30]/30 text-[#ff3b30] bg-[#ff3b30]/5 active:scale-95 transition-all"
        >
          Sign Out
        </button>

      </div>
    </div>
  )
}
