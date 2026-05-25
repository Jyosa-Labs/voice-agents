'use client'

import { signIn } from 'next-auth/react'

export function LoginScreen() {
  return (
    <div className="min-h-screen bg-[#07070f] flex flex-col items-center justify-center gap-8 p-6">
      {/* Nebula blob */}
      <div
        className="absolute pointer-events-none"
        style={{
          width: 600,
          height: 600,
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          background: 'radial-gradient(ellipse, rgba(109,40,217,0.12) 0%, transparent 68%)',
        }}
      />

      {/* Dot grid */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          backgroundImage: 'radial-gradient(circle, rgba(255,255,255,0.05) 1px, transparent 1px)',
          backgroundSize: '40px 40px',
          maskImage: 'radial-gradient(ellipse 80% 80% at 50% 50%, black 30%, transparent 100%)',
        }}
      />

      <div className="relative z-10 flex flex-col items-center gap-8 animate-fadeUp">
        {/* Brand */}
        <div className="flex items-center gap-2">
          <span className="w-1.5 h-1.5 rounded-full bg-violet-400/70 animate-pulse" />
          <span className="text-[11px] font-semibold tracking-[0.22em] uppercase text-violet-400/70">
            Voice AI
          </span>
          <span className="w-1.5 h-1.5 rounded-full bg-violet-400/70 animate-pulse" />
        </div>

        {/* Headline */}
        <div className="text-center space-y-2">
          <h1 className="text-4xl font-semibold tracking-tight text-white leading-none">
            Welcome
          </h1>
          <p className="text-white/40 text-sm font-light max-w-xs leading-relaxed">
            Sign in to access your personal AI voice agents
          </p>
        </div>

        {/* Google sign-in button */}
        <button
          onClick={() => signIn('google', { callbackUrl: '/' })}
          className="flex items-center gap-3 px-6 py-3 rounded-2xl border border-white/10 bg-white/[0.04]
            hover:bg-white/[0.08] hover:border-white/20 transition-all duration-200
            text-white/80 text-sm font-medium backdrop-blur-sm"
        >
          <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
            <path d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844a4.14 4.14 0 01-1.796 2.716v2.259h2.908c1.702-1.567 2.684-3.875 2.684-6.615z" fill="#4285F4"/>
            <path d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 009 18z" fill="#34A853"/>
            <path d="M3.964 10.71A5.41 5.41 0 013.682 9c0-.593.102-1.17.282-1.71V4.958H.957A8.996 8.996 0 000 9c0 1.452.348 2.827.957 4.042l3.007-2.332z" fill="#FBBC05"/>
            <path d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 00.957 4.958L3.964 7.29C4.672 5.163 6.656 3.58 9 3.58z" fill="#EA4335"/>
          </svg>
          Continue with Google
        </button>

        <p className="text-white/20 text-[11px] text-center max-w-xs">
          Your conversations are saved securely to your account
        </p>
      </div>
    </div>
  )
}
