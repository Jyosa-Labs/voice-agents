import NextAuth from 'next-auth'
import Google from 'next-auth/providers/google'
import { PrismaAdapter } from '@auth/prisma-adapter'
import { prisma } from '@/lib/db'
import { logger } from '@/lib/logger'

export function getAdminEmails(): string[] {
  return (process.env.ADMIN_EMAILS ?? '')
    .split(',')
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean)
}

export function isAdminEmail(email: string | null | undefined): boolean {
  if (!email) return false
  return getAdminEmails().includes(email.toLowerCase())
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  adapter: PrismaAdapter(prisma),
  providers: [
    Google({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
    }),
  ],
  callbacks: {
    async session({ session, user }) {
      session.user.id = user.id
      // Surface approval status on the session so the UI can render gates without an extra DB hit
      const dbUser = await prisma.user.findUnique({
        where: { id: user.id },
        select: { status: true },
      })
      session.user.status = dbUser?.status ?? 'pending'
      session.user.isAdmin = isAdminEmail(session.user.email)
      return session
    },
  },
  events: {
    async signIn({ user, isNewUser }) {
      // Auto-approve admin emails so the bootstrapping doesn't deadlock
      if (user.id && isAdminEmail(user.email)) {
        await prisma.user.updateMany({
          where: { id: user.id, NOT: { status: 'approved' } },
          data: { status: 'approved', approvedAt: new Date(), approvedBy: 'auto:admin' },
        })
      }
      logger.info('auth.signIn', {
        userId: user.id,
        email: user.email,
        isNewUser: !!isNewUser,
        isAdmin: isAdminEmail(user.email),
      })
    },
    signOut(message) {
      const userId = 'session' in message ? (message.session as { userId?: string })?.userId : undefined
      logger.info('auth.signOut', { userId })
    },
    createUser({ user }) {
      logger.info('auth.createUser', { userId: user.id, email: user.email })
    },
  },
  logger: {
    error(error: Error) {
      logger.error('auth.error', { error: error.message, name: error.name })
    },
    warn(code: string) {
      logger.warn('auth.warn', { code })
    },
  },
})
