import { useState } from 'react'
import type { Goal, Gender, WeightUnit, HeightUnit, DietPreference, UserProfile } from '../types'
import { storage } from '../lib/storage'
import { calculateGoals, lbsToKg, ftInToCm } from '../lib/calories'

interface OnboardingProps { onComplete: () => void }

const TOTAL_STEPS = 8

export default function Onboarding({ onComplete }: OnboardingProps) {
  const [step, setStep] = useState(0)
  const [goal, setGoal] = useState<Goal | null>(null)
  const [gender, setGender] = useState<Gender | null>(null)
  const [age, setAge] = useState('')
  const [weight, setWeight] = useState('')
  const [weightUnit, setWeightUnit] = useState<WeightUnit>('kg')
  const [heightFt, setHeightFt] = useState('')
  const [heightIn, setHeightIn] = useState('0')
  const [heightCm, setHeightCm] = useState('')
  const [heightUnit, setHeightUnit] = useState<HeightUnit>('cm')
  const [diet, setDiet] = useState<DietPreference | null>(null)
  const [name, setName] = useState('')

  function next() { setStep(s => s + 1) }
  function back() { setStep(s => s - 1) }

  function finish() {
    const weightKg = weightUnit === 'kg' ? parseFloat(weight) : lbsToKg(parseFloat(weight))
    const finalHeightCm = heightUnit === 'cm' ? parseFloat(heightCm) : ftInToCm(parseInt(heightFt), parseInt(heightIn))
    const { calorieGoal, proteinGoal, carbsGoal, fatGoal } = calculateGoals(gender!, parseInt(age), weightKg, finalHeightCm, goal!)
    const profile: UserProfile = {
      name, goal: goal!, gender: gender!, age: parseInt(age), weight: parseFloat(weight),
      weightUnit, heightCm: finalHeightCm, heightUnit, dietPreference: diet!,
      calorieGoal, proteinGoal, carbsGoal, fatGoal, onboardingComplete: true,
    }
    storage.saveProfile(profile)
    onComplete()
  }

  return (
    <div className="flex flex-col h-full bg-white">
      {step > 0 && (
        <div className="px-6 pt-14 pb-2">
          <div className="flex items-center gap-3">
            {step > 1 && (
              <button onClick={back} className="text-[#8e8e93] text-sm mr-1">
                <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">
                  <path d="M15 18l-6-6 6-6" />
                </svg>
              </button>
            )}
            <div className="flex-1 bg-[#f0f0f5] rounded-full h-1">
              <div
                className="bg-[#30d158] h-1 rounded-full transition-all duration-300"
                style={{ width: `${(step / (TOTAL_STEPS - 1)) * 100}%` }}
              />
            </div>
            <span className="text-[#8e8e93] text-xs">{step}/{TOTAL_STEPS - 1}</span>
          </div>
        </div>
      )}

      <div className="flex-1 flex flex-col px-6 overflow-y-auto">
        {step === 0 && <WelcomeStep onNext={next} />}
        {step === 1 && <GoalStep value={goal} onChange={setGoal} onNext={next} />}
        {step === 2 && <GenderStep value={gender} onChange={setGender} onNext={next} />}
        {step === 3 && <AgeStep value={age} onChange={setAge} onNext={next} />}
        {step === 4 && <WeightStep value={weight} onChange={setWeight} unit={weightUnit} onUnitChange={setWeightUnit} onNext={next} />}
        {step === 5 && <HeightStep ft={heightFt} onFtChange={setHeightFt} inches={heightIn} onInchesChange={setHeightIn} cm={heightCm} onCmChange={setHeightCm} unit={heightUnit} onUnitChange={setHeightUnit} onNext={next} />}
        {step === 6 && <DietStep value={diet} onChange={setDiet} onNext={next} />}
        {step === 7 && <ProfileStep value={name} onChange={setName} onFinish={finish} />}
      </div>
    </div>
  )
}

// ─── Steps ───────────────────────────────────────────────────────────

function WelcomeStep({ onNext }: { onNext: () => void }) {
  return (
    <div className="flex flex-col justify-between h-full py-16">
      <div className="flex-1 flex flex-col justify-center gap-5">
        <div>
          <p className="text-[#30d158] font-semibold text-base tracking-tight">FitTrack</p>
          <h1 className="text-[34px] font-semibold text-[#1d1d1f] leading-tight tracking-tight mt-2">
            Nutrition tracking that finally feels easy
          </h1>
          <p className="text-[#6e6e73] text-lg mt-3 leading-snug">
            Track calories, protein, and habits in seconds.
          </p>
        </div>
      </div>
      <button
        onClick={onNext}
        className="w-full bg-[#30d158] text-white font-semibold text-base py-4 rounded-2xl active:scale-95 transition-transform"
      >
        Get Started
      </button>
    </div>
  )
}

function GoalStep({ value, onChange, onNext }: { value: Goal | null; onChange: (g: Goal) => void; onNext: () => void }) {
  const options: { value: Goal; label: string; desc: string }[] = [
    { value: 'lose_weight', label: 'Lose Weight', desc: 'Calorie deficit, fat loss focus' },
    { value: 'gain_muscle', label: 'Gain Muscle', desc: 'Calorie surplus, protein priority' },
    { value: 'gain_weight', label: 'Gain Weight', desc: 'Increase overall body mass' },
    { value: 'maintenance', label: 'Maintenance', desc: 'Sustain current weight' },
  ]
  return (
    <div className="flex flex-col gap-5 py-8">
      <div>
        <h2 className="text-[26px] font-semibold text-[#1d1d1f] tracking-tight">What's your goal?</h2>
        <p className="text-[#6e6e73] text-sm mt-1">We'll calibrate your daily targets around this.</p>
      </div>
      <div className="flex flex-col gap-2.5">
        {options.map(o => (
          <button
            key={o.value}
            onClick={() => { onChange(o.value); onNext() }}
            className={`flex items-center justify-between p-4 rounded-2xl border text-left transition-all active:scale-95 ${
              value === o.value ? 'border-[#30d158] bg-[#30d158]/5' : 'border-[#e5e5ea] bg-white'
            }`}
          >
            <div>
              <p className="text-[#1d1d1f] font-semibold">{o.label}</p>
              <p className="text-[#8e8e93] text-sm">{o.desc}</p>
            </div>
            {value === o.value && (
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#30d158" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M20 6L9 17l-5-5" />
              </svg>
            )}
          </button>
        ))}
      </div>
    </div>
  )
}

function GenderStep({ value, onChange, onNext }: { value: Gender | null; onChange: (g: Gender) => void; onNext: () => void }) {
  return (
    <div className="flex flex-col gap-5 py-8">
      <div>
        <h2 className="text-[26px] font-semibold text-[#1d1d1f] tracking-tight">Biological sex</h2>
        <p className="text-[#6e6e73] text-sm mt-1">Used to calculate your basal metabolic rate accurately.</p>
      </div>
      <div className="flex gap-3">
        {(['male', 'female'] as Gender[]).map(g => (
          <button
            key={g}
            onClick={() => { onChange(g); onNext() }}
            className={`flex-1 py-5 rounded-2xl border font-semibold capitalize transition-all active:scale-95 ${
              value === g ? 'border-[#30d158] bg-[#30d158]/5 text-[#30d158]' : 'border-[#e5e5ea] bg-white text-[#1d1d1f]'
            }`}
          >
            {g}
          </button>
        ))}
      </div>
    </div>
  )
}

function AgeStep({ value, onChange, onNext }: { value: string; onChange: (v: string) => void; onNext: () => void }) {
  const valid = parseInt(value) >= 10 && parseInt(value) <= 100
  return (
    <div className="flex flex-col gap-5 py-8">
      <div>
        <h2 className="text-[26px] font-semibold text-[#1d1d1f] tracking-tight">How old are you?</h2>
        <p className="text-[#6e6e73] text-sm mt-1">Helps calibrate your daily calorie needs.</p>
      </div>
      <div className="flex items-end gap-2 border-b-2 border-[#30d158] pb-2">
        <input
          type="number"
          inputMode="numeric"
          value={value}
          onChange={e => onChange(e.target.value)}
          placeholder="25"
          className="text-[52px] font-semibold text-[#1d1d1f] tracking-tight bg-transparent outline-none w-40 placeholder-[#d1d1d6] leading-none"
        />
        <span className="text-[#8e8e93] text-xl pb-2">years</span>
      </div>
      <button onClick={onNext} disabled={!valid} className="w-full bg-[#30d158] disabled:bg-[#e5e5ea] disabled:text-[#c7c7cc] text-white font-semibold py-4 rounded-2xl active:scale-95 transition-all">
        Continue
      </button>
    </div>
  )
}

function WeightStep({ value, onChange, unit, onUnitChange, onNext }: {
  value: string; onChange: (v: string) => void; unit: WeightUnit; onUnitChange: (u: WeightUnit) => void; onNext: () => void
}) {
  const num = parseFloat(value)
  const valid = unit === 'kg' ? num >= 30 && num <= 300 : num >= 66 && num <= 660
  return (
    <div className="flex flex-col gap-5 py-8">
      <div>
        <h2 className="text-[26px] font-semibold text-[#1d1d1f] tracking-tight">Current weight</h2>
        <p className="text-[#6e6e73] text-sm mt-1">We'll track your progress from this baseline.</p>
      </div>
      <div className="flex bg-[#f5f5f7] rounded-xl p-1 w-36">
        {(['kg', 'lbs'] as WeightUnit[]).map(u => (
          <button key={u} onClick={() => onUnitChange(u)} className={`flex-1 py-1.5 rounded-lg text-sm font-medium transition-all ${unit === u ? 'bg-white text-[#1d1d1f] shadow-sm' : 'text-[#8e8e93]'}`}>
            {u}
          </button>
        ))}
      </div>
      <div className="flex items-end gap-2 border-b-2 border-[#30d158] pb-2">
        <input
          type="number"
          inputMode="decimal"
          value={value}
          onChange={e => onChange(e.target.value)}
          placeholder={unit === 'kg' ? '70' : '154'}
          className="text-[52px] font-semibold text-[#1d1d1f] tracking-tight bg-transparent outline-none w-40 placeholder-[#d1d1d6] leading-none"
        />
        <span className="text-[#8e8e93] text-xl pb-2">{unit}</span>
      </div>
      <button onClick={onNext} disabled={!valid} className="w-full bg-[#30d158] disabled:bg-[#e5e5ea] disabled:text-[#c7c7cc] text-white font-semibold py-4 rounded-2xl active:scale-95 transition-all">
        Continue
      </button>
    </div>
  )
}

function HeightStep({ ft, onFtChange, inches, onInchesChange, cm, onCmChange, unit, onUnitChange, onNext }: {
  ft: string; onFtChange: (v: string) => void; inches: string; onInchesChange: (v: string) => void
  cm: string; onCmChange: (v: string) => void; unit: HeightUnit; onUnitChange: (u: HeightUnit) => void; onNext: () => void
}) {
  const valid = unit === 'cm' ? parseFloat(cm) >= 100 && parseFloat(cm) <= 250 : parseInt(ft) >= 3 && parseInt(ft) <= 8
  return (
    <div className="flex flex-col gap-5 py-8">
      <div>
        <h2 className="text-[26px] font-semibold text-[#1d1d1f] tracking-tight">Your height</h2>
        <p className="text-[#6e6e73] text-sm mt-1">Used alongside weight to calculate your BMR.</p>
      </div>
      <div className="flex bg-[#f5f5f7] rounded-xl p-1 w-44">
        {(['cm', 'ft'] as HeightUnit[]).map(u => (
          <button key={u} onClick={() => onUnitChange(u)} className={`flex-1 py-1.5 rounded-lg text-sm font-medium transition-all ${unit === u ? 'bg-white text-[#1d1d1f] shadow-sm' : 'text-[#8e8e93]'}`}>
            {u === 'cm' ? 'cm' : 'ft / in'}
          </button>
        ))}
      </div>
      {unit === 'cm' ? (
        <div className="flex items-end gap-2 border-b-2 border-[#30d158] pb-2">
          <input type="number" inputMode="decimal" value={cm} onChange={e => onCmChange(e.target.value)} placeholder="175"
            className="text-[52px] font-semibold text-[#1d1d1f] tracking-tight bg-transparent outline-none w-40 placeholder-[#d1d1d6] leading-none" />
          <span className="text-[#8e8e93] text-xl pb-2">cm</span>
        </div>
      ) : (
        <div className="flex gap-4">
          <div className="flex items-end gap-2 border-b-2 border-[#30d158] pb-2 flex-1">
            <input type="number" inputMode="numeric" value={ft} onChange={e => onFtChange(e.target.value)} placeholder="5"
              className="text-[52px] font-semibold text-[#1d1d1f] tracking-tight bg-transparent outline-none w-20 placeholder-[#d1d1d6] leading-none" />
            <span className="text-[#8e8e93] text-xl pb-2">ft</span>
          </div>
          <div className="flex items-end gap-2 border-b-2 border-[#e5e5ea] pb-2 flex-1">
            <input type="number" inputMode="numeric" value={inches} onChange={e => onInchesChange(e.target.value)} placeholder="10" min="0" max="11"
              className="text-[52px] font-semibold text-[#1d1d1f] tracking-tight bg-transparent outline-none w-20 placeholder-[#d1d1d6] leading-none" />
            <span className="text-[#8e8e93] text-xl pb-2">in</span>
          </div>
        </div>
      )}
      <button onClick={onNext} disabled={!valid} className="w-full bg-[#30d158] disabled:bg-[#e5e5ea] disabled:text-[#c7c7cc] text-white font-semibold py-4 rounded-2xl active:scale-95 transition-all">
        Continue
      </button>
    </div>
  )
}

function DietStep({ value, onChange, onNext }: { value: DietPreference | null; onChange: (d: DietPreference) => void; onNext: () => void }) {
  const options: { value: DietPreference; label: string; desc: string }[] = [
    { value: 'non_vegetarian', label: 'Non-Vegetarian', desc: 'Includes meat, fish, and poultry' },
    { value: 'vegetarian', label: 'Vegetarian', desc: 'No meat or fish' },
    { value: 'pescetarian', label: 'Pescetarian', desc: 'Vegetarian plus seafood' },
    { value: 'vegan', label: 'Vegan', desc: 'No animal products' },
  ]
  return (
    <div className="flex flex-col gap-5 py-8">
      <div>
        <h2 className="text-[26px] font-semibold text-[#1d1d1f] tracking-tight">Diet preference</h2>
        <p className="text-[#6e6e73] text-sm mt-1">Helps tailor food suggestions.</p>
      </div>
      <div className="flex flex-col gap-2.5">
        {options.map(o => (
          <button
            key={o.value}
            onClick={() => { onChange(o.value); onNext() }}
            className={`flex items-center justify-between p-4 rounded-2xl border text-left transition-all active:scale-95 ${
              value === o.value ? 'border-[#30d158] bg-[#30d158]/5' : 'border-[#e5e5ea] bg-white'
            }`}
          >
            <div>
              <p className="text-[#1d1d1f] font-semibold">{o.label}</p>
              <p className="text-[#8e8e93] text-sm">{o.desc}</p>
            </div>
            {value === o.value && (
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#30d158" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M20 6L9 17l-5-5" />
              </svg>
            )}
          </button>
        ))}
      </div>
    </div>
  )
}

function ProfileStep({ value, onChange, onFinish }: { value: string; onChange: (v: string) => void; onFinish: () => void }) {
  return (
    <div className="flex flex-col gap-5 py-8">
      <div>
        <h2 className="text-[26px] font-semibold text-[#1d1d1f] tracking-tight">What's your name?</h2>
        <p className="text-[#6e6e73] text-sm mt-1">One last step before you're ready.</p>
      </div>
      <div className="border-b-2 border-[#30d158] pb-2">
        <input
          type="text"
          value={value}
          onChange={e => onChange(e.target.value)}
          placeholder="Your name"
          autoFocus
          className="text-[36px] font-semibold text-[#1d1d1f] tracking-tight bg-transparent outline-none w-full placeholder-[#d1d1d6] leading-none"
        />
      </div>
      <button
        onClick={onFinish}
        disabled={value.trim().length < 2}
        className="w-full bg-[#30d158] disabled:bg-[#e5e5ea] disabled:text-[#c7c7cc] text-white font-semibold py-4 rounded-2xl active:scale-95 transition-all"
      >
        Get started
      </button>
    </div>
  )
}
