# Onix

A PayBox-style remote MCP server for ChatGPT: each ChatGPT user signs in with OAuth, gets a **Circle developer-controlled wallet** on **Arc Testnet**, can send **USDC**, and can pay **x402** APIs.

## What it does

1. ChatGPT connects to `https://<your-host>/mcp` with **OAuth** (not “No Auth”).
2. The user signs in with Google or an email code.
3. Onix creates one Circle wallet on `ARC-TESTNET` for that user (or reuses the existing one).
4. ChatGPT can then call:
   - `get_wallet` — address, explorer, faucet
   - `get_balance` — USDC on Arc Testnet
   - `estimate_send_usdc` — fee preview
   - `send_usdc` — Circle REST transfer (requires `confirm: true`)
   - `x402_probe` — inspect an HTTP 402 paywall
   - `x402_pay` — sign and pay an x402 API on Arc Testnet
   - `list_transfers` — recent sends from this app

## Prerequisites

- Node.js 22+
- A [Circle Console](https://console.circle.com) testnet API key
- A registered [entity secret](https://developers.circle.com/wallets/dev-controlled/register-entity-secret)
- A public **HTTPS** URL so ChatGPT can reach this server (Cloudflare Tunnel or ngrok)

## Setup

```bash
cd arcbox
copy .env.example .env
```

Edit `.env`:

```env
PUBLIC_URL=https://your-tunnel-host
PORT=8787
COOKIE_SECRET=a-long-random-string
CIRCLE_API_KEY=TEST_API_KEY:...
CIRCLE_ENTITY_SECRET=your-64-char-entity-secret
```

```bash
npm install
npm run dev
```

Open `PUBLIC_URL` in a browser and create an account. Confirm a wallet address appears on `/dashboard`. Fund it from the [Circle faucet](https://faucet.circle.com) (Arc Testnet USDC).

## Connect ChatGPT

1. Copy `https://<your-host>/mcp`
2. On **ChatGPT web**, open Settings and turn on **Developer mode**
3. Plugins → Browse plugins → **+** → **New Plugin**
4. Name: `Onix`
5. Server URL: the `/mcp` URL
6. Authentication: **OAuth** — do not leave No Auth selected
7. Save, connect, and complete the Onix login

Then in chat:

> What’s my Arc Testnet wallet and USDC balance?

> Send 1.00 USDC to 0x…

`send_usdc` first returns a preview unless ChatGPT passes `confirm: true`.

## Auth model

- OAuth 2.1 authorization code + PKCE (`S256`)
- Dynamic client registration **and** Client ID Metadata Documents
- Refresh tokens (required by ChatGPT)
- `resource` / audience bound to `/mcp`
- One Circle EOA per Onix user, inside one shared wallet set

This is **developer-controlled custody**: Circle holds the keys, your server signs with the entity secret. Do not treat this as a non-custodial PayBox clone.

## Firebase auth

Sign-in is Google or email + 6-digit code. Firebase Auth holds the user; Firestore maps `email` / `uid` to the Circle wallet.

1. Create a Firebase project and enable **Authentication → Google**.
2. Create a Firestore database (production mode is fine — the Admin SDK bypasses rules).
3. Deploy `firestore.rules` (clients have no direct access).
4. Add `onixmpc.vercel.app` and `localhost` under Authentication → Settings → Authorized domains.
5. Project settings → service account → generate a private key.
6. Project settings → Your apps → Web app: copy apiKey, authDomain, appId.

For email codes, set `RESEND_API_KEY` (or install the Firebase **Trigger Email** extension, which reads the `mail` collection).

## Deploy on Vercel

1. Push this repo to GitHub.
2. Import the repo in [Vercel](https://vercel.com/new).
3. Set these environment variables in the Vercel project:

```env
PUBLIC_URL=https://onixmpc.vercel.app
COOKIE_SECRET=
CIRCLE_API_KEY=
CIRCLE_ENTITY_SECRET=
MCP_DANGEROUSLY_ALLOW_INSECURE_ISSUER_URL=false
FIREBASE_PROJECT_ID=
FIREBASE_CLIENT_EMAIL=
FIREBASE_PRIVATE_KEY=
FIREBASE_WEB_API_KEY=
FIREBASE_AUTH_DOMAIN=
FIREBASE_APP_ID=
RESEND_API_KEY=
EMAIL_FROM=
```

`PUBLIC_URL` must be the live `https://` origin (no trailing slash). After the first deploy, copy the Vercel URL into `PUBLIC_URL` and redeploy if needed.

4. ChatGPT plugin URL: `https://your-project.vercel.app/mcp`

User accounts and email→wallet maps live in Firestore once Firebase is configured.

## Local-only note

ChatGPT will not talk to `http://localhost`. Use a tunnel, or the Vercel HTTPS URL, and set `PUBLIC_URL` to that origin.

## Safety

- Testnet only
- Daily send cap via `SEND_DAILY_LIMIT_USDC` (default 100)
- Sends require an explicit `confirm: true` tool argument
