import { describe, expect, it } from "vitest";
import { renderErrorPage } from "@/lib/error-page";

describe("renderErrorPage fallback renderer", () => {
  it("generates a full HTML document string", () => {
    const html = renderErrorPage();
    expect(html).toContain("<!doctype html>");
    expect(html).toContain('<html lang="en">');
    expect(html).toContain("</html>");
  });

  it("includes expected user-friendly error title and messages", () => {
    const html = renderErrorPage();
    expect(html).toContain("This page didn't load");
    expect(html).toContain("Something went wrong on our end.");
  });

  it("contains recovery actions (reload and home link)", () => {
    const html = renderErrorPage();
    expect(html).toContain('onclick="location.reload()"');
    expect(html).toContain('href="/"');
  });
});
