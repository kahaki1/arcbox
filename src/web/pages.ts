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
    "ArcBox — send USDC from ChatGPT on Arc Testnet",
    `
    <div class="wrap">
      <header>
        <div class="brand"><span class="mark"></span>ArcBox</div>
        <div class="nav">
          <a href="/login">Log in</a>
          <a href="/signup">Create account</a>
        </div>
      </header>
      <section class="hero">
        <div class="eyebrow">ChatGPT MCP · Arc Testnet · Circle wallets</div>
        <h1>Connect ChatGPT<br>to a USDC wallet.</h1>
        <p class="lede">
          Each ChatGPT user signs in with OAuth. ArcBox assigns them a Circle developer-controlled
          wallet on Arc Testnet, then ChatGPT can check the balance and send USDC through App Kit.
        </p>
        <div class="cta">
          <a class="btn primary" href="/signup">Create an account</a>
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
        <div class="card"><div class="n">03</div><h3>Add a plugin</h3><p>Browse plugins → + → New Plugin. Name it ArcBox. Server URL = the MCP URL. Authentication: <strong>OAuth</strong>.</p></div>
        <div class="card"><div class="n">04</div><h3>Authorize</h3><p>Connect the plugin, create or log into your ArcBox account. We mint a Circle wallet on ARC-TESTNET for that user.</p></div>
      </section>
    </div>
    `,
  );
}

export function authPage(input: {
  mode: "login" | "signup";
  error?: string;
  email?: string;
}): string {
  const title = input.mode === "login" ? "Log in to ArcBox" : "Create your ArcBox account";
  const action = input.mode === "login" ? "/login" : "/signup";
  const switcher =
    input.mode === "login"
      ? `No account? <a href="/signup">Create one</a>`
      : `Already have an account? <a href="/login">Log in</a>`;
  return layout(
    title,
    `
    <div class="panel">
      <div class="brand" style="margin-bottom:18px"><span class="mark"></span>ArcBox</div>
      <h1 style="font-size:36px">${escapeHtml(title)}</h1>
      <p class="muted">This identity is what ChatGPT uses. One Circle developer wallet is created per account on Arc Testnet.</p>
      <form method="post" action="${action}">
        <label for="email">Email</label>
        <input id="email" name="email" type="email" required value="${escapeHtml(input.email ?? "")}" />
        <label for="password">Password</label>
        <input id="password" name="password" type="password" required minlength="8" />
        ${input.error ? `<div class="error">${escapeHtml(input.error)}</div>` : ""}
        <button class="btn primary" style="width:100%;margin-top:20px" type="submit">${
          input.mode === "login" ? "Continue" : "Create account"
        }</button>
      </form>
      <p class="muted" style="margin-top:16px">${switcher}</p>
    </div>
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
    "ArcBox dashboard",
    `
    <div class="wrap">
      <header>
        <div class="brand"><span class="mark"></span>ArcBox</div>
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
