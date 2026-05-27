import { auth, isAdminEmail } from '@/auth'
import { prisma } from '@/lib/db'
import { logger } from '@/lib/logger'

export async function GET() {
  const session = await auth()
  if (!session?.user?.email || !isAdminEmail(session.user.email)) {
    return Response.json({ error: 'Forbidden' }, { status: 403 })
  }

  const users = await prisma.user.findMany({
    select: {
      id: true,
      name: true,
      email: true,
      image: true,
      createdAt: true,
      status: true,
      approvedAt: true,
      approvedBy: true,
      _count: { select: { conversations: true } },
    },
    orderBy: [{ status: 'asc' }, { createdAt: 'desc' }],
  })

  logger.info('admin.users.list', { adminEmail: session.user.email, count: users.length })
  return Response.json({ users })
}
