import { Resend } from "resend";
import { getLogger } from "../../observability/request-context";

// Delivery layer behind the mailer service. The mailer owns the business
// rules (sender resolution, suspension, never-throw); a transport only moves
// a finished message to a provider. Swapping providers means adding an
// adapter here and a case in getEmailTransport() — callers never change.

export interface EmailAttachment {
  filename: string;
  contentType: string;
  content: string;
}

export interface OutgoingEmail {
  from: string;
  to: string;
  replyTo?: string;
  subject: string;
  html: string;
  // Plain-text alternative part. Optional; clients that strip HTML fall back
  // to it and spam filters score multipart messages better.
  text?: string;
  attachments?: EmailAttachment[];
  // Provider-side metadata (e.g. Resend tags for webhook attribution).
  // Transports that have no tag concept ignore them.
  tags?: { name: string; value: string }[];
  // Extra MIME headers, e.g. List-Unsubscribe / List-Unsubscribe-Post for
  // one-click unsubscribe on marketing mail.
  headers?: Record<string, string>;
}

export interface BatchSendResult {
  sent: OutgoingEmail[];
  failed: OutgoingEmail[];
}

export interface EmailTransport {
  // For logs and error messages.
  name: string;
  // Deliver one message. Throws on failure — the mailer decides whether a
  // failure may break the calling flow (it never does today).
  send(email: OutgoingEmail): Promise<void>;
  // Deliver many copies of similar messages, returning per-message outcomes
  // instead of throwing, so the caller can record statuses and meter sends.
  sendBatch(emails: OutgoingEmail[]): Promise<BatchSendResult>;
}

// --- Resend ---------------------------------------------------------------

// Resend allows up to 100 messages per batch call.
const RESEND_BATCH_LIMIT = 100;

let resendClient: Resend | null = null;

// Shared Resend client. Returns null when Resend is not configured. Exported
// for the domain-verification flow, which is Resend-specific by nature.
export function getResendClient(): Resend | null {
  if (!resendClient && process.env.RESEND_API_KEY) {
    resendClient = new Resend(process.env.RESEND_API_KEY);
  }
  return resendClient;
}

function toResendPayload(email: OutgoingEmail) {
  return {
    from: email.from,
    to: email.to,
    ...(email.replyTo ? { replyTo: email.replyTo } : {}),
    subject: email.subject,
    html: email.html,
    ...(email.text ? { text: email.text } : {}),
    attachments: email.attachments,
    tags: email.tags,
    ...(email.headers ? { headers: email.headers } : {}),
  };
}

class ResendTransport implements EmailTransport {
  name = "resend";

  async send(email: OutgoingEmail): Promise<void> {
    const client = getResendClient();
    if (!client) throw new Error("Resend client not configured");
    const { error } = await client.emails.send(toResendPayload(email));
    if (error) throw new Error(`Resend send failed: ${error.message}`);
  }

  async sendBatch(emails: OutgoingEmail[]): Promise<BatchSendResult> {
    const client = getResendClient();
    if (!client) return { sent: [], failed: [...emails] };

    const sent: OutgoingEmail[] = [];
    const failed: OutgoingEmail[] = [];
    for (let i = 0; i < emails.length; i += RESEND_BATCH_LIMIT) {
      const chunk = emails.slice(i, i + RESEND_BATCH_LIMIT);
      try {
        const { error } = await client.batch.send(chunk.map(toResendPayload));
        if (error) {
          failed.push(...chunk);
          getLogger().warn({ err: error }, "resend batch send failed");
        } else {
          sent.push(...chunk);
        }
      } catch (err) {
        failed.push(...chunk);
        getLogger().warn({ err }, "resend batch send threw");
      }
    }
    return { sent, failed };
  }
}

// --- Mailpit (dev/e2e) ------------------------------------------------------

// Local mail catcher (see docker-compose). Posts to Mailpit's HTTP send API so
// dev and e2e runs never reach real inboxes; tests read the inbox back out via
// the same API.
class MailpitTransport implements EmailTransport {
  name = "mailpit";

  constructor(private baseUrl: string) {}

  async send(email: OutgoingEmail): Promise<void> {
    const res = await fetch(`${this.baseUrl}/api/v1/send`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        From: { Email: extractAddress(email.from) },
        To: [{ Email: email.to }],
        ...(email.replyTo ? { ReplyTo: [{ Email: email.replyTo }] } : {}),
        Subject: email.subject,
        HTML: email.html,
        ...(email.text ? { Text: email.text } : {}),
        ...(email.headers ? { Headers: email.headers } : {}),
        Attachments: email.attachments?.map((a) => ({
          Content: a.content,
          Filename: a.filename,
          ContentType: a.contentType,
        })),
      }),
    });
    if (!res.ok) throw new Error(`Mailpit send returned ${res.status}`);
  }

  async sendBatch(emails: OutgoingEmail[]): Promise<BatchSendResult> {
    const sent: OutgoingEmail[] = [];
    const failed: OutgoingEmail[] = [];
    for (const email of emails) {
      try {
        await this.send(email);
        sent.push(email);
      } catch (err) {
        failed.push(email);
        getLogger().warn({ err, to: email.to }, "mailpit send failed");
      }
    }
    return { sent, failed };
  }
}

// "Name <addr>" -> "addr"; Mailpit's send API wants a bare address.
function extractAddress(from: string): string {
  const match = from.match(/<([^>]+)>/);
  return match ? match[1] : from;
}

// --- Log (unconfigured local dev) -------------------------------------------

// No provider configured: log instead of sending, keeping local dev quiet
// without breaking the flow. Everything counts as sent.
class LogTransport implements EmailTransport {
  name = "log";

  async send(email: OutgoingEmail): Promise<void> {
    getLogger().info({ to: email.to, subject: email.subject }, "dev email (not sent)");
  }

  async sendBatch(emails: OutgoingEmail[]): Promise<BatchSendResult> {
    getLogger().info(
      { count: emails.length, subject: emails[0]?.subject },
      "dev batch email (not sent)",
    );
    return { sent: [...emails], failed: [] };
  }
}

// --- Selection ----------------------------------------------------------------

// Provider precedence: MAILPIT_URL always wins (so a dev/e2e run can never hit
// real inboxes even with a live provider key in .env), then a configured
// provider, then the log fallback. Re-evaluated per call so tests and the
// dev server pick up env changes without process tricks.
export function getEmailTransport(): EmailTransport {
  if (process.env.MAILPIT_URL) return new MailpitTransport(process.env.MAILPIT_URL);
  if (process.env.RESEND_API_KEY && process.env.RESEND_FROM_EMAIL) return new ResendTransport();
  return new LogTransport();
}
