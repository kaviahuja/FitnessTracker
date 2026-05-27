import { useState } from 'react'
import { BrowserRouter, Routes, Route, NavLink } from 'react-router-dom'
import { storage } from './lib/storage'
import Onboarding from './onboarding/Onboarding'
import Home from './screens/Home'
import LogFood from './screens/LogFood'
import LogWeight from './screens/LogWeight'
import LogWorkout from './screens/LogWorkout'
import Profile from './screens/Profile'

function NavIcon({ name, active }: { name: string; active: boolean }) {
  const s = active ? 2 : 1.5
  const icons: Record<string, React.ReactNode> = {
    home: (
      <svg width="24" height="24" fill="none" stroke="currentColor" strokeWidth={s} strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">
        <path d="M3 9.5L12 3l9 6.5V20a1 1 0 01-1 1H5a1 1 0 01-1-1V9.5z" />
        <path d="M9 21V12h6v9" />
      </svg>
    ),
    food: (
      <svg width="24" height="24" fill="none" stroke="currentColor" strokeWidth={s} strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">
        <path d="M18 8h1a4 4 0 010 8h-1" />
        <path d="M2 8h16v9a4 4 0 01-4 4H6a4 4 0 01-4-4V8z" />
        <line x1="6" y1="1" x2="6" y2="4" />
        <line x1="10" y1="1" x2="10" y2="4" />
        <line x1="14" y1="1" x2="14" y2="4" />
      </svg>
    ),
    weight: (
      <svg width="24" height="24" fill="none" stroke="currentColor" strokeWidth={s} strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">
        <circle cx="12" cy="12" r="10" />
        <path d="M8 12h4l2-4" />
        <circle cx="12" cy="12" r="1" fill="currentColor" />
      </svg>
    ),
    workout: (
      <svg width="24" height="24" fill="none" stroke="currentColor" strokeWidth={s} strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">
        <path d="M6 4v16M18 4v16M3 8h4M17 8h4M3 16h4M17 16h4" />
      </svg>
    ),
    profile: (
      <svg width="24" height="24" fill="none" stroke="currentColor" strokeWidth={s} strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">
        <circle cx="12" cy="8" r="4" />
        <path d="M4 20c0-4 3.6-7 8-7s8 3 8 7" />
      </svg>
    ),
  }
  return <>{icons[name]}</>
}

const tabs = [
  { to: '/', key: 'home', label: 'Home' },
  { to: '/food', key: 'food', label: 'Nutrition' },
  { to: '/weight', key: 'weight', label: 'Weight' },
  { to: '/workout', key: 'workout', label: 'Workout' },
  { to: '/profile', key: 'profile', label: 'Profile' },
]

export default function App() {
  const [onboarded, setOnboarded] = useState(() => {
    return storage.getProfile()?.onboardingComplete === true
  })

  if (!onboarded) {
    return <Onboarding onComplete={() => setOnboarded(true)} />
  }

  return (
    <BrowserRouter>
      <div className="flex flex-col h-full bg-[#f5f5f7]">
        <div className="flex-1 overflow-y-auto">
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/food" element={<LogFood />} />
            <Route path="/weight" element={<LogWeight />} />
            <Route path="/workout" element={<LogWorkout />} />
            <Route path="/profile" element={<Profile />} />
          </Routes>
        </div>
        <nav className="flex bg-white border-t border-[#e5e5ea] pb-safe">
          {tabs.map(tab => (
            <NavLink
              key={tab.to}
              to={tab.to}
              end={tab.to === '/'}
              className={({ isActive }) =>
                `flex-1 flex flex-col items-center justify-center py-2 gap-0.5 transition-colors ${
                  isActive ? 'text-[#30d158]' : 'text-[#8e8e93]'
                }`
              }
            >
              {({ isActive }) => (
                <>
                  <div className={`p-1.5 rounded-xl transition-colors ${isActive ? 'bg-[#30d158]/10' : ''}`}>
                    <NavIcon name={tab.key} active={isActive} />
                  </div>
                  <span className="text-[10px] font-medium tracking-tight">{tab.label}</span>
                </>
              )}
            </NavLink>
          ))}
        </nav>
      </div>
    </BrowserRouter>
  )
}
