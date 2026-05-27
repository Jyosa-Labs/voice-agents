import { auth, isAdminEmail } from '@/auth'
import { prisma } from '@/lib/db'
import { logger } from '@/lib/logger'

type Ctx = { params: Promise<{ id: string }> }

export async function PATCH(req: Request, { params }: Ctx) {
  const session = await auth()
  if (!session?.user?.email || !isAdminEmail(session.user.email)) {
    return Response.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { id } = await params
  const { action } = (await req.json()) as { action?: string }

  if (action !== 'approve' && action !== 'reject') {
    return Response.json({ error: 'Invalid action. Must be "approve" or "reject".' }, { status: 400 })
  }

  const target = await prisma.user.findUnique({ where: { id } })
  if (!target) return Response.json({ error: 'User not found' }, { status: 404 })

  const updated = await prisma.user.update({
    where: { id },
    data: {
      status: action === 'approve' ? 'approved' : 'rejected',
      approvedAt: action === 'approve' ? new Date() : null,
      approvedBy: session.user.email,
    },
    select: { id: true, email: true, status: true, approvedAt: true, approvedBy: true },
  })

  logger.info('admin.users.update', {
    adminEmail: session.user.email,
    targetUserId: id,
    targetEmail: target.email,
    action,
  })

  return Response.json({ user: updated })
}
