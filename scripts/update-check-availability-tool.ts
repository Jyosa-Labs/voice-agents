/**
 * Patches the existing check_availability ElevenLabs tool to add a
 * time_of_day enum parameter ("morning" | "afternoon" | "evening").
 *
 * Usage: npx tsx scripts/update-check-availability-tool.ts
 */
import { config } from 'dotenv'
config()

const API_KEY = process.env.ELEVENLABS_API_KEY
const TOOL_ID = process.env.ELEVENLABS_TOOL_CHECK_AVAILABILITY

if (!API_KEY) {
  console.error('ELEVENLABS_API_KEY not set in .env')
  process.exit(1)
}
if (!TOOL_ID) {
  console.error('ELEVENLABS_TOOL_CHECK_AVAILABILITY not set in .env')
  process.exit(1)
}

const body = {
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
        time_of_day: {
          type: 'string',
          enum: ['morning', 'afternoon', 'evening'],
          description: 'Optional. Filter slots to a part of the day. Ask the user which they prefer before calling.',
        },
      },
      required: ['date'],
    },
  },
}

async function main() {
  const res = await fetch(`https://api.elevenlabs.io/v1/convai/tools/${TOOL_ID}`, {
    method: 'PATCH',
    headers: { 'xi-api-key': API_KEY!, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  const data = await res.json().catch(() => null)
  if (!res.ok) {
    console.error('Failed:', res.status, JSON.stringify(data, null, 2))
    process.exit(1)
  }
  console.log('✓ check_availability tool updated with time_of_day enum')
}

main()
