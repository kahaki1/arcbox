import { config } from "../config.js";
import { store, type WalletRecord } from "../store.js";
import { createArcWallet, createWalletSet, listWalletBalances } from "./rest.js";

async function ensureWalletSetId(): Promise<string> {
  if (config.circleWalletSetId) return config.circleWalletSetId;
  const existing = await store.getWalletSetId();
  if (existing) return existing;
  const id = await createWalletSet("Onix ChatGPT users");
  await store.setWalletSetId(id);
  return id;
}

export async function ensureUserWallet(userId: string, email?: string): Promise<WalletRecord> {
  const existing = await store.getWalletByUserId(userId);
  if (existing) return existing;

  const walletSetId = await ensureWalletSetId();
  const wallet = await createArcWallet(walletSetId, userId);

  return store.saveWallet({
    userId,
    email,
    circleWalletId: wallet.id,
    address: wallet.address,
    blockchain: wallet.blockchain,
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
  return listWalletBalances(walletId);
}

export function usdcBalance(balances: TokenBalance[]): string {
  const usdc = balances.find((row) => row.symbol.toUpperCase() === "USDC");
  return usdc?.amount ?? "0";
}
