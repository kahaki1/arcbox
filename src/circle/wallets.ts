import { randomUUID } from "node:crypto";
import { config } from "../config.js";
import { store, type WalletRecord } from "../store.js";
import { getCircleClient } from "./client.js";

async function ensureWalletSetId(): Promise<string> {
  if (config.circleWalletSetId) return config.circleWalletSetId;
  const existing = store.getWalletSetId();
  if (existing) return existing;

  const client = getCircleClient();
  const response = await client.createWalletSet({
    name: "ArcBox ChatGPT users",
    idempotencyKey: randomUUID(),
  });
  const id = response.data?.walletSet?.id;
  if (!id) {
    throw new Error("Circle did not return a wallet set id.");
  }
  store.setWalletSetId(id);
  return id;
}

export async function ensureUserWallet(userId: string): Promise<WalletRecord> {
  const existing = store.getWalletByUserId(userId);
  if (existing) return existing;

  const client = getCircleClient();
  const walletSetId = await ensureWalletSetId();
  const response = await client.createWallets({
    walletSetId,
    blockchains: [config.circleBlockchain],
    count: 1,
    accountType: "EOA",
    idempotencyKey: randomUUID(),
    metadata: [{ name: `arcbox:${userId}` }],
  });

  const wallet = response.data?.wallets?.[0];
  if (!wallet?.id || !wallet.address) {
    throw new Error("Circle wallet creation returned no address.");
  }

  return store.saveWallet({
    userId,
    circleWalletId: wallet.id,
    address: wallet.address,
    blockchain: wallet.blockchain ?? config.circleBlockchain,
    accountType: "EOA",
    createdAt: new Date().toISOString(),
  });
}

export type TokenBalance = {
  symbol: string;
  amount: string;
  tokenAddress?: string;
};

export async function getWalletBalances(walletId: string): Promise<TokenBalance[]> {
  const client = getCircleClient();
  const response = await client.getWalletTokenBalance({ id: walletId });
  return (response.data?.tokenBalances ?? []).map((row) => ({
    symbol: row.token?.symbol ?? "UNKNOWN",
    amount: row.amount ?? "0",
    tokenAddress: row.token?.tokenAddress,
  }));
}

export function usdcBalance(balances: TokenBalance[]): string {
  const usdc = balances.find((row) => row.symbol.toUpperCase() === "USDC");
  return usdc?.amount ?? "0";
}
