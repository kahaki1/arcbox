import { publicEncrypt, constants, randomUUID } from "node:crypto";
import { circleConfigured, config } from "../config.js";

const CIRCLE_API = "https://api.circle.com";

type CircleJson = {
  data?: Record<string, unknown>;
  message?: string;
  code?: number;
};

let cachedPublicKey: string | null = null;

function assertConfigured(): void {
  if (!circleConfigured()) {
    throw new Error(
      "Circle credentials are missing. Set CIRCLE_API_KEY and CIRCLE_ENTITY_SECRET.",
    );
  }
}

async function circleFetch<T>(path: string, init: RequestInit = {}): Promise<T> {
  assertConfigured();
  const response = await fetch(`${CIRCLE_API}${path}`, {
    ...init,
    headers: {
      accept: "application/json",
      authorization: `Bearer ${config.circleApiKey}`,
      "content-type": "application/json",
      ...(init.headers ?? {}),
    },
  });
  const body = (await response.json().catch(() => ({}))) as CircleJson;
  if (!response.ok) {
    const detail = body.message ?? JSON.stringify(body);
    throw new Error(`Circle API ${response.status} on ${path}: ${detail}`);
  }
  return body as T;
}

async function getEntityPublicKey(): Promise<string> {
  if (cachedPublicKey) return cachedPublicKey;
  const body = await circleFetch<{ data?: { publicKey?: string } }>(
    "/v1/w3s/config/entity/publicKey",
  );
  const pem = body.data?.publicKey;
  if (!pem) throw new Error("Circle did not return an entity public key.");
  cachedPublicKey = pem;
  return pem;
}

async function entitySecretCiphertext(): Promise<string> {
  const publicKey = await getEntityPublicKey();
  const secret = config.circleEntitySecret.replace(/^0x/, "");
  if (!/^[0-9a-fA-F]{64}$/.test(secret)) {
    throw new Error("CIRCLE_ENTITY_SECRET must be a 32-byte hex string (64 characters).");
  }
  const encrypted = publicEncrypt(
    {
      key: publicKey,
      padding: constants.RSA_PKCS1_OAEP_PADDING,
      oaepHash: "sha256",
    },
    Buffer.from(secret, "hex"),
  );
  return encrypted.toString("base64");
}

export async function createWalletSet(name: string): Promise<string> {
  const body = await circleFetch<{ data?: { walletSet?: { id?: string } } }>(
    "/v1/w3s/developer/walletSets",
    {
      method: "POST",
      body: JSON.stringify({
        idempotencyKey: randomUUID(),
        entitySecretCiphertext: await entitySecretCiphertext(),
        name,
      }),
    },
  );
  const id = body.data?.walletSet?.id;
  if (!id) throw new Error("Circle did not return a wallet set id.");
  return id;
}

export async function createArcWallet(walletSetId: string, userId: string): Promise<{
  id: string;
  address: string;
  blockchain: string;
}> {
  const body = await circleFetch<{
    data?: {
      wallets?: Array<{ id?: string; address?: string; blockchain?: string }>;
    };
  }>("/v1/w3s/developer/wallets", {
    method: "POST",
    body: JSON.stringify({
      idempotencyKey: randomUUID(),
      entitySecretCiphertext: await entitySecretCiphertext(),
      walletSetId,
      blockchains: [config.circleBlockchain],
      accountType: "EOA",
      count: 1,
      metadata: [{ name: `onix:${userId}` }],
    }),
  });
  const wallet = body.data?.wallets?.[0];
  if (!wallet?.id || !wallet.address) {
    throw new Error("Circle wallet creation returned no address.");
  }
  return {
    id: wallet.id,
    address: wallet.address,
    blockchain: wallet.blockchain ?? config.circleBlockchain,
  };
}

export async function listWalletBalances(walletId: string): Promise<
  Array<{ symbol: string; amount: string; tokenAddress?: string }>
> {
  const body = await circleFetch<{
    data?: {
      tokenBalances?: Array<{
        amount?: string;
        token?: { symbol?: string; tokenAddress?: string };
      }>;
    };
  }>(`/v1/w3s/wallets/${walletId}/balances`);
  return (body.data?.tokenBalances ?? []).map((row) => ({
    symbol: row.token?.symbol ?? "UNKNOWN",
    amount: row.amount ?? "0",
    tokenAddress: row.token?.tokenAddress,
  }));
}
