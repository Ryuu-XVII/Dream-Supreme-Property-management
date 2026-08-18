import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  PROPERTY24_PROFILE_URL_SHAPE,
  parseAgentProfileUrl,
  parseFeedPage,
  parseProfile,
} from "../src/property24";

// Parsed against saved copies of real Property24 pages rather than hand-built
// markup, so the assertions describe what the site actually serves. Scripts
// and styles were stripped; the page footer was deliberately kept, because it
// is full of /for-sale/ links that the "areas serviced" parser must not sweep
// up.
const fixture = (name: string) => readFileSync(join(__dirname, "fixtures", name), "utf8");

const AGENT = parseAgentProfileUrl(
  "https://www.property24.com/estate-agents/dream-supreme-properties/william-brooks/67801",
);

describe("agent profile URLs", () => {
  it("derives the two listing feeds from a profile URL", () => {
    expect(AGENT).toEqual({
      agencySlug: "dream-supreme-properties",
      agentSlug: "william-brooks",
      agentId: "67801",
      profileUrl:
        "https://www.property24.com/estate-agents/dream-supreme-properties/william-brooks/67801",
      saleUrl:
        "https://www.property24.com/for-sale/agency/dream-supreme-properties/william-brooks/67801",
      rentUrl:
        "https://www.property24.com/to-rent/agency/dream-supreme-properties/william-brooks/67801",
    });
  });

  it("accepts the URL with or without the www host", () => {
    expect(
      PROPERTY24_PROFILE_URL_SHAPE.test("https://property24.com/estate-agents/agency/agent/1"),
    ).toBe(true);
  });

  it.each([
    // Another site entirely — this value reaches fetch(), so the shape check
    // is a security boundary and not only input tidying.
    "https://evil.example.com/estate-agents/agency/agent/1",
    "https://www.property24.com.evil.example.com/estate-agents/a/b/1",
    // Plain http, a listing URL rather than a profile, and a non-numeric id.
    "http://www.property24.com/estate-agents/agency/agent/1",
    "https://www.property24.com/for-sale/suburb/city/gauteng/1/2",
    "https://www.property24.com/estate-agents/agency/agent/not-a-number",
    "",
  ])("rejects %s", (url) => {
    expect(PROPERTY24_PROFILE_URL_SHAPE.test(url)).toBe(false);
    expect(() => parseAgentProfileUrl(url)).toThrow();
  });

  it("tolerates surrounding whitespace from a paste", () => {
    expect(
      parseAgentProfileUrl(
        "  https://www.property24.com/estate-agents/dream-supreme-properties/william-brooks/67801  ",
      ).agentId,
    ).toBe("67801");
  });
});

describe("parsing an agent profile page", () => {
  const profile = parseProfile(fixture("agent-profile.html"), AGENT);

  it("reads the practitioner's name and agency", () => {
    expect(profile.fullName).toBe("William Brooks");
    expect(profile.agencyName).toBe("Dream Supreme Properties");
  });

  it("reads the profile photo", () => {
    expect(profile.photoUrl).toMatch(/^https:\/\/images\.prop24\.com\//);
  });

  it("reads the areas serviced without sweeping up footer links", () => {
    // The footer carries dozens of /for-sale/ links; only the suburbs under
    // the "Areas Serviced" heading belong here.
    expect(profile.areasServiced).toEqual(["Akasia", "Pretoria", "Wonderboom"]);
  });

  it("carries the agent identity through", () => {
    expect(profile.agentId).toBe("67801");
    expect(profile.profileUrl).toBe(AGENT.profileUrl);
  });
});

describe("parsing a for-sale feed page", () => {
  const { listings, pageUrls } = parseFeedPage(fixture("for-sale-feed.html"), "sale");

  it("finds the result tiles", () => {
    expect(listings.length).toBeGreaterThan(5);
  });

  it("gives every listing an id, a Property24 URL and the requested purpose", () => {
    for (const listing of listings) {
      expect(listing.listing_number).toMatch(/^\d+$/);
      expect(listing.url).toMatch(/^https:\/\/www\.property24\.com\/for-sale\//);
      expect(listing.purpose).toBe("sale");
    }
  });

  it("reads a machine-readable price alongside the displayed one", () => {
    const priced = listings.filter((l) => l.price_zar !== null);
    expect(priced.length).toBeGreaterThan(0);
    for (const listing of priced) {
      expect(listing.price_zar).toBeGreaterThan(0);
      // The label keeps Property24's formatting; the number is what maths uses.
      expect(listing.price_label).toMatch(/^R/);
    }
  });

  it("resolves lazy-loaded images rather than storing the placeholder", () => {
    // Only the first few tiles carry a real `src`; the rest ship
    // src="/blank.gif" with the image in `lazy-src`. Reading `src` alone left
    // most listings with a broken thumbnail.
    const withImages = listings.filter((l) => l.image_url !== null);
    expect(withImages.length).toBe(listings.length);
    for (const listing of withImages) {
      expect(listing.image_url).toMatch(/^https:\/\/images\.prop24\.com\//);
      expect(listing.image_url).not.toContain("blank.gif");
    }
  });

  it("labels which size it read, since floor and erf size are different", () => {
    for (const listing of listings) {
      if (listing.size_label !== null) {
        expect(listing.size_kind).toMatch(/Floor Size|Erf Size/);
      }
    }
  });

  it("reads bedroom, bathroom and parking counts as numbers where present", () => {
    for (const listing of listings) {
      for (const value of [listing.bedrooms, listing.bathrooms, listing.parking]) {
        if (value !== null) {
          expect(Number.isFinite(value)).toBe(true);
          expect(value).toBeGreaterThanOrEqual(0);
        }
      }
    }
  });

  it("returns no listing twice", () => {
    const ids = listings.map((l) => l.listing_number);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("only follows pagination links that stay on Property24", () => {
    for (const href of pageUrls) {
      expect(href).toMatch(/^https:\/\/www\.property24\.com\//);
    }
  });

  it("parses a specific listing end to end", () => {
    const listing = listings.find((l) => l.bedrooms !== null && l.size_label !== null);
    expect(listing).toBeDefined();
    expect(listing).toMatchObject({
      purpose: "sale",
      agency_name: "Dream Supreme Properties",
    });
    expect(listing!.title).toBeTruthy();
    expect(listing!.location).toBeTruthy();
  });
});

describe("parsing a feed with no results", () => {
  it("returns nothing rather than throwing", () => {
    // An agent with no stock still returns HTTP 200 and a full page. Returning
    // an empty list here is what lets the Worker tell "no listings" apart from
    // a parser failure.
    const { listings, pageUrls } = parseFeedPage("<html><body></body></html>", "rent");
    expect(listings).toEqual([]);
    expect(pageUrls).toEqual([]);
  });
});
