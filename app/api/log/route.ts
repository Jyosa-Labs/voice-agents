import { auth } from '@/auth'
import { logger } from '@/lib/logger'

export async function POST(req: Request) {
  const session = await auth()
  if (!session?.user?.id) return Response.json({ ok: false }, { status: 401 })

  const { event, ...data } = await req.json()
  logger.info(event, { userId: session.user.id, ...data })
  return Response.json({ ok: true })
}
