import { useState } from 'react'
import { storage } from '../lib/storage'
import type { WeightUnit, WeightLog } from '../types'

function todayStr() { return new Date().toISOString().split('T')[0] }
function uid() { return Date.now().toString(36) + Math.random().toString(36).slice(2) }

function formatDate(dateStr: string): string {
  const today = todayStr()
  const yesterday = new Date(); yesterday.setDate(yesterday.getDate() - 1)
  const yStr = yesterday.toISOString().split('T')[0]
  const label = new Date(dateStr + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })
  if (dateStr === today) return 'Today'
  if (dateStr === yStr) return 'Yesterday'
  return label
}

function formatFullDate(dateStr: string): string {
  return new Date(dateStr + 'T00:00:00').toLocaleDateString('en-US', {
    weekday: 'long', month: 'long', day: 'numeric',
  })
}

export default function LogWeight() {
  const profile = storage.getProfile()
  const [unit, setUnit] = useState<WeightUnit>(profile?.weightUnit ?? 'kg')
  const [selectedDate, setSelectedDate] = useState(todayStr())
  const [, setRefresh] = useState(0)

  const allLogs = storage.getWeightLogs().sort((a, b) => b.date.localeCompare(a.date))
  const existingLog = allLogs.find(l => l.date === selectedDate)
  const [input, setInput] = useState(existingLog ? String(existingLog.weight) : '')

  // When date changes, update the input to existing value for that date
  function changeDate(date: string) {
    setSelectedDate(date)
    const log = allLogs.find(l => l.date === date)
    setInput(log ? String(log.weight) : '')
  }

  function save() {
    const val = parseFloat(input)
    if (!val || val <= 0) return
    const log: WeightLog = { id: uid(), date: selectedDate, weight: val, unit }
    storage.saveWeightLog(log)
    setRefresh(r => r + 1)
  }

  const valid = parseFloat(input) > 0

  // Trend: difference from previous log
  const sortedLogs = [...allLogs].sort((a, b) => a.date.localeCompare(b.date))
  const latestTwo = sortedLogs.slice(-2)
  const trend = latestTwo.length === 2
    ? (latestTwo[1].weight - latestTwo[0].weight)
    : null

  return (
    <div className="flex flex-col h-full bg-[#f5f5f7] overflow-y-auto">
      <div className="px-4 pt-14 pb-4">
        <div className="flex items-center justify-between mb-1">
          <h1 className="text-[28px] font-semibold text-[#1d1d1f] tracking-tight">Weight</h1>
          {/* Date picker */}
          <button
            onClick={() => (document.getElementById('weight-date-input') as HTMLInputElement)?.showPicker?.()}
            className="flex items-center gap-1.5 bg-white border border-[#e5e5ea] px-3 py-1.5 rounded-xl shadow-sm"
          >
            <svg width="14" height="14" fill="none" stroke="#8e8e93" strokeWidth="1.5" viewBox="0 0 24 24">
              <rect x="3" y="4" width="18" height="18" rx="2" />
              <path d="M16 2v4M8 2v4M3 10h18" strokeLinecap="round" />
            </svg>
            <span className="text-[#1d1d1f] text-sm font-medium">{formatDate(selectedDate)}</span>
            <span className="text-[#8e8e93] text-xs">▾</span>
          </button>
          <input
            id="weight-date-input"
            type="date"
            value={selectedDate}
            max={todayStr()}
            onChange={e => { if (e.target.value) changeDate(e.target.value) }}
            className="absolute opacity-0 pointer-events-none w-0 h-0"
          />
        </div>
        <p className="text-[#8e8e93] text-sm">{formatFullDate(selectedDate)}</p>
      </div>

      {/* Log entry card */}
      <div className="px-4">
        <div className="bg-white rounded-2xl border border-[#e5e5ea] px-5 py-5">
          <p className="text-[#8e8e93] text-xs font-medium uppercase tracking-wide mb-4">
            {existingLog ? 'Logged weight' : 'Log your weight'}
          </p>

          {/* Unit toggle */}
          <div className="flex bg-[#f5f5f7] rounded-xl p-1 mb-5 w-40">
            {(['kg', 'lbs'] as WeightUnit[]).map(u => (
              <button
                key={u}
                onClick={() => setUnit(u)}
                className={`flex-1 py-1.5 rounded-lg text-sm font-medium transition-all ${
                  unit === u ? 'bg-white text-[#1d1d1f] shadow-sm' : 'text-[#8e8e93]'
                }`}
              >
                {u}
              </button>
            ))}
          </div>

          {/* Weight input */}
          <div className="flex items-end gap-2 mb-6">
            <input
              type="number"
              inputMode="decimal"
              value={input}
              onChange={e => setInput(e.target.value)}
              placeholder={unit === 'kg' ? '70.0' : '154.0'}
              className="text-[56px] font-bold text-[#0071e3] tracking-tight bg-transparent outline-none w-48 placeholder-[#d1d1d6] leading-none"
            />
            <span className="text-[#8e8e93] text-xl font-medium pb-2">{unit}</span>
          </div>

          <button
            onClick={save}
            disabled={!valid}
            className="w-full bg-[#30d158] disabled:bg-[#e5e5ea] disabled:text-[#c7c7cc] text-white font-semibold py-3.5 rounded-xl active:scale-95 transition-all"
          >
            {existingLog ? 'Update' : 'Save'}
          </button>
        </div>

        {/* Trend indicator */}
        {trend !== null && allLogs.length >= 2 && (
          <div className="mt-3 bg-white rounded-2xl border border-[#e5e5ea] px-5 py-4 flex items-center justify-between shadow-sm">
            <div>
              <p className="text-[#8e8e93] text-xs font-semibold uppercase tracking-wider">Change</p>
              <p className={`text-xl font-bold mt-0.5 ${
                trend === 0 ? 'text-[#1d1d1f]' :
                (profile?.goal === 'lose_weight' ? (trend < 0 ? 'text-[#30d158]' : 'text-[#ff3b30]') :
                 profile?.goal === 'gain_weight' || profile?.goal === 'gain_muscle' ? (trend > 0 ? 'text-[#30d158]' : 'text-[#8e8e93]') :
                 'text-[#1d1d1f]')
              }`}>
                {trend > 0 ? '+' : ''}{trend.toFixed(1)} {latestTwo[1].unit}
              </p>
            </div>
            <div className={`w-10 h-10 rounded-full flex items-center justify-center text-white text-lg font-bold ${
              trend === 0 ? 'bg-[#8e8e93]' :
              (profile?.goal === 'lose_weight' ? (trend < 0 ? 'bg-[#30d158]' : 'bg-[#ff3b30]') :
               profile?.goal === 'gain_weight' || profile?.goal === 'gain_muscle' ? (trend > 0 ? 'bg-[#30d158]' : 'bg-[#8e8e93]') :
               'bg-[#0071e3]')
            }`}>
              {trend > 0 ? '↑' : trend < 0 ? '↓' : '→'}
            </div>
          </div>
        )}
      </div>

      {/* History */}
      {allLogs.length > 0 && (
        <div className="px-4 mt-4 pb-24">
          <p className="text-[#8e8e93] text-xs font-medium uppercase tracking-wide px-1 mb-2">History</p>
          <div className="bg-white rounded-2xl border border-[#e5e5ea] overflow-hidden divide-y divide-[#f0f0f5]">
            {allLogs.slice(0, 20).map(log => (
              <div key={log.id} className="flex items-center justify-between px-5 py-3">
                <span className="text-[#6e6e73] text-sm">{formatDate(log.date)}</span>
                <span className="text-[#1d1d1f] font-semibold">{log.weight} <span className="text-[#8e8e93] font-normal text-sm">{log.unit}</span></span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
