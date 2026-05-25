'use client'

import { useState, useRef, useEffect } from 'react'
import Image from 'next/image'
import { useSession, signOut } from 'next-auth/react'
import { ConversationProvider, useConversation, useConversationClientTool } from '@elevenlabs/react'
import { Orb, OrbState } from './Orb'
import { AudioVisualizer } from './AudioVisualizer'
import { AGENTS, AgentConfig } from '@/config/agentConfig'

interface VoiceDemoProps {
  agentIds: Record<string, string>
}

interface TranscriptLine {
  id: number
  role: 'user' | 'agent'
  text: string
  tentative?: boolean
  createdAt: Date
  latencyMs?: number
  // event_id from onAgentChatResponsePart used to match streaming deltas to a line
  eventId?: number
}

const STATUS_LABEL: Record<OrbState, string> = {
  idle:       'Tap the orb to begin',
  connecting: 'Connecting…',
  listening:  'Listening…',
  speaking:   'Speaking…',
  paused:     'Paused — tap to resume',
}

const STATUS_COLORS: Record<OrbState, { dot: string; text: string; badge: string }> = {
  idle:       { dot: 'bg-white/25',                  text: 'text-white/40',     badge: 'border-white/10 bg-white/5' },
  connecting: { dot: 'bg-violet-400 animate-pulse',  text: 'text-violet-300',   badge: 'border-violet-500/25 bg-violet-500/10' },
  listening:  { dot: 'bg-cyan-400 animate-pulse',    text: 'text-cyan-300',     badge: 'border-cyan-500/25 bg-cyan-500/10' },
  speaking:   { dot: 'bg-fuchsia-400 animate-pulse', text: 'text-fuchsia-300',  badge: 'border-fuchsia-500/25 bg-fuchsia-500/10' },
  paused:     { dot: 'bg-amber-400',                 text: 'text-amber-300',    badge: 'border-amber-500/25 bg-amber-500/10' },
}

const NEBULA_COLOR: Record<string, string> = {
  purple: 'rgba(109,40,217,0.13)',
  cyan:   'rgba(8,145,178,0.13)',
  amber:  'rgba(217,119,6,0.13)',
}

// Rendered only when booking agent is active — keeps tool hooks out of other agents
function BookingToolHandlers({
  userName,
  userEmail,
  agentKey,
}: {
  userName: string
  userEmail: string
  agentKey: string
}) {
  const availabilityCache = useRef<Map<string, unknown>>(new Map())

  const serverLog = (event: string, data: Record<string, unknown>) => {
    fetch('/api/log', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ event, agentKey, ...data }),
    }).catch(() => {})
  }

  useEffect(() => {
    const dates = [
      new Date().toISOString().split('T')[0],
      new Date(Date.now() + 86_400_000).toISOString().split('T')[0],
    ]
    for (const date of dates) {
      fetch('/api/tools/cal/availability', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ date, timezone: 'Asia/Kolkata' }),
      })
        .then((r) => r.json())
        .then((result) => availabilityCache.current.set(date, result))
        .catch(() => {})
    }
  }, [])

  useConversationClientTool('check_availability', async (params: Record<string, unknown>) => {
    const date = params.date as string | undefined
    const cacheKey = date ? `${date}_${params.timezone ?? 'Asia/Kolkata'}` : null
    if (cacheKey && availabilityCache.current.has(cacheKey)) {
      serverLog('tool.call', { tool: 'check_availability', params, cached: true })
      return availabilityCache.current.get(cacheKey)
    }
    serverLog('tool.call', { tool: 'check_availability', params })
    const res = await fetch('/api/tools/cal/availability', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(params),
    })
    const result = await res.json()
    if (cacheKey) availabilityCache.current.set(cacheKey, result)
    serverLog('tool.result', { tool: 'check_availability', result })
    return result
  })

  useConversationClientTool('book_meeting', async (params: Record<string, unknown>) => {
    const filledParams = {
      ...params,
      attendee_name:  userName,
      attendee_email: userEmail,
    }
    serverLog('tool.call', { tool: 'book_meeting', params: filledParams })
    const res = await fetch('/api/tools/cal/book', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(filledParams),
    })
    const result = await res.json()
    serverLog('tool.result', { tool: 'book_meeting', result })
    return result
  })

  return null
}

function VoiceDemoInner({
  agentIds,
  selectedAgent,
  onAgentChange,
}: {
  agentIds: Record<string, string>
  selectedAgent: AgentConfig
  onAgentChange: (agent: AgentConfig) => void
}) {
  const { data: session } = useSession()
  const [lines, setLines] = useState<TranscriptLine[]>([])
  const [showBookingModal, setShowBookingModal] = useState(selectedAgent.key === 'booking')
  const nextId         = useRef(0)

  const serverLog = (event: string, data: Record<string, unknown>) => {
    fetch('/api/log', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ event, agentKey: selectedAgent.key, ...data }),
    }).catch(() => {})
  }
  const scrollRef          = useRef<HTMLDivElement>(null)
  const agentIdRef         = useRef<string | undefined>(undefined)
  const sessionStart       = useRef<Date | null>(null)
  const ttfbMs             = useRef<number | null>(null)
  const lastUserMsgAt      = useRef<number | null>(null)
  const reconnectTimer     = useRef<ReturnType<typeof setTimeout> | null>(null)
  const pendingGoodbye     = useRef(false)
  const stopRef            = useRef<(() => void) | null>(null)
  const isSpeakingRef      = useRef(false)
  const goodbyeTimer       = useRef<ReturnType<typeof setTimeout> | null>(null)
  const firstMessageShownRef = useRef(false)
  const firstMessageStartedRef = useRef(false)

  const { status, isSpeaking, isMuted, setMuted, startSession, endSession } = useConversation({
    onDisconnect: () => {
      if (agentIdRef.current) {
        reconnectTimer.current = setTimeout(() => {
          if (agentIdRef.current) startSession({ agentId: agentIdRef.current })
        }, 1500)
      }
    },
    onError: (err) => console.error('[ElevenLabs]', err),
    onMessage: (msg) => {
      const role = msg.role === 'user' ? 'user' : 'agent'
      const now  = Date.now()
      serverLog('message', { role, text: msg.message })

      // Per-turn latency: time from last finalized user message to this agent response
      let turnLatency: number | undefined
      if (role === 'agent' && lastUserMsgAt.current !== null) {
        turnLatency = now - lastUserMsgAt.current
        lastUserMsgAt.current = null
      }
      if (role === 'user') {
        lastUserMsgAt.current = now
      }

      // TTFB: first user input → first agent response (excludes connection setup)
      if (role === 'agent' && ttfbMs.current === null && turnLatency !== undefined) {
        ttfbMs.current = turnLatency
      }

      // Detect farewell in agent message → auto-end after TTS finishes
      if (role === 'agent') {
        const lower = msg.message.toLowerCase()
        const isFarewell = ['goodbye', 'bye', 'take care', 'have a great', 'have a good',
          'see you', 'farewell', 'pleasure assisting', 'pleasure helping', 'pleasure talking',
          'it was a pleasure', 'good luck', 'all the best'].some((p) => lower.includes(p))
        if (isFarewell) pendingGoodbye.current = true
      }

      // Detect user cancel intent → end the session
      if (role === 'user') {
        const lower = msg.message.toLowerCase()
        const cancelPhrases = [
          "don't want to talk", "don't wanna talk", "do not want to talk",
          'cancel the call', 'cancel this', 'end the call', 'end this call',
          'stop the call', 'hang up', 'leave me alone', 'not interested',
          "i'm done", 'im done', 'forget it', 'never mind', 'go away',
        ]
        if (cancelPhrases.some((p) => lower.includes(p))) {
          setTimeout(() => stopRef.current?.(), 600)
        }
      }

      setLines((prev) => {
        // 1. Primary match: a line tagged with the same event_id and role (handles the
        //    streaming→final handoff for agent messages, and protects against any
        //    duplicate onMessage call).
        const msgEventId = (msg as { event_id?: number }).event_id
        if (msgEventId !== undefined) {
          const idx = prev.findIndex((l) => l.eventId === msgEventId && l.role === role)
          if (idx !== -1) {
            const updated = [...prev]
            updated[idx] = {
              ...updated[idx],
              text: msg.message,
              tentative: false,
              ...(turnLatency !== undefined && { latencyMs: turnLatency }),
            }
            return updated
          }
        }
        // 2. Fallback: any tentative line with the same role (older behaviour)
        const lastIdx = [...prev].reverse().findIndex((l) => l.tentative && l.role === role)
        if (lastIdx !== -1) {
          const realIdx = prev.length - 1 - lastIdx
          const updated = [...prev]
          updated[realIdx] = {
            ...updated[realIdx],
            text: msg.message,
            tentative: false,
            eventId: msgEventId,
            ...(turnLatency !== undefined && { latencyMs: turnLatency }),
          }
          return updated
        }
        // 3. Dedup: if the most recent finalized line has identical role+text, skip.
        //    Covers the case where we pre-populated first_message and the SDK then
        //    also fires onMessage for it.
        const last = prev[prev.length - 1]
        if (last && last.role === role && last.text === msg.message && !last.tentative) {
          return prev
        }
        // 4. Append a brand-new line, tagged with event_id for future updates.
        return [
          ...prev,
          {
            id: nextId.current++,
            role,
            text: msg.message,
            tentative: false,
            createdAt: new Date(),
            eventId: msgEventId,
            ...(turnLatency !== undefined && { latencyMs: turnLatency }),
          },
        ]
      })
    },
  })

  useEffect(() => {
    if (scrollRef.current)
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
  }, [lines])

  isSpeakingRef.current = isSpeaking

  // The configured first_message doesn't come through onMessage. Show it
  // on the transcript when the agent FINISHES saying it (isSpeaking flips
  // from true to false the first time). Matches the "text after speech"
  // timing of all other turns and avoids showing text before any audio.
  useEffect(() => {
    if (status !== 'connected') return
    if (isSpeaking) {
      firstMessageStartedRef.current = true
      return
    }
    if (firstMessageStartedRef.current && !firstMessageShownRef.current) {
      firstMessageShownRef.current = true
      setLines((prev) => {
        if (prev.some((l) => l.role === 'agent')) return prev
        return [
          ...prev,
          {
            id: nextId.current++,
            role: 'agent',
            text: selectedAgent.firstMessage,
            tentative: false,
            createdAt: new Date(),
          },
        ]
      })
    }
  }, [isSpeaking, status, selectedAgent.firstMessage])

  // Auto-end session after agent finishes speaking a farewell.
  // Debounced 1.5s to avoid firing during brief pauses between TTS chunks.
  useEffect(() => {
    if (!pendingGoodbye.current || isSpeaking || status !== 'connected') return
    goodbyeTimer.current = setTimeout(() => {
      if (!isSpeakingRef.current && pendingGoodbye.current) {
        pendingGoodbye.current = false
        stopRef.current?.()
      }
    }, 1500)
    return () => {
      if (goodbyeTimer.current) clearTimeout(goodbyeTimer.current)
    }
  }, [isSpeaking, status])

  const orbState: OrbState =
    status === 'connecting'                ? 'connecting'
    : status === 'connected' && isMuted    ? 'paused'
    : status === 'connected' && isSpeaking ? 'speaking'
    : status === 'connected'               ? 'listening'
    : 'idle'

  const colors = STATUS_COLORS[orbState]

  const saveConversation = async (
    agentKey: string,
    transcript: TranscriptLine[],
    start: Date,
    ttfb: number | null,
  ) => {
    const nonEmpty = transcript.filter((l) => l.text && !l.tentative)
    if (!nonEmpty.length) return
    try {
      await fetch('/api/conversations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          agentKey,
          messages: nonEmpty.map((l) => ({
            role: l.role,
            text: l.text,
            createdAt: l.createdAt.toISOString(),
            latencyMs: l.latencyMs ?? null,
          })),
          startedAt: start.toISOString(),
          endedAt: new Date().toISOString(),
          ttfbMs: ttfb,
        }),
      })
    } catch (err) {
      console.error('[save conversation]', err)
    }
  }

  const logUsage = (agentKey: string, eventType: string) => {
    fetch('/api/usage', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ agentKey, eventType }),
    }).catch((err) => console.error('[usage]', err))
  }

  const stopSession = (opts?: { skipSave?: boolean }) => {
    const key      = selectedAgent.key
    const start    = sessionStart.current
    const ttfb     = ttfbMs.current
    const snapshot = [...lines]

    agentIdRef.current    = undefined
    sessionStart.current  = null
    ttfbMs.current        = null
    lastUserMsgAt.current = null
    firstMessageShownRef.current = false
    firstMessageStartedRef.current = false
    if (reconnectTimer.current) clearTimeout(reconnectTimer.current)
    endSession()
    setLines([])

    if (!opts?.skipSave && start) {
      saveConversation(key, snapshot, start, ttfb)
      logUsage(key, 'session_ended')
    }
  }

  stopRef.current = stopSession

  const handleOrbClick = () => {
    if (status === 'connected') {
      // Orb click while connected = pause/resume mic. Session stays alive
      // so the agent keeps its context. Use the "End conversation" button to
      // actually stop and save the transcript.
      setMuted(!isMuted)
    } else if (status === 'disconnected') {
      const id = agentIds[selectedAgent.key]
      agentIdRef.current = id
      sessionStart.current = new Date()
      firstMessageShownRef.current = false
      firstMessageStartedRef.current = false
      startSession({ agentId: id })
      logUsage(selectedAgent.key, 'session_started')
    }
  }

  const handleAgentChange = (agent: AgentConfig) => {
    if (agent.key === selectedAgent.key) return
    if (status === 'connected') {
      stopSession({ skipSave: false })
      logUsage(agent.key, 'agent_switched')
    }
    if (agent.key === 'booking') setShowBookingModal(true)
    onAgentChange(agent)
  }

  return (
    <div className="min-h-screen bg-[#07070f] flex flex-col items-center justify-center relative overflow-hidden select-none">

      {/* Sign out button */}
      <div className="absolute top-5 right-5 z-20 flex items-center gap-2.5">
        {session?.user?.image && (
          <Image
            src={session.user.image}
            alt={session.user.name ?? ''}
            width={28}
            height={28}
            className="rounded-full opacity-80"
          />
        )}
        <button
          onClick={() => signOut({ callbackUrl: '/' })}
          className="text-[11px] text-white/25 hover:text-white/55 transition-colors"
        >
          Sign out
        </button>
      </div>

      {/* Nebula blobs */}
      <div
        className="absolute pointer-events-none transition-all duration-1000"
        style={{
          width: 750, height: 750,
          top: '50%', left: '50%',
          transform: 'translate(-50%, -50%)',
          background: `radial-gradient(ellipse, ${NEBULA_COLOR[selectedAgent.theme]} 0%, transparent 68%)`,
          animation: 'nebulaDrift 22s ease-in-out infinite',
        }}
      />
      <div
        className="absolute pointer-events-none"
        style={{
          width: 500, height: 500,
          top: '25%', left: '65%',
          transform: 'translate(-50%, -50%)',
          background: 'radial-gradient(ellipse, rgba(6,182,212,0.06) 0%, transparent 68%)',
          animation: 'nebulaDrift2 28s ease-in-out infinite',
        }}
      />

      {/* Dot grid */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          backgroundImage: 'radial-gradient(circle, rgba(255,255,255,0.055) 1px, transparent 1px)',
          backgroundSize: '40px 40px',
          maskImage: 'radial-gradient(ellipse 80% 80% at 50% 50%, black 30%, transparent 100%)',
        }}
      />

      {/* Main content */}
      <div className="relative z-10 flex flex-col items-center gap-8 animate-fadeUp w-full max-w-lg px-6">

        {/* Brand label */}
        <div className="flex items-center gap-2">
          <span className="w-1.5 h-1.5 rounded-full bg-violet-400/70 animate-pulse" />
          <span className="text-[11px] font-semibold tracking-[0.22em] uppercase text-violet-400/70">
            Voice AI
          </span>
          <span className="w-1.5 h-1.5 rounded-full bg-violet-400/70 animate-pulse" />
        </div>

        {/* Agent selector tabs */}
        <div className="flex gap-2 p-1.5 rounded-2xl border border-white/8 bg-white/[0.03] backdrop-blur-sm">
          {AGENTS.map((agent) => {
            const isActive = agent.key === selectedAgent.key
            return (
              <button
                key={agent.key}
                onClick={() => handleAgentChange(agent)}
                className={`relative px-4 py-2 rounded-xl text-sm font-medium border transition-all duration-300
                  ${isActive
                    ? agent.activeTab
                    : 'border-transparent text-white/35 hover:text-white/60 hover:bg-white/5'
                  }`}
              >
                {agent.shortName}
                {isActive && (
                  <span className="absolute -bottom-[1px] left-1/2 -translate-x-1/2 w-6 h-0.5 rounded-full bg-current opacity-60" />
                )}
              </button>
            )
          })}
        </div>

        {/* Agent name + description */}
        <div className="text-center space-y-1.5">
          <h1 className="text-[2.4rem] font-semibold tracking-tight text-white leading-none">
            {selectedAgent.name}
          </h1>
          <p className="text-white/40 text-sm font-light leading-relaxed max-w-sm">
            {selectedAgent.description}
          </p>
        </div>

        {/* Orb */}
        <Orb
          state={orbState}
          theme={selectedAgent.theme}
          onClick={handleOrbClick}
          disabled={status === 'connecting' || showBookingModal}
        />

        {/* Audio visualizer */}
        <AudioVisualizer active={status === 'connected'} speaking={isSpeaking} />

        {/* Transcript */}
        {lines.length > 0 && (
          <div
            ref={scrollRef}
            className="w-full max-h-72 overflow-y-auto flex flex-col gap-2.5"
            style={{ scrollbarWidth: 'none' }}
          >
            {lines.map((line) => (
              <div
                key={line.id}
                className={`flex gap-2.5 items-start text-sm leading-relaxed transition-opacity duration-300 ${
                  line.tentative ? 'opacity-40' : 'opacity-100'
                }`}
              >
                <span
                  className={`shrink-0 mt-0.5 text-[10px] font-semibold tracking-wide uppercase px-1.5 py-0.5 rounded-md ${
                    line.role === 'user'
                      ? 'text-cyan-400/80 bg-cyan-400/10'
                      : 'text-fuchsia-400/80 bg-fuchsia-400/10'
                  }`}
                >
                  {line.role === 'user' ? 'You' : 'AI'}
                </span>
                <span className={`font-light ${line.role === 'user' ? 'text-white/65' : 'text-white/90'}`}>
                  {line.text || (
                    <span className="inline-flex gap-1 items-center h-4">
                      {[0, 1, 2].map((i) => (
                        <span
                          key={i}
                          className="w-1 h-1 rounded-full bg-cyan-400/60"
                          style={{ animation: `barBounce 0.55s ease-in-out ${i * 0.15}s infinite alternate` }}
                        />
                      ))}
                    </span>
                  )}
                </span>
              </div>
            ))}
          </div>
        )}

        {/* Status badge */}
        <div className="flex flex-col items-center gap-2.5">
          <div className={`flex items-center gap-2 px-4 py-1.5 rounded-full border text-xs font-medium transition-all duration-500 ${colors.badge}`}>
            <span className={`w-1.5 h-1.5 rounded-full transition-colors duration-300 ${colors.dot}`} />
            <span className={`transition-colors duration-300 ${colors.text}`}>
              {STATUS_LABEL[orbState]}
            </span>
          </div>
          {status === 'connected' && (
            <button
              onClick={() => stopSession()}
              className="text-xs px-3 py-1 rounded-full border border-red-500/25 bg-red-500/10 text-red-300/80 hover:text-red-200 hover:bg-red-500/15 transition-colors"
            >
              End conversation
            </button>
          )}
        </div>
      </div>

      {/* Booking tools — only registered when booking agent is active */}
      {selectedAgent.key === 'booking' && (
        <BookingToolHandlers
          userName={session?.user?.name ?? ''}
          userEmail={session?.user?.email ?? ''}
          agentKey={selectedAgent.key}
        />
      )}

      {/* Footer */}
      <div className="absolute bottom-7 text-center">
        <p className="text-white/12 text-[11px] tracking-wide">
          Allow microphone access when prompted
        </p>
      </div>

      {/* Booking agent info modal */}
      {showBookingModal && (
        <div className="absolute inset-0 z-50 flex items-center justify-center p-6 bg-black/60 backdrop-blur-sm">
          <div className="relative w-full max-w-sm rounded-2xl border border-cyan-500/20 bg-[#0d0d1a] p-7 shadow-2xl shadow-cyan-500/5 flex flex-col gap-5">
            {/* Header */}
            <div className="flex items-center gap-2.5">
              <span className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse" />
              <span className="text-[11px] font-semibold tracking-[0.2em] uppercase text-cyan-400/80">
                Booking Agent
              </span>
            </div>

            {/* Body */}
            <div className="space-y-3">
              <p className="text-white/85 text-sm leading-relaxed">
                This agent is configured to book calls on your behalf. It can check calendar availability and create a real meeting invite — all via voice.
              </p>
              <p className="text-white/60 text-sm leading-relaxed">
                For demo purposes, you can book a call with{' '}
                <span className="text-cyan-300 font-medium">Vipul Maheshwari</span>
                {' '}— Founder of Jyosa Labs.
              </p>
              <p className="text-white/35 text-xs leading-relaxed border-t border-white/8 pt-3">
                This is an MVP. The agent, calendar, and contact details can all be customised based on your requirements.
              </p>
            </div>

            {/* CTA */}
            <button
              onClick={() => setShowBookingModal(false)}
              className="w-full py-2.5 rounded-xl bg-cyan-500/15 border border-cyan-500/30 text-cyan-300 text-sm font-medium hover:bg-cyan-500/25 transition-colors"
            >
              Got it — let&apos;s try it
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

export function VoiceDemo({ agentIds }: VoiceDemoProps) {
  const [selectedAgent, setSelectedAgent] = useState<AgentConfig>(AGENTS[0])

  return (
    <ConversationProvider key={selectedAgent.key}>
      <VoiceDemoInner
        agentIds={agentIds}
        selectedAgent={selectedAgent}
        onAgentChange={setSelectedAgent}
      />
    </ConversationProvider>
  )
}
