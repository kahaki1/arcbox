import { randomUUID } from "node:crypto";
import { circleConfigured, config } from "../config.js";
import { store } from "../store.js";
import type { WalletRecord } from "../store.js";
import { loadCjs } from "./load-cjs.js";

type AppKitModule = typeof import("@circle-fin/app-kit");
type AdapterModule = typeof import("@circle-fin/adapter-circle-wallets");
type SendParams = import("@circle-fin/app-kit").SendParams;

let kit: InstanceType<AppKitModule["AppKit"]> | null = null;
let adapter: ReturnType<AdapterModule["createCircleWalletsAdapter"]> | null = null;

function getKit() {
  if (!kit) {
    const { AppKit } = loadCjs<AppKitModule>("@circle-fin/app-kit");
    kit = new AppKit();
  }
  return kit;
}

function getAdapter() {
  if (!circleConfigured()) {
    throw new Error("Circle credentials are missing.");
  }
  if (!adapter) {
    const { createCircleWalletsAdapter } = loadCjs<AdapterModule>(
      "@circle-fin/adapter-circle-wallets",
    );
    adapter = createCircleWalletsAdapter({
      apiKey: config.circleApiKey,
      entitySecret: config.circleEntitySecret,
    });
  }
  return adapter;
}

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

function sendParams(fromAddress: string, to: string, amount: string): SendParams {
  return {
    from: {
      adapter: getAdapter(),
      chain: config.chain,
      address: fromAddress,
    },
    to,
    amount,
    token: "USDC",
  };
}

export async function estimateUsdcSend(fromAddress: string, to: string, amount: string) {
  return getKit().estimateSend(sendParams(fromAddress, to, amount));
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

  const estimate = await estimateUsdcSend(input.wallet.address, input.to, input.amount);
  const result = await getKit().send(sendParams(input.wallet.address, input.to, input.amount));

  const state = "state" in result ? String(result.state) : "submitted";
  const txHash = "txHash" in result && typeof result.txHash === "string" ? result.txHash : undefined;
  const explorerUrl =
    "explorerUrl" in result && typeof result.explorerUrl === "string"
      ? result.explorerUrl
      : txHash
        ? `${config.explorerBase}/tx/${txHash}`
        : undefined;

  await store.addTransfer({
    id: randomUUID(),
    userId: input.userId,
    fromAddress: input.wallet.address,
    toAddress: input.to,
    amount: input.amount,
    token: "USDC",
    txHash,
    explorerUrl,
    state,
    createdAt: new Date().toISOString(),
  });

  return { estimate, result, txHash, explorerUrl, state };
}
