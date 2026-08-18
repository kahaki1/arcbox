import type { Express, Request, Response } from "express";
import { circleConfigured } from "../config.js";
import { ensureUserWallet, getWalletBalances, usdcBalance } from "../circle/wallets.js";
import {
  firebaseConfigured,
  firebaseWebConfig,
  firebaseWebReady,
  getOrCreateFirebaseUser,
  verifyGoogleIdToken,
} from "../firebase/admin.js";
import { store } from "../store.js";
import { authPage, dashboardPage } from "../web/pages.js";
import { startEmailOtp, verifyEmailOtp } from "./otp.js";
import { authProvider } from "./provider.js";
import { clearSession, createSession, getUserId, takePendingAuthCookie } from "./session.js";

async function finishLogin(req: Request, res: Response, userId: string, email: string, provider: string): Promise<string> {
  const existing = await store.getUserById(userId);
  await store.upsertUser({
    id: userId,
    email,
    provider,
    createdAt: existing?.createdAt ?? new Date().toISOString(),
  });
  await createSession(res, userId);

  if (circleConfigured()) {
    try {
      await ensureUserWallet(userId, email);
    } catch (error) {
      console.error("Wallet provision failed:", error);
    }
  }

  const pendingId = takePendingAuthCookie(req, res);
  if (pendingId) {
    const pending = await store.takePendingAuth(pendingId);
    const client = pending ? await authProvider.clientsStore.getClient(pending.clientId) : undefined;
    if (pending && client) {
      return authProvider.completeAuthorization(userId, client, {
        state: pending.state,
        scopes: pending.scopes,
        codeChallenge: pending.codeChallenge,
        redirectUri: pending.redirectUri,
        resource: pending.resource ? new URL(pending.resource) : undefined,
      });
    }
  }

  return "/dashboard";
}

export function mountAuthPages(app: Express): void {
  app.get(["/login", "/signup"], async (req, res) => {
    if (await getUserId(req)) {
      res.redirect("/dashboard");
      return;
    }
    res.type("html").send(
      authPage({
        firebaseWeb: firebaseWebConfig(),
        firebaseReady: firebaseConfigured(),
        googleReady: firebaseWebReady(),
      }),
    );
  });

  app.post("/auth/google", async (req, res) => {
    try {
      const idToken = typeof req.body?.idToken === "string" ? req.body.idToken : "";
      const google = await verifyGoogleIdToken(idToken);
      const redirect = await finishLogin(req, res, google.uid, google.email, "google");
      res.json({ ok: true, redirect });
    } catch (error) {
      res.status(401).json({ error: error instanceof Error ? error.message : "Google sign-in failed" });
    }
  });

  app.post("/auth/email/start", async (req, res) => {
    try {
      const email = typeof req.body?.email === "string" ? req.body.email : "";
      const result = await startEmailOtp(email);
      res.json({ ok: true, ...result });
    } catch (error) {
      res.status(400).json({ error: error instanceof Error ? error.message : "Could not send code" });
    }
  });

  app.post("/auth/email/verify", async (req, res) => {
    try {
      const email = typeof req.body?.email === "string" ? req.body.email : "";
      const code = typeof req.body?.code === "string" ? req.body.code : "";
      const verifiedEmail = await verifyEmailOtp(email, code);
      const user = await getOrCreateFirebaseUser(verifiedEmail);
      const redirect = await finishLogin(req, res, user.uid, user.email, "email");
      res.json({ ok: true, redirect });
    } catch (error) {
      res.status(401).json({ error: error instanceof Error ? error.message : "Could not verify code" });
    }
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
    const user = await store.getUserById(userId);
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
        const wallet = await ensureUserWallet(userId, user.email);
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
      const user = await store.getUserById(userId);
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
