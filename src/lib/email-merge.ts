import type { TReaderDocument } from "@usewaypoint/email-builder";

// EmailBuilder.js has no built-in merge-field concept, so template text uses
// plain `{{key}}` tokens (same syntax the old markdown document_template
// system used) and this walks every block substituting them with real
// values. Only the props known to hold user-facing text are touched — style
// values are never templated.
export function mergeEmailDocument(
  document: TReaderDocument,
  values: Record<string, string>,
): TReaderDocument {
  const replace = (input: string) =>
    input.replace(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g, (match, key) =>
      key in values ? values[key] : match,
    );

  const next: TReaderDocument = structuredClone(document);
  for (const block of Object.values(next)) {
    const data = block.data as { props?: Record<string, unknown> };
    const props = data?.props;
    if (!props) continue;
    if (typeof props.text === "string") props.text = replace(props.text);
    if (typeof props.url === "string") props.url = replace(props.url);
    if (typeof props.linkHref === "string") props.linkHref = replace(props.linkHref);
    if (typeof props.alt === "string") props.alt = replace(props.alt);
  }
  return next;
}

export function mergeSubject(subject: string, values: Record<string, string>): string {
  return subject.replace(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g, (match, key) =>
    key in values ? values[key] : match,
  );
}

// An admin can freely delete or retype a block's `{{field}}` token while
// customizing — nothing else catches it, and the field just silently
// vanishes from the sent email at merge time. Called before save so that's
// found out then rather than the next time this type sends.
export function findMissingMergeFields(
  document: TReaderDocument,
  subject: string,
  sampleKeys: string[],
): string[] {
  const haystack: string[] = [subject];
  for (const block of Object.values(document)) {
    const props = (block.data as { props?: Record<string, unknown> })?.props;
    if (!props) continue;
    if (typeof props.text === "string") haystack.push(props.text);
    if (typeof props.url === "string") haystack.push(props.url);
    if (typeof props.linkHref === "string") haystack.push(props.linkHref);
    if (typeof props.alt === "string") haystack.push(props.alt);
  }
  const combined = haystack.join("\n");
  return sampleKeys.filter((key) => !new RegExp(`\\{\\{\\s*${key}\\s*\\}\\}`).test(combined));
}
