import { mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const dataFile = process.env.VERCEL
  ? join("/tmp", "arcbox.json")
  : join(dirname(fileURLToPath(import.meta.url)), "..", "data", "arcbox.json");

export type UserRecord = {
  id: string;
  email: string;
  passwordHash: string;
  createdAt: string;
};

export type WalletRecord = {
  userId: string;
  circleWalletId: string;
  address: string;
  blockchain: string;
  accountType: string;
  createdAt: string;
};

export type OAuthClientRecord = {
  client_id: string;
  client_secret?: string;
  client_id_issued_at?: number;
  client_secret_expires_at?: number;
  redirect_uris: string[];
  client_name?: string;
  grant_types?: string[];
  response_types?: string[];
  token_endpoint_auth_method?: string;
  scope?: string;
};

export type AuthCodeRecord = {
  code: string;
  clientId: string;
  userId: string;
  codeChallenge: string;
  redirectUri: string;
  scopes: string[];
  resource?: string;
  expiresAt: number;
};

export type TokenRecord = {
  token: string;
  type: "access" | "refresh";
  userId: string;
  clientId: string;
  scopes: string[];
  resource?: string;
  expiresAt: number;
  familyId: string;
};

export type SessionRecord = {
  id: string;
  userId: string;
  expiresAt: number;
};

export type PendingAuthRecord = {
  id: string;
  clientId: string;
  state?: string;
  scopes: string[];
  codeChallenge: string;
  redirectUri: string;
  resource?: string;
  expiresAt: number;
};

export type TransferRecord = {
  id: string;
  userId: string;
  fromAddress: string;
  toAddress: string;
  amount: string;
  token: string;
  txHash?: string;
  explorerUrl?: string;
  state: string;
  createdAt: string;
};

type DbShape = {
  users: UserRecord[];
  wallets: WalletRecord[];
  oauthClients: OAuthClientRecord[];
  authCodes: AuthCodeRecord[];
  tokens: TokenRecord[];
  sessions: SessionRecord[];
  pendingAuth: PendingAuthRecord[];
  transfers: TransferRecord[];
  settings: { walletSetId?: string };
};

const emptyDb = (): DbShape => ({
  users: [],
  wallets: [],
  oauthClients: [],
  authCodes: [],
  tokens: [],
  sessions: [],
  pendingAuth: [],
  transfers: [],
  settings: {},
});

function load(): DbShape {
  try {
    const raw = readFileSync(dataFile, "utf8");
    return { ...emptyDb(), ...JSON.parse(raw) } as DbShape;
  } catch {
    return emptyDb();
  }
}

function save(db: DbShape): void {
  mkdirSync(dirname(dataFile), { recursive: true });
  const tmp = `${dataFile}.tmp`;
  writeFileSync(tmp, JSON.stringify(db, null, 2));
  renameSync(tmp, dataFile);
}

let db = load();

function persist(): void {
  pruneExpired();
  save(db);
}

function pruneExpired(): void {
  const now = Date.now();
  db.authCodes = db.authCodes.filter((row) => row.expiresAt > now);
  db.tokens = db.tokens.filter((row) => row.expiresAt > now);
  db.sessions = db.sessions.filter((row) => row.expiresAt > now);
  db.pendingAuth = db.pendingAuth.filter((row) => row.expiresAt > now);
}

export const store = {
  getUserById(id: string): UserRecord | undefined {
    return db.users.find((user) => user.id === id);
  },
  getUserByEmail(email: string): UserRecord | undefined {
    return db.users.find((user) => user.email === email.toLowerCase());
  },
  createUser(user: UserRecord): UserRecord {
    db.users.push(user);
    persist();
    return user;
  },

  getWalletByUserId(userId: string): WalletRecord | undefined {
    return db.wallets.find((wallet) => wallet.userId === userId);
  },
  saveWallet(wallet: WalletRecord): WalletRecord {
    db.wallets = db.wallets.filter((row) => row.userId !== wallet.userId);
    db.wallets.push(wallet);
    persist();
    return wallet;
  },

  getClient(clientId: string): OAuthClientRecord | undefined {
    return db.oauthClients.find((client) => client.client_id === clientId);
  },
  saveClient(client: OAuthClientRecord): OAuthClientRecord {
    db.oauthClients = db.oauthClients.filter((row) => row.client_id !== client.client_id);
    db.oauthClients.push(client);
    persist();
    return client;
  },

  saveAuthCode(code: AuthCodeRecord): void {
    db.authCodes.push(code);
    persist();
  },
  peekAuthCode(code: string): AuthCodeRecord | undefined {
    return db.authCodes.find((row) => row.code === code && row.expiresAt > Date.now());
  },
  takeAuthCode(code: string): AuthCodeRecord | undefined {
    const found = db.authCodes.find((row) => row.code === code);
    if (!found) return undefined;
    db.authCodes = db.authCodes.filter((row) => row.code !== code);
    persist();
    return found;
  },

  saveToken(token: TokenRecord): void {
    db.tokens.push(token);
    persist();
  },
  getToken(token: string): TokenRecord | undefined {
    return db.tokens.find((row) => row.token === token && row.expiresAt > Date.now());
  },
  deleteToken(token: string): void {
    db.tokens = db.tokens.filter((row) => row.token !== token);
    persist();
  },
  deleteTokenFamily(familyId: string): void {
    db.tokens = db.tokens.filter((row) => row.familyId !== familyId);
    persist();
  },

  saveSession(session: SessionRecord): void {
    db.sessions.push(session);
    persist();
  },
  getSession(id: string): SessionRecord | undefined {
    return db.sessions.find((row) => row.id === id && row.expiresAt > Date.now());
  },
  deleteSession(id: string): void {
    db.sessions = db.sessions.filter((row) => row.id !== id);
    persist();
  },

  savePendingAuth(pending: PendingAuthRecord): void {
    db.pendingAuth.push(pending);
    persist();
  },
  takePendingAuth(id: string): PendingAuthRecord | undefined {
    const found = db.pendingAuth.find((row) => row.id === id && row.expiresAt > Date.now());
    if (!found) return undefined;
    db.pendingAuth = db.pendingAuth.filter((row) => row.id !== id);
    persist();
    return found;
  },

  addTransfer(transfer: TransferRecord): void {
    db.transfers.unshift(transfer);
    db.transfers = db.transfers.slice(0, 200);
    persist();
  },
  listTransfers(userId: string, limit = 20): TransferRecord[] {
    return db.transfers.filter((row) => row.userId === userId).slice(0, limit);
  },
  sumSentToday(userId: string): number {
    const start = new Date();
    start.setUTCHours(0, 0, 0, 0);
    const since = start.toISOString();
    return db.transfers
      .filter((row) => row.userId === userId && row.createdAt >= since && row.state !== "failed")
      .reduce((sum, row) => sum + Number(row.amount), 0);
  },

  getWalletSetId(): string | undefined {
    return db.settings.walletSetId;
  },
  setWalletSetId(id: string): void {
    db.settings.walletSetId = id;
    persist();
  },
};
