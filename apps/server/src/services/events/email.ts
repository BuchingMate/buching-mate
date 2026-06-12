import { sendTenantEmail } from "../email/mailer";
import {
  emailButton,
  escapeHtml,
  loadTenantBrand,
  renderEmailShell,
  renderEmailText,
  type EmailBrand,
} from "../email/shell";

function heading(text: string) {
  return `<h1 style="margin:0 0 12px 0;font-size:22px;font-weight:600;color:#0f172a;">${text}</h1>`;
}

function paragraph(html: string) {
  return `<p style="margin:0 0 16px 0;font-size:15px;line-height:1.55;color:#475569;">${html}</p>`;
}

export async function sendEventReviewRequestedEmail(input: {
  orgId: string;
  to: string;
  reviewerName: string;
  submitterName: string;
  eventTitle: string;
  eventUrl: string;
}) {
  const brand = await loadTenantBrand(input.orgId);
  const body = `${heading("Review requested")}
${paragraph(`Hi ${escapeHtml(input.reviewerName)}, ${escapeHtml(input.submitterName)} asked you to review the event “${escapeHtml(input.eventTitle)}” before it can be published.`)}
<div style="margin:20px 0 24px 0;">${emailButton(input.eventUrl, "Review event", "#2563eb")}</div>`;
  await sendTenantEmail({
    orgId: input.orgId,
    kind: "review-requested",
    to: input.to,
    subject: `Review requested: ${input.eventTitle}`,
    html: renderEmailShell({
      brand,
      preheader: `${input.submitterName} asked you to review “${input.eventTitle}”.`,
      bodyHtml: body,
    }),
    text: renderEmailText(
      [
        `Hi ${input.reviewerName}, ${input.submitterName} asked you to review the event "${input.eventTitle}" before it can be published.`,
        "",
        `Review event: ${input.eventUrl}`,
      ],
      brand,
    ),
  });
}

export async function sendEventReviewApprovedEmail(input: {
  orgId: string;
  to: string;
  reviewerName: string;
  eventTitle: string;
  eventUrl: string;
}) {
  const brand = await loadTenantBrand(input.orgId);
  const body = `${heading("Event approved")}
${paragraph(`${escapeHtml(input.reviewerName)} approved “${escapeHtml(input.eventTitle)}”. You can now publish it.`)}
<div style="margin:20px 0 24px 0;">${emailButton(input.eventUrl, "Open event", "#2563eb")}</div>`;
  await sendTenantEmail({
    orgId: input.orgId,
    kind: "review-approved",
    to: input.to,
    subject: `Approved: ${input.eventTitle}`,
    html: renderEmailShell({
      brand,
      preheader: `“${input.eventTitle}” was approved — you can publish it now.`,
      bodyHtml: body,
    }),
    text: renderEmailText(
      [
        `${input.reviewerName} approved "${input.eventTitle}". You can now publish it.`,
        "",
        `Open event: ${input.eventUrl}`,
      ],
      brand,
    ),
  });
}

// Sent to every active registrant when the organizer cancels an event. Paid
// attendees are promised a refund — the organizer issues it manually from the
// registration sheet (Stripe Connect: the money sits in their account).
export function renderEventCancelledEmail(input: {
  attendeeName: string;
  eventTitle: string;
  orgName: string;
  refundExpected: boolean;
  brand?: EmailBrand | null;
}): { subject: string; html: string; text: string } {
  const brand = input.brand ?? { name: input.orgName, logoUrl: null, accentColor: null };
  const refundRow = input.refundExpected
    ? paragraph("Your payment will be refunded to your original payment method.")
    : "";
  const body = `${heading("Event cancelled")}
${paragraph(`Hi ${escapeHtml(input.attendeeName)}, ${escapeHtml(input.orgName)} has cancelled “${escapeHtml(input.eventTitle)}”. Your registration is no longer active.`)}
${refundRow}`;
  const html = renderEmailShell({
    brand,
    preheader: `“${input.eventTitle}” was cancelled${input.refundExpected ? " — your payment will be refunded" : ""}.`,
    bodyHtml: body,
    footerHtml: `<p style="margin:0;font-size:12px;color:#94a3b8;">Questions? Just reply to this email.</p>`,
  });
  const text = renderEmailText(
    [
      `Hi ${input.attendeeName}, ${input.orgName} has cancelled "${input.eventTitle}". Your registration is no longer active.`,
      input.refundExpected
        ? "Your payment will be refunded to your original payment method."
        : false,
      "",
      "Questions? Just reply to this email.",
    ],
    brand,
  );
  return { subject: `Event cancelled: ${input.eventTitle}`, html, text };
}

export async function sendEventCancelledEmail(input: {
  orgId: string;
  to: string;
  attendeeName: string;
  eventTitle: string;
  orgName: string;
  refundExpected: boolean;
}) {
  const brand = await loadTenantBrand(input.orgId);
  const { subject, html, text } = renderEventCancelledEmail({ ...input, brand });
  await sendTenantEmail({
    orgId: input.orgId,
    kind: "event-cancelled",
    to: input.to,
    subject,
    html,
    text,
  });
}

export async function sendEventReviewRejectedEmail(input: {
  orgId: string;
  to: string;
  reviewerName: string;
  eventTitle: string;
  note: string | null;
  eventUrl: string;
}) {
  const brand = await loadTenantBrand(input.orgId);
  const noteRow = input.note
    ? `<p style="margin:0 0 16px 0;font-size:14px;color:#475569;border-left:3px solid #e2e8f0;padding-left:12px;">${escapeHtml(input.note)}</p>`
    : "";
  const body = `${heading("Changes requested")}
${paragraph(`${escapeHtml(input.reviewerName)} requested changes on “${escapeHtml(input.eventTitle)}” before it can be published.`)}
${noteRow}
<div style="margin:20px 0 24px 0;">${emailButton(input.eventUrl, "Edit event", "#2563eb")}</div>`;
  await sendTenantEmail({
    orgId: input.orgId,
    kind: "review-rejected",
    to: input.to,
    subject: `Changes requested: ${input.eventTitle}`,
    html: renderEmailShell({
      brand,
      preheader: `${input.reviewerName} requested changes on “${input.eventTitle}”.`,
      bodyHtml: body,
    }),
    text: renderEmailText(
      [
        `${input.reviewerName} requested changes on "${input.eventTitle}" before it can be published.`,
        input.note ? `Note: ${input.note}` : false,
        "",
        `Edit event: ${input.eventUrl}`,
      ],
      brand,
    ),
  });
}
