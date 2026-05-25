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

    const conversation = await prisma.conversation.create({
      data: {
        userId,
        agentKey,
        startedAt: new Date(startedAt),
        endedAt: new Date(endedAt),
        ttfbMs: typeof ttfbMs === 'number' ? ttfbMs : null,
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
