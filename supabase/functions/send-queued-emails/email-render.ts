// Deno can't resolve this project's Vite `@/` path aliases, and Supabase
// Edge Functions bundle only what a function actually imports, so this is a
// deliberate, self-contained duplicate of the template logic in
// src/lib/email-blocks.ts, src/lib/email-template-layouts.ts,
// src/lib/email-merge.ts, and src/lib/email-document-types.ts — kept
// runnable under Deno via npm: specifiers instead of cross-importing the
// frontend source tree. If you change the default layout, block shape, or
// merge-field behavior for any email type over there, mirror the change
// here too, or the admin's saved templates and this render path will drift
// apart the exact way this file was written to stop happening.
import type { TReaderDocument } from "npm:@usewaypoint/email-builder@0.0.9";
import { renderToStaticMarkup } from "npm:@usewaypoint/email-builder@0.0.9";

export const ROOT_BLOCK_ID = "root";

interface RootStyle {
  backdropColor: string;
  canvasColor: string;
  textColor: string;
  fontFamily: string;
}

const DEFAULT_ROOT_STYLE: RootStyle = {
  backdropColor: "#f1f5f9",
  canvasColor: "#ffffff",
  textColor: "#111827",
  fontFamily: "MODERN_SANS",
};

function createRootBlock(childrenIds: string[], style: RootStyle): TReaderDocument[string] {
  return { type: "EmailLayout", data: { ...style, childrenIds } } as TReaderDocument[string];
}

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
  return text("DREAM SUPREME PROPERTIES", { fontSize: 12, color: MUTED, tight: true });
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

const DEFAULT_SUBJECTS: Record<string, string> = {
  team_invitation: "You've been invited to join {{agencyName}}",
  deal_notification: "{{eventSubject}}",
  daily_notification_digest: "Daily Digest - Dream Supreme Properties",
};

const BUILDERS: Record<string, () => TReaderDocument> = {
  team_invitation: buildTeamInvitationEmail,
  deal_notification: buildDealNotificationEmail,
  daily_notification_digest: buildDailyDigestEmail,
};

function buildDefaultEmailDocument(emailType: string): TReaderDocument {
  const builder = BUILDERS[emailType];
  if (!builder) throw new Error(`No default layout for email type: ${emailType}`);
  return builder();
}

function replaceTokens(input: string, values: Record<string, string>): string {
  return input.replace(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g, (match, key) =>
    key in values ? values[key] : match,
  );
}

function mergeEmailDocument(
  document: TReaderDocument,
  values: Record<string, string>,
): TReaderDocument {
  const next: TReaderDocument = structuredClone(document);
  for (const block of Object.values(next)) {
    const data = block.data as { props?: Record<string, unknown> };
    const props = data?.props;
    if (!props) continue;
    if (typeof props.text === "string") props.text = replaceTokens(props.text, values);
    if (typeof props.url === "string") props.url = replaceTokens(props.url, values);
    if (typeof props.linkHref === "string") props.linkHref = replaceTokens(props.linkHref, values);
    if (typeof props.alt === "string") props.alt = replaceTokens(props.alt, values);
  }
  return next;
}

interface SavedTemplate {
  subject: string;
  document: TReaderDocument;
}

// Looks up the agency's saved template for `emailType`, falls back to the
// built-in default layout when nothing has been customized, merges
// `mergeValues` into both subject and body, and renders final send-ready
// HTML. Throws if `emailType` isn't a known type or rendering fails — the
// caller falls back to the queue row's plain `subject`/`body_html` so a bug
// in a custom template (or an unrecognized type) never blocks delivery.
export async function renderTemplatedEmail(
  fetchSavedTemplate: () => Promise<SavedTemplate | null>,
  emailType: string,
  mergeValues: Record<string, string>,
): Promise<{ subject: string; html: string }> {
  const saved = await fetchSavedTemplate();
  const subjectSource = saved?.subject ?? DEFAULT_SUBJECTS[emailType];
  if (subjectSource === undefined) throw new Error(`Unknown email type: ${emailType}`);
  const document = saved?.document ?? buildDefaultEmailDocument(emailType);

  const mergedDocument = mergeEmailDocument(document, mergeValues);
  const mergedSubject = replaceTokens(subjectSource, mergeValues);
  const html = renderToStaticMarkup(mergedDocument, { rootBlockId: ROOT_BLOCK_ID });
  return { subject: mergedSubject, html };
}
