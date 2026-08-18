import { createHmac, randomInt } from "node:crypto";
import { config } from "../config.js";
import { store } from "../store.js";
import { sendLoginCode } from "./mail.js";

const OTP_TTL_MS = 10 * 60 * 1000;
const MAX_ATTEMPTS = 5;
const MAX_SENDS_PER_WINDOW = 3;

function hashCode(email: string, code: string): string {
  return createHmac("sha256", config.cookieSecret).update(`${email}:${code}`).digest("hex");
}

export async function startEmailOtp(email: string): Promise<{ debugCode?: string }> {
  const normalized = email.toLowerCase().trim();
  if (!normalized.includes("@")) {
    throw new Error("Enter a valid email address.");
  }

  const existing = await store.getOtp(normalized);
  if (existing && existing.sendCount >= MAX_SENDS_PER_WINDOW && Date.now() - existing.sentAt < OTP_TTL_MS) {
    throw new Error("Too many codes sent. Wait a few minutes and try again.");
  }

  const code = String(randomInt(100000, 1000000));
  await store.saveOtp({
    email: normalized,
    codeHash: hashCode(normalized, code),
    expiresAt: Date.now() + OTP_TTL_MS,
    attempts: 0,
    sentAt: Date.now(),
    sendCount: (existing?.sendCount ?? 0) + 1,
  });

  await sendLoginCode(normalized, code);
  return process.env.OTP_DEBUG === "true" ? { debugCode: code } : {};
}

export async function verifyEmailOtp(email: string, code: string): Promise<string> {
  const normalized = email.toLowerCase().trim();
  const digits = code.replace(/\s+/g, "");
  const existing = await store.getOtp(normalized);
  if (!existing) {
    throw new Error("No active code for that email. Request a new one.");
  }
  if (existing.attempts >= MAX_ATTEMPTS) {
    await store.deleteOtp(normalized);
    throw new Error("Too many incorrect attempts. Request a new code.");
  }
  if (existing.codeHash !== hashCode(normalized, digits)) {
    await store.saveOtp({ ...existing, attempts: existing.attempts + 1 });
    throw new Error("That code is incorrect.");
  }
  await store.deleteOtp(normalized);
  return normalized;
}
