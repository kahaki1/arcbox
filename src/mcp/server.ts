import { randomUUID } from "node:crypto";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { circleConfigured, config, mcpUrl } from "../config.js";
import { estimateUsdcSend, sendUsdc, validateSendInput } from "../circle/send.js";
import { ensureUserWallet, getWalletBalances, usdcBalance } from "../circle/wallets.js";
import { store } from "../store.js";
import { atomicToUsdc, payX402, pickArcAccept, probeX402 } from "../x402/client.js";

function textResult(payload: unknown, isError = false) {
  return {
    content: [{ type: "text" as const, text: JSON.stringify(payload, null, 2) }],
    structuredContent: typeof payload === "object" && payload !== null ? payload : { value: payload },
    isError,
  };
}

function authChallenge(message: string) {
  return {
    content: [{ type: "text" as const, text: message }],
    isError: true,
    _meta: {
      "mcp/www_authenticate": [
        `Bearer resource_metadata="${mcpUrl.origin}/.well-known/oauth-protected-resource/mcp", error="invalid_token", error_description="${message}"`,
      ],
    },
  };
}

function userIdFromExtra(extra: Record<string, unknown> | undefined): string | null {
  return typeof extra?.userId === "string" ? extra.userId : null;
}

export function createMcpServer(authExtra?: Record<string, unknown>): McpServer {
  const server = new McpServer({
    name: "onix-mcp-server",
    version: "1.0.0",
  });

  const oauthScheme = { type: "oauth2" as const, scopes: ["wallet"] };

  server.registerTool(
    "onix_status",
    {
      title: "Onix status",
      description:
        "Show whether this ChatGPT user is signed into Onix and whether Circle wallets are configured. Safe to call first.",
      inputSchema: z.object({}).strict(),
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
      // @ts-expect-error ChatGPT Apps SDK reads securitySchemes
      securitySchemes: [{ type: "noauth" }, oauthScheme],
    },
    async () => {
      const userId = userIdFromExtra(authExtra);
      const user = userId ? await store.getUserById(userId) : undefined;
      const wallet = userId ? await store.getWalletByUserId(userId) : undefined;
      return textResult({
        product: "Onix",
        network: config.circleBlockchain,
        authenticated: Boolean(user),
        email: user?.email ?? null,
        walletAddress: wallet?.address ?? null,
        circleConfigured: circleConfigured(),
        mcpUrl: mcpUrl.href,
        faucet: config.faucetUrl,
      });
    },
  );

  server.registerTool(
    "get_wallet",
    {
      title: "Get Arc Testnet wallet",
      description:
        "Return this ChatGPT user's Circle developer-controlled wallet on Arc Testnet. Creates the wallet on first use if it does not exist yet.",
      inputSchema: z.object({}).strict(),
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: true },
      // @ts-expect-error ChatGPT Apps SDK reads securitySchemes
      securitySchemes: [oauthScheme],
    },
    async () => {
      const userId = userIdFromExtra(authExtra);
      if (!userId) return authChallenge("Log into Onix to load your wallet.");
      try {
        const user = await store.getUserById(userId);
        const wallet = await ensureUserWallet(userId, user?.email);
        return textResult({
          address: wallet.address,
          walletId: wallet.circleWalletId,
          blockchain: wallet.blockchain,
          accountType: wallet.accountType,
          explorer: `${config.explorerBase}/address/${wallet.address}`,
          faucet: config.faucetUrl,
          note: "Fund this address with testnet USDC from the Circle faucet. On Arc, USDC is also used for gas.",
        });
      } catch (error) {
        return textResult(
          { error: error instanceof Error ? error.message : "Failed to load wallet" },
          true,
        );
      }
    },
  );

  server.registerTool(
    "get_balance",
    {
      title: "Get USDC balance",
      description: "Check the authenticated user's USDC (and other token) balances on Arc Testnet.",
      inputSchema: z.object({}).strict(),
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true },
      // @ts-expect-error ChatGPT Apps SDK reads securitySchemes
      securitySchemes: [oauthScheme],
    },
    async () => {
      const userId = userIdFromExtra(authExtra);
      if (!userId) return authChallenge("Log into Onix to read your balance.");
      try {
        const user = await store.getUserById(userId);
        const wallet = await ensureUserWallet(userId, user?.email);
        const balances = await getWalletBalances(wallet.circleWalletId);
        return textResult({
          address: wallet.address,
          usdc: usdcBalance(balances),
          balances,
          explorer: `${config.explorerBase}/address/${wallet.address}`,
        });
      } catch (error) {
        return textResult(
          { error: error instanceof Error ? error.message : "Failed to read balance" },
          true,
        );
      }
    },
  );

  server.registerTool(
    "estimate_send_usdc",
    {
      title: "Estimate a USDC send",
      description:
        "Estimate gas/fees for sending USDC on Arc Testnet from the authenticated user's Circle wallet. Does not submit a transaction.",
      inputSchema: z
        .object({
          to: z.string().describe("Recipient 0x address on Arc Testnet"),
          amount: z.string().describe('USDC amount as a decimal string, e.g. "1.50"'),
        })
        .strict(),
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true },
      // @ts-expect-error ChatGPT Apps SDK reads securitySchemes
      securitySchemes: [oauthScheme],
    },
    async ({ to, amount }) => {
      const userId = userIdFromExtra(authExtra);
      if (!userId) return authChallenge("Log into Onix to estimate a send.");
      const invalid = validateSendInput(to, amount);
      if (invalid) return textResult({ error: invalid }, true);
      try {
        const user = await store.getUserById(userId);
        const wallet = await ensureUserWallet(userId, user?.email);
        const estimate = await estimateUsdcSend(wallet, to, amount);
        return textResult({
          from: wallet.address,
          to,
          amount,
          token: "USDC",
          chain: config.chain,
          estimate,
          next_step: "Call send_usdc with the same to/amount and confirm=true to submit.",
        });
      } catch (error) {
        return textResult(
          { error: error instanceof Error ? error.message : "Estimate failed" },
          true,
        );
      }
    },
  );

  server.registerTool(
    "send_usdc",
    {
      title: "Send USDC on Arc Testnet",
      description:
        "Send USDC on Arc Testnet from the authenticated user's Circle developer wallet using Circle App Kit. If confirm is false, only preview. If confirm is true, submit the transfer.",
      inputSchema: z
        .object({
          to: z.string().describe("Recipient 0x address on Arc Testnet"),
          amount: z.string().describe('USDC amount as a decimal string, e.g. "1.50"'),
          confirm: z
            .boolean()
            .default(false)
            .describe("Must be true to actually submit. False returns a preview only."),
        })
        .strict(),
      annotations: { readOnlyHint: false, destructiveHint: true, idempotentHint: false, openWorldHint: true },
      // @ts-expect-error ChatGPT Apps SDK reads securitySchemes
      securitySchemes: [{ type: "oauth2", scopes: ["wallet", "wallet:send"] }],
    },
    async ({ to, amount, confirm }) => {
      const userId = userIdFromExtra(authExtra);
      if (!userId) return authChallenge("Log into Onix to send USDC.");
      const invalid = validateSendInput(to, amount);
      if (invalid) return textResult({ error: invalid }, true);
      try {
        const user = await store.getUserById(userId);
        const wallet = await ensureUserWallet(userId, user?.email);
        if (!confirm) {
          const estimate = await estimateUsdcSend(wallet, to, amount);
          return textResult({
            preview: true,
            from: wallet.address,
            to,
            amount,
            token: "USDC",
            chain: config.chain,
            dailyLimitUsdc: config.sendDailyLimitUsdc,
            sentTodayUsdc: await store.sumSentToday(userId),
            estimate,
            message: "Preview only. Call send_usdc again with confirm=true after the user agrees.",
          });
        }

        const sent = await sendUsdc({ userId, wallet, to, amount });
        return textResult({
          preview: false,
          from: wallet.address,
          to,
          amount,
          token: "USDC",
          chain: config.chain,
          state: sent.state,
          txHash: sent.txHash,
          explorerUrl: sent.explorerUrl,
          estimate: sent.estimate,
        });
      } catch (error) {
        return textResult(
          { error: error instanceof Error ? error.message : "Send failed" },
          true,
        );
      }
    },
  );

  server.registerTool(
    "list_transfers",
    {
      title: "List recent USDC sends",
      description: "List recent USDC transfers Onix submitted for the authenticated user.",
      inputSchema: z
        .object({
          limit: z.number().int().min(1).max(50).default(10),
        })
        .strict(),
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
      // @ts-expect-error ChatGPT Apps SDK reads securitySchemes
      securitySchemes: [oauthScheme],
    },
    async ({ limit }) => {
      const userId = userIdFromExtra(authExtra);
      if (!userId) return authChallenge("Log into Onix to list transfers.");
      return textResult({ transfers: await store.listTransfers(userId, limit) });
    },
  );

  server.registerTool(
    "x402_probe",
    {
      title: "Probe an x402 paywall",
      description:
        "Request a URL and report whether it requires an x402 payment on Arc Testnet. Does not pay. Try https://onixmpc.vercel.app/x402/ping for the Onix demo paywall.",
      inputSchema: z
        .object({
          url: z.string().url().describe("HTTPS URL to request"),
          method: z.string().default("GET"),
        })
        .strict(),
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true },
      // @ts-expect-error ChatGPT Apps SDK reads securitySchemes
      securitySchemes: [oauthScheme],
    },
    async ({ url, method }) => {
      const userId = userIdFromExtra(authExtra);
      if (!userId) return authChallenge("Log into Onix to probe x402 paywalls.");
      try {
        const probed = await probeX402(url, method);
        let quote = null;
        if (probed.required) {
          try {
            const accept = pickArcAccept(probed.required);
            quote = {
              network: accept.network,
              payTo: accept.payTo,
              usdc: atomicToUsdc(accept.maxAmountRequired ?? accept.amount ?? "0"),
              description: accept.description,
            };
          } catch (error) {
            quote = { error: error instanceof Error ? error.message : "Could not read Arc quote" };
          }
        }
        return textResult({
          url,
          status: probed.status,
          paidResource: probed.paid,
          quote,
          required: probed.required,
          body: probed.body,
        });
      } catch (error) {
        return textResult({ error: error instanceof Error ? error.message : "Probe failed" }, true);
      }
    },
  );

  server.registerTool(
    "x402_pay",
    {
      title: "Pay an x402 API on Arc Testnet",
      description:
        "Call a URL. If it returns HTTP 402 for Arc Testnet USDC, sign the x402 payment with this user's Circle wallet and retry. Use confirm=true to actually pay. Demo: https://onixmpc.vercel.app/x402/ping",
      inputSchema: z
        .object({
          url: z.string().url().describe("Paywalled HTTPS URL"),
          method: z.string().default("GET"),
          body: z.string().optional().describe("Optional JSON body for POST/PUT"),
          max_usdc: z.string().default("1").describe("Refuse to pay more than this many USDC"),
          confirm: z.boolean().default(false).describe("Must be true to sign and pay"),
        })
        .strict(),
      annotations: { readOnlyHint: false, destructiveHint: true, idempotentHint: false, openWorldHint: true },
      // @ts-expect-error ChatGPT Apps SDK reads securitySchemes
      securitySchemes: [{ type: "oauth2", scopes: ["wallet", "wallet:send"] }],
    },
    async ({ url, method, body, max_usdc, confirm }) => {
      const userId = userIdFromExtra(authExtra);
      if (!userId) return authChallenge("Log into Onix to pay x402 APIs.");
      try {
        const user = await store.getUserById(userId);
        const wallet = await ensureUserWallet(userId, user?.email);
        const probed = await probeX402(url, method, body);
        if (probed.paid) {
          return textResult({ url, already_free: true, status: probed.status, body: probed.body });
        }
        if (!probed.required) {
          return textResult({ error: `HTTP ${probed.status} with no x402 payment requirements`, body: probed.body }, true);
        }
        const accept = pickArcAccept(probed.required);
        const usdc = atomicToUsdc(accept.maxAmountRequired ?? accept.amount ?? "0");
        if (!confirm) {
          return textResult({
            preview: true,
            url,
            network: accept.network,
            payTo: accept.payTo,
            usdc,
            from: wallet.address,
            message: "Preview only. Call x402_pay again with confirm=true to sign and pay.",
          });
        }
        const spent = await store.sumSentToday(userId);
        if (spent + Number(usdc) > config.sendDailyLimitUsdc) {
          throw new Error(`This x402 payment would exceed the daily cap of ${config.sendDailyLimitUsdc} USDC.`);
        }
        const paid = await payX402({
          wallet,
          url,
          method,
          body,
          maxUsdc: max_usdc,
        });
        await store.addTransfer({
          id: randomUUID(),
          userId,
          fromAddress: wallet.address,
          toAddress: paid.payTo ?? accept.payTo ?? "",
          amount: paid.usdc ?? usdc,
          token: "USDC",
          state: paid.paid ? "x402_paid" : `x402_http_${paid.status}`,
          createdAt: new Date().toISOString(),
        });
        return textResult({
          preview: false,
          url,
          paid: paid.paid,
          status: paid.status,
          usdc: paid.usdc ?? usdc,
          from: wallet.address,
          payTo: paid.payTo,
          network: paid.network,
          body: paid.body,
        });
      } catch (error) {
        return textResult({ error: error instanceof Error ? error.message : "x402 payment failed" }, true);
      }
    },
  );

  return server;
}
