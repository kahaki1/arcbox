import "dotenv/config";

function requiredInProd(name: string, fallback: string): string {
  const value = process.env[name]?.trim();
  return value && value.length > 0 ? value : fallback;
}

const port = Number(process.env.PORT ?? "8787");

export const config = {
  port: Number.isFinite(port) ? port : 8787,
  publicUrl: (process.env.PUBLIC_URL ?? `http://localhost:${process.env.PORT ?? "8787"}`).replace(
    /\/+$/,
    "",
  ),
  cookieSecret: requiredInProd("COOKIE_SECRET", "dev-only-change-me-please-32chars!!"),
  circleApiKey: process.env.CIRCLE_API_KEY?.trim() ?? "",
  circleEntitySecret: process.env.CIRCLE_ENTITY_SECRET?.trim() ?? "",
  circleWalletSetId: process.env.CIRCLE_WALLET_SET_ID?.trim() ?? "",
  sendDailyLimitUsdc: Number(process.env.SEND_DAILY_LIMIT_USDC ?? "100"),
  chain: "Arc_Testnet" as const,
  circleBlockchain: "ARC-TESTNET" as const,
  explorerBase: "https://testnet.arcscan.app",
  faucetUrl: "https://faucet.circle.com",
  scopes: ["openid", "email", "wallet", "wallet:send"] as const,
  resendApiKey: process.env.RESEND_API_KEY?.trim() ?? "",
};

export const publicUrl = new URL(config.publicUrl);
export const mcpUrl = new URL("/mcp", `${config.publicUrl}/`);
export const issuerUrl = new URL(config.publicUrl);

export function isHttps(): boolean {
  return publicUrl.protocol === "https:";
}

export function circleConfigured(): boolean {
  return Boolean(config.circleApiKey && config.circleEntitySecret);
}
