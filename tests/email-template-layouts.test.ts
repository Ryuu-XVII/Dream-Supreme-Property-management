import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "@usewaypoint/email-builder";
import { EMAIL_DOCUMENT_TYPES } from "@/lib/email-document-types";
import { buildDefaultEmailDocument } from "@/lib/email-template-layouts";
import { mergeEmailDocument, mergeSubject } from "@/lib/email-merge";
import { ROOT_BLOCK_ID, addBlock, removeBlock, reorderBlocks } from "@/lib/email-blocks";

describe("default email template layouts", () => {
  for (const doc of EMAIL_DOCUMENT_TYPES) {
    it(`renders real, table-based HTML for ${doc.id}`, () => {
      const document = buildDefaultEmailDocument(doc);
      const merged = mergeEmailDocument(document, doc.sampleInput);
      const html = renderToStaticMarkup(merged, { rootBlockId: ROOT_BLOCK_ID });

      // Every {{field}} token was actually substituted with its sample value
      // (HTML-escaped, since the renderer correctly escapes text content).
      expect(html).not.toMatch(/\{\{\s*\w+\s*\}\}/);
      for (const value of Object.values(doc.sampleInput)) {
        const escaped = value.replace(/&/g, "&amp;");
        expect(html).toContain(escaped);
      }

      // react-email/EmailBuilder.js output is table-based with inline styles
      // — the whole point of using it over hand-rolled HTML — not <style>
      // blocks or class-based CSS that Gmail/Outlook strip.
      expect(html).toContain("<table");
      expect(html).not.toContain("<style");
    });

    it(`merges the subject line for ${doc.id}`, () => {
      const subject = mergeSubject(doc.defaultSubject, doc.sampleInput);
      expect(subject).not.toMatch(/\{\{\s*\w+\s*\}\}/);
    });
  }
});

describe("email block editing operations", () => {
  it("adds, reorders, and removes blocks without touching other content", () => {
    const doc = EMAIL_DOCUMENT_TYPES[0];
    let document = buildDefaultEmailDocument(doc);
    const before = document[ROOT_BLOCK_ID].data as { childrenIds: string[] };

    const added = addBlock(document, "Divider");
    document = added.document;
    const afterAdd = document[ROOT_BLOCK_ID].data as { childrenIds: string[] };
    expect(afterAdd.childrenIds.length).toBe(before.childrenIds.length + 1);
    expect(afterAdd.childrenIds.at(-1)).toBe(added.id);

    const reordered = [...afterAdd.childrenIds].reverse();
    document = reorderBlocks(document, reordered);
    expect((document[ROOT_BLOCK_ID].data as { childrenIds: string[] }).childrenIds).toEqual(
      reordered,
    );

    document = removeBlock(document, added.id);
    expect(document[added.id]).toBeUndefined();
    expect((document[ROOT_BLOCK_ID].data as { childrenIds: string[] }).childrenIds).not.toContain(
      added.id,
    );
  });
});
