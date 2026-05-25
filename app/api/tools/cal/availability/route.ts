import { auth } from '@/auth'
import { logger } from '@/lib/logger'

type TimeOfDay = 'morning' | 'afternoon' | 'evening'

const TIME_WINDOWS: Record<TimeOfDay, [number, number]> = {
  morning:   [5, 12],
  afternoon: [12, 17],
  evening:   [17, 22],
}

function hourInTimezone(iso: string, timezone: string): number {
  const parts = new Intl.DateTimeFormat('en-US', {
    hour: 'numeric', hour12: false, timeZone: timezone,
  }).formatToParts(new Date(iso))
  return Number(parts.find(p => p.type === 'hour')?.value ?? 0)
}

function formatSlots(
  slotsData: Record<string, Array<string | { start: string }>>,
  timezone: string,
  timeOfDay?: TimeOfDay,
): { display: string; slots_with_utc: Array<{ time: string; start_utc: string }> } {
  const allDisplay: string[] = []
  const slots_with_utc: Array<{ time: string; start_utc: string }> = []
  const window = timeOfDay ? TIME_WINDOWS[timeOfDay] : null

  for (const [date, slots] of Object.entries(slotsData)) {
    const dateLabel = new Date(date).toLocaleDateString('en-US', {
      weekday: 'long', month: 'long', day: 'numeric', timeZone: timezone,
    })
    const timeLabels: string[] = []

    for (const s of slots) {
      const iso = typeof s === 'string' ? s : s.start
      if (window) {
        const hr = hourInTimezone(iso, timezone)
        if (hr < window[0] || hr >= window[1]) continue
      }
      const display = new Date(iso).toLocaleTimeString('en-US', {
        hour: 'numeric', minute: '2-digit', hour12: true, timeZone: timezone,
      })
      const utc = new Date(iso).toISOString()
      timeLabels.push(display)
      slots_with_utc.push({ time: display, start_utc: utc })
    }

    if (timeLabels.length) allDisplay.push(`${dateLabel}: ${timeLabels.join(', ')}`)
  }

  return { display: allDisplay.join(' | '), slots_with_utc }
}

export async function POST(req: Request) {
  const session = await auth()
  if (!session?.user?.id) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { date, timezone = 'Asia/Kolkata', duration, time_of_day } = await req.json()
  const timeOfDay: TimeOfDay | undefined =
    time_of_day === 'morning' || time_of_day === 'afternoon' || time_of_day === 'evening'
      ? time_of_day
      : undefined
  logger.info('tools.cal.availability', { date, timezone, duration, time_of_day: timeOfDay })

  const params = new URLSearchParams({
    username:      process.env.CAL_COM_USERNAME!,
    eventTypeSlug: process.env.CAL_COM_EVENT_TYPE_SLUG!,
    start:         `${date}T00:00:00Z`,
    end:           `${date}T23:59:59Z`,
    timeZone:      timezone,
  })
  if (duration) params.set('duration', String(duration))

  const res = await fetch(`https://api.cal.com/v2/slots?${params}`, {
    headers: {
      'Authorization':    `Bearer ${process.env.CAL_COM_API_KEY}`,
      'cal-api-version':  '2024-09-04',
    },
  })

  if (!res.ok) {
    const err = await res.text()
    logger.error('tools.cal.availability.failed', { error: err })
    return Response.json({ available: false, message: 'Could not fetch availability right now.' })
  }

  const { data } = await res.json()
  if (!data || !Object.keys(data).length) {
    return Response.json({ available: false, message: `No availability on ${date}.` })
  }

  const { display, slots_with_utc } = formatSlots(data, timezone, timeOfDay)
  if (!slots_with_utc.length) {
    return Response.json({
      available: false,
      message: timeOfDay
        ? `No ${timeOfDay} slots on ${date}.`
        : `No availability on ${date}.`,
    })
  }
  logger.info('tools.cal.availability.ok', { date, time_of_day: timeOfDay, slots: display })
  return Response.json({ available: true, slots: display, slots_with_utc })
}
