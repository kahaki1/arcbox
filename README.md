# ArcBox

A PayBox-style remote MCP server for ChatGPT: each ChatGPT user signs in with OAuth, gets a **Circle developer-controlled wallet** on **Arc Testnet**, and can send **USDC** through [Circle App Kit](https://docs.arc.io/app-kit/send).

## What it does

1. ChatGPT connects to `https://<your-host>/mcp` with **OAuth** (not “No Auth”).
2. The user creates an ArcBox account or logs in.
3. ArcBox creates one Circle wallet on `ARC-TESTNET` for that user (or reuses the existing one).
4. ChatGPT can then call:
   - `get_wallet` — address, explorer, faucet
   - `get_balance` — USDC on Arc Testnet
   - `estimate_send_usdc` — fee preview
   - `send_usdc` — App Kit `kit.send()` (requires `confirm: true`)
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
4. Name: `ArcBox`
5. Server URL: the `/mcp` URL
6. Authentication: **OAuth** — do not leave No Auth selected
7. Save, connect, and complete the ArcBox login

Then in chat:

> What’s my Arc Testnet wallet and USDC balance?

> Send 1.00 USDC to 0x…

`send_usdc` first returns a preview unless ChatGPT passes `confirm: true`.

## Auth model

- OAuth 2.1 authorization code + PKCE (`S256`)
- Dynamic client registration **and** Client ID Metadata Documents
- Refresh tokens (required by ChatGPT)
- `resource` / audience bound to `/mcp`
- One Circle EOA per ArcBox user, inside one shared wallet set

This is **developer-controlled custody**: Circle holds the keys, your server signs with the entity secret. Do not treat this as a non-custodial PayBox clone.

## Deploy on Vercel

1. Push this repo to GitHub.
2. Import the repo in [Vercel](https://vercel.com/new).
3. Set these environment variables in the Vercel project:

```env
PUBLIC_URL=https://your-project.vercel.app
COOKIE_SECRET=
CIRCLE_API_KEY=
CIRCLE_ENTITY_SECRET=
MCP_DANGEROUSLY_ALLOW_INSECURE_ISSUER_URL=false
```

`PUBLIC_URL` must be the live `https://` origin (no trailing slash). After the first deploy, copy the Vercel URL into `PUBLIC_URL` and redeploy if needed.

4. ChatGPT plugin URL: `https://your-project.vercel.app/mcp`

Vercel functions are stateless. The local JSON user/wallet store lives in `/tmp` there, so accounts do not survive cold starts. Fine for a smoke test; for real use add a database next.

## Local-only note

ChatGPT will not talk to `http://localhost`. Use a tunnel, or the Vercel HTTPS URL, and set `PUBLIC_URL` to that origin.

## Safety

- Testnet only
- Daily send cap via `SEND_DAILY_LIMIT_USDC` (default 100)
- Sends require an explicit `confirm: true` tool argument
