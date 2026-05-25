import { auth } from '@/auth'
import { VoiceApp } from '@/components/VoiceApp'
import { LoginScreen } from '@/components/LoginScreen'

export default async function Home() {
  const session = await auth()
  if (!session) return <LoginScreen />
  return <VoiceApp />
}
