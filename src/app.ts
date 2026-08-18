import cookieParser from "cookie-parser";
import cors from "cors";
import express from "express";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { requireBearerAuth } from "@modelcontextprotocol/sdk/server/auth/middleware/bearerAuth.js";
import { mcpAuthRouter } from "@modelcontextprotocol/sdk/server/auth/router.js";
import { mountAuthPages } from "./auth/routes.js";
import { authProvider } from "./auth/provider.js";
import { getUserId } from "./auth/session.js";
import { firebaseConfigured } from "./firebase/admin.js";
import { circleConfigured, config, issuerUrl, mcpUrl, publicUrl } from "./config.js";
import { createMcpServer } from "./mcp/server.js";
import { landingPage } from "./web/pages.js";

process.env.MCP_DANGEROUSLY_ALLOW_INSECURE_ISSUER_URL ??= "true";

const app = express();
app.set("trust proxy", 1);
app.use(
  cors({
    origin: true,
    credentials: true,
    exposedHeaders: ["WWW-Authenticate", "Mcp-Session-Id"],
    allowedHeaders: ["Authorization", "Content-Type", "Mcp-Session-Id", "Last-Event-ID", "MCP-Protocol-Version"],
  }),
);
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(cookieParser());

app.use(async (req, res, next) => {
  res.locals.userId = await getUserId(req);
  next();
});

const oauthMetadata = {
  issuer: issuerUrl.href,
  authorization_endpoint: new URL("/authorize", issuerUrl).href,
  token_endpoint: new URL("/token", issuerUrl).href,
  registration_endpoint: new URL("/register", issuerUrl).href,
  revocation_endpoint: new URL("/revoke", issuerUrl).href,
  userinfo_endpoint: new URL("/userinfo", issuerUrl).href,
  response_types_supported: ["code"],
  grant_types_supported: ["authorization_code", "refresh_token"],
  code_challenge_methods_supported: ["S256"],
  token_endpoint_auth_methods_supported: ["none", "client_secret_post"],
  scopes_supported: [...config.scopes],
  authorization_response_iss_parameter_supported: true,
  client_id_metadata_document_supported: true,
};

const protectedResource = {
  resource: mcpUrl.href,
  authorization_servers: [issuerUrl.href],
  scopes_supported: [...config.scopes],
  resource_name: "Onix",
  resource_documentation: publicUrl.href,
  bearer_methods_supported: ["header"],
};

app.get("/.well-known/oauth-authorization-server", (_req, res) => {
  res.json(oauthMetadata);
});
app.get("/.well-known/openid-configuration", (_req, res) => {
  res.json(oauthMetadata);
});
app.get("/.well-known/oauth-protected-resource", (_req, res) => {
  res.json(protectedResource);
});
app.get("/.well-known/oauth-protected-resource/mcp", (_req, res) => {
  res.json(protectedResource);
});

app.use(
  mcpAuthRouter({
    provider: authProvider,
    issuerUrl,
    baseUrl: issuerUrl,
    resourceServerUrl: mcpUrl,
    scopesSupported: [...config.scopes],
    resourceName: "Onix",
    serviceDocumentationUrl: publicUrl,
  }),
);

app.get("/", (_req, res) => {
  res.type("html").send(landingPage());
});

app.get("/health", (_req, res) => {
  res.json({
    ok: true,
    mcp: mcpUrl.href,
    circleConfigured: circleConfigured(),
    firebaseConfigured: firebaseConfigured(),
  });
});

mountAuthPages(app);

const resourceMetadataUrl = new URL("/.well-known/oauth-protected-resource/mcp", issuerUrl).href;

async function handleMcp(req: express.Request, res: express.Response): Promise<void> {
  const extra = req.auth?.extra as Record<string, unknown> | undefined;
  const server = createMcpServer(extra);
  const transport = new StreamableHTTPServerTransport({
    sessionIdGenerator: undefined,
    enableJsonResponse: true,
  });
  res.on("close", () => {
    void transport.close();
    void server.close();
  });
  await server.connect(transport);
  await transport.handleRequest(req, res, req.body);
}

app.post(
  "/mcp",
  requireBearerAuth({
    verifier: authProvider,
    requiredScopes: ["wallet"],
    resourceMetadataUrl,
  }),
  (req, res) => {
    void handleMcp(req, res);
  },
);

app.get(
  "/mcp",
  requireBearerAuth({
    verifier: authProvider,
    requiredScopes: ["wallet"],
    resourceMetadataUrl,
  }),
  (req, res) => {
    void handleMcp(req, res);
  },
);

app.delete(
  "/mcp",
  requireBearerAuth({
    verifier: authProvider,
    requiredScopes: ["wallet"],
    resourceMetadataUrl,
  }),
  (req, res) => {
    void handleMcp(req, res);
  },
);

export { app };
