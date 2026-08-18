import { config, mcpUrl } from "../config.js";

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

const css = `
  :root {
    --bg: #07080a;
    --bg-2: #0e1014;
    --card: #12151b;
    --line: rgba(236, 232, 223, 0.1);
    --text: #ece8df;
    --muted: #8f8a82;
    --mint: #5dffb2;
    --mint-dim: rgba(93, 255, 178, 0.12);
    --danger: #ff7a7a;
  }
  * { box-sizing: border-box; }
  html, body { margin: 0; padding: 0; background: var(--bg); color: var(--text); }
  body {
    font-family: "Segoe UI", Inter, ui-sans-serif, system-ui, sans-serif;
    line-height: 1.5;
    min-height: 100vh;
  }
  a { color: var(--mint); text-decoration: none; }
  .wrap { width: min(1080px, calc(100% - 40px)); margin: 0 auto; }
  header {
    display: flex; align-items: center; justify-content: space-between;
    padding: 22px 0 10px;
  }
  .brand { display: flex; align-items: center; gap: 10px; font-weight: 700; letter-spacing: -0.03em; }
  .mark {
    width: 28px; height: 28px; border-radius: 8px;
    background: linear-gradient(145deg, #5dffb2, #1f6bff);
  }
  .nav { display: flex; gap: 18px; color: var(--muted); font-size: 14px; }
  .hero { padding: 72px 0 36px; }
  .eyebrow {
    color: var(--mint); font-size: 13px; letter-spacing: 0.14em;
    text-transform: uppercase; font-weight: 600;
  }
  h1 { font-size: clamp(42px, 7vw, 76px); line-height: 0.95; letter-spacing: -0.05em; margin: 14px 0 18px; }
  .lede { max-width: 640px; color: var(--muted); font-size: 18px; }
  .cta { display: flex; gap: 12px; margin-top: 28px; flex-wrap: wrap; }
  .btn {
    border: 0; border-radius: 999px; padding: 12px 18px; font-weight: 650;
    cursor: pointer; font-size: 14px;
  }
  .btn.primary { background: var(--mint); color: #062014; }
  .btn.ghost { background: transparent; color: var(--text); border: 1px solid var(--line); }
  .copy-row {
    margin-top: 28px; display: flex; gap: 8px; align-items: center;
    background: var(--card); border: 1px solid var(--line); border-radius: 14px;
    padding: 10px 12px; width: min(680px, 100%);
  }
  .copy-row code { flex: 1; overflow: auto; color: var(--mint); font-size: 14px; }
  .steps { display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 14px; padding: 20px 0 70px; }
  .card {
    background: var(--card); border: 1px solid var(--line); border-radius: 18px; padding: 18px;
  }
  .n { color: var(--mint); font-weight: 700; font-size: 12px; letter-spacing: 0.08em; }
  .card h3 { margin: 8px 0 8px; font-size: 18px; }
  .card p { margin: 0; color: var(--muted); font-size: 14px; }
  .panel { width: min(440px, calc(100% - 40px)); margin: 72px auto; }
  label { display: block; font-size: 13px; color: var(--muted); margin: 14px 0 6px; }
  input {
    width: 100%; background: #0b0d11; border: 1px solid var(--line); color: var(--text);
    border-radius: 12px; padding: 12px 12px; font-size: 15px;
  }
  .error { color: var(--danger); font-size: 14px; margin-top: 12px; }
  .muted { color: var(--muted); }
  .grid2 { display: grid; grid-template-columns: repeat(auto-fit, minmax(260px, 1fr)); gap: 14px; }
  .mono { font-family: ui-monospace, SFMono-Regular, Consolas, monospace; word-break: break-all; }
  .divider { display:flex; align-items:center; gap:12px; color:var(--muted); font-size:13px; margin:22px 0; }
  .divider:before, .divider:after { content:""; flex:1; height:1px; background:var(--line); }
  .btn.google { width:100%; background:#fff; color:#111; display:flex; align-items:center; justify-content:center; gap:10px; }
  .code-row { display:flex; gap:8px; }
  .code-row input { text-align:center; font-size:22px; letter-spacing:.12em; }
  .hidden { display:none; }
`;

function layout(title: string, body: string): string {
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${escapeHtml(title)}</title>
  <style>${css}</style>
</head>
<body>
  ${body}
</body>
</html>`;
}

export function landingPage(): string {
  return layout(
    "Onix — send USDC from ChatGPT on Arc Testnet",
    `
    <div class="wrap">
      <header>
        <div class="brand"><span class="mark"></span>Onix</div>
        <div class="nav">
          <a href="/login">Sign in</a>
        </div>
      </header>
      <section class="hero">
        <div class="eyebrow">ChatGPT MCP · Arc Testnet · Circle wallets</div>
        <h1>Connect ChatGPT<br>to a USDC wallet.</h1>
        <p class="lede">
          Each ChatGPT user signs in with Google or an email code. Onix maps that email to a Circle
          developer-controlled wallet on Arc Testnet, then ChatGPT can send USDC through App Kit.
        </p>
        <div class="cta">
          <a class="btn primary" href="/login">Continue with Google or email</a>
          <a class="btn ghost" href="https://chatgpt.com/#settings" target="_blank" rel="noreferrer">Open ChatGPT settings</a>
        </div>
        <div class="copy-row">
          <code id="mcp">${escapeHtml(mcpUrl.href)}</code>
          <button class="btn ghost" type="button" onclick="navigator.clipboard.writeText(document.getElementById('mcp').textContent)">Copy MCP URL</button>
        </div>
      </section>
      <section class="steps">
        <div class="card"><div class="n">01</div><h3>Copy the MCP URL</h3><p>Use the URL above. ChatGPT must reach this host over HTTPS.</p></div>
        <div class="card"><div class="n">02</div><h3>Enable Developer mode</h3><p>On ChatGPT web: Settings → Apps &amp; connectors / Security → turn on Developer mode.</p></div>
        <div class="card"><div class="n">03</div><h3>Add a plugin</h3><p>Browse plugins → + → New Plugin. Name it Onix. Server URL = the MCP URL. Authentication: <strong>OAuth</strong>.</p></div>
        <div class="card"><div class="n">04</div><h3>Authorize</h3><p>Connect the plugin, then sign in with Google or an email code. We mint a Circle wallet and store it against that email in Firebase.</p></div>
      </section>
    </div>
    `,
  );
}

export function authPage(input: {
  firebaseWeb: { apiKey: string; authDomain: string; projectId: string; appId: string };
  firebaseReady: boolean;
  googleReady: boolean;
  error?: string;
}): string {
  return layout(
    "Sign in to Onix",
    `
    <div class="panel">
      <div class="brand" style="margin-bottom:18px"><span class="mark"></span>Onix</div>
      <h1 style="font-size:36px">Sign in</h1>
      <p class="muted">Continue with Google, or we will email you a 6-digit code. Same email always maps to the same Arc Testnet wallet.</p>
      ${
        input.googleReady
          ? `<button class="btn google" id="google-btn" type="button">
              <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden="true"><path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.3 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 8 3.1l5.7-5.7C34.2 6.1 29.4 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.7-.4-3.5z"/><path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.7 16 19 12 24 12c3.1 0 5.8 1.2 8 3.1l5.7-5.7C34.2 6.1 29.4 4 24 4 16.3 4 9.6 8.3 6.3 14.7z"/><path fill="#4CAF50" d="M24 44c5.2 0 10-2 13.6-5.2l-6.3-5.3C29.2 35.1 26.7 36 24 36c-5.3 0-9.7-3.3-11.3-8l-6.5 5C9.5 39.6 16.2 44 24 44z"/><path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-1.1 3.2-3.5 5.8-6.6 7.2l6.3 5.3C38.2 37.3 44 32 44 24c0-1.3-.1-2.7-.4-3.5z"/></svg>
              Continue with Google
            </button>`
          : `<p class="muted">Google sign-in needs FIREBASE_WEB_API_KEY, FIREBASE_AUTH_DOMAIN, and FIREBASE_APP_ID.</p>`
      }
      <div class="divider">or email a code</div>
      <form id="email-form">
        <label for="email">Email</label>
        <input id="email" name="email" type="email" required autocomplete="email" />
        <button class="btn primary" style="width:100%;margin-top:20px" type="submit">Send login code</button>
      </form>
      <form id="code-form" class="hidden">
        <label for="code">Code sent to <span id="sent-to"></span></label>
        <input id="code" name="code" inputmode="numeric" pattern="[0-9]*" maxlength="6" autocomplete="one-time-code" required />
        <button class="btn primary" style="width:100%;margin-top:20px" type="submit">Verify and continue</button>
        <p class="muted" style="margin-top:12px"><a href="#" id="resend">Send a new code</a></p>
      </form>
      <div class="error${input.error ? "" : " hidden"}" id="error">${escapeHtml(input.error ?? "")}</div>
      ${
        input.firebaseReady
          ? ""
          : `<p class="error">Firebase Admin is not configured yet. Add the service account env vars.</p>`
      }
    </div>
    <script type="module">
      const firebaseConfig = ${JSON.stringify(input.firebaseWeb)};
      const errorEl = document.getElementById("error");
      function showError(message) {
        errorEl.textContent = message;
        errorEl.classList.remove("hidden");
      }
      async function post(url, body) {
        const response = await fetch(url, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(body),
        });
        const data = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(data.error || "Request failed");
        return data;
      }
      const googleBtn = document.getElementById("google-btn");
      if (googleBtn) {
        googleBtn.addEventListener("click", async () => {
          try {
            const { initializeApp } = await import("https://www.gstatic.com/firebasejs/11.6.0/firebase-app.js");
            const { getAuth, GoogleAuthProvider, signInWithPopup } = await import("https://www.gstatic.com/firebasejs/11.6.0/firebase-auth.js");
            const app = initializeApp(firebaseConfig);
            const cred = await signInWithPopup(getAuth(app), new GoogleAuthProvider());
            const idToken = await cred.user.getIdToken();
            const data = await post("/auth/google", { idToken });
            window.location.href = data.redirect || "/dashboard";
          } catch (error) {
            showError(error instanceof Error ? error.message : "Google sign-in failed");
          }
        });
      }
      const emailForm = document.getElementById("email-form");
      const codeForm = document.getElementById("code-form");
      const sentTo = document.getElementById("sent-to");
      emailForm.addEventListener("submit", async (event) => {
        event.preventDefault();
        const email = document.getElementById("email").value;
        try {
          await post("/auth/email/start", { email });
          sentTo.textContent = email;
          emailForm.classList.add("hidden");
          codeForm.classList.remove("hidden");
          document.getElementById("code").focus();
        } catch (error) {
          showError(error instanceof Error ? error.message : "Could not send code");
        }
      });
      codeForm.addEventListener("submit", async (event) => {
        event.preventDefault();
        try {
          const data = await post("/auth/email/verify", {
            email: document.getElementById("email").value,
            code: document.getElementById("code").value,
          });
          window.location.href = data.redirect || "/dashboard";
        } catch (error) {
          showError(error instanceof Error ? error.message : "Could not verify code");
        }
      });
      document.getElementById("resend").addEventListener("click", async (event) => {
        event.preventDefault();
        try {
          await post("/auth/email/start", { email: document.getElementById("email").value });
          showError("A new code was sent.");
        } catch (error) {
          showError(error instanceof Error ? error.message : "Could not resend code");
        }
      });
    </script>
    `,
  );
}

export function dashboardPage(input: {
  email: string;
  address?: string;
  usdc?: string;
  walletError?: string;
}): string {
  return layout(
    "Onix dashboard",
    `
    <div class="wrap">
      <header>
        <div class="brand"><span class="mark"></span>Onix</div>
        <div class="nav"><span class="muted">${escapeHtml(input.email)}</span><a href="/logout">Log out</a></div>
      </header>
      <section class="hero" style="padding-top:36px">
        <div class="eyebrow">Your Arc Testnet wallet</div>
        <h1 style="font-size:48px">Ready for ChatGPT.</h1>
        <p class="lede">Connect the MCP plugin, then ask ChatGPT to show your wallet or send USDC.</p>
      </section>
      <div class="grid2" style="padding-bottom:80px">
        <div class="card">
          <div class="n">WALLET</div>
          <h3>${input.address ? "Assigned" : "Not created yet"}</h3>
          <p class="mono">${escapeHtml(input.address ?? "No wallet yet. Refresh after signup, or check the error below.")}</p>
          ${
            input.address
              ? `<p style="margin-top:12px"><a href="${config.explorerBase}/address/${escapeHtml(
                  input.address,
                )}" target="_blank" rel="noreferrer">View on Arcscan</a> · <a href="${
                  config.faucetUrl
                }" target="_blank" rel="noreferrer">Get testnet USDC</a></p>`
              : ""
          }
          ${input.walletError ? `<div class="error">${escapeHtml(input.walletError)}</div>` : ""}
        </div>
        <div class="card">
          <div class="n">BALANCE</div>
          <h3>${escapeHtml(input.usdc ?? "—")} USDC</h3>
          <p>USDC is also gas on Arc. Leave a little extra when you send.</p>
          <div class="copy-row" style="margin-top:16px;width:100%">
            <code>${escapeHtml(mcpUrl.href)}</code>
          </div>
        </div>
      </div>
    </div>
    `,
  );
}
