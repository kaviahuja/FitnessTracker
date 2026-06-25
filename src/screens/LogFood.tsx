import { useState, useRef, useEffect } from 'react'
import { storage } from '../lib/storage'
import { queueSync } from '../lib/supabase'
import type { FoodItem, MealLog } from '../types'

function todayStr() { return new Date().toISOString().split('T')[0] }
function uid() { return Date.now().toString(36) + Math.random().toString(36).slice(2) }

function fileToBase64(file: File): Promise<{ data: string; mediaType: string }> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      const result = reader.result as string
      const [prefix, data] = result.split(',')
      const mediaType = prefix.match(/:(.*?);/)?.[1] ?? 'image/jpeg'
      resolve({ data, mediaType })
    }
    reader.onerror = reject
    reader.readAsDataURL(file)
  })
}

function formatDate(dateStr: string): string {
  const today = todayStr()
  const yesterday = new Date(); yesterday.setDate(yesterday.getDate() - 1)
  const yStr = yesterday.toISOString().split('T')[0]
  const label = new Date(dateStr + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })
  if (dateStr === today) return `Today`
  if (dateStr === yStr) return `Yesterday`
  return label
}

async function analyzeFood(data: string, mediaType: string): Promise<FoodItem[]> {
  const apiKey = localStorage.getItem('fittrack_claude_key')
  if (!apiKey) throw new Error('no_api_key')

  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      'anthropic-dangerous-direct-browser-access': 'true',
    },
    body: JSON.stringify({
      model: 'claude-opus-4-7',
      max_tokens: 1024,
      messages: [{
        role: 'user',
        content: [
          { type: 'image', source: { type: 'base64', media_type: mediaType, data } },
          { type: 'text', text: 'Identify all food items in this image. For each, estimate serving size and nutrition. Return ONLY a JSON array with no markdown:\n[{"name":"","amount":"","calories":0,"protein":0,"carbs":0,"fat":0}]\nAll nutrient values must be integers.' },
        ],
      }],
    }),
  })

  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error((err as { error?: { message?: string } }).error?.message ?? 'API request failed')
  }
  const result = await res.json() as { content: { type: string; text: string }[] }
  const text = result.content?.find(c => c.type === 'text')?.text ?? ''
  const match = text.match(/\[[\s\S]*?\]/)
  if (!match) throw new Error('Could not parse food data')
  return JSON.parse(match[0]) as FoodItem[]
}

type Per100g = { calories: number; protein: number; carbs: number; fat: number }
type FoodSuggestion = { name: string; per100g: Per100g }
type USDAFood = { description: string; foodNutrients: { nutrientId: number; value: number }[] }

type SearchResult = { suggestions: FoodSuggestion[]; error: string | null }

async function searchFoods(query: string): Promise<SearchResult> {
  const apiKey = localStorage.getItem('fittrack_usda_key')
  if (!apiKey) return { suggestions: [], error: 'Add USDA API key to enable search' }
  try {
    const url = `https://api.nal.usda.gov/fdc/v1/foods/search?query=${encodeURIComponent(query)}&api_key=${apiKey}&dataType=Foundation,SR%20Legacy&pageSize=6`
    const res = await fetch(url)
    if (!res.ok) {
      console.error('USDA search failed:', res.status, res.statusText)
      const reason = res.status === 403 || res.status === 401
        ? 'USDA API key is invalid'
        : res.status === 429
        ? 'USDA rate limit reached — try again in a moment'
        : `USDA API error (${res.status})`
      return { suggestions: [], error: reason }
    }
    const data = await res.json() as { foods?: USDAFood[] }
    const getNutrient = (food: USDAFood, id: number) =>
      food.foodNutrients.find(n => n.nutrientId === id)?.value ?? 0
    const suggestions = (data.foods ?? []).slice(0, 5).map(food => ({
      name: food.description,
      per100g: {
        calories: Math.round(getNutrient(food, 1008)),
        protein: Math.round(getNutrient(food, 1003) * 10) / 10,
        carbs: Math.round(getNutrient(food, 1005) * 10) / 10,
        fat: Math.round(getNutrient(food, 1004) * 10) / 10,
      },
    }))
    return { suggestions, error: null }
  } catch (e) {
    console.error('USDA search threw:', e)
    return { suggestions: [], error: 'Network error — check your connection' }
  }
}

const MEAL_TYPES = ['Breakfast', 'Lunch', 'Dinner', 'Snack'] as const
type MealType = (typeof MEAL_TYPES)[number]
const MEAL_TIMES: Record<MealType, string> = {
  Breakfast: '6–10 am', Lunch: '12–2 pm', Dinner: '6–9 pm', Snack: 'Anytime',
}
const MEAL_COLORS: Record<MealType, string> = {
  Breakfast: 'bg-[#ff9500]',
  Lunch: 'bg-[#30d158]',
  Dinner: 'bg-[#0071e3]',
  Snack: 'bg-[#bf5af2]',
}
type Step = 'closed' | 'select-meal' | 'select-method' | 'analyzing' | 'review' | 'manual-add'

function emptyItem(): FoodItem {
  return { name: '', amount: '', calories: 0, protein: 0, carbs: 0, fat: 0 }
}

function ApiKeysModal({ onDismiss, onUsdaSaved }: { onDismiss: () => void; onUsdaSaved: () => void }) {
  const [usdaKey, setUsdaKey] = useState(() => localStorage.getItem('fittrack_usda_key') ?? '')
  const [claudeKey, setClaudeKey] = useState(() => localStorage.getItem('fittrack_claude_key') ?? '')
  const [saved, setSaved] = useState(false)

  function save() {
    if (usdaKey.trim()) localStorage.setItem('fittrack_usda_key', usdaKey.trim())
    if (claudeKey.trim()) localStorage.setItem('fittrack_claude_key', claudeKey.trim())
    // Push to cloud so the keys survive sign-outs and follow the user to
    // any device — see api_keys column on user_data.
    queueSync()
    onUsdaSaved()
    setSaved(true)
    setTimeout(() => { setSaved(false); onDismiss() }, 800)
  }

  const canSave = usdaKey.trim().length >= 8 || claudeKey.trim().length >= 10

  return (
    <div className="fixed inset-0 bg-black/40 flex items-end z-50 px-4 pb-6">
      <div className="bg-white rounded-2xl p-6 w-full flex flex-col gap-5 shadow-xl">
        <div className="flex items-center justify-between">
          <h3 className="text-[#1d1d1f] font-bold text-xl">API Keys</h3>
          <button onClick={onDismiss} className="w-8 h-8 bg-[#f5f5f7] rounded-full flex items-center justify-center text-[#8e8e93]">
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none"><path d="M1 1l10 10M11 1L1 11" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/></svg>
          </button>
        </div>
        <p className="text-[#6e6e73] text-sm -mt-2">All keys are stored locally on this device only.</p>

        {/* USDA key */}
        <div className="flex flex-col gap-2">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 bg-[#30d158]/10 rounded-lg flex items-center justify-center flex-shrink-0">
              <svg width="13" height="13" fill="none" stroke="#30d158" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">
                <circle cx="11" cy="11" r="8"/><path d="M21 21l-4.35-4.35" strokeLinecap="round"/>
              </svg>
            </div>
            <div>
              <p className="text-[#1d1d1f] font-semibold text-sm">Manual Entry Search</p>
              <p className="text-[#8e8e93] text-xs">USDA FoodData Central — fdc.nal.usda.gov</p>
            </div>
          </div>
          <input
            type="password"
            placeholder="Paste your USDA API key"
            value={usdaKey}
            onChange={e => setUsdaKey(e.target.value)}
            className="bg-[#f5f5f7] border border-[#e5e5ea] text-[#1d1d1f] rounded-xl px-4 py-3 outline-none w-full placeholder-[#c7c7cc] text-sm"
          />
        </div>

        {/* Claude key */}
        <div className="flex flex-col gap-2">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 bg-[#0071e3]/10 rounded-lg flex items-center justify-center flex-shrink-0">
              <svg width="13" height="13" fill="none" stroke="#0071e3" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">
                <path d="M23 19a2 2 0 01-2 2H3a2 2 0 01-2-2V8a2 2 0 012-2h4l2-3h6l2 3h4a2 2 0 012 2z"/><circle cx="12" cy="13" r="4"/>
              </svg>
            </div>
            <div>
              <p className="text-[#1d1d1f] font-semibold text-sm">Photo Analysis</p>
              <p className="text-[#8e8e93] text-xs">Claude AI — console.anthropic.com</p>
            </div>
          </div>
          <input
            type="password"
            placeholder="sk-ant-..."
            value={claudeKey}
            onChange={e => setClaudeKey(e.target.value)}
            className="bg-[#f5f5f7] border border-[#e5e5ea] text-[#1d1d1f] rounded-xl px-4 py-3 outline-none w-full placeholder-[#c7c7cc] text-sm"
          />
        </div>

        <div className="flex gap-3 mt-1">
          <button onClick={onDismiss} className="flex-1 bg-[#f5f5f7] text-[#1d1d1f] font-medium py-3 rounded-xl">Cancel</button>
          <button
            onClick={save}
            disabled={!canSave}
            className={`flex-1 font-semibold py-3 rounded-xl transition-colors ${saved ? 'bg-[#30d158] text-white' : 'bg-[#0071e3] disabled:bg-[#e5e5ea] disabled:text-[#c7c7cc] text-white'}`}
          >
            {saved ? 'Saved ✓' : 'Save Keys'}
          </button>
        </div>
      </div>
    </div>
  )
}

// Copy source: either a single meal or all meals from a date
type CopySource =
  | { kind: 'meal'; log: MealLog }
  | { kind: 'day'; date: string; logs: MealLog[] }

function CopyMealModal({ source, onCopy, onClose }: {
  source: CopySource
  onCopy: (dates: string[]) => void
  onClose: () => void
}) {
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [customDate, setCustomDate] = useState('')

  const sourceDate = source.kind === 'meal' ? source.log.date : source.date
  const yesterday = (() => { const d = new Date(); d.setDate(d.getDate() - 1); return d.toISOString().split('T')[0] })()
  const tomorrow = (() => { const d = new Date(); d.setDate(d.getDate() + 1); return d.toISOString().split('T')[0] })()
  const today = todayStr()

  // Hide the source date itself from quick chips so users don't accidentally
  // create a duplicate on the same day they're copying from.
  const quickDates = [
    { date: yesterday, label: 'Yesterday' },
    { date: today, label: 'Today' },
    { date: tomorrow, label: 'Tomorrow' },
  ].filter(d => d.date !== sourceDate)

  function toggle(date: string) {
    setSelected(prev => {
      const next = new Set(prev)
      if (next.has(date)) next.delete(date)
      else next.add(date)
      return next
    })
  }

  function addCustom() {
    if (!customDate) return
    toggle(customDate)
    setCustomDate('')
  }

  // Preview labels
  const headerSub = source.kind === 'meal'
    ? source.log.meal
    : `${source.logs.length} meal${source.logs.length !== 1 ? 's' : ''} from ${formatDate(source.date)}`
  const itemNames = source.kind === 'meal'
    ? source.log.items.map(i => i.name).join(', ')
    : source.logs.flatMap(l => l.items.map(i => i.name)).join(', ')
  const totalCals = source.kind === 'meal'
    ? source.log.items.reduce((s, i) => s + i.calories, 0)
    : source.logs.reduce((s, l) => s + l.items.reduce((ss, i) => ss + i.calories, 0), 0)

  return (
    <div className="fixed inset-0 z-50 flex flex-col justify-end">
      <div className="absolute inset-0 bg-black/30" onClick={onClose} />
      <div className="relative bg-white rounded-t-3xl max-h-[88vh] flex flex-col overflow-hidden shadow-2xl">
        <div className="flex justify-center pt-3 pb-1 flex-shrink-0">
          <div className="w-10 h-1 bg-[#e5e5ea] rounded-full" />
        </div>
        <div className="overflow-y-auto flex-1 px-5 pb-8">
          <div className="flex flex-col gap-5 py-4">
            <div>
              <p className="text-[#8e8e93] text-xs">Copy</p>
              <h3 className="text-[#1d1d1f] font-bold text-xl mt-0.5">{headerSub}</h3>
              {itemNames && <p className="text-[#6e6e73] text-sm mt-1 line-clamp-2">{itemNames}</p>}
              <p className="text-[#8e8e93] text-xs mt-1">{totalCals} kcal</p>
            </div>

            {quickDates.length > 0 && (
              <div>
                <p className="text-[#8e8e93] text-xs font-semibold uppercase tracking-wider mb-2">Quick dates</p>
                <div className="flex gap-2 flex-wrap">
                  {quickDates.map(({ date, label }) => (
                    <button
                      key={date}
                      onClick={() => toggle(date)}
                      className={`px-4 py-2 rounded-xl text-sm font-semibold border transition-all active:scale-95 ${
                        selected.has(date)
                          ? 'bg-[#30d158] border-transparent text-white'
                          : 'bg-[#f5f5f7] border-[#e5e5ea] text-[#1d1d1f]'
                      }`}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div>
              <p className="text-[#8e8e93] text-xs font-semibold uppercase tracking-wider mb-2">Or pick a date</p>
              <div className="flex gap-2">
                <input
                  type="date"
                  value={customDate}
                  onChange={e => setCustomDate(e.target.value)}
                  className="flex-1 bg-[#f5f5f7] border border-[#e5e5ea] rounded-xl px-4 py-2.5 text-[#1d1d1f] text-sm outline-none"
                />
                <button
                  onClick={addCustom}
                  disabled={!customDate || customDate === sourceDate}
                  className="bg-[#0071e3] disabled:bg-[#e5e5ea] disabled:text-[#c7c7cc] text-white font-semibold px-4 rounded-xl text-sm active:scale-95 transition-all"
                >
                  Add
                </button>
              </div>
              {customDate === sourceDate && (
                <p className="text-[#ff9500] text-[10px] mt-1 px-0.5">Can't copy to the same day you're copying from</p>
              )}
            </div>

            {selected.size > 0 && (
              <div className="bg-[#f5f5f7] border border-[#e5e5ea] rounded-xl px-4 py-3">
                <p className="text-[#8e8e93] text-xs font-semibold uppercase tracking-wider mb-2">Will copy to</p>
                <div className="flex gap-1.5 flex-wrap">
                  {[...selected].sort().map(d => (
                    <span key={d} className="bg-white border border-[#e5e5ea] rounded-lg pl-2.5 pr-1.5 py-1 text-xs text-[#1d1d1f] inline-flex items-center gap-1.5">
                      {formatDate(d)}
                      <button onClick={() => toggle(d)} className="text-[#c7c7cc] hover:text-[#ff3b30] text-[11px] leading-none">✕</button>
                    </span>
                  ))}
                </div>
              </div>
            )}

            <button
              onClick={() => onCopy([...selected])}
              disabled={selected.size === 0}
              className="w-full bg-[#30d158] disabled:bg-[#e5e5ea] disabled:text-[#c7c7cc] text-white font-semibold py-4 rounded-2xl active:scale-95 transition-all"
            >
              {selected.size === 0 ? 'Pick at least one date' : `Copy to ${selected.size} date${selected.size !== 1 ? 's' : ''}`}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

function ItemEditor({ item, onChange, onDelete, hasUsdaKey }: { item: FoodItem; onChange: (u: FoodItem) => void; onDelete: () => void; hasUsdaKey: boolean }) {
  const [suggestions, setSuggestions] = useState<FoodSuggestion[]>([])
  const [searchError, setSearchError] = useState<string | null>(null)
  const [per100g, setPer100g] = useState<Per100g | null>(null)
  const [weightG, setWeightG] = useState<string>('')
  const [searching, setSearching] = useState(false)
  const per100gRef = useRef<Per100g | null>(null)
  per100gRef.current = per100g

  useEffect(() => {
    if (per100gRef.current !== null || item.name.length < 2) {
      setSuggestions([])
      setSearchError(null)
      return
    }
    const t = setTimeout(async () => {
      setSearching(true)
      const result = await searchFoods(item.name)
      setSuggestions(result.suggestions)
      setSearchError(result.error)
      setSearching(false)
    }, 400)
    return () => clearTimeout(t)
  }, [item.name])

  function calcItem(name: string, w: number, p: Per100g): FoodItem {
    return {
      ...item,
      name,
      amount: `${w}g`,
      calories: Math.round((w / 100) * p.calories),
      protein: Math.round((w / 100) * p.protein * 10) / 10,
      carbs: Math.round((w / 100) * p.carbs * 10) / 10,
      fat: Math.round((w / 100) * p.fat * 10) / 10,
    }
  }

  function handleNameChange(name: string) {
    if (per100g !== null) {
      setPer100g(null)
      setWeightG('')
      onChange({ ...item, name, calories: 0, protein: 0, carbs: 0, fat: 0, amount: '' })
    } else {
      onChange({ ...item, name })
    }
  }

  function selectSuggestion(s: FoodSuggestion) {
    setPer100g(s.per100g)
    setSuggestions([])
    const w = parseFloat(weightG)
    onChange(!isNaN(w) && w > 0 ? calcItem(s.name, w, s.per100g) : { ...item, name: s.name })
  }

  function handleWeightChange(val: string) {
    setWeightG(val)
    const w = parseFloat(val)
    if (!isNaN(w) && w > 0 && per100g) {
      onChange(calcItem(item.name, w, per100g))
    }
  }

  function clearSelection() {
    setPer100g(null)
    setWeightG('')
    onChange({ ...item, calories: 0, protein: 0, carbs: 0, fat: 0, amount: '' })
  }

  function num(key: keyof FoodItem, label: string) {
    return (
      <div className="flex-1 flex flex-col gap-1">
        <span className="text-[#8e8e93] text-xs">{label}</span>
        <input
          type="number"
          inputMode="numeric"
          value={(item[key] as number) || ''}
          onChange={e => onChange({ ...item, [key]: Number(e.target.value) })}
          className="bg-[#f5f5f7] border border-[#e5e5ea] text-[#1d1d1f] text-sm rounded-lg px-2.5 py-2 outline-none w-full"
        />
      </div>
    )
  }

  return (
    <div className="bg-[#f5f5f7] rounded-xl p-3 flex flex-col gap-2 border border-[#e5e5ea]">
      {/* Food name with live search */}
      <div className="flex gap-2 items-start">
        <div className="flex-1">
          <div className="flex items-center justify-between mb-1">
            <span className="text-[#8e8e93] text-xs">Food</span>
            {per100g && (
              <button onClick={clearSelection} className="text-[#8e8e93] text-xs underline">Clear</button>
            )}
          </div>
          <div className="relative">
            <input
              type="text"
              value={item.name}
              placeholder={hasUsdaKey ? 'Search food name...' : 'Enter food name'}
              onChange={e => handleNameChange(e.target.value)}
              onBlur={() => setTimeout(() => setSuggestions([]), 150)}
              className="block w-full bg-white border border-[#e5e5ea] text-[#1d1d1f] text-sm rounded-lg px-2.5 py-2 outline-none placeholder-[#c7c7cc] pr-8"
            />
            {!hasUsdaKey && (
              <p className="text-[#ff9500] text-[10px] mt-1 px-0.5">Add USDA key to enable food search</p>
            )}
            {hasUsdaKey && searchError && item.name.length >= 2 && per100g === null && (
              <p className="text-[#ff3b30] text-[10px] mt-1 px-0.5">{searchError}</p>
            )}
            {hasUsdaKey && !searchError && !searching && suggestions.length === 0 && item.name.length >= 2 && per100g === null && (
              <p className="text-[#8e8e93] text-[10px] mt-1 px-0.5">No matches — enter macros manually below</p>
            )}
            {searching && (
              <div className="absolute right-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 border-2 border-[#e5e5ea] border-t-[#30d158] rounded-full animate-spin pointer-events-none" />
            )}
            {suggestions.length > 0 && (
              <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-[#e5e5ea] rounded-xl shadow-lg z-10 overflow-hidden">
                {suggestions.map((s, i) => (
                  <button
                    key={i}
                    onMouseDown={() => selectSuggestion(s)}
                    className="w-full text-left px-3 py-2.5 flex items-center justify-between gap-2 border-b border-[#f0f0f5] last:border-0 active:bg-[#f5f5f7]"
                  >
                    <span className="text-[#1d1d1f] text-sm truncate">{s.name}</span>
                    <svg width="12" height="12" fill="none" stroke="#c7c7cc" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24" className="flex-shrink-0">
                      <path d="M9 18l6-6-6-6" />
                    </svg>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
        <button onClick={onDelete} className="text-[#c7c7cc] text-base leading-none mt-[22px] flex-shrink-0">✕</button>
      </div>

      {/* Weight (database mode) or Amount (manual mode) */}
      {per100g ? (
        <div className="flex items-center gap-2">
          <span className="text-[#8e8e93] text-xs w-14 flex-shrink-0">Weight</span>
          <div className="relative flex-1">
            <input
              type="number"
              inputMode="numeric"
              value={weightG}
              placeholder="grams"
              onChange={e => handleWeightChange(e.target.value)}
              className="block w-full bg-white border border-[#e5e5ea] text-[#1d1d1f] text-sm rounded-lg px-2.5 py-2 outline-none pr-7"
            />
            <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[#8e8e93] text-xs pointer-events-none">g</span>
          </div>
        </div>
      ) : (
        <div>
          <span className="text-[#8e8e93] text-xs">Amount</span>
          <input
            type="text"
            value={item.amount}
            placeholder="100g"
            onChange={e => onChange({ ...item, amount: e.target.value })}
            className="block w-full bg-white border border-[#e5e5ea] text-[#1d1d1f] text-sm rounded-lg px-2.5 py-2 outline-none mt-1 placeholder-[#c7c7cc]"
          />
        </div>
      )}

      {/* Macro fields — always editable */}
      <div className="flex gap-2">
        {num('calories', 'kcal')}
        {num('protein', 'Protein')}
        {num('carbs', 'Carbs')}
        {num('fat', 'Fat')}
      </div>
    </div>
  )
}

export default function LogFood() {
  const [selectedDate, setSelectedDate] = useState(todayStr())
  const [step, setStep] = useState<Step>('closed')
  const [selectedMeal, setSelectedMeal] = useState<MealType>('Breakfast')
  const [items, setItems] = useState<FoodItem[]>([])
  const [photoPreview, setPhotoPreview] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [showApiKeys, setShowApiKeys] = useState(false)
  const [usdaKeySet, setUsdaKeySet] = useState(() => !!localStorage.getItem('fittrack_usda_key'))
  const [copySource, setCopySource] = useState<CopySource | null>(null)
  const [editingMealId, setEditingMealId] = useState<string | null>(null)
  const [, setRefresh] = useState(0)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const dateInputRef = useRef<HTMLInputElement>(null)

  const mealLogs = storage.getMealLogs().filter(m => m.date === selectedDate)
  const profile = storage.getProfile()
  const goal = profile?.calorieGoal ?? 2000
  const totalCals = mealLogs.reduce((sum, m) => sum + m.items.reduce((s, i) => s + i.calories, 0), 0)
  const over = totalCals > goal

  function openSheet(meal?: MealType) {
    setSelectedMeal(meal ?? 'Breakfast')
    setItems([])
    setPhotoPreview(null)
    setError(null)
    setStep(meal ? 'select-method' : 'select-meal')
  }

  function closeSheet() {
    setStep('closed')
    setPhotoPreview(null)
    setError(null)
    setItems([])
    setEditingMealId(null)
  }

  function openEdit(log: MealLog) {
    setSelectedMeal(log.meal as MealType)
    setSelectedDate(log.date)
    setItems(log.items.length ? log.items : [emptyItem()])
    setPhotoPreview(log.photoUrl ?? null)
    setError(null)
    setEditingMealId(log.id)
    setStep('manual-add')
  }

  async function handlePhoto(file: File) {
    setPhotoPreview(URL.createObjectURL(file))
    setStep('analyzing')
    setError(null)
    try {
      const { data, mediaType } = await fileToBase64(file)
      const detected = await analyzeFood(data, mediaType)
      setItems(detected.length ? detected : [emptyItem()])
      setStep('review')
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e)
      if (msg === 'no_api_key') { setShowApiKeys(true); setStep('select-method') }
      else { setError(`Analysis failed: ${msg}`); setStep('select-method') }
    }
  }

  function saveMeal() {
    const validItems = items.filter(i => i.name.trim())
    if (!validItems.length) return
    // Reuse existing id when editing so storage.saveMealLog updates the row
    // instead of creating a duplicate.
    const id = editingMealId ?? uid()
    storage.saveMealLog({ id, date: selectedDate, meal: selectedMeal, items: validItems, ...(photoPreview ? { photoUrl: photoPreview } : {}) } as MealLog)
    setRefresh(r => r + 1)
    closeSheet()
  }

  function deleteMealLog(id: string) {
    storage.deleteMealLog(id)
    setRefresh(r => r + 1)
  }

  function handleCopy(dates: string[]) {
    if (!copySource || dates.length === 0) return
    const sourceLogs = copySource.kind === 'meal' ? [copySource.log] : copySource.logs
    for (const date of dates) {
      for (const log of sourceLogs) {
        storage.saveMealLog({
          ...log,
          id: uid(),
          date,
        })
      }
    }
    // Navigate to the first destination date so the user immediately sees
    // the copied meal land. Without this, the copy succeeds silently — the
    // new meal exists on a date the user isn't currently viewing.
    const sortedDates = [...dates].sort()
    setSelectedDate(sortedDates[0])
    setCopySource(null)
    setRefresh(r => r + 1)
  }

  const itemTotal = {
    cal: items.reduce((s, i) => s + (i.calories || 0), 0),
    p: items.reduce((s, i) => s + (i.protein || 0), 0),
    c: items.reduce((s, i) => s + (i.carbs || 0), 0),
    f: items.reduce((s, i) => s + (i.fat || 0), 0),
  }

  return (
    <div className="flex flex-col h-full bg-[#f5f5f7]">
      {showApiKeys && <ApiKeysModal onDismiss={() => setShowApiKeys(false)} onUsdaSaved={() => setUsdaKeySet(true)} />}
      {copySource && <CopyMealModal source={copySource} onCopy={handleCopy} onClose={() => setCopySource(null)} />}

      {/* Header */}
      <div className="px-4 pt-14 pb-3 bg-[#f5f5f7] flex-shrink-0">
        <div className="flex items-center justify-between mb-3">
          <h1 className="text-[28px] font-semibold text-[#1d1d1f] tracking-tight">Nutrition</h1>
          <div className="flex items-center gap-2">
            {/* API Keys button */}
            <button
              onClick={() => setShowApiKeys(true)}
              title="Manage API keys"
              className="flex items-center gap-1.5 bg-white border border-[#e5e5ea] px-3 py-1.5 rounded-xl shadow-sm"
            >
              <svg width="13" height="13" fill="none" stroke="#8e8e93" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">
                <path d="M21 2l-2 2m-7.61 7.61a5.5 5.5 0 1 1-7.778 7.778 5.5 5.5 0 0 1 7.777-7.777zm0 0L15.5 7.5m0 0l3 3L22 7l-3-3m-3.5 3.5L19 4"/>
              </svg>
              <span className="text-[#1d1d1f] text-sm font-medium">API Keys</span>
            </button>
          <button
            onClick={() => dateInputRef.current?.showPicker?.()}
            className="flex items-center gap-1.5 bg-white border border-[#e5e5ea] px-3 py-1.5 rounded-xl shadow-sm"
          >
            <svg width="14" height="14" fill="none" stroke="#8e8e93" strokeWidth="1.5" viewBox="0 0 24 24">
              <rect x="3" y="4" width="18" height="18" rx="2" />
              <path d="M16 2v4M8 2v4M3 10h18" strokeLinecap="round" />
            </svg>
            <span className="text-[#1d1d1f] text-sm font-medium">{formatDate(selectedDate)}</span>
            <span className="text-[#8e8e93] text-xs">▾</span>
          </button>
          </div>
          <input
            ref={dateInputRef}
            type="date"
            value={selectedDate}
            onChange={e => { if (e.target.value) setSelectedDate(e.target.value) }}
            className="absolute opacity-0 pointer-events-none w-0 h-0"
          />
        </div>

        {/* Daily summary */}
        <div className="bg-white rounded-2xl border border-[#e5e5ea] px-4 py-3 flex items-center gap-3">
          <div className="flex-1">
            <div className="flex justify-between text-sm mb-2">
              <span className="text-[#1d1d1f] font-semibold">{totalCals.toLocaleString()} kcal</span>
              <span className="text-[#8e8e93]">{goal.toLocaleString()} goal</span>
            </div>
            <div className="h-1 bg-[#f0f0f5] rounded-full overflow-hidden">
              <div
                className={`h-1 rounded-full transition-all ${over ? 'bg-red-500' : 'bg-[#30d158]'}`}
                style={{ width: `${Math.min((totalCals / goal) * 100, 100)}%` }}
              />
            </div>
          </div>
          <span className={`text-sm font-semibold flex-shrink-0 ${over ? 'text-red-500' : 'text-[#30d158]'}`}>
            {over ? `+${totalCals - goal}` : `${goal - totalCals} left`}
          </span>
        </div>
      </div>

      {/* Meal sections */}
      <div className="flex-1 overflow-y-auto px-4 pb-28 flex flex-col gap-3 pt-2">
        {mealLogs.length > 0 && (
          <div className="flex justify-end -mb-1">
            <button
              onClick={() => setCopySource({ kind: 'day', date: selectedDate, logs: mealLogs })}
              className="flex items-center gap-1.5 text-[#0071e3] text-xs font-semibold py-1 px-2 active:bg-[#0071e3]/10 rounded-lg transition-colors"
            >
              <svg width="11" height="11" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">
                <rect x="9" y="9" width="13" height="13" rx="2" />
                <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
              </svg>
              Copy day
            </button>
          </div>
        )}
        {MEAL_TYPES.map(type => {
          const logs = mealLogs.filter(m => m.meal === type)
          const typeCals = logs.reduce((s, m) => s + m.items.reduce((ss, i) => ss + i.calories, 0), 0)
          return (
            <div key={type} className="bg-white rounded-2xl border border-[#e5e5ea] overflow-hidden shadow-sm">
              <div className="flex items-center justify-between px-4 py-3">
                <div className="flex items-center gap-3">
                  <div className={`w-1.5 h-9 rounded-full ${MEAL_COLORS[type]}`} />
                  <div>
                    <p className="text-[#1d1d1f] font-semibold">{type}</p>
                    <p className="text-[#8e8e93] text-xs">{MEAL_TIMES[type]}{typeCals > 0 ? ` · ${typeCals} kcal` : ''}</p>
                  </div>
                </div>
                <button
                  onClick={() => openSheet(type)}
                  className="w-8 h-8 bg-[#f5f5f7] border border-[#e5e5ea] rounded-full flex items-center justify-center text-[#30d158] text-xl font-light"
                >
                  +
                </button>
              </div>
              {logs.length > 0 && (
                <div className="border-t border-[#f0f0f5] divide-y divide-[#f0f0f5]">
                  {logs.map(log => (
                    <div key={log.id} className="px-4 py-3.5 flex items-start gap-3">
                      <div className="flex-1 min-w-0 flex flex-col gap-1">
                        {log.items.map((item, i) => (
                          <div key={i} className="flex justify-between text-sm">
                            <span className="text-[#1d1d1f] truncate">
                              {item.name}
                              {item.amount ? <span className="text-[#8e8e93] text-xs ml-1">({item.amount})</span> : null}
                            </span>
                            <span className="text-[#6e6e73] ml-2 flex-shrink-0">{item.calories} kcal</span>
                          </div>
                        ))}
                      </div>
                      <div className="flex items-center gap-1.5 flex-shrink-0">
                        <button
                          onClick={() => openEdit(log)}
                          title="Edit"
                          className="w-8 h-8 bg-[#f5f5f7] rounded-full flex items-center justify-center text-[#8e8e93] active:text-[#0071e3] active:bg-[#e5e5ea] transition-colors"
                        >
                          <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">
                            <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7" />
                            <path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z" />
                          </svg>
                        </button>
                        <button
                          onClick={() => setCopySource({ kind: 'meal', log })}
                          title="Copy to another day"
                          className="w-8 h-8 bg-[#f5f5f7] rounded-full flex items-center justify-center text-[#8e8e93] active:text-[#0071e3] active:bg-[#e5e5ea] transition-colors"
                        >
                          <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">
                            <rect x="9" y="9" width="13" height="13" rx="2" />
                            <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
                          </svg>
                        </button>
                        <button
                          onClick={() => deleteMealLog(log.id)}
                          title="Delete"
                          className="w-8 h-8 bg-[#f5f5f7] rounded-full flex items-center justify-center text-[#8e8e93] active:text-[#ff3b30] active:bg-[#e5e5ea] transition-colors"
                        >
                          <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                            <path d="M1 1l10 10M11 1L1 11" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                          </svg>
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )
        })}
      </div>

      {/* FAB */}
      <button
        onClick={() => openSheet()}
        className="fixed bottom-24 right-5 w-14 h-14 bg-[#30d158] rounded-full shadow-lg flex items-center justify-center text-white text-3xl font-light active:scale-95 transition-transform z-30"
      >
        +
      </button>

      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={e => e.target.files?.[0] && handlePhoto(e.target.files[0])}
        onClick={e => { (e.target as HTMLInputElement).value = '' }}
      />

      {/* Bottom sheet */}
      {step !== 'closed' && (
        <div className="fixed inset-0 z-40 flex flex-col justify-end">
          <div className="absolute inset-0 bg-black/30" onClick={closeSheet} />
          <div className="relative bg-white rounded-t-3xl max-h-[88vh] flex flex-col overflow-hidden shadow-2xl">
            <div className="flex justify-center pt-3 pb-1 flex-shrink-0">
              <div className="w-10 h-1 bg-[#e5e5ea] rounded-full" />
            </div>
            <div className="overflow-y-auto flex-1 px-5 pb-10">

              {step === 'select-meal' && (
                <div className="flex flex-col gap-4 py-4">
                  <h3 className="text-[#1d1d1f] font-semibold text-xl">Add Meal</h3>
                  <div className="grid grid-cols-2 gap-2">
                    {MEAL_TYPES.map(type => (
                      <button
                        key={type}
                        onClick={() => { setSelectedMeal(type); setStep('select-method') }}
                        className="flex flex-col gap-0.5 p-4 bg-[#f5f5f7] border border-[#e5e5ea] rounded-2xl text-left active:scale-95 transition-transform"
                      >
                        <span className="text-[#1d1d1f] font-semibold">{type}</span>
                        <span className="text-[#8e8e93] text-xs">{MEAL_TIMES[type]}</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {step === 'select-method' && (
                <div className="flex flex-col gap-4 py-4">
                  <div>
                    <p className="text-[#8e8e93] text-sm">Adding to</p>
                    <h3 className="text-[#1d1d1f] font-semibold text-xl">{selectedMeal}</h3>
                  </div>
                  {error && (
                    <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-red-600 text-sm">{error}</div>
                  )}
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    className="flex items-center gap-4 p-4 bg-[#f5f5f7] border border-[#e5e5ea] rounded-2xl text-left active:scale-95 transition-transform"
                  >
                    <svg width="24" height="24" fill="none" stroke="#30d158" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">
                      <path d="M23 19a2 2 0 01-2 2H3a2 2 0 01-2-2V8a2 2 0 012-2h4l2-3h6l2 3h4a2 2 0 012 2z" />
                      <circle cx="12" cy="13" r="4" />
                    </svg>
                    <div>
                      <p className="text-[#1d1d1f] font-semibold">Photo analysis</p>
                      <p className="text-[#8e8e93] text-sm">Claude AI identifies food and estimates calories</p>
                    </div>
                  </button>
                  <button
                    onClick={() => { setItems([emptyItem()]); setStep('manual-add') }}
                    className="flex items-center gap-4 p-4 bg-[#f5f5f7] border border-[#e5e5ea] rounded-2xl text-left active:scale-95 transition-transform"
                  >
                    <svg width="24" height="24" fill="none" stroke="#30d158" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">
                      <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7" />
                      <path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z" />
                    </svg>
                    <div>
                      <p className="text-[#1d1d1f] font-semibold">Enter manually</p>
                      <p className="text-[#8e8e93] text-sm">Type in food items and nutrition yourself</p>
                    </div>
                  </button>
                </div>
              )}

              {step === 'analyzing' && (
                <div className="flex flex-col items-center justify-center py-16 gap-5">
                  {photoPreview && <img src={photoPreview} alt="food" className="w-36 h-36 rounded-2xl object-cover" />}
                  <div className="w-7 h-7 border-2 border-[#e5e5ea] border-t-[#30d158] rounded-full animate-spin" />
                  <p className="text-[#6e6e73] text-sm">Analysing your meal...</p>
                </div>
              )}

              {(step === 'review' || step === 'manual-add') && (
                <div className="flex flex-col gap-4 py-4">
                  <div className="flex items-center justify-between">
                    <h3 className="text-[#1d1d1f] font-semibold text-xl">
                      {step === 'review' ? 'Review & Edit' : editingMealId ? 'Edit Meal' : 'Add Items'}
                    </h3>
                    <span className="text-sm text-[#8e8e93]">{selectedMeal}</span>
                  </div>

                  {photoPreview && step === 'review' && (
                    <img src={photoPreview} alt="food" className="w-full h-40 rounded-xl object-cover" />
                  )}

                  <div className="flex flex-col gap-2">
                    {items.map((item, i) => (
                      <ItemEditor
                        key={i}
                        item={item}
                        hasUsdaKey={usdaKeySet}
                        onChange={updated => setItems(prev => prev.map((it, j) => j === i ? updated : it))}
                        onDelete={() => setItems(prev => prev.filter((_, j) => j !== i))}
                      />
                    ))}
                  </div>

                  <button
                    onClick={() => setItems(prev => [...prev, emptyItem()])}
                    className="w-full py-3 border border-dashed border-[#c7c7cc] text-[#8e8e93] rounded-xl text-sm"
                  >
                    + Add another item
                  </button>

                  {items.length > 0 && (
                    <div className="bg-[#f5f5f7] border border-[#e5e5ea] rounded-xl px-4 py-3">
                      <div className="flex justify-between text-sm">
                        <span className="text-[#6e6e73]">Total</span>
                        <span className="text-[#1d1d1f] font-semibold">{itemTotal.cal} kcal</span>
                      </div>
                      <div className="flex gap-4 mt-1 text-xs text-[#8e8e93]">
                        <span>P {itemTotal.p}g</span>
                        <span>C {itemTotal.c}g</span>
                        <span>F {itemTotal.f}g</span>
                      </div>
                    </div>
                  )}

                  <button
                    onClick={saveMeal}
                    disabled={!items.some(i => i.name.trim())}
                    className="w-full bg-[#30d158] disabled:bg-[#e5e5ea] disabled:text-[#c7c7cc] text-white font-semibold py-4 rounded-2xl active:scale-95 transition-all"
                  >
                    {editingMealId ? 'Update' : 'Save'} {selectedMeal}
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
