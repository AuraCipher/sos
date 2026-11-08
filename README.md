# SOS Pickup

A tiny, private web app for two friends: one friend (who has no personal
phone) can request a ride to or from college with a single tap — from a
borrowed phone, a college computer, or any modern browser. The other friend
receives the request as a push notification in the
[ntfy](https://ntfy.sh) Android app he already uses.

## Technology stack

- Next.js 16 (App Router) + React + TypeScript, Tailwind CSS
- Next.js Route Handlers (`/api/auth/pin`, `/api/sos`) as the backend
- HMAC-signed cookie sessions (`node:crypto`) — no database
- ntfy.sh REST API (server-side publish)
- A Next.js 16 **Proxy** (`src/proxy.ts`) guarding the private URL with a
  real HTTP 404
- Vitest for automated tests
- Vercel (deployment target — not configured yet)

Deliberately no database, no Redis, no separate server, no custom Android
app. All secrets stay in server-side environment variables.

## How it works

```
Friend's browser                     Your phone (ntfy Android app)
     │                                            ▲
     │  GET /private/<SOS_LINK_SECRET>            │
     │  (proxy: real 404 unless exact match)      │
     │  PIN screen  ── POST /api/auth/pin ──►     │
     │  ◄── HttpOnly signed session cookie        │
     │                                            │
     │  SOS panel  ── POST /api/sos ──►           │
     │           (server: verify session,         │
     │            validate message, publish)      │
     │                                            │
     │           ntfy.sh / localhost mock ────────┘
```

- The private page lives at `https://<host>/private/<SOS_LINK_SECRET>`.
  A wrong secret gets a genuine 404 from the proxy that runs before the
  page renders; the page itself re-checks and 404s as a fallback.
- The PIN is compared server-side against `SOS_PIN` (constant-time
  digest-first comparison) and never leaves the request body.
- A correct PIN sets a HttpOnly, SameSite=Strict (Secure in production)
  browser-session cookie: an HMAC-SHA256 signature over `{v, exp}` with
  `SOS_SESSION_SECRET`, valid 12 hours, no Max-Age (dies with the browser).
- Every `POST /api/sos` re-verifies the session server-side. On success it
  publishes the fixed message
  *"SOS: My Abu isn't coming today. Please pick me up!"*
  plus the optional custom message (sanitized, max 280 characters) and
  answers `{ ok: true }` only after ntfy confirmed the publish.
- Restarting `SOS_SESSION_SECRET` invalidates all sessions immediately.

## Getting started

Requires Node.js 20.9+ (developed on Node 22).

```bash
npm install
npm test            # 51 automated tests (no real notifications sent)
npm run dev         # http://localhost:3000
```

Other commands:

```bash
npm run lint        # ESLint CLI (Next.js 16 removed `next lint`)
npm run build       # production build (Turbopack by default)
npm run start       # serve the production build
```

## Configuring `.env.local`

Copy `.env.example` to `.env.local` (git-ignored) and fill in the values:

```env
SOS_PIN=             # plain-text PIN the friend must type (4+ characters)
SOS_LINK_SECRET=     # random string forming the private URL path — openssl rand -hex 32
SOS_SESSION_SECRET=  # random string that signs session cookies — openssl rand -hex 32

NTFY_TOPIC=          # private ntfy topic the Android app subscribes to
NTFY_SERVER_URL=     # https://ntfy.sh (any http(s) URL; see testing below)
NTFY_AUTH_TOKEN=     # optional, only for access-restricted topics (tk_…)
NTFY_PRIORITY=       # urgent / high / default / low / min, or 1–5
```

Rules:

- Everything here is read at request time by server-side code
  (`src/lib/env.ts`) and is never exposed to the browser.
- On Vercel, put the same variables in the project's environment
  settings.
- Missing or invalid configuration returns clear user-facing errors that
  name the variable (e.g. "SOS_PIN is not set") but never its value.
- Never use a `NEXT_PUBLIC_` prefix on any of these.

## Testing the flows locally

```bash
npm run build && npm test

# terminal 1 — mock ntfy, prints every publish it receives
node scripts/mock-ntfy-server.mjs          # http://127.0.0.1:3001

# terminal 2 — the app (reads .env.local at startup)
npm run start                              # http://localhost:3000
```

- **PIN authentication:** open `/private/<SOS_LINK_SECRET>` in a browser.
  Wrong PIN → "Incorrect PIN." message, guess-by-guess lockout messages.
  Correct PIN → the SOS panel appears (no reload) and the session is set.
- **SOS notification (against the mock):** press SEND SOS and watch the
  mock-ntfy terminal print `Title: SOS Pickup`, `Priority: urgent`, the
  fixed message, and your optional line if you typed one. For a real
  notification later, set `NTFY_SERVER_URL=https://ntfy.sh` (or delete the
  mock's values) and subscribe the Android app to your topic.
- **Lockout:** enter the wrong PIN 5 times → 30-second lock with a live
  countdown; the 6th/7th/8th failure escalates to 1/5/15 minutes, 9+ to 30
  minutes. Refreshing the page keeps the countdown (localStorage).
- **Cooldown:** send an SOS; the button shows a 30-second countdown and is
  disabled; refresh keeps the countdown; it re-enables at zero.
- Unauthenticated `POST /api/sos` (e.g. via curl) always answers 401, no
  matter what the browser shows.

## Automated tests

`npm test` (Vitest, 51 assertions across 8 files) covers:

- session sign/verify, tampering, expiry, and cookie attributes
- PIN endpoint: right/wrong PIN, cookie shape, throttle, config errors
- SOS endpoint: session enforcement, message compose/sanitize/limits,
  ntfy failure paths (fetch is mocked — **no real notifications sent**)
- lockout table + server-side throttle math
- private-link matching, proxy 404/pass-through behavior, fail-closed
- a privacy scan: browser-bound files must not reference any secret
  variable name

## Security notes & honest limitations

- **Server-side enforcement is the real control:** session verification,
  PIN comparison, message limits, and the URL proxy check all run on the
  server on every request.
- **The lockout and the 30-second cooldown are conveniences, not
  security.** They live in the requester's browser (localStorage):
  clearing browser data, using another browser, or scripting `POST
  /api/sos` directly bypasses them entirely. The server keeps only a
  small in-memory throttle on repeated PIN failures per IP
  (`src/lib/pin-throttle.ts`) — it does not survive instance restarts and
  is not shared between serverless instances.
- **Session cookie:** signature-based, 12-hour TTL, browser-session
  lifetime (no Max-Age). HttpOnly always, Secure in production. Anyone
  with the cookie from the same browser session counts as the friend.
- **The URL echo:** for any Next.js dynamic route the HTML payload repeats
  the URL you requested (route metadata). Someone only sees the secret in
  a response if they already requested that exact URL. The secret is
  never echoed anywhere else, and error bodies from the proxy/pin/SOS
  endpoints carry none of it.
- **Timing:** PIN, link secret, and session MAC comparisons are
  digest-first (`SHA-256` then fixed-length byte compare) so probe timing
  does not shortcut anything.
- **Headers:** `X-Frame-Options: DENY`, `X-Content-Type-Options:
  nosniff`, `Referrer-Policy: strict-origin-when-cross-origin`,
  `Permissions-Policy` locked down, `X-Powered-By` suppressed
  (`next.config.ts`), and the whole site `robots: noindex`
  (`src/app/layout.tsx`).
- **Threat model:** two friends, guest browser, borrowed phone. Keep the
  PIN unrelated to the link secret, rotate `SOS_SESSION_SECRET` if a
  device with the link is lost, and remember ntfy.sh topic knowledge *is*
  the notification access control — pick an unguessable topic.

## Deployment (Vercel)

Not configured yet. When you deploy:

1. Add every variable from `.env.example` in the Vercel project settings.
2. Make sure the friend's ntfy Android app subscribes to `NTFY_TOPIC`.
3. Send the friend the link `https://<deployment>/private/<SOS_LINK_SECRET>`.
