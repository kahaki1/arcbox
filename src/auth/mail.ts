import { adminDb, firebaseConfigured } from "../firebase/admin.js";
import { config } from "../config.js";

export function emailSenderConfigured(): boolean {
  return Boolean(process.env.RESEND_API_KEY);
}

export async function sendLoginCode(email: string, code: string): Promise<void> {
  const from = process.env.EMAIL_FROM ?? "Onix <onboarding@resend.dev>";
  const subject = "Your Onix login code";
  const html = `
    <div style="font-family:Segoe UI,Arial,sans-serif;background:#07080a;color:#ece8df;padding:32px">
      <div style="max-width:440px;margin:0 auto;background:#12151b;border-radius:18px;padding:28px">
        <div style="font-size:13px;letter-spacing:.14em;text-transform:uppercase;color:#5dffb2;font-weight:700">Onix</div>
        <h1 style="font-size:28px;letter-spacing:-.04em;margin:12px 0 8px">Your login code</h1>
        <p style="color:#8f8a82;margin:0 0 20px">Use this code to sign in. It expires in 10 minutes.</p>
        <div style="font-size:36px;letter-spacing:.2em;font-weight:700;color:#5dffb2">${code}</div>
      </div>
    </div>
  `;
  const text = `Your Onix login code is ${code}. It expires in 10 minutes.`;

  if (firebaseConfigured()) {
    await adminDb().collection("mail").add({
      to: email,
      message: { subject, html, text },
      createdAt: new Date().toISOString(),
    });
  }

  if (process.env.RESEND_API_KEY) {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        authorization: `Bearer ${process.env.RESEND_API_KEY}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({ from, to: [email], subject, html, text }),
    });
    if (!response.ok) {
      const detail = await response.text();
      throw new Error(`Resend failed (${response.status}): ${detail.slice(0, 200)}`);
    }
    return;
  }

  if (process.env.OTP_DEBUG === "true") {
    console.warn(`OTP_DEBUG ${email}: ${code}`);
    return;
  }

  if (firebaseConfigured()) {
    return;
  }

  throw new Error("Email sending is not configured. Set RESEND_API_KEY or enable the Firebase Trigger Email extension.");
}

void config;
