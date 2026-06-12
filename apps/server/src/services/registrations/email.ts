import { buildEventIcs } from "../../lib/ics";
import { googleCalendarUrl, outlookCalendarUrl } from "../../lib/calendar-links";
import { formatEventDateTime } from "../../lib/event-time";
import { formatDisplay, type Money } from "../../lib/money";
import { sendTenantEmail } from "../email/mailer";
import {
  emailButton,
  escapeHtml,
  loadTenantBrand,
  renderEmailShell,
  renderEmailText,
  type EmailBrand,
} from "../email/shell";

export async function sendBookingResumeEmail({
  orgId,
  to,
  eventTitle,
  orgName,
  resumeUrl,
}: {
  orgId: string;
  to: string;
  eventTitle: string;
  orgName: string;
  resumeUrl: string;
}) {
  const brand = await loadTenantBrand(orgId);
  const rendered = renderResumeEmail({ eventTitle, orgName, resumeUrl, brand });
  await sendTenantEmail({
    orgId,
    kind: "booking-resume",
    to,
    subject: `Complete your booking for ${eventTitle}`,
    html: rendered.html,
    text: rendered.text,
  });
}

export async function sendBookingConfirmationEmail({
  orgId,
  to,
  attendeeName,
  eventTitle,
  orgName,
  timezone,
  location,
  registrationId,
  joinUrl,
  startUtc,
  endUtc,
  organizerEmail,
  eventId,
  description,
  manageUrl,
  amountPaid,
  subscribeUrl,
}: {
  orgId: string;
  to: string;
  attendeeName: string;
  eventTitle: string;
  orgName: string;
  timezone: string;
  location: string | null;
  registrationId: string;
  joinUrl?: string | null;
  startUtc: Date;
  endUtc: Date;
  organizerEmail?: string | null;
  eventId?: string;
  description?: string | null;
  manageUrl?: string | null;
  amountPaid?: Money | null;
  subscribeUrl?: string | null;
}) {
  const icsAttachment = {
    filename: "event.ics",
    contentType: "text/calendar",
    content: Buffer.from(
      buildEventIcs({
        uid: `${eventId ?? registrationId}@buchingmate`,
        title: eventTitle,
        description: description ?? null,
        startUtc,
        endUtc,
        location,
        joinUrl: joinUrl ?? null,
        organizerEmail: organizerEmail ?? null,
        organizerName: orgName,
      }),
      "utf8",
    ).toString("base64"),
  };

  const brand = await loadTenantBrand(orgId);
  const rendered = renderConfirmationEmail({
    attendeeName,
    eventTitle,
    orgName,
    timezone,
    location,
    registrationId,
    joinUrl: joinUrl ?? null,
    startUtc,
    endUtc,
    description: description ?? null,
    manageUrl: manageUrl ?? null,
    amountPaid: amountPaid ?? null,
    subscribeUrl: subscribeUrl ?? null,
    brand,
  });

  await sendTenantEmail({
    orgId,
    kind: "booking-confirmed",
    to,
    subject: `Booking confirmed for ${eventTitle}`,
    html: rendered.html,
    text: rendered.text,
    attachments: [icsAttachment],
  });
}

interface ResumeRenderInput {
  eventTitle: string;
  orgName: string;
  resumeUrl: string;
  brand?: EmailBrand | null;
}

// Exported for tests: pure render, no I/O.
export function renderResumeEmail(input: ResumeRenderInput): { html: string; text: string } {
  const brand = input.brand ?? { name: input.orgName, logoUrl: null, accentColor: null };
  const body = `
                <h1 style="margin:0 0 12px 0;font-size:22px;font-weight:600;color:#0f172a;">
                  Complete your booking
                </h1>
                <p style="margin:0 0 24px 0;font-size:15px;line-height:1.55;color:#475569;">
                  Your spot for <strong>${escapeHtml(input.eventTitle)}</strong> at ${escapeHtml(input.orgName)} is held as pending. Finish payment within 30 minutes to confirm.
                </p>
                ${emailButton(input.resumeUrl, "Complete payment")}
                <p style="margin:24px 0 0 0;font-size:12px;color:#94a3b8;line-height:1.5;">
                  Or paste this link into your browser:<br/>
                  <span style="color:#475569;word-break:break-all;">${escapeHtml(input.resumeUrl)}</span>
                </p>`;
  const html = renderEmailShell({
    brand,
    preheader: `Finish payment within 30 minutes to confirm your spot for ${input.eventTitle}.`,
    bodyHtml: body,
    footerHtml: `<p style="margin:0;font-size:12px;color:#94a3b8;">If you didn't start this booking, you can ignore this email.</p>`,
  });
  const text = renderEmailText(
    [
      `Your spot for ${input.eventTitle} at ${input.orgName} is held as pending.`,
      "Finish payment within 30 minutes to confirm:",
      "",
      input.resumeUrl,
      "",
      "If you didn't start this booking, you can ignore this email.",
    ],
    brand,
  );
  return { html, text };
}

interface ConfirmationRenderInput {
  attendeeName: string;
  eventTitle: string;
  orgName: string;
  timezone: string;
  location: string | null;
  registrationId: string;
  joinUrl: string | null;
  startUtc: Date;
  endUtc: Date;
  description: string | null;
  manageUrl: string | null;
  amountPaid?: Money | null;
  subscribeUrl?: string | null;
  brand?: EmailBrand | null;
}

// Exported for tests: pure render, no I/O.
export function renderConfirmationEmail(input: ConfirmationRenderInput): {
  html: string;
  text: string;
} {
  const brand = input.brand ?? { name: input.orgName, logoUrl: null, accentColor: null };
  const { dateLabel, timeLabel } = formatEventDateTime(
    input.startUtc,
    input.endUtc,
    input.timezone,
  );
  const calendarInput = {
    title: input.eventTitle,
    description: input.description,
    startUtc: input.startUtc,
    endUtc: input.endUtc,
    location: input.location,
    joinUrl: input.joinUrl,
  };
  const googleUrl = googleCalendarUrl(calendarInput);
  const outlookUrl = outlookCalendarUrl(calendarInput);
  const preheader = [dateLabel, timeLabel, input.location ?? (input.joinUrl ? "Online" : null)]
    .filter(Boolean)
    .join(" · ");

  const joinButton = input.joinUrl
    ? `
                <div style="margin:0 0 20px 0;">
                  ${emailButton(input.joinUrl, "Join meeting", "#2563eb")}
                  <p style="margin:8px 0 0 0;font-size:12px;color:#94a3b8;word-break:break-all;">${escapeHtml(input.joinUrl)}</p>
                </div>
      `
    : "";
  // Location is always shown so the attendee never wonders where to go: a map
  // link for a venue, "Online" for video-only events, a placeholder otherwise.
  const locationCell = input.location
    ? `<a href="https://www.google.com/maps/search/?api=1&amp;query=${encodeURIComponent(input.location)}" style="color:#0f172a;text-decoration:underline;">${escapeHtml(input.location)}</a>`
    : input.joinUrl
      ? "Online"
      : "To be announced";
  const amountLabel = input.amountPaid ? formatDisplay(input.amountPaid) : null;
  const detailRows = [
    ["Date", escapeHtml(dateLabel)],
    ["Time", escapeHtml(timeLabel)],
    ["Location", locationCell],
    ["Host", escapeHtml(input.orgName)],
    ...(amountLabel ? [["Amount paid", escapeHtml(amountLabel)]] : []),
  ]
    .map(
      ([label, value], i, all) => `
                  <tr>
                    <td style="padding:${i === 0 ? "14px" : "8px"} 0 ${i === all.length - 1 ? "14px" : "8px"} 0;color:#64748b;font-size:14px;vertical-align:top;">${label}</td>
                    <td style="padding:${i === 0 ? "14px" : "8px"} 0 ${i === all.length - 1 ? "14px" : "8px"} 0;color:#0f172a;font-size:14px;text-align:right;">${value}</td>
                  </tr>`,
    )
    .join("");
  const aboutBlock = input.description
    ? `
                <p style="margin:0 0 4px 0;font-size:12px;font-weight:600;letter-spacing:0.04em;text-transform:uppercase;color:#94a3b8;">About this event</p>
                <p style="margin:0 0 20px 0;font-size:14px;line-height:1.55;color:#475569;">${escapeHtml(input.description).replace(/\r?\n/g, "<br/>")}</p>
      `
    : "";
  const manageLink = input.manageUrl
    ? `<a href="${escapeHtml(input.manageUrl)}" style="color:#475569;text-decoration:underline;">Manage your booking</a> &middot; `
    : "";
  const receiptNote = amountLabel ? " This email is your receipt." : "";
  // Calendar opt-in invite, shown only when the attendee hasn't already
  // subscribed. One-click link; subscribing is the recipient's explicit choice.
  const subscribeBlock = input.subscribeUrl
    ? `
                <p style="margin:0 0 24px 0;font-size:13px;color:#64748b;">
                  Want to hear about ${escapeHtml(input.orgName)}'s future events?
                  <a href="${escapeHtml(input.subscribeUrl)}" style="color:#2563eb;text-decoration:underline;">Subscribe to their Calendar</a>.
                </p>`
    : "";

  const body = `
                <h1 style="margin:0 0 12px 0;font-size:22px;font-weight:600;color:#0f172a;">
                  You're booked
                </h1>
                <p style="margin:0 0 24px 0;font-size:15px;line-height:1.55;color:#475569;">
                  Hi ${escapeHtml(input.attendeeName)}, your spot for <strong>${escapeHtml(input.eventTitle)}</strong> at ${escapeHtml(input.orgName)} is confirmed.
                </p>
                ${joinButton}
                <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-top:1px solid #e2e8f0;border-bottom:1px solid #e2e8f0;margin:0 0 16px 0;">
                  ${detailRows}
                </table>
                ${aboutBlock}
                <p style="margin:0 0 24px 0;font-size:13px;color:#64748b;">
                  Add to calendar:
                  <a href="${escapeHtml(googleUrl)}" style="color:#2563eb;text-decoration:underline;">Google</a> &middot;
                  <a href="${escapeHtml(outlookUrl)}" style="color:#2563eb;text-decoration:underline;">Outlook</a> &middot;
                  or open the attached invite (Apple&nbsp;Calendar)
                </p>
                ${subscribeBlock}`;
  const footer = `
                <p style="margin:0 0 4px 0;font-size:12px;color:#94a3b8;">
                  ${manageLink}Questions? Just reply to this email.
                </p>
                <p style="margin:0;font-size:11px;color:#cbd5e1;">
                  Booking reference: ${escapeHtml(input.registrationId)}.${receiptNote}
                </p>`;

  const html = renderEmailShell({ brand, preheader, bodyHtml: body, footerHtml: footer });

  const text = renderEmailText(
    [
      `Hi ${input.attendeeName}, your spot for ${input.eventTitle} at ${input.orgName} is confirmed.`,
      "",
      `Date: ${dateLabel}`,
      `Time: ${timeLabel}`,
      `Location: ${input.location ?? (input.joinUrl ? "Online" : "To be announced")}`,
      `Host: ${input.orgName}`,
      amountLabel ? `Amount paid: ${amountLabel} (this email is your receipt)` : false,
      input.joinUrl ? `Join: ${input.joinUrl}` : false,
      ...(input.description ? ["", `About this event: ${input.description}`] : []),
      "",
      `Add to Google Calendar: ${googleUrl}`,
      input.manageUrl ? `Manage your booking: ${input.manageUrl}` : false,
      input.subscribeUrl
        ? `Subscribe to ${input.orgName}'s Calendar for future events: ${input.subscribeUrl}`
        : false,
      "",
      `Booking reference: ${input.registrationId}`,
    ],
    brand,
  );

  return { html, text };
}
