import type { TReaderDocument } from "@usewaypoint/email-builder";
import type { EmailDocumentTypeDef } from "@/lib/email-document-types";
import { ROOT_BLOCK_ID, createRootBlock, DEFAULT_ROOT_STYLE } from "@/lib/email-blocks";

const NAVY = "#1e293b";
const MUTED = "#64748b";
const INK = "#111827";
const BODY = "#334155";
const LINK = "#2563eb";

const PAD = { top: 8, bottom: 8, right: 32, left: 32 };
const PAD_TIGHT = { top: 2, bottom: 2, right: 32, left: 32 };

function heading(text: string, opts: { fontSize?: "h1" | "h2" | "h3"; color?: string } = {}) {
  return {
    type: "Heading",
    data: {
      props: { text, level: opts.fontSize ?? "h2" },
      style: {
        color: opts.color ?? INK,
        backgroundColor: null,
        fontFamily: "MODERN_SANS",
        fontWeight: "bold",
        textAlign: "left",
        padding: PAD,
      },
    },
  } as TReaderDocument[string];
}

function text(
  content: string,
  opts: { fontSize?: number; color?: string; tight?: boolean; align?: "left" | "center" } = {},
) {
  return {
    type: "Text",
    data: {
      props: { text: content, markdown: false },
      style: {
        color: opts.color ?? BODY,
        backgroundColor: null,
        fontSize: opts.fontSize ?? 15,
        fontFamily: "MODERN_SANS",
        fontWeight: "normal",
        textAlign: opts.align ?? "left",
        padding: opts.tight ? PAD_TIGHT : PAD,
      },
    },
  } as TReaderDocument[string];
}

function button(label: string, url: string) {
  return {
    type: "Button",
    data: {
      props: {
        text: label,
        url,
        buttonBackgroundColor: NAVY,
        buttonTextColor: "#ffffff",
        buttonStyle: "rounded",
        size: "medium",
        fullWidth: false,
      },
      style: { fontFamily: "MODERN_SANS", textAlign: "left", padding: PAD },
    },
  } as TReaderDocument[string];
}

function divider() {
  return {
    type: "Divider",
    data: {
      props: { lineColor: "#e2e8f0", lineHeight: 1 },
      style: { backgroundColor: null, padding: PAD },
    },
  } as TReaderDocument[string];
}

function spacer(height: number) {
  return { type: "Spacer", data: { props: { height } } } as TReaderDocument[string];
}

function footer() {
  return text("Dream Supreme Property Management · Real Estate Excellence", {
    fontSize: 12,
    color: "#94a3b8",
    align: "center",
  });
}

function brandRow() {
  return text("DREAM SUPREME PROPERTIES", {
    fontSize: 12,
    color: MUTED,
    tight: true,
  });
}

function assembleDocument(blocks: TReaderDocument[string][]): TReaderDocument {
  const document: TReaderDocument = {};
  const childrenIds: string[] = [];
  blocks.forEach((block, index) => {
    const id = `block_${index}`;
    document[id] = block;
    childrenIds.push(id);
  });
  document[ROOT_BLOCK_ID] = createRootBlock(childrenIds, DEFAULT_ROOT_STYLE);
  return document;
}

function buildTeamInvitationEmail(): TReaderDocument {
  return assembleDocument([
    brandRow(),
    heading("Team Invitation", { fontSize: "h2" }),
    divider(),
    spacer(8),
    text("Hello {{recipientName}},"),
    text("You have been invited to join {{agencyName}} in the role of {{role}}."),
    text("Click the button below to complete your registration and set up your account password:"),
    spacer(4),
    button("Complete Account Registration", "{{inviteUrl}}"),
    spacer(8),
    text("If the button above does not work, copy and paste this link into your browser:", {
      fontSize: 12,
      color: MUTED,
    }),
    text("{{inviteUrl}}", { fontSize: 12, color: LINK }),
    divider(),
    footer(),
  ]);
}

function buildDealNotificationEmail(): TReaderDocument {
  return assembleDocument([
    brandRow(),
    heading("{{eventSubject}}", { fontSize: "h2", color: NAVY }),
    spacer(4),
    text("{{eventBody}}"),
    spacer(4),
    button("View Deal Details", "{{dealLink}}"),
    divider(),
    footer(),
  ]);
}

function buildDailyDigestEmail(): TReaderDocument {
  return assembleDocument([
    brandRow(),
    heading("Your Daily Digest", { fontSize: "h2" }),
    divider(),
    spacer(8),
    text("Hello {{recipientName}},"),
    text("You have {{digestCount}} new updates today across your deals and tasks."),
    spacer(4),
    button("View All Notifications", "{{notificationsUrl}}"),
    divider(),
    footer(),
  ]);
}

function buildPasswordResetEmail(): TReaderDocument {
  return assembleDocument([
    brandRow(),
    heading("Reset your password", { fontSize: "h2" }),
    divider(),
    spacer(8),
    text("Hello {{recipientName}},"),
    text(
      "We received a request to reset the password for your Dream Supreme Properties account. Click the button below to choose a new one.",
    ),
    spacer(4),
    button("Reset Password", "{{resetUrl}}"),
    spacer(8),
    text("If you didn't request this, you can safely ignore this email.", {
      fontSize: 12,
      color: MUTED,
    }),
    divider(),
    footer(),
  ]);
}

// A neutral fallback for any email type without a bespoke layout above —
// one paragraph per sample field plus a button for the first URL-shaped
// field, so a newly-registered type still opens to something reasonable.
function buildGenericEmail(doc: EmailDocumentTypeDef): TReaderDocument {
  const entries = Object.entries(doc.sampleInput);
  const urlEntry = entries.find(([key]) => /url|link/i.test(key));
  const textEntries = entries.filter(([key]) => key !== urlEntry?.[0]);

  const blocks: TReaderDocument[string][] = [brandRow(), heading("Dream Supreme Properties")];
  textEntries.forEach(([key]) => blocks.push(text(`{{${key}}}`)));
  if (urlEntry) blocks.push(button("View details", `{{${urlEntry[0]}}}`));
  blocks.push(divider(), footer());
  return assembleDocument(blocks);
}

const BUILDERS: Record<string, () => TReaderDocument> = {
  team_invitation: buildTeamInvitationEmail,
  deal_notification: buildDealNotificationEmail,
  daily_notification_digest: buildDailyDigestEmail,
  password_reset: buildPasswordResetEmail,
};

// A fully laid-out starting point per real email type — matching copy, a
// call-to-action button, and a footer — rather than a generic stack of
// {{field}} placeholders, so an admin opens the designer to something that
// already reads like the actual email it replaces. Also serves as a
// reasonable fallback for any email type without bespoke copy yet.
export function buildDefaultEmailDocument(doc: EmailDocumentTypeDef): TReaderDocument {
  const builder = BUILDERS[doc.id];
  return builder ? builder() : buildGenericEmail(doc);
}
