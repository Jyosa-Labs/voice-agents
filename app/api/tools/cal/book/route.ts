import { auth } from '@/auth'
import { logger } from '@/lib/logger'

const MIN_LEAD_MINUTES = 60
const MAX_HORIZON_DAYS = 60

export async function POST(req: Request) {
  const session = await auth()
  if (!session?.user?.id) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { start_utc, attendee_name, attendee_email, attendee_timezone = 'Asia/Kolkata' } = await req.json()
  logger.info('tools.cal.book', { start_utc, attendee_name, attendee_email })

  // Guardrail: validate start_utc is real, future, within lead time and horizon
  const startMs = new Date(start_utc).getTime()
  if (Number.isNaN(startMs)) {
    return Response.json({ success: false, message: 'Invalid start time format.' })
  }
  const now = Date.now()
  if (startMs < now + MIN_LEAD_MINUTES * 60 * 1000) {
    return Response.json({
      success: false,
      message: `That slot is too soon — please pick a time at least ${MIN_LEAD_MINUTES} minutes from now.`,
    })
  }
  if (startMs > now + MAX_HORIZON_DAYS * 24 * 60 * 60 * 1000) {
    return Response.json({
      success: false,
      message: `That slot is too far out — bookings are limited to ${MAX_HORIZON_DAYS} days ahead.`,
    })
  }

  const body = {
    start:         start_utc,
    username:      process.env.CAL_COM_USERNAME,
    eventTypeSlug: process.env.CAL_COM_EVENT_TYPE_SLUG,
    attendee: {
      name:     attendee_name,
      email:    attendee_email,
      timeZone: attendee_timezone,
    },
  }

  const res = await fetch('https://api.cal.com/v2/bookings', {
    method: 'POST',
    headers: {
      'Content-Type':    'application/json',
      'cal-api-version': '2024-08-13',
    },
    body: JSON.stringify(body),
  })

  const result = await res.json()

  if (!res.ok || result.status !== 'success') {
    const reason = result?.error?.message ?? result?.message ?? 'Unknown error'
    logger.error('tools.cal.book.failed', { reason, attendee_email })
    return Response.json({ success: false, message: `Booking failed: ${reason}` })
  }

  const booking = result.data
  const startTime = new Date(booking.start).toLocaleString('en-US', {
    weekday: 'long', month: 'long', day: 'numeric',
    hour: 'numeric', minute: '2-digit', hour12: true,
    timeZone: attendee_timezone,
  })

  logger.info('tools.cal.book.ok', { bookingId: booking.id, attendee_email, start: booking.start })
  return Response.json({
    success: true,
    message: `Meeting booked for ${startTime}. A confirmation email has been sent to ${attendee_email}.`,
    bookingId: booking.id,
  })
}
