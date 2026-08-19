import { randomUUID } from "node:crypto";
import { config } from "../config.js";
import { store } from "../store.js";
import type { WalletRecord } from "../store.js";
import {
  ARC_TESTNET_USDC,
  createTransfer,
  estimateTransfer,
  listWalletBalances,
  waitForTransfer,
} from "./rest.js";

const ADDRESS_RE = /^0x[a-fA-F0-9]{40}$/;
const AMOUNT_RE = /^(?:0|[1-9]\d*)(?:\.\d{1,6})?$/;

export function validateSendInput(to: string, amount: string): string | null {
  if (!ADDRESS_RE.test(to)) {
    return "Recipient must be a 0x EVM address (40 hex characters).";
  }
  if (!AMOUNT_RE.test(amount) || Number(amount) <= 0) {
    return "Amount must be a positive USDC number with up to 6 decimal places.";
  }
  return null;
}

async function usdcTokenAddress(walletId: string): Promise<string> {
  const balances = await listWalletBalances(walletId);
  const usdc = balances.find((row) => row.symbol.toUpperCase() === "USDC");
  return usdc?.tokenAddress || ARC_TESTNET_USDC;
}

export async function estimateUsdcSend(wallet: WalletRecord, to: string, amount: string) {
  const tokenAddress = await usdcTokenAddress(wallet.circleWalletId);
  return estimateTransfer({
    walletId: wallet.circleWalletId,
    to,
    amount,
    tokenAddress,
  });
}

export async function sendUsdc(input: {
  userId: string;
  wallet: WalletRecord;
  to: string;
  amount: string;
}) {
  const spent = await store.sumSentToday(input.userId);
  if (spent + Number(input.amount) > config.sendDailyLimitUsdc) {
    throw new Error(
      `This send would exceed the daily cap of ${config.sendDailyLimitUsdc} USDC (already sent ${spent} today).`,
    );
  }

  const tokenAddress = await usdcTokenAddress(input.wallet.circleWalletId);
  let estimate: Record<string, unknown> = {};
  try {
    estimate = await estimateTransfer({
      walletId: input.wallet.circleWalletId,
      to: input.to,
      amount: input.amount,
      tokenAddress,
    });
  } catch (error) {
    estimate = { warning: error instanceof Error ? error.message : "Fee estimate unavailable" };
  }
  const created = await createTransfer({
    walletId: input.wallet.circleWalletId,
    to: input.to,
    amount: input.amount,
    tokenAddress,
  });
  const result = await waitForTransfer(created.id);
  const txHash = result.txHash;
  const explorerUrl = txHash ? `${config.explorerBase}/tx/${txHash}` : undefined;

  if (result.state !== "COMPLETE") {
    await store.addTransfer({
      id: created.id,
      userId: input.userId,
      fromAddress: input.wallet.address,
      toAddress: input.to,
      amount: input.amount,
      token: "USDC",
      txHash,
      explorerUrl,
      state: result.state,
      createdAt: new Date().toISOString(),
    });
    throw new Error(
      `Transfer ended in state ${result.state}${txHash ? ` (${txHash})` : ""}. No USDC should be treated as sent unless the explorer shows a success.`,
    );
  }

  await store.addTransfer({
    id: created.id || randomUUID(),
    userId: input.userId,
    fromAddress: input.wallet.address,
    toAddress: input.to,
    amount: input.amount,
    token: "USDC",
    txHash,
    explorerUrl,
    state: result.state,
    createdAt: new Date().toISOString(),
  });

  return { estimate, result, txHash, explorerUrl, state: result.state };
}
