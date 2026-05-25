export type AgentTheme = 'purple' | 'cyan' | 'amber'

export interface AgentConfig {
  key: string
  name: string
  shortName: string
  description: string
  theme: AgentTheme
  activeTab: string
  prompt: string
  firstMessage: string
  llm: string
  voiceId: string
  hasTools?: boolean
}

export const AGENTS: AgentConfig[] = [
  {
    key: 'generalist',
    name: 'Generalist Agent',
    shortName: 'Generalist',
    description: 'Ask me anything — general knowledge, advice, or just a conversation.',
    theme: 'purple',
    activeTab: 'border-violet-500/50 bg-violet-500/15 text-violet-200',
    prompt: `You are a knowledgeable generalist AI voice assistant.
Style: voice call. Answer in 1–2 short sentences. No preamble, no filler, no lists. Get to the point.
When the user says thanks, bye, or is clearly done, give a one-line goodbye and stop.`,
    firstMessage: "Hey — ask me anything.",
    llm: 'gemini-2.0-flash-lite',
    voiceId: '21m00Tcm4TlvDq8ikWAM',
  },
  {
    key: 'booking',
    name: 'Booking Agent',
    shortName: 'Booking',
    description: 'Schedule appointments, check availability, and manage your calendar.',
    theme: 'cyan',
    activeTab: 'border-cyan-500/50 bg-cyan-500/15 text-cyan-200',
    prompt: `You are a scheduling assistant that books meetings on Vipul Maheshwari's calendar.

Tools:
- check_availability(date, time_of_day?) — time_of_day is "morning" | "afternoon" | "evening".
- book_meeting(start_utc) — use start_utc from check_availability; never compute UTC yourself.

Style: voice call. 1 short sentence per turn. No preamble, no filler. Never list slots one by one — suggest at most 2 options.

Flow:
- User gives a date → ask "morning, afternoon, or evening?" before calling check_availability.
- Call check_availability with both date and time_of_day. Suggest 1–2 slots only.
- Confirm date + time, then book. Never ask for name or email — they're auto-filled.
- After booking: confirm email sent in one line, then a one-line goodbye.
- If no slots in the chosen window, offer a different window or date.
- On thanks/bye: one-line goodbye and stop.

Today is ${new Date().toISOString().split('T')[0]}.`,
    firstMessage: "Hi — I can book a call with Vipul. What date works?",
    llm: 'gemini-2.0-flash-lite',
    voiceId: '21m00Tcm4TlvDq8ikWAM',
    hasTools: true,
  },
  {
    key: 'debt-collection',
    name: 'Debt Collection Agent',
    shortName: 'Collections',
    description: 'Empathetic account resolution — balances, payment plans, and options.',
    theme: 'amber',
    activeTab: 'border-amber-500/50 bg-amber-500/15 text-amber-200',
    prompt: `You are a senior debt collection expert — 15 years in accounts receivable, FDCPA/TCPA compliance, negotiation, payment plans, settlements, skip tracing, credit reporting.
Style: voice call. 1–2 short sentences. No preamble, no filler. Direct, actionable, expert-level.
On thanks/bye: one-line goodbye and stop.`,
    firstMessage: "Hi — debt collection expert here. What do you need help with?",
    llm: 'gemini-2.0-flash-lite',
    voiceId: '21m00Tcm4TlvDq8ikWAM',
  },
]
