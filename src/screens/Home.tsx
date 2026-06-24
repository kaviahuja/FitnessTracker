import { useMemo, useState } from 'react'
import type { CSSProperties } from 'react'
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts'
import { storage } from '../lib/storage'

type WeightRange = '1w' | '2w' | '1m' | '3m' | '6m'
const RANGE_DAYS: Record<WeightRange, number> = { '1w': 7, '2w': 14, '1m': 30, '3m': 90, '6m': 180 }
const RANGE_LABELS: Record<WeightRange, string> = { '1w': '1W', '2w': '2W', '1m': '1M', '3m': '3M', '6m': '6M' }

function rangeDays(range: WeightRange): string[] {
  const n = RANGE_DAYS[range]
  return Array.from({ length: n }, (_, i) => {
    const d = new Date()
    d.setDate(d.getDate() - (n - 1 - i))
    return d.toISOString().split('T')[0]
  })
}

function tickLabel(dateStr: string, range: WeightRange): string {
  const d = new Date(dateStr + 'T00:00:00')
  // Short weekday label for 1W; date label for everything longer.
  if (range === '1w') return d.toLocaleDateString('en-US', { weekday: 'short' })
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

function todayStr() { return new Date().toISOString().split('T')[0] }

function last7Days() {
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(); d.setDate(d.getDate() - (6 - i))
    return d.toISOString().split('T')[0]
  })
}

function currentWeekDays(): string[] {
  const today = new Date()
  const dow = today.getDay()
  const offset = dow === 0 ? -6 : 1 - dow
  const monday = new Date(today)
  monday.setDate(today.getDate() + offset)
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(monday)
    d.setDate(monday.getDate() + i)
    return d.toISOString().split('T')[0]
  })
}

function weekdayIdx(dateStr: string): number {
  return (new Date(dateStr + 'T00:00:00').getDay() + 6) % 7
}

function mondayOf(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00')
  const dow = d.getDay()
  d.setDate(d.getDate() + (dow === 0 ? -6 : 1 - dow))
  return d.toISOString().split('T')[0]
}

function shortDay(dateStr: string) {
  return new Date(dateStr + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'short' })
}

function CalorieRing({ consumed, goal }: { consumed: number; goal: number }) {
  const pct = Math.min(consumed / goal, 1)
  const r = 52
  const circ = 2 * Math.PI * r
  const over = consumed > goal
  return (
    <div className="relative flex items-center justify-center flex-shrink-0" style={{ width: 130, height: 130 }}>
      <svg width="130" height="130" style={{ transform: 'rotate(-90deg)' }}>
        <circle cx="65" cy="65" r={r} fill="none" stroke="#f0f0f5" strokeWidth="11" />
        <circle
          cx="65" cy="65" r={r} fill="none"
          stroke={over ? '#ff3b30' : '#30d158'}
          strokeWidth="11" strokeLinecap="round"
          strokeDasharray={`${pct * circ} ${circ}`}
          style={{ transition: 'stroke-dasharray 0.6s ease' }}
        />
      </svg>
      <div className="absolute flex flex-col items-center">
        <span className="text-[22px] font-bold text-[#1d1d1f] leading-none">{Math.round(pct * 100)}%</span>
        <span className="text-[10px] text-[#8e8e93] mt-0.5">of goal</span>
      </div>
    </div>
  )
}

function MacroBar({ label, consumed, goal, barColor, labelColor }: {
  label: string; consumed: number; goal: number; barColor: string; labelColor: string
}) {
  const pct = Math.min((consumed / goal) * 100, 100)
  return (
    <div className="flex items-center gap-2">
      <span className={`text-xs font-semibold w-12 ${labelColor}`}>{label}</span>
      <div className="flex-1 h-1.5 bg-[#f0f0f5] rounded-full overflow-hidden">
        <div className={`h-1.5 rounded-full transition-all ${barColor}`} style={{ width: `${pct}%` }} />
      </div>
      <span className="text-[10px] text-[#8e8e93] w-16 text-right">{consumed}g / {goal}g</span>
    </div>
  )
}

export default function Home() {
  const profile = storage.getProfile()
  const today = todayStr()
  const days = last7Days()
  const mealLogs = storage.getMealLogs()
  const weightLogs = storage.getWeightLogs()
  const workoutLogs = storage.getWorkoutLogs()
  const routine = storage.getRoutine()
  const [weightRange, setWeightRange] = useState<WeightRange>('1w')

  const todayNutrition = useMemo(() =>
    mealLogs.filter(m => m.date === today).reduce(
      (acc, meal) => {
        meal.items.forEach(i => { acc.calories += i.calories; acc.protein += i.protein; acc.carbs += i.carbs; acc.fat += i.fat })
        return acc
      },
      { calories: 0, protein: 0, carbs: 0, fat: 0 }
    ), [mealLogs, today])

  const calorie7Days = useMemo(() =>
    days.map(date => ({
      day: shortDay(date),
      cals: mealLogs.filter(m => m.date === date).reduce((s, m) => s + m.items.reduce((ss, i) => ss + i.calories, 0), 0),
      date,
    })), [mealLogs, days])

  const weightSeries = useMemo(() =>
    rangeDays(weightRange).map(date => {
      const log = weightLogs.find(w => w.date === date)
      return { label: tickLabel(date, weightRange), weight: log?.weight ?? null, date }
    }).filter(d => d.weight !== null), [weightLogs, weightRange])

  const workoutWeekDays = useMemo(() =>
    currentWeekDays().map(date => {
      const log = workoutLogs.find(w => w.date === date)
      const routineDay = routine[weekdayIdx(date)]
      const isFuture = date > today
      const isToday = date === today

      let state: 'green' | 'red' | 'blue' | 'grey'
      if (log && !log.isRestDay) state = 'green'
      else if (log?.isRestDay || routineDay?.isRestDay) state = 'blue'
      else if (!isFuture && !isToday && routineDay && !routineDay.isRestDay) state = 'red'
      else state = 'grey'

      const label = routineDay?.name?.trim() ||
        (routineDay?.isRestDay || log?.isRestDay ? 'Rest' : '')

      return { date, state, label }
    }), [workoutLogs, routine, today])

  const { chartData, topExerciseName, useReps } = useMemo(() => {
    const freq = new Map<string, number>()
    for (const log of workoutLogs) {
      if (log.isRestDay) continue
      for (const ex of log.exercises) {
        const k = ex.name.toLowerCase()
        freq.set(k, (freq.get(k) ?? 0) + 1)
      }
    }
    if (freq.size === 0) return { chartData: [], topExerciseName: '', useReps: false }

    const topKey = [...freq.entries()].sort((a, b) => b[1] - a[1])[0][0]
    const topName = workoutLogs.flatMap(l => l.exercises)
      .find(e => e.name.toLowerCase() === topKey)?.name ?? topKey

    const hasWeight = workoutLogs.some(l =>
      l.exercises.some(e => e.name.toLowerCase() === topKey &&
        e.sets.some(s => (s.weight ?? 0) > 0)))

    const thisMon = mondayOf(today)
    const weeks = Array.from({ length: 6 }, (_, i) => {
      const d = new Date(thisMon + 'T00:00:00')
      d.setDate(d.getDate() - (5 - i) * 7)
      return d.toISOString().split('T')[0]
    })

    const data = weeks.map(mon => {
      const sun = (() => { const d = new Date(mon + 'T00:00:00'); d.setDate(d.getDate() + 6); return d.toISOString().split('T')[0] })()
      let max: number | null = null
      for (const log of workoutLogs.filter(l => l.date >= mon && l.date <= sun && !l.isRestDay)) {
        for (const ex of log.exercises.filter(e => e.name.toLowerCase() === topKey)) {
          for (const s of ex.sets) {
            const v = hasWeight ? (s.weight ?? null) : s.reps
            if (v != null && (max === null || v > max)) max = v
          }
        }
      }
      const label = new Date(mon + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
      return { weekLabel: label, value: max }
    })

    return { chartData: data, topExerciseName: topName, useReps: !hasWeight }
  }, [workoutLogs, today])

  const hasEnoughChartData = chartData.filter(d => d.value !== null).length >= 2

  const calorieGoal = profile?.calorieGoal ?? 2000
  const consumed = todayNutrition.calories
  const remaining = Math.max(calorieGoal - consumed, 0)
  const over = consumed > calorieGoal

  const greeting = () => {
    const h = new Date().getHours()
    return h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening'
  }

  return (
    <div className="flex flex-col gap-4 px-4 pb-8 overflow-y-auto h-full bg-[#f5f5f7]">
      {/* Header */}
      <div className="pt-14 pb-1">
        <p className="text-[#8e8e93] text-sm">{greeting()}</p>
        <h1 className="text-[30px] font-bold text-[#1d1d1f] tracking-tight">{profile?.name ?? 'there'}</h1>
        <p className="text-[#8e8e93] text-sm mt-0.5">
          {new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
        </p>
      </div>

      {/* Calories card */}
      <div className="bg-white rounded-2xl border border-[#e5e5ea] px-5 py-4 shadow-sm">
        <p className="text-[#8e8e93] text-xs font-semibold uppercase tracking-wider mb-4">Calories</p>
        <div className="flex items-center gap-4 mb-4">
          <CalorieRing consumed={consumed} goal={calorieGoal} />
          <div className="flex-1">
            <div className="flex gap-5 mb-3">
              <div>
                <p className="text-[30px] font-bold text-[#1d1d1f] leading-none tracking-tight">{consumed.toLocaleString()}</p>
                <p className="text-[#8e8e93] text-xs mt-1">consumed</p>
              </div>
              <div>
                <p className={`text-[22px] font-bold leading-none tracking-tight ${over ? 'text-[#ff3b30]' : 'text-[#30d158]'}`}>
                  {over ? `+${(consumed - calorieGoal).toLocaleString()}` : remaining.toLocaleString()}
                </p>
                <p className="text-[#8e8e93] text-xs mt-1">{over ? 'over goal' : 'remaining'}</p>
              </div>
            </div>
            <div className="flex flex-col gap-2">
              <MacroBar label="Protein" consumed={todayNutrition.protein} goal={profile?.proteinGoal ?? 150} barColor="bg-[#0071e3]" labelColor="text-[#0071e3]" />
              <MacroBar label="Carbs" consumed={todayNutrition.carbs} goal={profile?.carbsGoal ?? 200} barColor="bg-[#ff9500]" labelColor="text-[#ff9500]" />
              <MacroBar label="Fat" consumed={todayNutrition.fat} goal={profile?.fatGoal ?? 65} barColor="bg-[#ff453a]" labelColor="text-[#ff453a]" />
            </div>
          </div>
        </div>

        {/* 7-day chart */}
        <div className="pt-4 border-t border-[#f5f5f7]">
          <p className="text-[#8e8e93] text-xs font-semibold uppercase tracking-wider mb-3">Last 7 days</p>
          {calorie7Days.every(d => d.cals === 0) ? (
            <p className="text-[#c7c7cc] text-sm text-center py-4">No data yet — start logging meals</p>
          ) : (
            <ResponsiveContainer width="100%" height={72}>
              <BarChart data={calorie7Days} barSize={18}>
                <XAxis dataKey="day" tick={{ fill: '#8e8e93', fontSize: 10 }} axisLine={false} tickLine={false} />
                <Tooltip cursor={false} contentStyle={{ background: '#fff', border: '1px solid #e5e5ea', borderRadius: 10, fontSize: 12, boxShadow: '0 4px 16px rgba(0,0,0,0.08)' }} formatter={(v: unknown) => [`${Number(v) || 0} kcal`, '']} />
                <Bar dataKey="cals" radius={[5, 5, 0, 0]}>
                  {calorie7Days.map((e, i) => <Cell key={i} fill={e.date === today ? '#30d158' : '#e5e5ea'} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      {/* Weight card */}
      <div className="bg-white rounded-2xl border border-[#e5e5ea] px-5 py-4 shadow-sm">
        <div className="flex items-center justify-between mb-2">
          <p className="text-[#8e8e93] text-xs font-semibold uppercase tracking-wider">Weight Trend</p>
          {weightSeries.length > 0 && (
            <span className="text-[#1d1d1f] text-sm font-bold">
              {weightSeries[weightSeries.length - 1].weight}{' '}
              <span className="text-[#8e8e93] font-normal">{profile?.weightUnit ?? 'kg'}</span>
            </span>
          )}
        </div>
        {/* Range chips */}
        <div className="flex gap-1 mb-3">
          {(['1w', '2w', '1m', '3m', '6m'] as WeightRange[]).map(r => (
            <button
              key={r}
              onClick={() => setWeightRange(r)}
              className={`flex-1 py-1 rounded-md text-[11px] font-semibold transition-all ${
                weightRange === r ? 'bg-[#0071e3] text-white shadow-sm' : 'bg-[#f5f5f7] text-[#8e8e93]'
              }`}
            >
              {RANGE_LABELS[r]}
            </button>
          ))}
        </div>
        {weightSeries.length < 2 ? (
          <p className="text-[#c7c7cc] text-sm text-center py-6">
            {weightSeries.length === 0
              ? `No weight logs in the last ${RANGE_LABELS[weightRange]} — log on 2+ days to see your trend`
              : 'Log weight on 2+ days to see your trend'}
          </p>
        ) : (
          <ResponsiveContainer width="100%" height={110}>
            <LineChart data={weightSeries}>
              <XAxis
                dataKey="label"
                tick={{ fill: '#8e8e93', fontSize: 10 }}
                axisLine={false}
                tickLine={false}
                minTickGap={20}
              />
              <YAxis domain={['auto', 'auto']} tick={{ fill: '#8e8e93', fontSize: 10 }} axisLine={false} tickLine={false} width={28} />
              <Tooltip contentStyle={{ background: '#fff', border: '1px solid #e5e5ea', borderRadius: 10, fontSize: 12, boxShadow: '0 4px 16px rgba(0,0,0,0.08)' }} formatter={(v: unknown) => [`${Number(v) || 0} ${profile?.weightUnit ?? 'kg'}`, 'Weight']} />
              <Line
                type="monotone"
                dataKey="weight"
                stroke="#0071e3"
                strokeWidth={2.5}
                dot={weightSeries.length <= 30 ? { fill: '#0071e3', r: 4, strokeWidth: 0 } : false}
                activeDot={{ r: 6, fill: '#0071e3' }}
              />
            </LineChart>
          </ResponsiveContainer>
        )}
      </div>

      {/* Workout card */}
      <div className="bg-white rounded-2xl border border-[#e5e5ea] px-5 py-4 shadow-sm">
        <p className="text-[#8e8e93] text-xs font-semibold uppercase tracking-wider mb-4">Workouts</p>

        {/* Progress chart */}
        {topExerciseName && (
          <div className="mb-4 pb-4 border-b border-[#f5f5f7]">
            <div className="flex items-baseline justify-between mb-2">
              <p className="text-[#1d1d1f] text-sm font-semibold truncate flex-1 mr-2">{topExerciseName}</p>
              <p className="text-[#8e8e93] text-[10px] flex-shrink-0">
                {useReps ? 'Max reps/week' : `Max ${profile?.weightUnit ?? 'kg'}/week`}
              </p>
            </div>
            {!hasEnoughChartData ? (
              <p className="text-[#c7c7cc] text-sm text-center py-4">Log 2+ weeks to see your progress trend</p>
            ) : (
              <ResponsiveContainer width="100%" height={90}>
                <LineChart data={chartData}>
                  <XAxis dataKey="weekLabel" tick={{ fill: '#8e8e93', fontSize: 10 }} axisLine={false} tickLine={false} />
                  <YAxis domain={['auto', 'auto']} tick={{ fill: '#8e8e93', fontSize: 10 }} axisLine={false} tickLine={false} width={28} />
                  <Tooltip contentStyle={{ background: '#fff', border: '1px solid #e5e5ea', borderRadius: 10, fontSize: 12, boxShadow: '0 4px 16px rgba(0,0,0,0.08)' }}
                    formatter={(v: unknown) => v == null ? ['—', ''] : [`${Number(v)} ${useReps ? 'reps' : (profile?.weightUnit ?? 'kg')}`, '']} />
                  <Line type="monotone" dataKey="value" stroke="#30d158" strokeWidth={2.5} connectNulls={false}
                    dot={{ fill: '#30d158', r: 4, strokeWidth: 0 }} activeDot={{ r: 6, fill: '#30d158' }} />
                </LineChart>
              </ResponsiveContainer>
            )}
          </div>
        )}

        {/* Mon–Sun boxes */}
        <div className="flex gap-2">
          {workoutWeekDays.map((w, i) => {
            const boxStyle: CSSProperties =
              w.state === 'green' ? { backgroundColor: '#30d158', borderColor: '#30d158' } :
              w.state === 'red'   ? { backgroundColor: '#ff3b30', borderColor: '#ff3b30' } :
              w.state === 'blue'  ? { backgroundColor: '#e8f1fb', borderColor: '#bfd4f5' } :
                                    { backgroundColor: 'white',   borderColor: '#e5e5ea' }
            const labelColor =
              w.state === 'green' || w.state === 'red' ? 'text-white' :
              w.state === 'blue' ? 'text-[#0071e3]' : 'text-[#c7c7cc]'
            return (
              <div key={i} className="flex-1 flex flex-col items-center gap-1.5">
                <div className="w-full aspect-square rounded-xl border-2 flex items-center justify-center px-0.5" style={boxStyle}>
                  {w.label ? (
                    <span className={`text-[9px] font-bold text-center leading-tight ${labelColor}`}>{w.label}</span>
                  ) : w.state === 'green' ? (
                    <svg width="13" height="13" viewBox="0 0 13 13" fill="none">
                      <path d="M2.5 6.5l3 3 5-5" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                  ) : null}
                </div>
                <span className="text-[#8e8e93] text-[10px]">
                  {new Date(w.date + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'short' }).slice(0, 3)}
                </span>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
