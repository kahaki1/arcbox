import type { CookieOptions, Request, Response } from "express";
import { randomUUID } from "node:crypto";
import { config, isHttps } from "../config.js";
import { store } from "../store.js";
import { readSession, signSession } from "./crypto.js";

const COOKIE = "arcbox_session";
const SESSION_MS = 14 * 24 * 60 * 60 * 1000;

function cookieOptions(): CookieOptions {
  return {
    httpOnly: true,
    sameSite: "lax",
    secure: isHttps(),
    maxAge: SESSION_MS,
    path: "/",
  };
}

export async function getUserId(req: Request): Promise<string | null> {
  const raw = req.cookies?.[COOKIE];
  if (!raw || typeof raw !== "string") return null;
  const parsed = await readSession(raw);
  if (!parsed) return null;
  const session = await store.getSession(parsed.sid);
  return session?.userId ?? null;
}

export async function createSession(res: Response, userId: string): Promise<void> {
  const id = randomUUID();
  await store.saveSession({
    id,
    userId,
    expiresAt: Date.now() + SESSION_MS,
  });
  res.cookie(COOKIE, await signSession({ sid: id }), cookieOptions());
}

export function clearSession(req: Request, res: Response): void {
  const raw = req.cookies?.[COOKIE];
  if (raw) {
    void readSession(raw).then((parsed) => {
      if (parsed) void store.deleteSession(parsed.sid);
    });
  }
  res.clearCookie(COOKIE, { path: "/" });
}

export const pendingCookie = "arcbox_oauth_pending";

export function setPendingAuthCookie(res: Response, pendingId: string): void {
  res.cookie(pendingCookie, pendingId, {
    httpOnly: true,
    sameSite: "lax",
    secure: isHttps(),
    maxAge: 15 * 60 * 1000,
    path: "/",
  });
}

export function takePendingAuthCookie(req: Request, res: Response): string | null {
  const value = req.cookies?.[pendingCookie];
  res.clearCookie(pendingCookie, { path: "/" });
  return typeof value === "string" ? value : null;
}

void config;
