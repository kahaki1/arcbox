import { randomUUID } from "node:crypto";
import type { Express, Request, Response } from "express";
import { config } from "../config.js";
import { circleConfigured } from "../config.js";
import { ensureUserWallet, getWalletBalances, usdcBalance } from "../circle/wallets.js";
import { store } from "../store.js";
import { authPage, dashboardPage } from "../web/pages.js";
import { hashPassword, verifyPassword } from "./crypto.js";
import { authProvider } from "./provider.js";
import { clearSession, createSession, getUserId, takePendingAuthCookie } from "./session.js";

function emailFrom(req: Request): string {
  const value = typeof req.body?.email === "string" ? req.body.email : "";
  return value.trim().toLowerCase();
}

function passwordFrom(req: Request): string {
  return typeof req.body?.password === "string" ? req.body.password : "";
}

async function finishLogin(req: Request, res: Response, userId: string): Promise<void> {
  await createSession(res, userId);
  if (circleConfigured()) {
    try {
      await ensureUserWallet(userId);
    } catch (error) {
      console.error("Wallet provision failed:", error);
    }
  }

  const pendingId = takePendingAuthCookie(req, res);
  if (pendingId) {
    const pending = store.takePendingAuth(pendingId);
    const client = pending ? await authProvider.clientsStore.getClient(pending.clientId) : undefined;
    if (pending && client) {
      authProvider.completeAuthorization(
        userId,
        client,
        {
          state: pending.state,
          scopes: pending.scopes,
          codeChallenge: pending.codeChallenge,
          redirectUri: pending.redirectUri,
          resource: pending.resource ? new URL(pending.resource) : undefined,
        },
        res,
      );
      return;
    }
  }

  res.redirect("/dashboard");
}

export function mountAuthPages(app: Express): void {
  app.get("/login", async (req, res) => {
    if (await getUserId(req)) {
      res.redirect("/dashboard");
      return;
    }
    res.type("html").send(authPage({ mode: "login" }));
  });

  app.post("/login", async (req, res) => {
    const email = emailFrom(req);
    const password = passwordFrom(req);
    const user = store.getUserByEmail(email);
    if (!user || !(await verifyPassword(password, user.passwordHash))) {
      res.status(401).type("html").send(authPage({ mode: "login", email, error: "Invalid email or password." }));
      return;
    }
    await finishLogin(req, res, user.id);
  });

  app.get("/signup", async (req, res) => {
    if (await getUserId(req)) {
      res.redirect("/dashboard");
      return;
    }
    res.type("html").send(authPage({ mode: "signup" }));
  });

  app.post("/signup", async (req, res) => {
    const email = emailFrom(req);
    const password = passwordFrom(req);
    if (!email.includes("@") || password.length < 8) {
      res
        .status(400)
        .type("html")
        .send(authPage({ mode: "signup", email, error: "Use a valid email and a password of at least 8 characters." }));
      return;
    }
    if (store.getUserByEmail(email)) {
      res.status(409).type("html").send(authPage({ mode: "signup", email, error: "That email is already registered." }));
      return;
    }
    const user = store.createUser({
      id: randomUUID(),
      email,
      passwordHash: await hashPassword(password),
      createdAt: new Date().toISOString(),
    });
    await finishLogin(req, res, user.id);
  });

  app.get("/logout", (req, res) => {
    clearSession(req, res);
    res.redirect("/");
  });

  app.get("/dashboard", async (req, res) => {
    const userId = await getUserId(req);
    if (!userId) {
      res.redirect("/login");
      return;
    }
    const user = store.getUserById(userId);
    if (!user) {
      clearSession(req, res);
      res.redirect("/login");
      return;
    }

    let address: string | undefined;
    let usdc: string | undefined;
    let walletError: string | undefined;
    try {
      if (circleConfigured()) {
        const wallet = await ensureUserWallet(userId);
        address = wallet.address;
        usdc = usdcBalance(await getWalletBalances(wallet.circleWalletId));
      } else {
        walletError = "Add CIRCLE_API_KEY and CIRCLE_ENTITY_SECRET to create wallets.";
      }
    } catch (error) {
      walletError = error instanceof Error ? error.message : "Wallet lookup failed.";
    }

    res.type("html").send(dashboardPage({ email: user.email, address, usdc, walletError }));
  });

  app.get("/userinfo", async (req, res) => {
    const header = req.headers.authorization ?? "";
    const token = header.toLowerCase().startsWith("bearer ") ? header.slice(7) : "";
    try {
      const auth = await authProvider.verifyAccessToken(token);
      const userId = typeof auth.extra?.userId === "string" ? auth.extra.userId : "";
      const user = store.getUserById(userId);
      if (!user) {
        res.status(401).json({ error: "invalid_token" });
        return;
      }
      res.json({
        sub: user.id,
        email: user.email,
        email_verified: true,
      });
    } catch {
      res.status(401).json({ error: "invalid_token" });
    }
  });
}

void config;
