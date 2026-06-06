import { buildEventIcs } from "../../lib/ics";
import { googleCalendarUrl, outlookCalendarUrl } from "../../lib/calendar-links";
import { formatEventDateTime } from "../../lib/event-time";
import { sendTenantEmail } from "../email/mailer";

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
  await sendTenantEmail({
    orgId,
    kind: "booking-resume",
    to,
    subject: `Complete your booking for ${eventTitle}`,
    html: renderResumeHtml({ eventTitle, orgName, resumeUrl }),
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

function renderResumeHtml({
  eventTitle,
  orgName,
  resumeUrl,
}: {
  eventTitle: string;
  orgName: string;
  resumeUrl: string;
}) {
  return `
<!DOCTYPE html>
<html>
  <body style="margin:0;padding:0;background:#f6f7f9;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;color:#0f172a;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="padding:32px 16px;">
      <tr>
        <td align="center">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:480px;background:#ffffff;border-radius:12px;border:1px solid #e2e8f0;overflow:hidden;">
            <tr>
              <td style="padding:32px 32px 8px 32px;">
                <h1 style="margin:0 0 12px 0;font-size:22px;font-weight:600;color:#0f172a;">
                  Complete your booking
                </h1>
                <p style="margin:0 0 24px 0;font-size:15px;line-height:1.55;color:#475569;">
                  Your spot for <strong>${escapeHtml(eventTitle)}</strong> at ${escapeHtml(orgName)} is held as pending. Finish payment within 30 minutes to confirm.
                </p>
                <a href="${resumeUrl}"
                   style="display:inline-block;background:#0f172a;color:#ffffff;text-decoration:none;padding:11px 20px;border-radius:8px;font-size:14px;font-weight:500;">
                  Complete payment
                </a>
                <p style="margin:24px 0 0 0;font-size:12px;color:#94a3b8;line-height:1.5;">
                  Or paste this link into your browser:<br/>
                  <span style="color:#475569;word-break:break-all;">${resumeUrl}</span>
                </p>
              </td>
            </tr>
            <tr>
              <td style="padding:20px 32px;background:#f8fafc;border-top:1px solid #e2e8f0;">
                <p style="margin:0;font-size:12px;color:#94a3b8;">
                  If you didn't start this booking, you can ignore this email.
                </p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>
  `.trim();
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
}

// Exported for tests: pure render, no I/O.
export function renderConfirmationEmail(input: ConfirmationRenderInput): {
  html: string;
  text: string;
} {
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
  // Shown by inbox list views next to the subject; invisible in the body.
  const preheader = [dateLabel, timeLabel, input.location ?? (input.joinUrl ? "Online" : null)]
    .filter(Boolean)
    .join(" · ");

  const joinButton = input.joinUrl
    ? `
                <div style="margin:0 0 20px 0;">
                  <a href="${input.joinUrl}" style="display:inline-block;background:#2563eb;color:#ffffff;text-decoration:none;padding:11px 20px;border-radius:8px;font-size:14px;font-weight:500;">Join meeting</a>
                  <p style="margin:8px 0 0 0;font-size:12px;color:#94a3b8;word-break:break-all;">${input.joinUrl}</p>
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
  const detailRows = [
    ["Date", escapeHtml(dateLabel)],
    ["Time", escapeHtml(timeLabel)],
    ["Location", locationCell],
    ["Host", escapeHtml(input.orgName)],
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
    ? `<a href="${input.manageUrl}" style="color:#475569;text-decoration:underline;">Manage your booking</a> &middot; `
    : "";

  const html = `
<!DOCTYPE html>
<html>
  <body style="margin:0;padding:0;background:#f6f7f9;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;color:#0f172a;">
    <div style="display:none;max-height:0;overflow:hidden;mso-hide:all;">${escapeHtml(preheader)}</div>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="padding:32px 16px;">
      <tr>
        <td align="center">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:480px;background:#ffffff;border-radius:12px;border:1px solid #e2e8f0;overflow:hidden;">
            <tr>
              <td style="padding:32px 32px 8px 32px;">
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
              </td>
            </tr>
            <tr>
              <td style="padding:20px 32px;background:#f8fafc;border-top:1px solid #e2e8f0;">
                <p style="margin:0 0 4px 0;font-size:12px;color:#94a3b8;">
                  ${manageLink}Questions? Just reply to this email.
                </p>
                <p style="margin:0;font-size:11px;color:#cbd5e1;">
                  Booking reference: ${escapeHtml(input.registrationId)}
                </p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>
  `.trim();

  const textLines = [
    `Hi ${input.attendeeName}, your spot for ${input.eventTitle} at ${input.orgName} is confirmed.`,
    "",
    `Date: ${dateLabel}`,
    `Time: ${timeLabel}`,
    `Location: ${input.location ?? (input.joinUrl ? "Online" : "To be announced")}`,
    `Host: ${input.orgName}`,
    ...(input.joinUrl ? [`Join: ${input.joinUrl}`] : []),
    ...(input.description ? ["", `About this event: ${input.description}`] : []),
    "",
    `Add to Google Calendar: ${googleUrl}`,
    ...(input.manageUrl ? [`Manage your booking: ${input.manageUrl}`] : []),
    "",
    `Booking reference: ${input.registrationId}`,
  ];

  return { html, text: textLines.join("\n") };
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
