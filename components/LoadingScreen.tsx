'use client'

export function LoadingScreen() {
  return (
    <div className="min-h-screen bg-[#07070f] flex flex-col items-center justify-center gap-8">
      <div className="relative w-24 h-24 flex items-center justify-center">
        <div className="absolute inset-0 rounded-full bg-gradient-to-br from-violet-600/20 to-fuchsia-600/10" />
        <div
          className="absolute inset-0 rounded-full border-2 border-transparent animate-spinOrb"
          style={{
            borderTopColor: '#7c3aed',
            borderRightColor: 'rgba(124,58,237,0.3)',
          }}
        />
        <div className="w-3 h-3 rounded-full bg-violet-400 animate-pulse" />
      </div>

      <div className="space-y-1.5 text-center">
        <p className="text-white/70 text-sm font-medium tracking-wide">
          Initializing your agent
        </p>
        <p className="text-white/25 text-xs">Just a moment…</p>
      </div>
    </div>
  )
}
