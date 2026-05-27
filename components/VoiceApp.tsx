'use client'

import { useState, useEffect } from 'react'
import { VoiceDemo } from './VoiceDemo'
import { LoadingScreen } from './LoadingScreen'

export function VoiceApp() {
  const [agentIds, setAgentIds] = useState<Record<string, string> | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const CACHE_KEY = 'voice_agent_ids'
    const cached = localStorage.getItem(CACHE_KEY)
    if (cached) {
      try { setAgentIds(JSON.parse(cached)) } catch {}
    }

    fetch('/api/agents')
      .then(async (r) => {
        if (!r.ok) {
          const body = await r.json()
          throw new Error(body.error ?? 'Failed to load agents')
        }
        return r.json()
      })
      .then((ids) => {
        localStorage.setItem(CACHE_KEY, JSON.stringify(ids))
        setAgentIds(ids)
      })
      .catch((err: Error) => {
        if (!cached) setError(err.message)
      })
  }, [])

  if (error) {
    return (
      <div className="min-h-screen bg-[#07070f] flex items-center justify-center p-6">
        <div className="max-w-md w-full space-y-4 text-center">
          <div className="w-12 h-12 rounded-full bg-red-500/10 border border-red-500/20 flex items-center justify-center mx-auto">
            <span className="text-red-400 text-lg">!</span>
          </div>
          <div>
            <h2 className="text-white/80 font-medium text-sm mb-1">Setup required</h2>
            <p className="text-white/35 text-xs leading-relaxed font-mono bg-white/5 border border-white/10 rounded-xl px-4 py-3 mt-3">
              {error}
            </p>
          </div>
        </div>
      </div>
    )
  }

  if (!agentIds) return <LoadingScreen />

  return <VoiceDemo agentIds={agentIds} />
}
