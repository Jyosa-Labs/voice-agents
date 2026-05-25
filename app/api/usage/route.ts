import { auth } from '@/auth'
import { prisma } from '@/lib/db'
import { logger } from '@/lib/logger'

export async function POST(req: Request) {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      logger.warn('usage.unauthorized')
      return Response.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { agentKey, eventType } = await req.json()
    const userId = session.user.id

    await prisma.usageEvent.create({
      data: { userId, agentKey, eventType },
    })

    logger.info('usage.event', { userId, agentKey, eventType })

    return Response.json({ ok: true })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unexpected server error'
    logger.error('usage.error', { error: message })
    return Response.json({ error: message }, { status: 500 })
  }
}
