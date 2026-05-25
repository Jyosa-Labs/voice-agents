# Voice AI

A real-time voice AI demo built with Next.js, ElevenLabs Conversational AI, Google OAuth, and PostgreSQL. Talk to specialised AI agents using your microphone — conversations are saved, latency is tracked per query.

---

## Agents

| Agent | Description |
|---|---|
| **Generalist** | General knowledge, advice, anything |
| **Booking** | Scheduling, appointments, reservations |
| **Collections** | Debt recovery, payment plans, compliance |

---

## Tech Stack

| Layer | Technology |
|---|---|
| Framework | Next.js 15 (App Router) |
| Auth | Auth.js v5 + Google OAuth |
| Database | PostgreSQL (Neon) + Prisma ORM |
| Voice | ElevenLabs Conversational AI |
| TTS Model | `eleven_flash_v2` |
| LLM | Gemini 2.0 Flash Lite (via ElevenLabs) |
| Styling | Tailwind CSS |
| Deployment | Vercel |

---

## Getting Started

### 1. Clone & install

```bash
git clone <repo-url>
cd voice-agents
npm install
```

### 2. Set up environment variables

Copy `.env.example` to `.env` and fill in the values:

```bash
# ElevenLabs
ELEVENLABS_API_KEY=

# Google OAuth — console.cloud.google.com
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=

# Auth.js secret — run: openssl rand -base64 32
AUTH_SECRET=

# Neon PostgreSQL — neon.tech
DATABASE_URL=
```

### 3. Set up Google OAuth

In [Google Cloud Console](https://console.cloud.google.com) → APIs & Services → Credentials → OAuth 2.0 Client:

- **Authorised JavaScript origins:**
  - `http://localhost:3000`
  - `https://your-domain.vercel.app`
- **Authorised redirect URIs:**
  - `http://localhost:3000/api/auth/callback/google`
  - `https://your-domain.vercel.app/api/auth/callback/google`

### 4. Push database schema

```bash
npm run db:push
```

### 5. Run locally

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

---

## Database Schema

```
User             — accounts, linked via Google OAuth
AgentInstance    — ElevenLabs agent IDs per user (created once, reused)
Conversation     — each voice session with TTFB latency
Message          — full transcript with per-turn latency (ms)
UsageEvent       — session started/ended, agent switched
```

---

## Latency Tracking

Every conversation stores:

- **`Conversation.ttfbMs`** — time from first user input → first agent response
- **`Message.latencyMs`** — per-turn latency on each agent response (user speaks → agent replies)

Query average latency per agent:

```sql
SELECT c."agentKey", AVG(m."latencyMs") as avg_ms, COUNT(*) as turns
FROM "Message" m
JOIN "Conversation" c ON c.id = m."conversationId"
WHERE m.role = 'agent' AND m."latencyMs" IS NOT NULL
GROUP BY c."agentKey";
```

---

## Scripts

```bash
npm run dev          # start dev server
npm run build        # production build
npm run db:push      # sync Prisma schema to database
npm run db:studio    # open Prisma Studio (visual DB browser)
```

---

## Deployment (Vercel)

1. Push to GitHub
2. Import repo in [Vercel](https://vercel.com)
3. Add all environment variables from `.env` in Vercel project settings
4. Deploy
