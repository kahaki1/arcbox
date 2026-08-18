import { randomUUID } from "node:crypto";
import type { Response } from "express";
import type { OAuthRegisteredClientsStore } from "@modelcontextprotocol/sdk/server/auth/clients.js";
import type {
  AuthorizationParams,
  OAuthServerProvider,
} from "@modelcontextprotocol/sdk/server/auth/provider.js";
import type { AuthInfo } from "@modelcontextprotocol/sdk/server/auth/types.js";
import type {
  OAuthClientInformationFull,
  OAuthTokenRevocationRequest,
  OAuthTokens,
} from "@modelcontextprotocol/sdk/shared/auth.js";
import { config, issuerUrl, mcpUrl } from "../config.js";
import { store, type OAuthClientRecord } from "../store.js";
import { randomToken, signIdToken } from "./crypto.js";
import { setPendingAuthCookie } from "./session.js";

function grantedScopes(requested?: string[]): string[] {
  const set = new Set<string>([...config.scopes, ...(requested ?? [])]);
  return [...set];
}

const ACCESS_TTL_SEC = 60 * 60;
const REFRESH_TTL_MS = 30 * 24 * 60 * 60 * 1000;
const CODE_TTL_MS = 10 * 60 * 1000;
const cimdCache = new Map<string, { client: OAuthClientInformationFull; fetchedAt: number }>();

function asFullClient(row: OAuthClientRecord): OAuthClientInformationFull {
  return {
    client_id: row.client_id,
    client_secret: row.client_secret,
    client_id_issued_at: row.client_id_issued_at,
    client_secret_expires_at: row.client_secret_expires_at,
    redirect_uris: row.redirect_uris,
    client_name: row.client_name,
    grant_types: row.grant_types ?? ["authorization_code", "refresh_token"],
    response_types: row.response_types ?? ["code"],
    token_endpoint_auth_method: row.token_endpoint_auth_method ?? "none",
    scope: row.scope,
  };
}

async function fetchCimdClient(clientId: string): Promise<OAuthClientInformationFull | undefined> {
  if (!clientId.startsWith("https://")) return undefined;
  const cached = cimdCache.get(clientId);
  if (cached && Date.now() - cached.fetchedAt < 10 * 60 * 1000) {
    return cached.client;
  }

  const response = await fetch(clientId, {
    headers: { accept: "application/json" },
    redirect: "error",
  });
  if (!response.ok) return undefined;
  const body = (await response.json()) as {
    client_id?: string;
    redirect_uris?: string[];
    client_name?: string;
    grant_types?: string[];
    token_endpoint_auth_method?: string;
    token_endpoint_auth_methods_supported?: string[];
    scope?: string;
  };
  if (!Array.isArray(body.redirect_uris) || body.redirect_uris.length === 0) {
    return undefined;
  }

  const client: OAuthClientInformationFull = {
    client_id: clientId,
    redirect_uris: body.redirect_uris,
    client_name: body.client_name,
    grant_types: body.grant_types ?? ["authorization_code", "refresh_token"],
    response_types: ["code"],
    token_endpoint_auth_method: body.token_endpoint_auth_methods_supported?.includes("none")
      ? "none"
      : (body.token_endpoint_auth_method ?? "none"),
    scope: body.scope,
  };
  cimdCache.set(clientId, { client, fetchedAt: Date.now() });
  await store.saveClient({
    client_id: client.client_id,
    redirect_uris: client.redirect_uris,
    client_name: client.client_name,
    grant_types: client.grant_types,
    response_types: client.response_types,
    token_endpoint_auth_method: client.token_endpoint_auth_method,
    scope: client.scope,
    client_id_issued_at: Math.floor(Date.now() / 1000),
  });
  return client;
}

export class ArcBoxClientsStore implements OAuthRegisteredClientsStore {
  async getClient(clientId: string): Promise<OAuthClientInformationFull | undefined> {
    const local = await store.getClient(clientId);
    if (local) return asFullClient(local);
    try {
      return await fetchCimdClient(clientId);
    } catch {
      return undefined;
    }
  }

  async registerClient(client: OAuthClientInformationFull): Promise<OAuthClientInformationFull> {
    const saved = await store.saveClient({
      client_id: client.client_id,
      client_secret: client.client_secret,
      client_id_issued_at: client.client_id_issued_at,
      client_secret_expires_at: client.client_secret_expires_at,
      redirect_uris: client.redirect_uris,
      client_name: client.client_name,
      grant_types: client.grant_types,
      response_types: client.response_types,
      token_endpoint_auth_method: client.token_endpoint_auth_method,
      scope: client.scope,
    });
    return asFullClient(saved);
  }
}

export class ArcBoxAuthProvider implements OAuthServerProvider {
  clientsStore = new ArcBoxClientsStore();

  async authorize(
    client: OAuthClientInformationFull,
    params: AuthorizationParams,
    res: Response,
  ): Promise<void> {
    if (!client.redirect_uris.includes(params.redirectUri)) {
      res.status(400).send("Unregistered redirect_uri");
      return;
    }

    const userId = res.locals.userId as string | undefined;
    if (!userId) {
      const pendingId = randomUUID();
      await store.savePendingAuth({
        id: pendingId,
        clientId: client.client_id,
        state: params.state,
        scopes: grantedScopes(params.scopes),
        codeChallenge: params.codeChallenge,
        redirectUri: params.redirectUri,
        resource: params.resource?.href,
        expiresAt: Date.now() + 15 * 60 * 1000,
      });
      setPendingAuthCookie(res, pendingId);
      res.redirect("/login");
      return;
    }

    res.redirect(await this.completeAuthorization(userId, client, params));
  }

  async completeAuthorization(
    userId: string,
    client: OAuthClientInformationFull,
    params: AuthorizationParams,
  ): Promise<string> {
    if (!client.redirect_uris.includes(params.redirectUri)) {
      throw new Error("Unregistered redirect_uri");
    }

    const code = randomToken();
    await store.saveAuthCode({
      code,
      clientId: client.client_id,
      userId,
      codeChallenge: params.codeChallenge,
      redirectUri: params.redirectUri,
      scopes: grantedScopes(params.scopes),
      resource: params.resource?.href,
      expiresAt: Date.now() + CODE_TTL_MS,
    });

    const target = new URL(params.redirectUri);
    target.searchParams.set("code", code);
    if (params.state) target.searchParams.set("state", params.state);
    target.searchParams.set("iss", issuerUrl.href);
    return target.toString();
  }

  async challengeForAuthorizationCode(
    client: OAuthClientInformationFull,
    authorizationCode: string,
  ): Promise<string> {
    const row = await store.peekAuthCode(authorizationCode);
    if (!row || row.clientId !== client.client_id) {
      throw new Error("Invalid authorization code");
    }
    return row.codeChallenge;
  }

  async exchangeAuthorizationCode(
    client: OAuthClientInformationFull,
    authorizationCode: string,
    _codeVerifier?: string,
    redirectUri?: string,
    resource?: URL,
  ): Promise<OAuthTokens> {
    const row = await store.takeAuthCode(authorizationCode);
    if (!row || row.clientId !== client.client_id) {
      throw new Error("Invalid authorization code");
    }
    if (redirectUri && redirectUri !== row.redirectUri) {
      throw new Error("redirect_uri mismatch");
    }
    if (resource && row.resource && resource.href !== row.resource) {
      throw new Error("resource mismatch");
    }
    return this.issueTokens(client, row.userId, row.scopes, row.resource ?? resource?.href);
  }

  async exchangeRefreshToken(
    client: OAuthClientInformationFull,
    refreshToken: string,
    scopes?: string[],
    resource?: URL,
  ): Promise<OAuthTokens> {
    const row = await store.getToken(refreshToken);
    if (!row || row.type !== "refresh" || row.clientId !== client.client_id) {
      throw new Error("Invalid refresh token");
    }
    const nextScopes = scopes && scopes.length > 0 ? scopes : row.scopes;
    if (!nextScopes.every((scope) => row.scopes.includes(scope))) {
      throw new Error("Requested scopes exceed original grant");
    }
    await store.deleteTokenFamily(row.familyId);
    return this.issueTokens(
      client,
      row.userId,
      nextScopes,
      resource?.href ?? row.resource,
      row.familyId,
    );
  }

  async verifyAccessToken(token: string): Promise<AuthInfo> {
    const row = await store.getToken(token);
    if (!row || row.type !== "access") {
      throw new Error("Invalid or expired token");
    }
    return {
      token,
      clientId: row.clientId,
      scopes: row.scopes,
      expiresAt: Math.floor(row.expiresAt / 1000),
      resource: row.resource ? new URL(row.resource) : mcpUrl,
      extra: { userId: row.userId },
    };
  }

  async revokeToken(
    _client: OAuthClientInformationFull,
    request: OAuthTokenRevocationRequest,
  ): Promise<void> {
    const row = await store.getToken(request.token);
    if (!row) return;
    await store.deleteTokenFamily(row.familyId);
  }

  private async issueTokens(
    client: OAuthClientInformationFull,
    userId: string,
    scopes: string[],
    resource?: string,
    familyId: string = randomUUID(),
  ): Promise<OAuthTokens> {
    const access = randomToken();
    const refresh = randomToken();
    await store.saveToken({
      token: access,
      type: "access",
      userId,
      clientId: client.client_id,
      scopes,
      resource,
      expiresAt: Date.now() + ACCESS_TTL_SEC * 1000,
      familyId,
    });
    await store.saveToken({
      token: refresh,
      type: "refresh",
      userId,
      clientId: client.client_id,
      scopes,
      resource,
      expiresAt: Date.now() + REFRESH_TTL_MS,
      familyId,
    });

    const user = await store.getUserById(userId);
    const tokens: OAuthTokens = {
      access_token: access,
      token_type: "bearer",
      expires_in: ACCESS_TTL_SEC,
      refresh_token: refresh,
      scope: scopes.join(" "),
    };

    if (user && scopes.includes("openid")) {
      tokens.id_token = await signIdToken({
        issuer: issuerUrl.href,
        audience: client.client_id,
        subject: user.id,
        email: user.email,
      });
    }

    return tokens;
  }
}

export const authProvider = new ArcBoxAuthProvider();
