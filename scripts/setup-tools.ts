/**
 * Run once to create ElevenLabs client tools and print the env vars to add.
 * Usage: npx tsx scripts/setup-tools.ts
 */
import { config } from 'dotenv'
config()

const API_KEY = process.env.ELEVENLABS_API_KEY
if (!API_KEY) {
  console.error('ELEVENLABS_API_KEY not set in .env')
  process.exit(1)
}

async function createTool(payload: object): Promise<string> {
  const res = await fetch('https://api.elevenlabs.io/v1/convai/tools', {
    method: 'POST',
    headers: { 'xi-api-key': API_KEY!, 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })
  const data = await res.json() as { id?: string; detail?: unknown }
  if (!res.ok || !data.id) {
    console.error('Failed:', JSON.stringify(data, null, 2))
    process.exit(1)
  }
  return data.id
}

async function main() {
  console.log('Creating ElevenLabs client tools...\n')

  const checkAvailabilityId = await createTool({
    name: 'check_availability',
    type: 'client',
    tool_config: {
      type: 'client',
      name: 'check_availability',
      description: "Check the host's calendar for available meeting slots on a given date.",
      expects_response: true,
      parameters: {
        type: 'object',
        properties: {
          date:     { type: 'string', description: 'Date in YYYY-MM-DD format' },
          timezone: { type: 'string', description: 'Timezone e.g. Asia/Kolkata. Default Asia/Kolkata.' },
          duration: { type: 'string', description: 'Duration in minutes e.g. 30. Omit if not specified.' },
        },
        required: ['date'],
      },
    },
  })
  console.log('✓ check_availability:', checkAvailabilityId)

  const bookMeetingId = await createTool({
    name: 'book_meeting',
    type: 'client',
    tool_config: {
      type: 'client',
      name: 'book_meeting',
      description: "Book a meeting. Only call after confirming time with user. Use start_utc from check_availability.",
      expects_response: true,
      parameters: {
        type: 'object',
        properties: {
          start_utc:         { type: 'string', description: 'Start time ISO 8601 UTC e.g. 2026-05-30T09:00:00Z' },
          attendee_name:     { type: 'string', description: 'Attendee full name' },
          attendee_email:    { type: 'string', description: 'Attendee email address' },
          attendee_timezone: { type: 'string', description: 'Attendee timezone e.g. Asia/Kolkata' },
          duration:          { type: 'string', description: 'Duration in minutes. Default 30.' },
        },
        required: ['start_utc', 'attendee_name', 'attendee_email'],
      },
    },
  })
  console.log('✓ book_meeting:', bookMeetingId)

  const endConversationId = await createTool({
    name: 'end_conversation',
    type: 'client',
    tool_config: {
      type: 'client',
      name: 'end_conversation',
      description: 'End the voice conversation. Call this when the user says goodbye, thanks, or the conversation is clearly over.',
      expects_response: true,
      parameters: {
        type: 'object',
        properties: {},
        required: [],
      },
    },
  })
  console.log('✓ end_conversation:', endConversationId)

  console.log('\nAdd these to your .env and Vercel environment variables:\n')
  console.log(`ELEVENLABS_TOOL_CHECK_AVAILABILITY=${checkAvailabilityId}`)
  console.log(`ELEVENLABS_TOOL_BOOK_MEETING=${bookMeetingId}`)
  console.log(`ELEVENLABS_TOOL_END_CONVERSATION=${endConversationId}`)
}

main()
