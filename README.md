# SOS Pickup

A tiny, private web app for two friends: one friend (who has no personal
phone) can request a ride to or from college with a single tap — from a
borrowed phone, a college computer, or any modern browser. The other friend
receives the request as a push notification in the
[ntfy](https://ntfy.sh) Android app he already uses.

## Technology stack

- Next.js (App Router) + React + TypeScript
- Tailwind CSS
- Next.js Route Handlers (`/api/sos`) as the backend
- ntfy.sh REST API for push delivery (planned — not wired up yet)
- Vercel (deployment target — not configured yet)

Deliberately no database, no separate server, no custom Android app, and no
login system.

## Getting started

Requires Node.js 20.9+.

```bash
npm install
npm run dev        # http://localhost:3000
```

Other commands:

```bash
npm run lint       # ESLint CLI (Next.js 16 removed `next lint`)
npm run build      # production build (Turbopack by default)
npm run start      # serve the production build
```

## Environment variables

`NTFY_TOPIC`, `NTFY_SERVER_URL`, `NTFY_AUTH_TOKEN`, and `NTFY_PRIORITY`
(described in `.env.example`) will be read server-side by the SOS Route
Handler once the ntfy integration is implemented. Real values belong in
`.env.local` (git-ignored); never put them in `.env.example` or anywhere
the browser can read.

## Current implementation status

Implemented:

- Responsive, mobile-first SOS interface (header, hero, red SEND SOS button,
  optional message field, cooldown UI structure) with clear button states.
- `src/app/api/sos/route.ts` — POST Route Handler that validates the JSON
  body and currently answers an honest `501 Not Implemented`.
- Shared constants + API contract in `src/lib/sos.ts`, including the fixed
  default message: *"SOS: My Abu isn't coming today. Please pick me up!"*

Not implemented yet:

- ntfy.sh publishing, the server-enforced 2-minute cooldown, and deployment.
- Pressing SEND SOS today shows a "not connected yet" error; it never
  pretends a pickup request was sent.

## Next steps: ntfy integration

1. Pick a private, unguessable topic and subscribe the friend's ntfy Android
   app to it (topic knowledge is the access control on ntfy.sh).
2. Set `NTFY_TOPIC`, `NTFY_SERVER_URL`, `NTFY_AUTH_TOKEN` (if protected), and
   `NTFY_PRIORITY` in `.env.local` and later in the Vercel project settings.
3. In `src/app/api/sos/route.ts`:
   - enforce the 2-minute cooldown, answering `429` with
     `{ ok: false, error, retryAfterSeconds }`;
   - publish to ntfy.sh (`PUT` with the fixed default message plus the
     user's optional message and `Priority` header);
   - return `{ ok: true, cooldownSeconds: 120 }` on success.
4. Deploy to Vercel and test end-to-end from a borrowed phone.
