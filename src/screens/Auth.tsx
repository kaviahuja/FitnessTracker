import { useState } from 'react'
import { supabase, loadFromCloud } from '../lib/supabase'

export default function Auth({ onAuth }: { onAuth: () => void }) {
  const [mode, setMode] = useState<'signin' | 'signup'>('signin')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [signedUp, setSignedUp] = useState(false)

  async function handleSubmit() {
    setError(null)
    setLoading(true)
    try {
      if (mode === 'signup') {
        const { error } = await supabase.auth.signUp({ email, password })
        if (error) throw error
        setSignedUp(true)
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password })
        if (error) throw error
        await loadFromCloud()
        onAuth()
      }
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Something went wrong')
    } finally {
      setLoading(false)
    }
  }

  if (signedUp) {
    return (
      <div className="flex flex-col h-full bg-[#f5f5f7] items-center justify-center px-6 gap-6">
        <div className="w-16 h-16 bg-[#30d158]/10 rounded-2xl flex items-center justify-center">
          <svg width="32" height="32" fill="none" stroke="#30d158" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">
            <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/>
          </svg>
        </div>
        <div className="text-center">
          <h2 className="text-[#1d1d1f] font-bold text-2xl">Check your email</h2>
          <p className="text-[#6e6e73] text-sm mt-2 leading-relaxed">
            We sent a confirmation link to <span className="font-semibold text-[#1d1d1f]">{email}</span>.
            Click it, then come back and sign in.
          </p>
        </div>
        <button
          onClick={() => { setSignedUp(false); setMode('signin') }}
          className="w-full bg-[#1d1d1f] text-white font-semibold py-4 rounded-2xl"
        >
          Back to Sign In
        </button>
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full bg-[#f5f5f7] overflow-y-auto">
      <div className="flex flex-col justify-center min-h-full px-6 py-12 gap-8">

        {/* Logo */}
        <div className="flex flex-col items-center gap-3">
          <div className="w-20 h-20 rounded-[22px] bg-gradient-to-br from-[#30d158] to-[#0071e3] flex items-center justify-center shadow-lg">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="48" height="48">
              <rect x="52" y="212" width="36" height="88" rx="18" fill="white"/>
              <rect x="88" y="182" width="68" height="148" rx="12" fill="white"/>
              <rect x="156" y="234" width="200" height="44" rx="10" fill="white"/>
              <rect x="356" y="182" width="68" height="148" rx="12" fill="white"/>
              <rect x="424" y="212" width="36" height="88" rx="18" fill="white"/>
            </svg>
          </div>
          <div className="text-center">
            <h1 className="text-[#1d1d1f] font-bold text-3xl tracking-tight">FitTrack</h1>
            <p className="text-[#8e8e93] text-sm mt-1">Your fitness, saved to the cloud</p>
          </div>
        </div>

        {/* Mode toggle */}
        <div className="flex bg-[#e5e5ea] rounded-xl p-1">
          {(['signin', 'signup'] as const).map(m => (
            <button
              key={m}
              onClick={() => { setMode(m); setError(null) }}
              className={`flex-1 py-2 rounded-lg text-sm font-semibold transition-all ${
                mode === m ? 'bg-white text-[#1d1d1f] shadow-sm' : 'text-[#8e8e93]'
              }`}
            >
              {m === 'signin' ? 'Sign In' : 'Create Account'}
            </button>
          ))}
        </div>

        {/* Fields */}
        <div className="flex flex-col gap-3">
          <div className="bg-white border border-[#e5e5ea] rounded-2xl overflow-hidden shadow-sm">
            <div className="flex items-center px-4 py-3.5 border-b border-[#f5f5f7]">
              <span className="text-[#6e6e73] text-sm w-20">Email</span>
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="you@example.com"
                autoCapitalize="none"
                autoCorrect="off"
                className="flex-1 text-[#1d1d1f] text-sm font-medium bg-transparent outline-none placeholder-[#c7c7cc]"
              />
            </div>
            <div className="flex items-center px-4 py-3.5">
              <span className="text-[#6e6e73] text-sm w-20">Password</span>
              <input
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="••••••••"
                className="flex-1 text-[#1d1d1f] text-sm font-medium bg-transparent outline-none placeholder-[#c7c7cc]"
              />
            </div>
          </div>

          {error && (
            <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-red-600 text-sm">
              {error}
            </div>
          )}

          <button
            onClick={handleSubmit}
            disabled={loading || !email || !password}
            className="w-full bg-[#30d158] disabled:bg-[#e5e5ea] disabled:text-[#c7c7cc] text-white font-semibold py-4 rounded-2xl flex items-center justify-center gap-2 transition-colors"
          >
            {loading ? (
              <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            ) : (
              mode === 'signin' ? 'Sign In' : 'Create Account'
            )}
          </button>
        </div>

        {mode === 'signup' && (
          <p className="text-[#8e8e93] text-xs text-center leading-relaxed">
            After creating your account, check your email for a confirmation link before signing in.
          </p>
        )}
      </div>
    </div>
  )
}
