import { Slider } from "@/components/ui/slider";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function SliderInput({
  label,
  value,
  onChange,
  min,
  max,
  step = 1,
  format = "zar",
  hint,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  min: number;
  max: number;
  step?: number;
  format?: "zar" | "pct" | "years" | "plain";
  hint?: string;
}) {
  const formatted = (() => {
    if (format === "zar") return `R ${value.toLocaleString("en-ZA")}`;
    if (format === "pct") return `${value.toFixed(2)}%`;
    if (format === "years") return `${value} yrs`;
    return `${value}`;
  })();

  return (
    <div className="space-y-2">
      <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-2">
        <Label className="min-w-0 truncate text-sm">{label}</Label>
        <span className="money shrink-0 text-sm font-semibold text-foreground">{formatted}</span>
      </div>
      <Slider
        value={[value]}
        min={min}
        max={max}
        step={step}
        onValueChange={([v]) => onChange(v)}
      />
      <div className="flex items-center justify-between gap-2">
        <span className="text-[11px] text-muted-foreground">
          {format === "zar"
            ? `R ${min.toLocaleString("en-ZA")}`
            : format === "pct"
              ? `${min}%`
              : `${min}`}
        </span>
        <Input
          type="number"
          value={value}
          min={min}
          max={max}
          step={step}
          onChange={(e) => {
            const n = Number(e.target.value);
            if (Number.isNaN(n)) return;
            onChange(Math.min(max, Math.max(min, n)));
          }}
          className="money h-8 w-28 text-right text-xs"
        />
        <span className="text-[11px] text-muted-foreground">
          {format === "zar"
            ? `R ${max.toLocaleString("en-ZA")}`
            : format === "pct"
              ? `${max}%`
              : `${max}`}
        </span>
      </div>
      {hint && <p className="text-[11px] text-muted-foreground">{hint}</p>}
    </div>
  );
}
