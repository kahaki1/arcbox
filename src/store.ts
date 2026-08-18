import { mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { adminDb, firebaseConfigured } from "./firebase/admin.js";

export type UserRecord = {
  id: string;
  email: string;
  provider?: string;
  createdAt: string;
};

export type WalletRecord = {
  userId: string;
  email?: string;
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

export type OtpRecord = {
  email: string;
  codeHash: string;
  expiresAt: number;
  attempts: number;
  sentAt: number;
  sendCount: number;
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
  otps: OtpRecord[];
  settings: { walletSetId?: string };
};

const dataFile = process.env.VERCEL
  ? join("/tmp", "arcbox.json")
  : join(dirname(fileURLToPath(import.meta.url)), "..", "data", "arcbox.json");

const emptyDb = (): DbShape => ({
  users: [],
  wallets: [],
  oauthClients: [],
  authCodes: [],
  tokens: [],
  sessions: [],
  pendingAuth: [],
  transfers: [],
  otps: [],
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

let memory = load();

function persist(): void {
  const now = Date.now();
  memory.authCodes = memory.authCodes.filter((row) => row.expiresAt > now);
  memory.tokens = memory.tokens.filter((row) => row.expiresAt > now);
  memory.sessions = memory.sessions.filter((row) => row.expiresAt > now);
  memory.pendingAuth = memory.pendingAuth.filter((row) => row.expiresAt > now);
  memory.otps = memory.otps.filter((row) => row.expiresAt > now);
  save(memory);
}

function docId(value: string): string {
  return Buffer.from(value).toString("base64url");
}

function emailKey(email: string): string {
  return docId(email.toLowerCase());
}

const firestoreStore = {
  async getUserById(id: string): Promise<UserRecord | undefined> {
    const snap = await adminDb().collection("users").doc(id).get();
    return snap.exists ? (snap.data() as UserRecord) : undefined;
  },
  async getUserByEmail(email: string): Promise<UserRecord | undefined> {
    const snap = await adminDb().collection("users").where("email", "==", email.toLowerCase()).limit(1).get();
    return snap.empty ? undefined : (snap.docs[0]?.data() as UserRecord);
  },
  async upsertUser(user: UserRecord): Promise<UserRecord> {
    const ref = adminDb().collection("users").doc(user.id);
    const existing = await ref.get();
    const next = existing.exists ? { ...(existing.data() as UserRecord), ...user } : user;
    await ref.set(next, { merge: true });
    return next;
  },

  async getWalletByUserId(userId: string): Promise<WalletRecord | undefined> {
    const snap = await adminDb().collection("wallets").doc(userId).get();
    return snap.exists ? (snap.data() as WalletRecord) : undefined;
  },
  async saveWallet(wallet: WalletRecord): Promise<WalletRecord> {
    await adminDb().collection("wallets").doc(wallet.userId).set(wallet);
    if (wallet.email) {
      await adminDb().collection("users").doc(wallet.userId).set(
        { email: wallet.email, walletAddress: wallet.address, circleWalletId: wallet.circleWalletId },
        { merge: true },
      );
    }
    return wallet;
  },

  async getClient(clientId: string): Promise<OAuthClientRecord | undefined> {
    const snap = await adminDb().collection("oauthClients").doc(docId(clientId)).get();
    return snap.exists ? (snap.data() as OAuthClientRecord) : undefined;
  },
  async saveClient(client: OAuthClientRecord): Promise<OAuthClientRecord> {
    await adminDb().collection("oauthClients").doc(docId(client.client_id)).set(client);
    return client;
  },

  async saveAuthCode(code: AuthCodeRecord): Promise<void> {
    await adminDb().collection("authCodes").doc(docId(code.code)).set(code);
  },
  async peekAuthCode(code: string): Promise<AuthCodeRecord | undefined> {
    const snap = await adminDb().collection("authCodes").doc(docId(code)).get();
    if (!snap.exists) return undefined;
    const row = snap.data() as AuthCodeRecord;
    return row.expiresAt > Date.now() ? row : undefined;
  },
  async takeAuthCode(code: string): Promise<AuthCodeRecord | undefined> {
    const ref = adminDb().collection("authCodes").doc(docId(code));
    const snap = await ref.get();
    if (!snap.exists) return undefined;
    await ref.delete();
    return snap.data() as AuthCodeRecord;
  },

  async saveToken(token: TokenRecord): Promise<void> {
    await adminDb().collection("tokens").doc(docId(token.token)).set(token);
  },
  async getToken(token: string): Promise<TokenRecord | undefined> {
    const snap = await adminDb().collection("tokens").doc(docId(token)).get();
    if (!snap.exists) return undefined;
    const row = snap.data() as TokenRecord;
    return row.expiresAt > Date.now() ? row : undefined;
  },
  async deleteToken(token: string): Promise<void> {
    await adminDb().collection("tokens").doc(docId(token)).delete();
  },
  async deleteTokenFamily(familyId: string): Promise<void> {
    const snap = await adminDb().collection("tokens").where("familyId", "==", familyId).get();
    const batch = adminDb().batch();
    for (const doc of snap.docs) batch.delete(doc.ref);
    await batch.commit();
  },

  async saveSession(session: SessionRecord): Promise<void> {
    await adminDb().collection("sessions").doc(session.id).set(session);
  },
  async getSession(id: string): Promise<SessionRecord | undefined> {
    const snap = await adminDb().collection("sessions").doc(id).get();
    if (!snap.exists) return undefined;
    const row = snap.data() as SessionRecord;
    return row.expiresAt > Date.now() ? row : undefined;
  },
  async deleteSession(id: string): Promise<void> {
    await adminDb().collection("sessions").doc(id).delete();
  },

  async savePendingAuth(pending: PendingAuthRecord): Promise<void> {
    await adminDb().collection("pendingAuth").doc(pending.id).set(pending);
  },
  async takePendingAuth(id: string): Promise<PendingAuthRecord | undefined> {
    const ref = adminDb().collection("pendingAuth").doc(id);
    const snap = await ref.get();
    if (!snap.exists) return undefined;
    await ref.delete();
    const row = snap.data() as PendingAuthRecord;
    return row.expiresAt > Date.now() ? row : undefined;
  },

  async addTransfer(transfer: TransferRecord): Promise<void> {
    await adminDb().collection("transfers").doc(transfer.id).set(transfer);
  },
  async listTransfers(userId: string, limit = 20): Promise<TransferRecord[]> {
    const snap = await adminDb().collection("transfers").where("userId", "==", userId).get();
    return snap.docs
      .map((doc) => doc.data() as TransferRecord)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      .slice(0, limit);
  },
  async sumSentToday(userId: string): Promise<number> {
    const start = new Date();
    start.setUTCHours(0, 0, 0, 0);
    const since = start.toISOString();
    const snap = await adminDb().collection("transfers").where("userId", "==", userId).get();
    return snap.docs
      .map((doc) => doc.data() as TransferRecord)
      .filter((row) => row.createdAt >= since && row.state !== "failed")
      .reduce((sum, row) => sum + Number(row.amount), 0);
  },

  async getWalletSetId(): Promise<string | undefined> {
    const snap = await adminDb().collection("settings").doc("app").get();
    return snap.exists ? (snap.data() as { walletSetId?: string }).walletSetId : undefined;
  },
  async setWalletSetId(id: string): Promise<void> {
    await adminDb().collection("settings").doc("app").set({ walletSetId: id }, { merge: true });
  },

  async getOtp(email: string): Promise<OtpRecord | undefined> {
    const snap = await adminDb().collection("otps").doc(emailKey(email)).get();
    if (!snap.exists) return undefined;
    const row = snap.data() as OtpRecord;
    return row.expiresAt > Date.now() ? row : undefined;
  },
  async saveOtp(otp: OtpRecord): Promise<void> {
    await adminDb().collection("otps").doc(emailKey(otp.email)).set(otp);
  },
  async deleteOtp(email: string): Promise<void> {
    await adminDb().collection("otps").doc(emailKey(email)).delete();
  },
};

const fileStore = {
  async getUserById(id: string) {
    return memory.users.find((user) => user.id === id);
  },
  async getUserByEmail(email: string) {
    return memory.users.find((user) => user.email === email.toLowerCase());
  },
  async upsertUser(user: UserRecord) {
    const index = memory.users.findIndex((row) => row.id === user.id);
    if (index >= 0) memory.users[index] = { ...memory.users[index], ...user };
    else memory.users.push(user);
    persist();
    return memory.users.find((row) => row.id === user.id) ?? user;
  },
  async getWalletByUserId(userId: string) {
    return memory.wallets.find((wallet) => wallet.userId === userId);
  },
  async saveWallet(wallet: WalletRecord) {
    memory.wallets = memory.wallets.filter((row) => row.userId !== wallet.userId);
    memory.wallets.push(wallet);
    persist();
    return wallet;
  },
  async getClient(clientId: string) {
    return memory.oauthClients.find((client) => client.client_id === clientId);
  },
  async saveClient(client: OAuthClientRecord) {
    memory.oauthClients = memory.oauthClients.filter((row) => row.client_id !== client.client_id);
    memory.oauthClients.push(client);
    persist();
    return client;
  },
  async saveAuthCode(code: AuthCodeRecord) {
    memory.authCodes.push(code);
    persist();
  },
  async peekAuthCode(code: string) {
    return memory.authCodes.find((row) => row.code === code && row.expiresAt > Date.now());
  },
  async takeAuthCode(code: string) {
    const found = memory.authCodes.find((row) => row.code === code);
    if (!found) return undefined;
    memory.authCodes = memory.authCodes.filter((row) => row.code !== code);
    persist();
    return found;
  },
  async saveToken(token: TokenRecord) {
    memory.tokens.push(token);
    persist();
  },
  async getToken(token: string) {
    return memory.tokens.find((row) => row.token === token && row.expiresAt > Date.now());
  },
  async deleteToken(token: string) {
    memory.tokens = memory.tokens.filter((row) => row.token !== token);
    persist();
  },
  async deleteTokenFamily(familyId: string) {
    memory.tokens = memory.tokens.filter((row) => row.familyId !== familyId);
    persist();
  },
  async saveSession(session: SessionRecord) {
    memory.sessions.push(session);
    persist();
  },
  async getSession(id: string) {
    return memory.sessions.find((row) => row.id === id && row.expiresAt > Date.now());
  },
  async deleteSession(id: string) {
    memory.sessions = memory.sessions.filter((row) => row.id !== id);
    persist();
  },
  async savePendingAuth(pending: PendingAuthRecord) {
    memory.pendingAuth.push(pending);
    persist();
  },
  async takePendingAuth(id: string) {
    const found = memory.pendingAuth.find((row) => row.id === id && row.expiresAt > Date.now());
    if (!found) return undefined;
    memory.pendingAuth = memory.pendingAuth.filter((row) => row.id !== id);
    persist();
    return found;
  },
  async addTransfer(transfer: TransferRecord) {
    memory.transfers.unshift(transfer);
    memory.transfers = memory.transfers.slice(0, 200);
    persist();
  },
  async listTransfers(userId: string, limit = 20) {
    return memory.transfers.filter((row) => row.userId === userId).slice(0, limit);
  },
  async sumSentToday(userId: string) {
    const start = new Date();
    start.setUTCHours(0, 0, 0, 0);
    const since = start.toISOString();
    return memory.transfers
      .filter((row) => row.userId === userId && row.createdAt >= since && row.state !== "failed")
      .reduce((sum, row) => sum + Number(row.amount), 0);
  },
  async getWalletSetId() {
    return memory.settings.walletSetId;
  },
  async setWalletSetId(id: string) {
    memory.settings.walletSetId = id;
    persist();
  },
  async getOtp(email: string) {
    return memory.otps.find((row) => row.email === email.toLowerCase() && row.expiresAt > Date.now());
  },
  async saveOtp(otp: OtpRecord) {
    memory.otps = memory.otps.filter((row) => row.email !== otp.email);
    memory.otps.push(otp);
    persist();
  },
  async deleteOtp(email: string) {
    memory.otps = memory.otps.filter((row) => row.email !== email.toLowerCase());
    persist();
  },
};

export const store = firebaseConfigured() ? firestoreStore : fileStore;
