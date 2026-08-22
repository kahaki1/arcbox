import { useState } from "react";
import {
  ArrowUp,
  AtSign,
  BarChart3,
  Check,
  ChevronDown,
  ChevronRight,
  Copy,
  Folder,
  Hexagon,
  Mic,
  Plus,
  Send,
  Wallet,
} from "lucide-react";

const MCP_URL = "https://onixmpc.vercel.app/mcp";
const LOGIN_URL = "https://onixmpc.vercel.app/login";
const CHATGPT_SETTINGS = "https://chatgpt.com/#settings";

const DIFF_LINES = [
  { n: 1, kind: "del", text: "awaiting_confirmation" },
  { n: 2, kind: "add", text: "tool: send_usdc" },
  { n: 3, kind: "add", text: "  to: alice.eth" },
  { n: 4, kind: "add", text: "  amount: 25.00 USDC" },
  { n: 5, kind: "add", text: "  network: arc-sepolia" },
  { n: 6, kind: "add", text: "status: confirmed ✓" },
];

const TOOLS = [
  {
    name: "create_wallet",
    icon: Plus,
    body: "Mints a Circle developer-controlled wallet the first time a user signs in. MPC custody, no private key ever touches the client.",
  },
  {
    name: "get_address",
    icon: AtSign,
    body: "Returns the user's Arc Testnet address so an agent can share it or receive funds.",
  },
  {
    name: "get_balance",
    icon: BarChart3,
    body: "Live USDC balance, fetched per-request against the verified identity, not cached or guessed.",
  },
  {
    name: "send_usdc",
    icon: Send,
    body: "Executes a signed USDC transfer on Arc Testnet after the agent confirms amount and recipient with the user.",
  },
];

const STEPS = [
  {
    n: "01",
    title: "Copy the MCP URL",
    body: "Use the URL above. ChatGPT must reach this host over HTTPS.",
  },
  {
    n: "02",
    title: "Enable Developer mode",
    body: "On ChatGPT web: Settings → Apps & connectors / Security → turn on Developer mode.",
  },
  {
    n: "03",
    title: "Add a plugin",
    body: "Browse plugins → + → New Plugin. Name it Onix. Server URL = the MCP URL. Authentication: OAuth.",
  },
  {
    n: "04",
    title: "Authorize",
    body: "Connect the plugin, then sign in with Google or an email code. We mint a Circle wallet and store it against that email.",
  },
];

const STARS = [
  { t: "8%", l: "6%", s: 1.5, o: 0.35 },
  { t: "18%", l: "22%", s: 1, o: 0.22 },
  { t: "12%", l: "41%", s: 1.2, o: 0.28 },
  { t: "28%", l: "58%", s: 1, o: 0.18 },
  { t: "9%", l: "73%", s: 1.4, o: 0.3 },
  { t: "34%", l: "81%", s: 1, o: 0.2 },
  { t: "22%", l: "91%", s: 1.1, o: 0.25 },
  { t: "42%", l: "14%", s: 1, o: 0.16 },
  { t: "51%", l: "37%", s: 1.3, o: 0.24 },
  { t: "61%", l: "68%", s: 1, o: 0.18 },
  { t: "70%", l: "88%", s: 1.2, o: 0.22 },
  { t: "78%", l: "9%", s: 1, o: 0.15 },
];

function CopyMcpButton({ dark = false }) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(MCP_URL);
    } catch {
      const el = document.createElement("textarea");
      el.value = MCP_URL;
      document.body.appendChild(el);
      el.select();
      document.execCommand("copy");
      document.body.removeChild(el);
    }
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1600);
  }

  return (
    <button
      type="button"
      onClick={copy}
      className={
        dark
          ? "inline-flex h-10 items-center gap-2 rounded-full bg-on-dark px-4 text-sm font-semibold text-primary transition hover:bg-white"
          : "inline-flex h-10 items-center gap-2 rounded-full border border-subtle bg-white px-4 text-sm font-semibold text-primary transition hover:border-primary/30"
      }
    >
      {copied ? <Check size={15} strokeWidth={2.2} /> : <Copy size={15} strokeWidth={2.2} />}
      {copied ? "Copied!" : "Copy"}
    </button>
  );
}

function TerminalPanel() {
  return (
    <div className="overflow-hidden rounded-2xl bg-panel-dark shadow-panel">
      <div className="bg-panel-inner px-4 py-4 sm:px-5">
        <div className="mb-3 flex items-center gap-2 text-[13px] text-muted-on-dark">
          <Folder size={14} strokeWidth={1.8} />
          <span className="text-on-dark/90">onix-mcp</span>
          <ChevronRight size={13} className="opacity-50" />
        </div>

        <div className="rounded-xl border border-white/10 bg-panel-dark/60 px-3 py-2.5">
          <p className="text-[13px] leading-6 text-muted-on-dark">
            Ask anything, <span className="text-on-dark/80">@</span> to mention,{" "}
            <span className="text-on-dark/80">/</span> for actions
          </p>
          <div className="mt-2 flex items-center justify-between gap-3 text-[12px] text-muted-on-dark">
            <span className="inline-flex items-center gap-1">
              Arc Testnet <ChevronDown size={12} />
            </span>
            <span className="inline-flex items-center gap-2">
              <Mic size={14} strokeWidth={1.8} />
              <span className="flex h-6 w-6 items-center justify-center rounded-full bg-on-dark text-primary">
                <ArrowUp size={13} strokeWidth={2.4} />
              </span>
            </span>
          </div>
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-4 text-[12px] text-muted-on-dark">
          <span className="inline-flex items-center gap-1.5">
            <Hexagon size={12} strokeWidth={1.8} />
            Arc Sepolia
          </span>
          <span className="inline-flex items-center gap-1.5 font-mono">
            <Wallet size={12} strokeWidth={1.8} />
            0x74…9F2c
          </span>
        </div>
      </div>

      <div className="relative bg-terminal-black px-4 py-5 sm:px-5">
        {STARS.map((star, i) => (
          <span
            key={i}
            className="pointer-events-none absolute rounded-full bg-white"
            style={{
              top: star.t,
              left: star.l,
              width: star.s,
              height: star.s,
              opacity: star.o,
            }}
          />
        ))}

        <div className="relative font-mono text-[12.5px] leading-6 sm:text-[13px]">
          <p className="text-on-dark">
            <span className="text-accent-blue">you:</span> send 25 USDC to alice.eth
          </p>
          <p className="mt-1 text-on-dark">
            <span className="text-accent-green">Onix:</span> Here's the call:
          </p>

          <div className="mt-3 overflow-hidden rounded-lg border border-white/[0.07] bg-black/40">
            {DIFF_LINES.map((line) => (
              <div
                key={line.n}
                className={
                  line.kind === "del"
                    ? "grid grid-cols-[2.25rem_1.25rem_1fr] bg-[#2a1614]/70 text-accent-red"
                    : "grid grid-cols-[2.25rem_1.25rem_1fr] bg-[#102418]/55 text-accent-green"
                }
              >
                <span className="select-none px-2 text-right text-[11px] text-muted-on-dark/70">
                  {line.n}
                </span>
                <span className="select-none">{line.kind === "del" ? "−" : "+"}</span>
                <span className={line.kind === "del" ? "pr-3 line-through decoration-accent-red/50" : "pr-3"}>
                  {line.text}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-page font-sans text-primary">
      <header className="fixed inset-x-0 top-0 z-50 border-b border-subtle bg-white">
        <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-5 sm:h-16 sm:px-8">
          <a href="#top" className="flex items-center gap-2 text-[15px] font-semibold tracking-tight">
            <span className="font-mono text-muted">&gt;</span>
            Onix
          </a>
          <nav className="flex items-center gap-6 text-[14px]">
            <a href="#product" className="hidden text-primary/80 hover:underline sm:inline">
              Product
            </a>
            <a href="#docs" className="hidden text-primary/80 hover:underline sm:inline">
              Docs
            </a>
            <a href="#pricing" className="hidden text-primary/80 hover:underline sm:inline">
              Pricing
            </a>
            <a
              href={LOGIN_URL}
              className="inline-flex h-9 items-center rounded-full bg-primary px-4 text-[13px] font-semibold text-white"
            >
              Sign in
            </a>
          </nav>
        </div>
      </header>

      <main id="top" className="pt-14 sm:pt-16">
        <section className="mx-auto max-w-6xl px-5 pb-16 pt-16 sm:px-8 sm:pb-24 sm:pt-24">
          <div className="mx-auto max-w-3xl text-center">
            <h1 className="text-[2.35rem] font-extrabold leading-[1.05] tracking-[-0.045em] text-primary sm:text-6xl">
              Connect any AI agent to a real USDC wallet.
            </h1>
            <p className="mx-auto mt-5 max-w-2xl text-[16px] leading-7 text-muted sm:text-[18px] sm:leading-8">
              Onix is an MCP server. ChatGPT, Claude, or any MCP-compatible agent signs in once and
              gets a Circle developer-controlled wallet on Arc Testnet — no seed phrases, no
              copy-pasted private keys.
            </p>
            <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
              <a
                href={LOGIN_URL}
                className="inline-flex h-11 items-center rounded-full bg-primary px-5 text-[14px] font-semibold text-white"
              >
                Continue with Google
              </a>
              <a
                href={CHATGPT_SETTINGS}
                className="inline-flex h-11 items-center rounded-full border border-primary/80 bg-transparent px-5 text-[14px] font-semibold text-primary"
              >
                Open ChatGPT settings
              </a>
            </div>
          </div>

          <div className="mx-auto mt-14 max-w-3xl">
            <TerminalPanel />
          </div>
        </section>

        <section className="bg-panel-dark">
          <div className="mx-auto flex max-w-6xl flex-col gap-4 px-5 py-10 sm:flex-row sm:items-center sm:justify-between sm:px-8 sm:py-12">
            <div className="min-w-0">
              <p className="text-[12px] font-medium uppercase tracking-[0.14em] text-muted-on-dark">
                Your MCP endpoint
              </p>
              <p className="mt-3 truncate font-mono text-[14px] text-on-dark sm:text-[16px]">{MCP_URL}</p>
            </div>
            <CopyMcpButton dark />
          </div>
        </section>

        <section id="product" className="mx-auto max-w-6xl px-5 py-20 sm:px-8 sm:py-24">
          <h2 className="text-3xl font-bold tracking-[-0.03em] sm:text-4xl">Four tools. One wallet.</h2>
          <p className="mt-3 max-w-xl text-[16px] leading-7 text-muted">
            Every call is scoped to the signed-in user's own Circle wallet — never a hardcoded key.
          </p>
          <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {TOOLS.map((tool) => {
              const Icon = tool.icon;
              return (
                <article key={tool.name} className="rounded-2xl border border-subtle bg-card-light p-5">
                  <div className="flex h-9 w-9 items-center justify-center rounded-lg border border-subtle text-primary">
                    <Icon size={16} strokeWidth={1.8} />
                  </div>
                  <h3 className="mt-4 font-mono text-[13px] font-medium text-primary">{tool.name}</h3>
                  <p className="mt-2 text-[14px] leading-6 text-muted">{tool.body}</p>
                </article>
              );
            })}
          </div>
        </section>

        <section id="docs" className="border-t border-subtle">
          <div className="mx-auto max-w-6xl px-5 py-20 sm:px-8 sm:py-24">
            <p className="text-[12px] font-medium uppercase tracking-[0.14em] text-muted">Built for the agent-first era</p>
            <h2 className="mt-3 max-w-xl text-3xl font-bold tracking-[-0.03em] sm:text-4xl">
              Four steps from ChatGPT to a wallet.
            </h2>
            <ol className="mt-12 space-y-10">
              {STEPS.map((step) => (
                <li key={step.n} className="grid gap-2 sm:grid-cols-[5rem_1fr] sm:gap-8">
                  <span className="font-mono text-2xl font-medium text-muted/70">{step.n}</span>
                  <div>
                    <h3 className="text-[17px] font-semibold tracking-tight">{step.title}</h3>
                    <p className="mt-1 max-w-2xl text-[15px] leading-7 text-muted">{step.body}</p>
                  </div>
                </li>
              ))}
            </ol>
          </div>
        </section>

        <section id="pricing" className="border-t border-subtle">
          <div className="mx-auto max-w-6xl px-5 py-16 sm:px-8">
            <p className="text-[15px] text-muted">Free on Arc Testnet while the network is in public test.</p>
          </div>
        </section>
      </main>

      <footer className="border-t border-subtle bg-page">
        <div className="mx-auto max-w-6xl px-5 py-14 sm:px-8">
          <div className="flex flex-col gap-10 sm:flex-row sm:justify-between">
            <div>
              <p className="flex items-center gap-2 font-semibold">
                <span className="font-mono text-muted">&gt;</span>
                Onix
              </p>
              <p className="mt-2 text-[14px] text-muted">USDC wallets for AI agents.</p>
            </div>
            <div className="flex gap-16 text-[14px]">
              <div>
                <p className="font-semibold">Product</p>
                <a href="#docs" className="mt-3 block text-muted hover:text-primary">
                  Docs
                </a>
                <a href="#" className="mt-2 block text-muted hover:text-primary">
                  Changelog
                </a>
              </div>
              <div>
                <p className="font-semibold">Resources</p>
                <a
                  href="https://github.com/kahaki1/arcbox"
                  className="mt-3 block text-muted hover:text-primary"
                >
                  GitHub
                </a>
                <a href="#" className="mt-2 block text-muted hover:text-primary">
                  Support
                </a>
              </div>
            </div>
          </div>
          <div className="mt-12 flex flex-col gap-2 border-t border-subtle pt-6 text-[13px] text-muted sm:flex-row sm:justify-between">
            <span>© 2026 Onix</span>
            <span>Built on Arc Testnet with Circle.</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
