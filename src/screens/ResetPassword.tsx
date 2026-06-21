import { useState } from 'react'
import { supabase } from '../lib/supabase'

export default function ResetPassword({ onDone }: { onDone: () => void }) {
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)

  async function handleSubmit() {
    setError(null)
    if (password.length < 6) {
      setError('Password must be at least 6 characters')
      return
    }
    if (password !== confirm) {
      setError('Passwords do not match')
      return
    }
    setLoading(true)
    try {
      const { error } = await supabase.auth.updateUser({ password })
      if (error) throw error
      setSuccess(true)
      // Sign out so the user logs back in with their new password
      await supabase.auth.signOut()
      // Strip the recovery hash from the URL
      window.history.replaceState(null, '', window.location.pathname)
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Something went wrong')
    } finally {
      setLoading(false)
    }
  }

  if (success) {
    return (
      <div className="flex flex-col h-full bg-[#f5f5f7] items-center justify-center px-6 gap-6">
        <div className="w-16 h-16 bg-[#30d158]/10 rounded-2xl flex items-center justify-center">
          <svg width="32" height="32" fill="none" stroke="#30d158" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">
            <polyline points="20 6 9 17 4 12" />
          </svg>
        </div>
        <div className="text-center">
          <h2 className="text-[#1d1d1f] font-bold text-2xl">Password updated</h2>
          <p className="text-[#6e6e73] text-sm mt-2 leading-relaxed">
            Sign in with your new password to continue.
          </p>
        </div>
        <button
          onClick={onDone}
          className="w-full bg-[#1d1d1f] text-white font-semibold py-4 rounded-2xl"
        >
          Sign In
        </button>
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full bg-[#f5f5f7] overflow-y-auto">
      <div className="flex flex-col justify-center min-h-full px-6 py-12 gap-8">

        <div className="flex flex-col items-center gap-3">
          <div className="w-20 h-20 rounded-[22px] bg-gradient-to-br from-[#30d158] to-[#0071e3] flex items-center justify-center shadow-lg">
            <svg width="40" height="40" fill="none" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">
              <rect x="3" y="11" width="18" height="11" rx="2" />
              <path d="M7 11V7a5 5 0 0110 0v4" />
            </svg>
          </div>
          <div className="text-center">
            <h1 className="text-[#1d1d1f] font-bold text-3xl tracking-tight">Reset password</h1>
            <p className="text-[#8e8e93] text-sm mt-1">Choose a new password for your account</p>
          </div>
        </div>

        <div className="flex flex-col gap-3">
          <div className="bg-white border border-[#e5e5ea] rounded-2xl overflow-hidden shadow-sm">
            <div className="flex items-center px-4 py-3.5 border-b border-[#f5f5f7]">
              <span className="text-[#6e6e73] text-sm w-24">New</span>
              <input
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="••••••••"
                className="flex-1 text-[#1d1d1f] text-sm font-medium bg-transparent outline-none placeholder-[#c7c7cc]"
              />
            </div>
            <div className="flex items-center px-4 py-3.5">
              <span className="text-[#6e6e73] text-sm w-24">Confirm</span>
              <input
                type="password"
                value={confirm}
                onChange={e => setConfirm(e.target.value)}
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
            disabled={loading || !password || !confirm}
            className="w-full bg-[#30d158] disabled:bg-[#e5e5ea] disabled:text-[#c7c7cc] text-white font-semibold py-4 rounded-2xl flex items-center justify-center gap-2 transition-colors"
          >
            {loading ? (
              <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            ) : (
              'Update Password'
            )}
          </button>
        </div>
      </div>
    </div>
  )
}
