import { sendTenantEmail } from "../email/mailer";

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function shell(body: string) {
  return `<!DOCTYPE html><html><body style="margin:0;padding:0;background:#f6f7f9;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;color:#0f172a;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="padding:32px 16px;"><tr><td align="center">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:480px;background:#ffffff;border-radius:12px;border:1px solid #e2e8f0;overflow:hidden;"><tr><td style="padding:32px;">
${body}
</td></tr></table></td></tr></table></body></html>`.trim();
}

function button(href: string, label: string) {
  return `<a href="${href}" style="display:inline-block;background:#2563eb;color:#ffffff;text-decoration:none;padding:11px 20px;border-radius:8px;font-size:14px;font-weight:500;">${escapeHtml(label)}</a>`;
}

export async function sendEventReviewRequestedEmail(input: {
  orgId: string;
  to: string;
  reviewerName: string;
  submitterName: string;
  eventTitle: string;
  eventUrl: string;
}) {
  const body = `<h1 style="margin:0 0 12px 0;font-size:22px;font-weight:600;">Review requested</h1>
<p style="margin:0 0 16px 0;font-size:15px;line-height:1.55;color:#475569;">Hi ${escapeHtml(input.reviewerName)}, ${escapeHtml(input.submitterName)} asked you to review the event “${escapeHtml(input.eventTitle)}” before it can be published.</p>
<div style="margin:20px 0 0 0;">${button(input.eventUrl, "Review event")}</div>`;
  await sendTenantEmail({
    orgId: input.orgId,
    kind: "review-requested",
    to: input.to,
    subject: `Review requested: ${input.eventTitle}`,
    html: shell(body),
  });
}

export async function sendEventReviewApprovedEmail(input: {
  orgId: string;
  to: string;
  reviewerName: string;
  eventTitle: string;
  eventUrl: string;
}) {
  const body = `<h1 style="margin:0 0 12px 0;font-size:22px;font-weight:600;">Event approved</h1>
<p style="margin:0 0 16px 0;font-size:15px;line-height:1.55;color:#475569;">${escapeHtml(input.reviewerName)} approved “${escapeHtml(input.eventTitle)}”. You can now publish it.</p>
<div style="margin:20px 0 0 0;">${button(input.eventUrl, "Open event")}</div>`;
  await sendTenantEmail({
    orgId: input.orgId,
    kind: "review-approved",
    to: input.to,
    subject: `Approved: ${input.eventTitle}`,
    html: shell(body),
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
  const noteRow = input.note
    ? `<p style="margin:0 0 16px 0;font-size:14px;color:#475569;border-left:3px solid #e2e8f0;padding-left:12px;">${escapeHtml(input.note)}</p>`
    : "";
  const body = `<h1 style="margin:0 0 12px 0;font-size:22px;font-weight:600;">Changes requested</h1>
<p style="margin:0 0 16px 0;font-size:15px;line-height:1.55;color:#475569;">${escapeHtml(input.reviewerName)} requested changes on “${escapeHtml(input.eventTitle)}” before it can be published.</p>
${noteRow}
<div style="margin:20px 0 0 0;">${button(input.eventUrl, "Edit event")}</div>`;
  await sendTenantEmail({
    orgId: input.orgId,
    kind: "review-rejected",
    to: input.to,
    subject: `Changes requested: ${input.eventTitle}`,
    html: shell(body),
  });
}
