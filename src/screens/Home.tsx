import { useMemo } from 'react'
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts'
import { storage } from '../lib/storage'

function todayStr() { return new Date().toISOString().split('T')[0] }

function last7Days() {
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(); d.setDate(d.getDate() - (6 - i))
    return d.toISOString().split('T')[0]
  })
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

  const weight7Days = useMemo(() =>
    days.map(date => {
      const log = weightLogs.find(w => w.date === date)
      return { day: shortDay(date), weight: log?.weight ?? null, date }
    }).filter(d => d.weight !== null), [weightLogs, days])

  const workout7Days = useMemo(() =>
    days.map(date => {
      const log = workoutLogs.find(w => w.date === date)
      return { done: !!log, isRest: log?.isRestDay ?? false, date, day: shortDay(date) }
    }), [workoutLogs, days])

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
        <div className="flex items-center justify-between mb-1">
          <p className="text-[#8e8e93] text-xs font-semibold uppercase tracking-wider">Weight Trend</p>
          {weight7Days.length > 0 && (
            <span className="text-[#1d1d1f] text-sm font-bold">
              {weight7Days[weight7Days.length - 1].weight}{' '}
              <span className="text-[#8e8e93] font-normal">{profile?.weightUnit ?? 'kg'}</span>
            </span>
          )}
        </div>
        {weight7Days.length < 2 ? (
          <p className="text-[#c7c7cc] text-sm text-center py-6">Log weight on 2+ days to see your trend</p>
        ) : (
          <ResponsiveContainer width="100%" height={110}>
            <LineChart data={weight7Days}>
              <XAxis dataKey="day" tick={{ fill: '#8e8e93', fontSize: 10 }} axisLine={false} tickLine={false} />
              <YAxis domain={['auto', 'auto']} tick={{ fill: '#8e8e93', fontSize: 10 }} axisLine={false} tickLine={false} width={28} />
              <Tooltip contentStyle={{ background: '#fff', border: '1px solid #e5e5ea', borderRadius: 10, fontSize: 12, boxShadow: '0 4px 16px rgba(0,0,0,0.08)' }} formatter={(v: unknown) => [`${Number(v) || 0} ${profile?.weightUnit ?? 'kg'}`, 'Weight']} />
              <Line type="monotone" dataKey="weight" stroke="#0071e3" strokeWidth={2.5} dot={{ fill: '#0071e3', r: 4, strokeWidth: 0 }} activeDot={{ r: 6, fill: '#0071e3' }} />
            </LineChart>
          </ResponsiveContainer>
        )}
      </div>

      {/* Workout card */}
      <div className="bg-white rounded-2xl border border-[#e5e5ea] px-5 py-4 shadow-sm">
        <div className="flex items-center justify-between mb-4">
          <p className="text-[#8e8e93] text-xs font-semibold uppercase tracking-wider">Workouts</p>
          <span className={`text-xs font-semibold px-3 py-1 rounded-full ${
            workout7Days[6].done
              ? workout7Days[6].isRest ? 'bg-blue-50 text-blue-500' : 'bg-[#30d158]/10 text-[#30d158]'
              : 'bg-[#f5f5f7] text-[#8e8e93]'
          }`}>
            {workout7Days[6].done ? (workout7Days[6].isRest ? 'Rest day' : 'Done') : 'Not logged'}
          </span>
        </div>
        <div className="flex gap-2">
          {workout7Days.map((w, i) => (
            <div key={i} className="flex-1 flex flex-col items-center gap-1.5">
              <div className={`w-full aspect-square rounded-xl border-2 flex items-center justify-center ${
                !w.done ? 'border-[#e5e5ea] bg-white' :
                w.isRest ? 'border-blue-200 bg-blue-50' :
                'border-[#30d158] bg-[#30d158]'
              }`}>
                {w.done && !w.isRest && (
                  <svg width="13" height="13" viewBox="0 0 13 13" fill="none">
                    <path d="M2.5 6.5l3 3 5-5" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                )}
                {w.isRest && (
                  <div className="w-1.5 h-1.5 rounded-full bg-blue-400" />
                )}
              </div>
              <span className="text-[#8e8e93] text-[10px]">{w.day}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
