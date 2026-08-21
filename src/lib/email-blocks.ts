import type { TReaderDocument } from "@usewaypoint/email-builder";

export const ROOT_BLOCK_ID = "root";

export type EmailBlockType = "Heading" | "Text" | "Button" | "Image" | "Divider" | "Spacer";

export const EMAIL_BLOCK_LABELS: Record<EmailBlockType, string> = {
  Heading: "Heading",
  Text: "Paragraph",
  Button: "Button",
  Image: "Image",
  Divider: "Divider",
  Spacer: "Spacer",
};

export const FONT_FAMILY_OPTIONS = [
  { value: "MODERN_SANS", label: "Modern Sans" },
  { value: "BOOK_SANS", label: "Book Sans" },
  { value: "ORGANIC_SANS", label: "Organic Sans" },
  { value: "GEOMETRIC_SANS", label: "Geometric Sans" },
  { value: "HEAVY_SANS", label: "Heavy Sans" },
  { value: "ROUNDED_SANS", label: "Rounded Sans" },
  { value: "MODERN_SERIF", label: "Modern Serif" },
  { value: "BOOK_SERIF", label: "Book Serif" },
  { value: "MONOSPACE", label: "Monospace" },
] as const;

export interface RootStyle {
  backdropColor: string;
  canvasColor: string;
  textColor: string;
  fontFamily: string;
}

export const DEFAULT_ROOT_STYLE: RootStyle = {
  backdropColor: "#f1f5f9",
  canvasColor: "#ffffff",
  textColor: "#111827",
  fontFamily: "MODERN_SANS",
};

const PADDING = { top: 8, bottom: 8, right: 24, left: 24 };

function newId(): string {
  return crypto.randomUUID();
}

// Sensible defaults per block type, so dropping a new block onto the canvas
// already looks like something rather than an empty shell.
export function createBlock(type: EmailBlockType): TReaderDocument[string] {
  switch (type) {
    case "Heading":
      return {
        type: "Heading",
        data: {
          props: { text: "Heading", level: "h2" },
          style: {
            color: "#111827",
            backgroundColor: null,
            fontFamily: "MODERN_SANS",
            fontWeight: "bold",
            textAlign: "left",
            padding: PADDING,
          },
        },
      } as TReaderDocument[string];
    case "Text":
      return {
        type: "Text",
        data: {
          props: { text: "Add your text here.", markdown: false },
          style: {
            color: "#334155",
            backgroundColor: null,
            fontSize: 15,
            fontFamily: "MODERN_SANS",
            fontWeight: "normal",
            textAlign: "left",
            padding: PADDING,
          },
        },
      } as TReaderDocument[string];
    case "Button":
      return {
        type: "Button",
        data: {
          props: {
            text: "Click here",
            url: "https://example.com",
            buttonBackgroundColor: "#1e293b",
            buttonTextColor: "#ffffff",
            buttonStyle: "rounded",
            size: "medium",
            fullWidth: false,
          },
          style: { fontFamily: "MODERN_SANS", textAlign: "center", padding: PADDING },
        },
      } as TReaderDocument[string];
    case "Image":
      return {
        type: "Image",
        data: {
          props: {
            url: "https://placehold.co/560x200",
            alt: "Image",
            width: 560,
            height: null,
            linkHref: null,
            contentAlignment: "middle",
          },
          style: { backgroundColor: null, textAlign: "center", padding: PADDING },
        },
      } as TReaderDocument[string];
    case "Divider":
      return {
        type: "Divider",
        data: {
          props: { lineColor: "#e2e8f0", lineHeight: 1 },
          style: { backgroundColor: null, padding: PADDING },
        },
      } as TReaderDocument[string];
    case "Spacer":
      return { type: "Spacer", data: { props: { height: 16 } } } as TReaderDocument[string];
  }
}

function currentRootStyle(document: TReaderDocument): RootStyle {
  const data = document[ROOT_BLOCK_ID]?.data as Partial<RootStyle> | undefined;
  return {
    backdropColor: data?.backdropColor ?? DEFAULT_ROOT_STYLE.backdropColor,
    canvasColor: data?.canvasColor ?? DEFAULT_ROOT_STYLE.canvasColor,
    textColor: data?.textColor ?? DEFAULT_ROOT_STYLE.textColor,
    fontFamily: data?.fontFamily ?? DEFAULT_ROOT_STYLE.fontFamily,
  };
}

export function createRootBlock(
  childrenIds: string[],
  style: RootStyle = DEFAULT_ROOT_STYLE,
): TReaderDocument[string] {
  return {
    type: "EmailLayout",
    data: { ...style, childrenIds },
  } as TReaderDocument[string];
}

// Every block gets a fresh id, so the caller doesn't have to think about
// collisions when appending a block created elsewhere (e.g. duplicating one).
// These, and removeBlock/reorderBlocks below, all preserve the document's
// current root style (colors, font) rather than resetting it to defaults —
// createRootBlock alone can't know what the caller already customized.
export function addBlock(
  document: TReaderDocument,
  type: EmailBlockType,
  atIndex?: number,
): { document: TReaderDocument; id: string } {
  const id = newId();
  const root = document[ROOT_BLOCK_ID];
  const childrenIds = [...((root.data as { childrenIds: string[] }).childrenIds ?? [])];
  const insertAt = atIndex ?? childrenIds.length;
  childrenIds.splice(insertAt, 0, id);

  return {
    document: {
      ...document,
      [id]: createBlock(type),
      [ROOT_BLOCK_ID]: createRootBlock(childrenIds, currentRootStyle(document)),
    },
    id,
  };
}

export function removeBlock(document: TReaderDocument, id: string): TReaderDocument {
  const root = document[ROOT_BLOCK_ID];
  const childrenIds = ((root.data as { childrenIds: string[] }).childrenIds ?? []).filter(
    (c) => c !== id,
  );
  const next: TReaderDocument = {
    ...document,
    [ROOT_BLOCK_ID]: createRootBlock(childrenIds, currentRootStyle(document)),
  };
  delete next[id];
  return next;
}

export function reorderBlocks(document: TReaderDocument, childrenIds: string[]): TReaderDocument {
  return {
    ...document,
    [ROOT_BLOCK_ID]: createRootBlock(childrenIds, currentRootStyle(document)),
  };
}

export function updateRootStyle(document: TReaderDocument, patch: Partial<RootStyle>) {
  return {
    ...document,
    [ROOT_BLOCK_ID]: createRootBlock(rootChildrenIds(document), {
      ...currentRootStyle(document),
      ...patch,
    }),
  };
}

export function updateBlock(
  document: TReaderDocument,
  id: string,
  block: TReaderDocument[string],
): TReaderDocument {
  return { ...document, [id]: block };
}

export function rootChildrenIds(document: TReaderDocument): string[] {
  const root = document[ROOT_BLOCK_ID];
  return (root?.data as { childrenIds?: string[] })?.childrenIds ?? [];
}

export function getRootStyle(document: TReaderDocument): RootStyle {
  return currentRootStyle(document);
}
