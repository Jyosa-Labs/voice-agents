'use client'

import type { AgentTheme } from '@/config/agentConfig'

export type OrbState = 'idle' | 'connecting' | 'listening' | 'speaking' | 'paused'

const IDLE_BY_THEME: Record<AgentTheme, { gradient: string; glow: string; ripple: string }> = {
  purple: {
    gradient: 'radial-gradient(circle at 38% 32%, #c4b5fd, #7c3aed 52%, #2e1065)',
    glow:     '0 0 55px rgba(124,58,237,0.5), 0 0 110px rgba(124,58,237,0.22), 0 0 200px rgba(124,58,237,0.08)',
    ripple:   'rgba(139,92,246,',
  },
  cyan: {
    gradient: 'radial-gradient(circle at 38% 32%, #a5f3fc, #0891b2 52%, #082f49)',
    glow:     '0 0 55px rgba(8,145,178,0.5), 0 0 110px rgba(8,145,178,0.22), 0 0 200px rgba(8,145,178,0.08)',
    ripple:   'rgba(6,182,212,',
  },
  amber: {
    gradient: 'radial-gradient(circle at 38% 32%, #fde68a, #d97706 52%, #451a03)',
    glow:     '0 0 55px rgba(217,119,6,0.5), 0 0 110px rgba(217,119,6,0.22), 0 0 200px rgba(217,119,6,0.08)',
    ripple:   'rgba(245,158,11,',
  },
}

const LISTENING = {
  gradient: 'radial-gradient(circle at 38% 32%, #a5f3fc, #0891b2 52%, #082f49)',
  glow:     '0 0 65px rgba(8,145,178,0.6), 0 0 130px rgba(8,145,178,0.28)',
  ripple:   'rgba(6,182,212,',
}

const SPEAKING = {
  gradient: 'radial-gradient(circle at 38% 32%, #f5d0fe, #a21caf 52%, #4a044e)',
  glow:     '0 0 75px rgba(162,28,175,0.65), 0 0 150px rgba(162,28,175,0.3)',
  ripple:   'rgba(217,70,239,',
}

const ANIM: Record<OrbState, string> = {
  idle:       'animate-orbIdle',
  connecting: '',
  listening:  'animate-orbListen',
  speaking:   'animate-orbSpeak',
  paused:     '',
}

const RIPPLE_COUNT: Partial<Record<OrbState, number>> = { listening: 3, speaking: 2 }
const RIPPLE_MS:    Partial<Record<OrbState, number>> = { listening: 2200, speaking: 1300 }

interface OrbProps {
  state: OrbState
  theme: AgentTheme
  onClick: () => void
  disabled?: boolean
}

export function Orb({ state, theme, onClick, disabled }: OrbProps) {
  const base =
    state === 'speaking'  ? SPEAKING
    : state === 'listening' ? LISTENING
    : IDLE_BY_THEME[theme]

  const isPaused = state === 'paused'

  const rippleCount = RIPPLE_COUNT[state] ?? 0
  const rippleMs    = RIPPLE_MS[state] ?? 2000

  return (
    <div
      className={`relative flex items-center justify-center transition-all duration-700
        ${disabled ? 'cursor-not-allowed opacity-60' : 'cursor-pointer'}`}
      onClick={disabled ? undefined : onClick}
    >
      {Array.from({ length: rippleCount }).map((_, i) => (
        <div
          key={i}
          className="absolute rounded-full border pointer-events-none"
          style={{
            width: 210, height: 210,
            borderColor: `${base.ripple}0.35)`,
            animation: `rippleOut ${rippleMs}ms ease-out ${(rippleMs / rippleCount) * i}ms infinite`,
          }}
        />
      ))}

      {state === 'connecting' && (
        <div
          className="absolute rounded-full border-2 animate-spinOrb"
          style={{
            width: 224, height: 224,
            borderColor: 'transparent',
            borderTopColor: IDLE_BY_THEME[theme].ripple + '0.9)',
            borderRightColor: IDLE_BY_THEME[theme].ripple + '0.3)',
          }}
        />
      )}

      <div
        className={`relative rounded-full transition-[background,box-shadow,filter] duration-700 ${ANIM[state]}`}
        style={{
          width: 200, height: 200,
          background: base.gradient,
          boxShadow: base.glow,
          filter: isPaused ? 'saturate(0.3) brightness(0.6)' : undefined,
        }}
      >
        <div
          className="absolute inset-0 rounded-full"
          style={{
            background:
              'radial-gradient(circle at 34% 28%, rgba(255,255,255,0.22) 0%, rgba(255,255,255,0.04) 45%, transparent 65%)',
          }}
        />
        <div
          className="absolute inset-0 rounded-full"
          style={{ boxShadow: 'inset 0 0 32px rgba(0,0,0,0.35)' }}
        />
      </div>
    </div>
  )
}
