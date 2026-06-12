import { formatDisplay, type Money } from "../../lib/money";
import { sendTenantEmail } from "../email/mailer";
import {
  escapeHtml,
  loadTenantBrand,
  renderEmailShell,
  renderEmailText,
  type EmailBrand,
} from "../email/shell";

// Sent to the attendee when a refund settles, so "your payment will be
// refunded" (event-cancelled email) is followed by proof that it happened.

interface RefundRenderInput {
  attendeeName: string;
  eventTitle: string;
  orgName: string;
  amount: Money | null;
  registrationId: string;
  brand?: EmailBrand | null;
}

// Exported for tests: pure render, no I/O.
export function renderRefundEmail(input: RefundRenderInput): { html: string; text: string } {
  const brand = input.brand ?? { name: input.orgName, logoUrl: null, accentColor: null };
  const amountLabel = input.amount ? formatDisplay(input.amount) : null;
  const amountSentence = amountLabel
    ? `Your payment of <strong>${escapeHtml(amountLabel)}</strong> for <strong>${escapeHtml(input.eventTitle)}</strong> has been refunded to your original payment method.`
    : `Your payment for <strong>${escapeHtml(input.eventTitle)}</strong> has been refunded to your original payment method.`;
  const body = `
                <h1 style="margin:0 0 12px 0;font-size:22px;font-weight:600;color:#0f172a;">Refund processed</h1>
                <p style="margin:0 0 16px 0;font-size:15px;line-height:1.55;color:#475569;">
                  Hi ${escapeHtml(input.attendeeName)}, ${amountSentence}
                </p>
                <p style="margin:0 0 24px 0;font-size:13px;color:#64748b;">
                  Depending on your bank, the money can take 5–10 business days to appear on your statement.
                </p>`;
  const footer = `
                <p style="margin:0 0 4px 0;font-size:12px;color:#94a3b8;">Questions? Just reply to this email.</p>
                <p style="margin:0;font-size:11px;color:#cbd5e1;">Booking reference: ${escapeHtml(input.registrationId)}. This email is your refund receipt.</p>`;
  const html = renderEmailShell({
    brand,
    preheader: amountLabel
      ? `${amountLabel} refunded for ${input.eventTitle}.`
      : `Your payment for ${input.eventTitle} was refunded.`,
    bodyHtml: body,
    footerHtml: footer,
  });
  const text = renderEmailText(
    [
      `Hi ${input.attendeeName}, your payment${amountLabel ? ` of ${amountLabel}` : ""} for ${input.eventTitle} has been refunded to your original payment method.`,
      "",
      "Depending on your bank, the money can take 5-10 business days to appear on your statement.",
      "",
      `Booking reference: ${input.registrationId}`,
    ],
    brand,
  );
  return { html, text };
}

export async function sendRefundConfirmationEmail(input: {
  orgId: string;
  to: string;
  attendeeName: string;
  eventTitle: string;
  orgName: string;
  amount: Money | null;
  registrationId: string;
}) {
  const brand = await loadTenantBrand(input.orgId);
  const rendered = renderRefundEmail({ ...input, brand });
  await sendTenantEmail({
    orgId: input.orgId,
    kind: "payment-refunded",
    to: input.to,
    subject: `Refund processed for ${input.eventTitle}`,
    html: rendered.html,
    text: rendered.text,
  });
}
