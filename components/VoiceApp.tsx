'use client'

import { useState, useEffect } from 'react'
import { signOut } from 'next-auth/react'
import { VoiceDemo } from './VoiceDemo'
import { LoadingScreen } from './LoadingScreen'

type Gate = 'loading' | 'pending' | 'rejected' | 'error' | 'ok'

export function VoiceApp() {
  const [agentIds, setAgentIds] = useState<Record<string, string> | null>(null)
  const [gate, setGate] = useState<Gate>('loading')
  const [errorMsg, setErrorMsg] = useState<string | null>(null)

  useEffect(() => {
    const CACHE_KEY = 'voice_agent_ids'
    const cached = localStorage.getItem(CACHE_KEY)
    if (cached) {
      try {
        setAgentIds(JSON.parse(cached))
        setGate('ok')
      } catch {}
    }

    fetch('/api/agents')
      .then(async (r) => {
        const body = await r.json().catch(() => ({}))
        if (r.status === 403 && body.error === 'pending_approval') {
          setGate(body.status === 'rejected' ? 'rejected' : 'pending')
          localStorage.removeItem(CACHE_KEY)
          return null
        }
        if (!r.ok) throw new Error(body.error ?? 'Failed to load agents')
        return body as Record<string, string>
      })
      .then((ids) => {
        if (!ids) return
        localStorage.setItem(CACHE_KEY, JSON.stringify(ids))
        setAgentIds(ids)
        setGate('ok')
      })
      .catch((err: Error) => {
        setErrorMsg(err.message)
        if (!cached) setGate('error')
      })
  }, [])

  if (gate === 'pending' || gate === 'rejected') {
    const isRejected = gate === 'rejected'
    return (
      <div className="min-h-screen bg-[#07070f] flex items-center justify-center p-6">
        <div className="max-w-md w-full space-y-5 text-center">
          <div className={`w-14 h-14 rounded-full border flex items-center justify-center mx-auto ${
            isRejected
              ? 'bg-red-500/10 border-red-500/25'
              : 'bg-amber-500/10 border-amber-500/25'
          }`}>
            <span className={`text-2xl ${isRejected ? 'text-red-300' : 'text-amber-300'}`}>
              {isRejected ? '✕' : '⏳'}
            </span>
          </div>
          <div className="space-y-2">
            <h2 className="text-white/85 font-medium text-base">
              {isRejected ? 'Access denied' : 'Waiting for approval'}
            </h2>
            <p className="text-white/45 text-sm leading-relaxed">
              {isRejected
                ? "Your account was not approved. If you think this is a mistake, please reach out to the demo owner."
                : "Your request to use this demo has been received. The owner will approve you shortly — you can refresh this page to check."}
            </p>
          </div>
          <button
            onClick={() => signOut({ callbackUrl: '/' })}
            className="text-[11px] text-white/30 hover:text-white/60 transition-colors"
          >
            Sign out
          </button>
        </div>
      </div>
    )
  }

  if (gate === 'error') {
    return (
      <div className="min-h-screen bg-[#07070f] flex items-center justify-center p-6">
        <div className="max-w-md w-full space-y-4 text-center">
          <div className="w-12 h-12 rounded-full bg-red-500/10 border border-red-500/20 flex items-center justify-center mx-auto">
            <span className="text-red-400 text-lg">!</span>
          </div>
          <div>
            <h2 className="text-white/80 font-medium text-sm mb-1">Setup required</h2>
            <p className="text-white/35 text-xs leading-relaxed font-mono bg-white/5 border border-white/10 rounded-xl px-4 py-3 mt-3">
              {errorMsg}
            </p>
          </div>
        </div>
      </div>
    )
  }

  if (!agentIds) return <LoadingScreen />

  return <VoiceDemo agentIds={agentIds} />
}
