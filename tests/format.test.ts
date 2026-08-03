import { describe, expect, it } from "vitest";
import {
  dateFmt,
  dateTimeFmt,
  daysUntil,
  initials,
  pct,
  relative,
  urgencyClass,
  urgencyOf,
  zar,
  zarCompact,
} from "@/lib/format";

describe("currency formatting (zar)", () => {
  it("formats cents to ZAR with 2 decimal places", () => {
    const formatted = zar(10000);
    expect(formatted).toMatch(/^R 100[.,]00$/);

    const formattedLarge = zar(123456);
    expect(formattedLarge).toMatch(/^R 1[\s\u00A0,]?234[.,]56$/);

    expect(zar(0)).toMatch(/^R 0[.,]00$/);
  });

  it("supports formatting without decimals when requested", () => {
    expect(zar(10000, { decimals: false })).toBe("R 100");
    expect(zar(123456, { decimals: false })).toMatch(/^R 1[\s\u00A0,]?235$/);
  });
});

describe("compact currency formatting (zarCompact)", () => {
  it("formats values under 1,000 rands", () => {
    expect(zarCompact(50000)).toBe("R 500");
  });

  it("formats values in thousands with 'k'", () => {
    expect(zarCompact(250000)).toBe("R 3k"); // 2500 rands
    expect(zarCompact(5000000)).toBe("R 50k"); // 50000 rands
  });

  it("formats values in millions with 'm'", () => {
    expect(zarCompact(250000000)).toBe("R 2.50m"); // 2,500,000 rands
  });
});

describe("percentage formatting (pct)", () => {
  it("converts basis points to formatted percentage string", () => {
    expect(pct(500)).toBe("5.00%");
    expect(pct(1525)).toBe("15.25%");
    expect(pct(0)).toBe("0.00%");
  });
});

describe("date formatting and calculations", () => {
  it("formats dates into standard display formats", () => {
    const d = new Date("2026-05-15T10:30:00Z");
    expect(dateFmt(d)).toMatch(/15 May 2026/);
    expect(dateTimeFmt(d)).toMatch(/15 May 2026/);
  });

  it("calculates days until a target date", () => {
    const today = new Date();
    const future = new Date(today);
    future.setDate(today.getDate() + 5);

    expect(daysUntil(future)).toBe(5);
  });

  it("calculates relative time string", () => {
    const today = new Date();
    const past = new Date(today);
    past.setDate(today.getDate() - 3);

    expect(relative(past)).toMatch(/3 days ago/);
  });
});

describe("urgency classification", () => {
  it("returns correct urgency status based on remaining days", () => {
    expect(urgencyOf(-1)).toBe("lapsed");
    expect(urgencyOf(0)).toBe("critical");
    expect(urgencyOf(3)).toBe("critical");
    expect(urgencyOf(4)).toBe("warning");
    expect(urgencyOf(7)).toBe("warning");
    expect(urgencyOf(8)).toBe("safe");
  });

  it("maps every urgency status to a Tailwind CSS class definition", () => {
    expect(urgencyClass.lapsed).toBeDefined();
    expect(urgencyClass.critical).toBeDefined();
    expect(urgencyClass.warning).toBeDefined();
    expect(urgencyClass.safe).toBeDefined();
  });
});

describe("initials extraction", () => {
  it("extracts up to 2 uppercase initials from a name string", () => {
    expect(initials("John Doe")).toBe("JD");
    expect(initials("alice smith")).toBe("AS");
    expect(initials("Single")).toBe("S");
    expect(initials("First Middle Last")).toBe("FM");
  });
});
