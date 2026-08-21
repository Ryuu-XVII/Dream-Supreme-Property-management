import { useEffect, useMemo, useState } from "react";
import { DndContext, closestCenter, type DragEndEvent } from "@dnd-kit/core";
import {
  SortableContext,
  verticalListSortingStrategy,
  useSortable,
  arrayMove,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import type { TReaderDocument } from "@usewaypoint/email-builder";
import { renderToStaticMarkup } from "@usewaypoint/email-builder";
import {
  GripVertical,
  Heading as HeadingIcon,
  Image as ImageIcon,
  MinusSquare,
  MousePointerClick,
  Plus,
  Rows3,
  Trash2,
  Type,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { GlassCard } from "@/components/ui-kit";
import {
  ROOT_BLOCK_ID,
  addBlock,
  removeBlock,
  reorderBlocks,
  rootChildrenIds,
  updateBlock,
  updateRootStyle,
  getRootStyle,
  EMAIL_BLOCK_LABELS,
  FONT_FAMILY_OPTIONS,
  type EmailBlockType,
} from "@/lib/email-blocks";

const BLOCK_TYPES: EmailBlockType[] = ["Heading", "Text", "Button", "Image", "Divider", "Spacer"];

const BLOCK_ICONS: Record<EmailBlockType, React.ComponentType<{ className?: string }>> = {
  Heading: HeadingIcon,
  Text: Type,
  Button: MousePointerClick,
  Image: ImageIcon,
  Divider: MinusSquare,
  Spacer: Rows3,
};

type Padding = { top: number; bottom: number; left: number; right: number };
const DEFAULT_PADDING: Padding = { top: 8, bottom: 8, left: 24, right: 24 };

function blockPreviewText(block: TReaderDocument[string]): string {
  const props = (block.data as { props?: Record<string, unknown> })?.props ?? {};
  if (typeof props.text === "string") return props.text;
  if (block.type === "Image") return (props.url as string) ?? "Image";
  if (block.type === "Divider") return "Horizontal rule";
  if (block.type === "Spacer") return `${(props.height as number) ?? 16}px spacing`;
  return block.type;
}

function SortableRow({
  id,
  block,
  selected,
  onSelect,
  onDelete,
}: {
  id: string;
  block: TReaderDocument[string];
  selected: boolean;
  onSelect: () => void;
  onDelete: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id,
  });
  const Icon = BLOCK_ICONS[block.type as EmailBlockType] ?? Type;

  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={`flex items-center gap-2 rounded-lg border px-2 py-2 ${
        selected ? "border-primary bg-primary/5" : "border-border/60"
      } ${isDragging ? "opacity-50" : ""}`}
    >
      <button
        type="button"
        className="cursor-grab touch-none text-muted-foreground"
        {...attributes}
        {...listeners}
      >
        <GripVertical className="size-4" />
      </button>
      <button type="button" className="flex min-w-0 flex-1 items-center gap-2" onClick={onSelect}>
        <Icon className="size-4 shrink-0 text-primary" />
        <span className="truncate text-sm">{blockPreviewText(block)}</span>
      </button>
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="size-7 shrink-0 text-muted-foreground hover:text-destructive"
        onClick={onDelete}
      >
        <Trash2 className="size-3.5" />
      </Button>
    </div>
  );
}

function FieldRow({
  label,
  children,
  span,
}: {
  label: string;
  children: React.ReactNode;
  span?: boolean;
}) {
  return (
    <div className={`space-y-1 ${span ? "sm:col-span-2" : ""}`}>
      <Label className="text-xs">{label}</Label>
      {children}
    </div>
  );
}

function AlignSelect({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger>
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="left">Left</SelectItem>
        <SelectItem value="center">Center</SelectItem>
        <SelectItem value="right">Right</SelectItem>
      </SelectContent>
    </Select>
  );
}

function FontFamilySelect({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger>
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {FONT_FAMILY_OPTIONS.map((f) => (
          <SelectItem key={f.value} value={f.value}>
            {f.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

function PaddingFields({
  value,
  onChange,
}: {
  value: Partial<Padding> | null | undefined;
  onChange: (padding: Padding) => void;
}) {
  const padding = { ...DEFAULT_PADDING, ...value };
  const set = (side: keyof Padding, amount: number) => onChange({ ...padding, [side]: amount });

  return (
    <FieldRow label="Padding (px)" span>
      <div className="grid grid-cols-4 gap-2">
        {(["top", "right", "bottom", "left"] as const).map((side) => (
          <div key={side}>
            <span className="mb-1 block text-[10px] uppercase text-muted-foreground">{side}</span>
            <Input
              type="number"
              min={0}
              value={padding[side]}
              onChange={(e) => set(side, Number(e.target.value))}
            />
          </div>
        ))}
      </div>
    </FieldRow>
  );
}

function ColorField({
  label,
  value,
  fallback,
  onChange,
}: {
  label: string;
  value: string | null | undefined;
  fallback: string;
  onChange: (color: string) => void;
}) {
  const current = value ?? fallback;
  return (
    <FieldRow label={label}>
      <div className="flex items-center gap-2">
        <input
          type="color"
          value={/^#[0-9a-fA-F]{6}$/.test(current) ? current : fallback}
          onChange={(e) => onChange(e.target.value)}
          className="h-9 w-10 shrink-0 cursor-pointer rounded-md border border-input bg-transparent p-0.5"
        />
        <Input value={current} onChange={(e) => onChange(e.target.value)} />
      </div>
    </FieldRow>
  );
}

function BlockProperties({
  block,
  onChange,
}: {
  block: TReaderDocument[string];
  onChange: (block: TReaderDocument[string]) => void;
}) {
  const data = block.data as { props?: any; style?: any };
  const props = data.props ?? {};
  const style = data.style ?? {};

  const setProp = (key: string, value: unknown) =>
    onChange({ ...block, data: { ...data, props: { ...props, [key]: value } } } as any);
  const setStyle = (key: string, value: unknown) =>
    onChange({ ...block, data: { ...data, style: { ...style, [key]: value } } } as any);

  switch (block.type) {
    case "Heading":
      return (
        <div className="grid gap-3 sm:grid-cols-2">
          <FieldRow label="Text" span>
            <Input value={props.text ?? ""} onChange={(e) => setProp("text", e.target.value)} />
          </FieldRow>
          <FieldRow label="Level (size)">
            <Select value={props.level ?? "h2"} onValueChange={(v) => setProp("level", v)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="h1">H1 — Largest</SelectItem>
                <SelectItem value="h2">H2 — Medium</SelectItem>
                <SelectItem value="h3">H3 — Smallest</SelectItem>
              </SelectContent>
            </Select>
          </FieldRow>
          <FieldRow label="Weight">
            <Select
              value={style.fontWeight ?? "bold"}
              onValueChange={(v) => setStyle("fontWeight", v)}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="normal">Normal</SelectItem>
                <SelectItem value="bold">Bold</SelectItem>
              </SelectContent>
            </Select>
          </FieldRow>
          <FieldRow label="Font family">
            <FontFamilySelect
              value={style.fontFamily ?? "MODERN_SANS"}
              onChange={(v) => setStyle("fontFamily", v)}
            />
          </FieldRow>
          <FieldRow label="Text align">
            <AlignSelect
              value={style.textAlign ?? "left"}
              onChange={(v) => setStyle("textAlign", v)}
            />
          </FieldRow>
          <ColorField
            label="Text color"
            value={style.color}
            fallback="#111827"
            onChange={(v) => setStyle("color", v)}
          />
          <ColorField
            label="Background color"
            value={style.backgroundColor}
            fallback="#ffffff"
            onChange={(v) => setStyle("backgroundColor", v)}
          />
          <PaddingFields value={style.padding} onChange={(p) => setStyle("padding", p)} />
        </div>
      );
    case "Text":
      return (
        <div className="grid gap-3 sm:grid-cols-2">
          <FieldRow label="Text" span>
            <Textarea
              rows={3}
              value={props.text ?? ""}
              onChange={(e) => setProp("text", e.target.value)}
            />
          </FieldRow>
          <FieldRow label="Font size (px)">
            <Input
              type="number"
              min={8}
              value={style.fontSize ?? 15}
              onChange={(e) => setStyle("fontSize", Number(e.target.value))}
            />
          </FieldRow>
          <FieldRow label="Weight">
            <Select
              value={style.fontWeight ?? "normal"}
              onValueChange={(v) => setStyle("fontWeight", v)}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="normal">Normal</SelectItem>
                <SelectItem value="bold">Bold</SelectItem>
              </SelectContent>
            </Select>
          </FieldRow>
          <FieldRow label="Font family">
            <FontFamilySelect
              value={style.fontFamily ?? "MODERN_SANS"}
              onChange={(v) => setStyle("fontFamily", v)}
            />
          </FieldRow>
          <FieldRow label="Text align">
            <AlignSelect
              value={style.textAlign ?? "left"}
              onChange={(v) => setStyle("textAlign", v)}
            />
          </FieldRow>
          <ColorField
            label="Text color"
            value={style.color}
            fallback="#334155"
            onChange={(v) => setStyle("color", v)}
          />
          <ColorField
            label="Background color"
            value={style.backgroundColor}
            fallback="#ffffff"
            onChange={(v) => setStyle("backgroundColor", v)}
          />
          <PaddingFields value={style.padding} onChange={(p) => setStyle("padding", p)} />
        </div>
      );
    case "Button":
      return (
        <div className="grid gap-3 sm:grid-cols-2">
          <FieldRow label="Button text">
            <Input value={props.text ?? ""} onChange={(e) => setProp("text", e.target.value)} />
          </FieldRow>
          <FieldRow label="URL">
            <Input value={props.url ?? ""} onChange={(e) => setProp("url", e.target.value)} />
          </FieldRow>
          <FieldRow label="Size">
            <Select value={props.size ?? "medium"} onValueChange={(v) => setProp("size", v)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="x-small">X-Small</SelectItem>
                <SelectItem value="small">Small</SelectItem>
                <SelectItem value="medium">Medium</SelectItem>
                <SelectItem value="large">Large</SelectItem>
              </SelectContent>
            </Select>
          </FieldRow>
          <FieldRow label="Shape">
            <Select
              value={props.buttonStyle ?? "rounded"}
              onValueChange={(v) => setProp("buttonStyle", v)}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="rectangle">Rectangle</SelectItem>
                <SelectItem value="rounded">Rounded</SelectItem>
                <SelectItem value="pill">Pill</SelectItem>
              </SelectContent>
            </Select>
          </FieldRow>
          <ColorField
            label="Background color"
            value={props.buttonBackgroundColor}
            fallback="#1e293b"
            onChange={(v) => setProp("buttonBackgroundColor", v)}
          />
          <ColorField
            label="Text color"
            value={props.buttonTextColor}
            fallback="#ffffff"
            onChange={(v) => setProp("buttonTextColor", v)}
          />
          <FieldRow label="Font family">
            <FontFamilySelect
              value={style.fontFamily ?? "MODERN_SANS"}
              onChange={(v) => setStyle("fontFamily", v)}
            />
          </FieldRow>
          <FieldRow label="Alignment">
            <AlignSelect
              value={style.textAlign ?? "left"}
              onChange={(v) => setStyle("textAlign", v)}
            />
          </FieldRow>
          <FieldRow label="Full width">
            <Switch checked={!!props.fullWidth} onCheckedChange={(v) => setProp("fullWidth", v)} />
          </FieldRow>
          <PaddingFields value={style.padding} onChange={(p) => setStyle("padding", p)} />
        </div>
      );
    case "Image":
      return (
        <div className="grid gap-3 sm:grid-cols-2">
          <FieldRow label="Image URL" span>
            <Input value={props.url ?? ""} onChange={(e) => setProp("url", e.target.value)} />
          </FieldRow>
          <FieldRow label="Alt text">
            <Input value={props.alt ?? ""} onChange={(e) => setProp("alt", e.target.value)} />
          </FieldRow>
          <FieldRow label="Link URL (optional)">
            <Input
              value={props.linkHref ?? ""}
              onChange={(e) => setProp("linkHref", e.target.value)}
            />
          </FieldRow>
          <FieldRow label="Width (px)">
            <Input
              type="number"
              min={1}
              value={props.width ?? 560}
              onChange={(e) => setProp("width", Number(e.target.value))}
            />
          </FieldRow>
          <FieldRow label="Height (px, blank = auto)">
            <Input
              type="number"
              min={1}
              value={props.height ?? ""}
              onChange={(e) =>
                setProp("height", e.target.value === "" ? null : Number(e.target.value))
              }
            />
          </FieldRow>
          <FieldRow label="Alignment">
            <AlignSelect
              value={style.textAlign ?? "center"}
              onChange={(v) => setStyle("textAlign", v)}
            />
          </FieldRow>
          <ColorField
            label="Background color"
            value={style.backgroundColor}
            fallback="#ffffff"
            onChange={(v) => setStyle("backgroundColor", v)}
          />
          <PaddingFields value={style.padding} onChange={(p) => setStyle("padding", p)} />
        </div>
      );
    case "Divider":
      return (
        <div className="grid gap-3 sm:grid-cols-2">
          <ColorField
            label="Line color"
            value={props.lineColor}
            fallback="#e2e8f0"
            onChange={(v) => setProp("lineColor", v)}
          />
          <FieldRow label="Thickness (px)">
            <Input
              type="number"
              min={1}
              value={props.lineHeight ?? 1}
              onChange={(e) => setProp("lineHeight", Number(e.target.value))}
            />
          </FieldRow>
          <ColorField
            label="Background color"
            value={style.backgroundColor}
            fallback="#ffffff"
            onChange={(v) => setStyle("backgroundColor", v)}
          />
          <PaddingFields value={style.padding} onChange={(p) => setStyle("padding", p)} />
        </div>
      );
    case "Spacer":
      return (
        <div className="grid gap-3 sm:grid-cols-2">
          <FieldRow label="Height (px)">
            <Input
              type="number"
              min={1}
              value={props.height ?? 16}
              onChange={(e) => setProp("height", Number(e.target.value))}
            />
          </FieldRow>
        </div>
      );
    default:
      return null;
  }
}

function EmailSettingsPanel({
  document,
  onChange,
}: {
  document: TReaderDocument;
  onChange: (document: TReaderDocument) => void;
}) {
  const rootStyle = getRootStyle(document);

  return (
    <GlassCard>
      <h3 className="mb-3 font-display text-sm font-semibold">Email settings</h3>
      <div className="grid gap-3 sm:grid-cols-2">
        <ColorField
          label="Page background"
          value={rootStyle.backdropColor}
          fallback="#f1f5f9"
          onChange={(v) => onChange(updateRootStyle(document, { backdropColor: v }))}
        />
        <ColorField
          label="Email card background"
          value={rootStyle.canvasColor}
          fallback="#ffffff"
          onChange={(v) => onChange(updateRootStyle(document, { canvasColor: v }))}
        />
        <ColorField
          label="Base text color"
          value={rootStyle.textColor}
          fallback="#111827"
          onChange={(v) => onChange(updateRootStyle(document, { textColor: v }))}
        />
        <FieldRow label="Font family">
          <FontFamilySelect
            value={rootStyle.fontFamily}
            onChange={(v) => onChange(updateRootStyle(document, { fontFamily: v }))}
          />
        </FieldRow>
      </div>
    </GlassCard>
  );
}

export function EmailTemplateEditor({
  subject,
  document,
  onChange,
  previewValues,
}: {
  subject: string;
  document: TReaderDocument;
  onChange: (next: { subject: string; document: TReaderDocument }) => void;
  previewValues: Record<string, string>;
}) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const childrenIds = rootChildrenIds(document);

  // Recomputing the preview means a structuredClone + full block walk +
  // renderToStaticMarkup (React's server renderer), and every change reloads
  // the <iframe> from scratch (a real navigation, not a cheap DOM patch) —
  // doing that on every keystroke made typing in a text field feel laggy.
  // Debouncing means the block list and property panel still update
  // instantly (they read `document` directly), only the preview pane lags
  // slightly behind while the admin is actively typing.
  const [debouncedDocument, setDebouncedDocument] = useState(document);
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedDocument(document), 300);
    return () => clearTimeout(timer);
  }, [document]);

  const previewHtml = useMemo(() => {
    // Live preview substitutes sample values so an admin sees roughly what a
    // real send will look like, without needing to wire real data here.
    let doc = debouncedDocument;
    try {
      const merged: TReaderDocument = structuredClone(debouncedDocument);
      for (const block of Object.values(merged)) {
        const props = (block.data as { props?: Record<string, unknown> })?.props;
        if (props && typeof props.text === "string") {
          props.text = props.text.replace(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g, (m, key) =>
            key in previewValues ? previewValues[key] : m,
          );
        }
        if (props && typeof props.url === "string") {
          props.url = props.url.replace(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g, (m, key) =>
            key in previewValues ? previewValues[key] : m,
          );
        }
      }
      doc = merged;
    } catch {
      // Fall back to the unmerged document if anything goes wrong.
    }
    return renderToStaticMarkup(doc, { rootBlockId: ROOT_BLOCK_ID });
  }, [debouncedDocument, previewValues]);

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = childrenIds.indexOf(String(active.id));
    const newIndex = childrenIds.indexOf(String(over.id));
    if (oldIndex === -1 || newIndex === -1) return;
    onChange({
      subject,
      document: reorderBlocks(document, arrayMove(childrenIds, oldIndex, newIndex)),
    });
  }

  function handleAddBlock(type: EmailBlockType) {
    const { document: next, id } = addBlock(document, type);
    onChange({ subject, document: next });
    setSelectedId(id);
  }

  function handleDeleteBlock(id: string) {
    onChange({ subject, document: removeBlock(document, id) });
    if (selectedId === id) setSelectedId(null);
  }

  const selectedBlock = selectedId ? document[selectedId] : undefined;

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_1fr]">
      <div className="space-y-4">
        <GlassCard>
          <Label htmlFor="email-subject">Subject line</Label>
          <Input
            id="email-subject"
            className="mt-1"
            value={subject}
            onChange={(e) => onChange({ subject: e.target.value, document })}
            placeholder="e.g. You've been invited to join {{agencyName}}"
          />
        </GlassCard>

        <EmailSettingsPanel
          document={document}
          onChange={(next) => onChange({ subject, document: next })}
        />

        <GlassCard>
          <div className="mb-3 flex items-center justify-between">
            <h3 className="font-display text-sm font-semibold">Blocks</h3>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button size="sm" variant="outline">
                  <Plus className="mr-1.5 size-3.5" /> Add block
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                {BLOCK_TYPES.map((type) => (
                  <DropdownMenuItem key={type} onClick={() => handleAddBlock(type)}>
                    {EMAIL_BLOCK_LABELS[type]}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>

          {childrenIds.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">
              No blocks yet — add one above.
            </p>
          ) : (
            <DndContext collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
              <SortableContext items={childrenIds} strategy={verticalListSortingStrategy}>
                <div className="space-y-2">
                  {childrenIds.map((id) => (
                    <SortableRow
                      key={id}
                      id={id}
                      block={document[id]}
                      selected={id === selectedId}
                      onSelect={() => setSelectedId(id === selectedId ? null : id)}
                      onDelete={() => handleDeleteBlock(id)}
                    />
                  ))}
                </div>
              </SortableContext>
            </DndContext>
          )}
        </GlassCard>

        {selectedBlock && selectedId && (
          <GlassCard>
            <h3 className="mb-3 font-display text-sm font-semibold">
              {EMAIL_BLOCK_LABELS[selectedBlock.type as EmailBlockType] ?? selectedBlock.type}{" "}
              properties
            </h3>
            <BlockProperties
              block={selectedBlock}
              onChange={(next) =>
                onChange({ subject, document: updateBlock(document, selectedId, next) })
              }
            />
          </GlassCard>
        )}
      </div>

      <GlassCard className="p-0">
        <div className="border-b border-border px-4 py-2 text-xs font-medium text-muted-foreground">
          Live preview (sample data)
        </div>
        <iframe
          title="Email preview"
          srcDoc={previewHtml}
          sandbox=""
          className="h-[70vh] w-full rounded-b-lg"
        />
      </GlassCard>
    </div>
  );
}
