import { randomBytes } from "node:crypto";
import { config } from "../config.js";
import { signTypedData } from "../circle/rest.js";
import type { WalletRecord } from "../store.js";

export type X402Accept = {
  scheme?: string;
  network?: string;
  maxAmountRequired?: string;
  amount?: string;
  resource?: string;
  description?: string;
  mimeType?: string;
  payTo?: string;
  maxTimeoutSeconds?: number;
  asset?: string;
  extra?: { name?: string; version?: string; verifyingContract?: string };
};

export type X402Required = {
  x402Version?: number;
  accepts?: X402Accept[];
  error?: string;
  resource?: { url?: string; description?: string };
};

function header(res: Response, name: string): string | null {
  return res.headers.get(name) ?? res.headers.get(name.toLowerCase());
}

function decodeRequired(value: string): X402Required | null {
  try {
    const json = Buffer.from(value, "base64").toString("utf8");
    return JSON.parse(json) as X402Required;
  } catch {
    try {
      return JSON.parse(value) as X402Required;
    } catch {
      return null;
    }
  }
}

export function isArcNetwork(network?: string): boolean {
  if (!network) return false;
  const n = network.toLowerCase();
  return (
    n === "eip155:5042002" ||
    n === "arc-testnet" ||
    n === "arctestnet" ||
    n === "arc_testnet"
  );
}

export function parsePaymentRequired(res: Response, body: unknown): X402Required | null {
  const fromHeader =
    header(res, "PAYMENT-REQUIRED") ??
    header(res, "payment-required") ??
    header(res, "X-PAYMENT-REQUIRED");
  if (fromHeader) {
    const decoded = decodeRequired(fromHeader);
    if (decoded) return decoded;
  }
  if (body && typeof body === "object") {
    const rec = body as X402Required;
    if (Array.isArray(rec.accepts) || rec.x402Version) return rec;
  }
  return null;
}

export function pickArcAccept(required: X402Required): X402Accept {
  const accepts = required.accepts ?? [];
  const match = accepts.find((item) => isArcNetwork(item.network) && (item.scheme ?? "exact") === "exact");
  const chosen = match ?? accepts.find((item) => (item.scheme ?? "exact") === "exact") ?? accepts[0];
  if (!chosen) {
    throw new Error("This 402 response has no x402 payment options.");
  }
  if (!isArcNetwork(chosen.network)) {
    throw new Error(
      `This paywall is on ${chosen.network ?? "an unknown network"}, not Arc Testnet (eip155:5042002).`,
    );
  }
  if (chosen.extra?.name === "GatewayWalletBatched") {
    throw new Error(
      "This endpoint uses Circle Gateway batch settlement. Deposit USDC into Gateway first; Onix currently pays EIP-3009 x402 on Arc Testnet.",
    );
  }
  return chosen;
}

export function atomicToUsdc(atomic: string): string {
  const value = BigInt(atomic);
  const whole = value / 1_000_000n;
  const frac = (value % 1_000_000n).toString().padStart(6, "0").replace(/0+$/, "");
  return frac ? `${whole}.${frac}` : whole.toString();
}

function usdcToAtomic(usdc: string): bigint {
  const [w, f = ""] = usdc.split(".");
  const frac = (f + "000000").slice(0, 6);
  return BigInt(w || "0") * 1_000_000n + BigInt(frac || "0");
}

function randomNonce(): string {
  return `0x${randomBytes(32).toString("hex")}`;
}

export function buildTypedData(input: {
  from: string;
  accept: X402Accept;
}): { typedData: Record<string, unknown>; authorization: Record<string, string> } {
  const now = Math.floor(Date.now() / 1000);
  const timeout = input.accept.maxTimeoutSeconds && input.accept.maxTimeoutSeconds > 0
    ? input.accept.maxTimeoutSeconds
    : 3600;
  const authorization = {
    from: input.from,
    to: input.accept.payTo ?? "",
    value: input.accept.maxAmountRequired ?? input.accept.amount ?? "0",
    validAfter: String(now - 60),
    validBefore: String(now + timeout),
    nonce: randomNonce(),
  };
  const asset = input.accept.asset || config.arcUsdc;
  const typedData = {
    types: {
      EIP712Domain: [
        { name: "name", type: "string" },
        { name: "version", type: "string" },
        { name: "chainId", type: "uint256" },
        { name: "verifyingContract", type: "address" },
      ],
      TransferWithAuthorization: [
        { name: "from", type: "address" },
        { name: "to", type: "address" },
        { name: "value", type: "uint256" },
        { name: "validAfter", type: "uint256" },
        { name: "validBefore", type: "uint256" },
        { name: "nonce", type: "bytes32" },
      ],
    },
    domain: {
      name: input.accept.extra?.name ?? "USDC",
      version: input.accept.extra?.version ?? "2",
      chainId: config.arcChainId,
      verifyingContract: input.accept.extra?.verifyingContract ?? asset,
    },
    primaryType: "TransferWithAuthorization",
    message: authorization,
  };
  return { typedData, authorization };
}

export function encodePayment(input: {
  accept: X402Accept;
  signature: string;
  authorization: Record<string, string>;
  version?: number;
}): string {
  const payload = {
    x402Version: input.version ?? 1,
    scheme: input.accept.scheme ?? "exact",
    network: input.accept.network ?? config.arcNetwork,
    payload: {
      signature: input.signature,
      authorization: input.authorization,
    },
  };
  return Buffer.from(JSON.stringify(payload)).toString("base64");
}

async function readBody(res: Response): Promise<unknown> {
  const text = await res.text();
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

export async function probeX402(url: string, method = "GET", body?: string): Promise<{
  status: number;
  paid: boolean;
  required: X402Required | null;
  body: unknown;
}> {
  const res = await fetch(url, {
    method,
    headers: body ? { "content-type": "application/json" } : undefined,
    body: body && method !== "GET" ? body : undefined,
    redirect: "follow",
  });
  const parsed = await readBody(res);
  return {
    status: res.status,
    paid: res.status !== 402,
    required: res.status === 402 ? parsePaymentRequired(res, parsed) : null,
    body: parsed,
  };
}

export async function payX402(input: {
  wallet: WalletRecord;
  url: string;
  method?: string;
  body?: string;
  maxUsdc?: string;
}): Promise<{
  status: number;
  paid: boolean;
  usdc?: string;
  payTo?: string;
  network?: string;
  body: unknown;
}> {
  const method = input.method ?? "GET";
  const first = await fetch(input.url, {
    method,
    headers: input.body && method !== "GET" ? { "content-type": "application/json" } : undefined,
    body: input.body && method !== "GET" ? input.body : undefined,
    redirect: "follow",
  });
  const firstBody = await readBody(first);
  if (first.status !== 402) {
    return { status: first.status, paid: first.ok, body: firstBody };
  }

  const required = parsePaymentRequired(first, firstBody);
  if (!required) {
    throw new Error("Got HTTP 402 but could not parse x402 payment requirements.");
  }
  const accept = pickArcAccept(required);
  const atomic = accept.maxAmountRequired ?? accept.amount ?? "0";
  const usdc = atomicToUsdc(atomic);
  if (input.maxUsdc && usdcToAtomic(usdc) > usdcToAtomic(input.maxUsdc)) {
    throw new Error(`Paywall asks for ${usdc} USDC, which exceeds max_usdc=${input.maxUsdc}.`);
  }
  if (!accept.payTo) {
    throw new Error("Paywall is missing a payTo address.");
  }

  const { typedData, authorization } = buildTypedData({
    from: input.wallet.address,
    accept,
  });
  const signature = await signTypedData(input.wallet.circleWalletId, typedData);
  const payment = encodePayment({
    accept,
    signature,
    authorization,
    version: required.x402Version,
  });

  const ownHost = (() => {
    try {
      return new URL(input.url).origin === new URL(config.publicUrl).origin;
    } catch {
      return false;
    }
  })();

  const paid = await fetch(input.url, {
    method,
    headers: {
      ...(input.body && method !== "GET" ? { "content-type": "application/json" } : {}),
      "X-PAYMENT": payment,
      "PAYMENT-SIGNATURE": payment,
      ...(ownHost ? { "X-Onix-Wallet-Id": input.wallet.circleWalletId } : {}),
    },
    body: input.body && method !== "GET" ? input.body : undefined,
    redirect: "follow",
  });
  const paidBody = await readBody(paid);
  return {
    status: paid.status,
    paid: paid.ok,
    usdc,
    payTo: accept.payTo,
    network: accept.network,
    body: paidBody,
  };
}
