import NextAuth from 'next-auth'
import Google from 'next-auth/providers/google'
import { PrismaAdapter } from '@auth/prisma-adapter'
import { prisma } from '@/lib/db'
import { logger } from '@/lib/logger'

export const { handlers, auth, signIn, signOut } = NextAuth({
  adapter: PrismaAdapter(prisma),
  providers: [
    Google({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
    }),
  ],
  callbacks: {
    session({ session, user }) {
      session.user.id = user.id
      return session
    },
  },
  events: {
    signIn({ user, isNewUser }) {
      logger.info('auth.signIn', {
        userId: user.id,
        email: user.email,
        isNewUser: !!isNewUser,
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
