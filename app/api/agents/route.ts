import { auth } from '@/auth'
import { prisma } from '@/lib/db'
import { AGENTS } from '@/config/agentConfig'
import { logger } from '@/lib/logger'

export async function GET() {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      logger.warn('agents.unauthorized')
      return Response.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const userId = session.user.id
    const apiKey = process.env.ELEVENLABS_API_KEY

    if (!apiKey) {
      logger.error('agents.missingApiKey', { userId })
      return Response.json({ error: 'ELEVENLABS_API_KEY is not set on the server.' }, { status: 500 })
    }

    logger.info('agents.load', { userId })

    const entries = await Promise.all(
      AGENTS.map(async (agent) => {
        let instance = await prisma.agentInstance.findUnique({
          where: { userId_agentKey: { userId, agentKey: agent.key } },
        })

        const toolIds: string[] = agent.hasTools
          ? [
              process.env.ELEVENLABS_TOOL_CHECK_AVAILABILITY,
              process.env.ELEVENLABS_TOOL_BOOK_MEETING,
            ].filter(Boolean) as string[]
          : []

        const agentBody = {
          conversation_config: {
            agent: {
              prompt: {
                prompt: agent.prompt,
                llm: agent.llm,
                ...(toolIds.length ? { tool_ids: toolIds } : {}),
              },
              first_message: agent.firstMessage,
              language: 'en',
            },
            tts: {
              voice_id: agent.voiceId,
              model_id: 'eleven_flash_v2',
              optimize_streaming_latency: 4,
            },
            conversation: {
              // Streaming agent_chat_response_part is intentionally OFF — when
              // enabled it caused duplicate transcript lines (streamed bubble
              // + final onMessage). onMessage alone is the single source of truth.
              client_events: [
                'audio',
                'interruption',
                'agent_response',
                'user_transcript',
                'agent_response_correction',
                'agent_tool_response',
              ],
            },
          },
        }

        if (!instance) {
          logger.info('agents.creating', { userId, agentKey: agent.key })

          const res = await fetch('https://api.elevenlabs.io/v1/convai/agents/create', {
            method: 'POST',
            headers: { 'xi-api-key': apiKey, 'Content-Type': 'application/json' },
            body: JSON.stringify({ name: `${agent.name} [${userId.slice(0, 6)}]`, ...agentBody }),
          })

          if (!res.ok) {
            const body = await res.text()
            throw new Error(`Agent "${agent.name}" creation failed (${res.status}): ${body}`)
          }

          const { agent_id } = await res.json()
          instance = await prisma.agentInstance.create({
            data: { userId, agentKey: agent.key, elevenlabsAgentId: agent_id },
          })

          logger.info('agents.created', { userId, agentKey: agent.key, elevenlabsAgentId: agent_id })
        } else {
          // PATCH existing agent to keep tools/prompt in sync
          const patchRes = await fetch(`https://api.elevenlabs.io/v1/convai/agents/${instance.elevenlabsAgentId}`, {
            method: 'PATCH',
            headers: { 'xi-api-key': apiKey, 'Content-Type': 'application/json' },
            body: JSON.stringify(agentBody),
          })
          const patchBody = await patchRes.json().catch(() => null)

          if (patchRes.status === 404) {
            // Agent no longer exists in ElevenLabs (key changed etc) — recreate it
            logger.warn('agents.stale', { agentKey: agent.key, oldId: instance.elevenlabsAgentId })
            await prisma.agentInstance.delete({ where: { userId_agentKey: { userId, agentKey: agent.key } } })

            const createRes = await fetch('https://api.elevenlabs.io/v1/convai/agents/create', {
              method: 'POST',
              headers: { 'xi-api-key': apiKey, 'Content-Type': 'application/json' },
              body: JSON.stringify({ name: `${agent.name} [${userId.slice(0, 6)}]`, ...agentBody }),
            })
            if (!createRes.ok) {
              const body = await createRes.text()
              throw new Error(`Agent "${agent.name}" recreation failed (${createRes.status}): ${body}`)
            }
            const { agent_id } = await createRes.json()
            instance = await prisma.agentInstance.create({
              data: { userId, agentKey: agent.key, elevenlabsAgentId: agent_id },
            })
            logger.info('agents.recreated', { userId, agentKey: agent.key, elevenlabsAgentId: agent_id })
          } else if (!patchRes.ok) {
            logger.error('agents.patch.failed', { agentKey: agent.key, status: patchRes.status, body: JSON.stringify(patchBody) })
          } else {
            logger.info('agents.updated', { userId, agentKey: agent.key, hasTools: agent.hasTools ?? false })
          }
        }

        return [agent.key, instance.elevenlabsAgentId] as const
      }),
    )

    return Response.json(Object.fromEntries(entries))
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unexpected server error'
    logger.error('agents.error', { error: message })
    return Response.json({ error: message }, { status: 500 })
  }
}
