'use client'

const BAR_COUNT = 36

const BARS = Array.from({ length: BAR_COUNT }, (_, i) => ({
  maxH: 12 + ((i * 7 + i % 5 * 3) % 28),
  duration: 0.38 + (i % 7) * 0.09,
  delay: (i % 9) * 0.07,
}))

interface AudioVisualizerProps {
  active: boolean
  speaking: boolean
}

export function AudioVisualizer({ active, speaking }: AudioVisualizerProps) {
  const barColor = speaking
    ? 'linear-gradient(to top, #a21caf, #e879f9 80%)'
    : 'linear-gradient(to top, #0e7490, #67e8f9 80%)'

  return (
    <div
      className="flex items-end justify-center transition-opacity duration-500"
      style={{ height: 48, gap: 4, opacity: active ? 1 : 0.35 }}
    >
      {BARS.map((bar, i) => (
        <div
          key={i}
          className="rounded-full transition-[height] duration-300"
          style={{
            width: 3,
            height: active ? bar.maxH : 3,
            transformOrigin: 'bottom center',
            background: active ? barColor : 'rgba(255,255,255,0.18)',
            animation: active
              ? `barBounce ${bar.duration}s ease-in-out ${bar.delay}s infinite alternate`
              : 'none',
          }}
        />
      ))}
    </div>
  )
}
