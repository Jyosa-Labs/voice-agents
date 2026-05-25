import { auth } from '@/auth'
import { prisma } from '@/lib/db'
import { logger } from '@/lib/logger'

interface MessagePayload {
  role: string
  text: string
  createdAt: string
  latencyMs?: number
}

export async function POST(req: Request) {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      logger.warn('conversations.unauthorized')
      return Response.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { agentKey, messages, startedAt, endedAt, ttfbMs } = await req.json()
    const userId = session.user.id
    const durationMs = new Date(endedAt).getTime() - new Date(startedAt).getTime()

    const h = req.headers
    const forwardedFor = h.get('x-forwarded-for')
    const ipAddress = forwardedFor ? forwardedFor.split(',')[0].trim() : h.get('x-real-ip')
    const country   = h.get('x-vercel-ip-country')
    const city      = h.get('x-vercel-ip-city')
    const region    = h.get('x-vercel-ip-country-region')
    const userAgent = h.get('user-agent')

    const conversation = await prisma.conversation.create({
      data: {
        userId,
        agentKey,
        startedAt: new Date(startedAt),
        endedAt: new Date(endedAt),
        ttfbMs: typeof ttfbMs === 'number' ? ttfbMs : null,
        userName:  session.user.name ?? null,
        userEmail: session.user.email ?? null,
        userImage: session.user.image ?? null,
        ipAddress: ipAddress ?? null,
        country:   country ?? null,
        city:      city ? decodeURIComponent(city) : null,
        region:    region ?? null,
        userAgent: userAgent ?? null,
        messages: {
          create: (messages as MessagePayload[]).map((m) => ({
            role: m.role,
            text: m.text,
            createdAt: new Date(m.createdAt),
            latencyMs: typeof m.latencyMs === 'number' ? m.latencyMs : null,
          })),
        },
      },
    })

    logger.info('conversations.saved', {
      userId,
      agentKey,
      conversationId: conversation.id,
      messageCount: messages.length,
      durationMs,
      ttfbMs: ttfbMs ?? null,
    })

    return Response.json({ id: conversation.id })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unexpected server error'
    logger.error('conversations.error', { error: message })
    return Response.json({ error: message }, { status: 500 })
  }
}
