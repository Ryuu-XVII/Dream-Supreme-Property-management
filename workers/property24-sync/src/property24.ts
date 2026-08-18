// Fetches and parses an agent's public Property24 estate-agent profile and
// their live sale/rental listings.
//
// SERVER-ONLY. This must never be imported into a browser bundle: Property24
// sends no CORS headers, so a fetch from the page is blocked outright, and
// the caller here is trusted to have already authorized the request.
//
// It also has to run from Cloudflare specifically. Property24 serves its own
// branded "Server unavailable" 503 page to some cloud egress — Supabase Edge
// Functions are refused outright — while Cloudflare Workers are served
// normally. That is why this lives in a TanStack Start server route rather
// than in supabase/functions/.
//
// Nothing here logs in, solves CAPTCHAs, or retries past a refusal. Only
// public pages are read, at a deliberately conservative rate.
import * as cheerio from "cheerio";

const P24_ORIGIN = "https://www.property24.com";
const ALLOWED_HOSTS = new Set(["property24.com", "www.property24.com"]);

export const PROPERTY24_PROFILE_URL_SHAPE =
  /^https:\/\/(www\.)?property24\.com\/estate-agents\/[^/]+\/[^/]+\/\d+$/;

const PAGE_DELAY_MS = 750;
const MAX_PAGES_PER_FEED = 25;
const FETCH_TIMEOUT_MS = 20_000;
const FETCH_RETRIES = 1;

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
const clean = (value: string | undefined | null) => (value ?? "").replace(/\s+/g, " ").trim();

export interface AgentRef {
  agencySlug: string;
  agentSlug: string;
  agentId: string;
  profileUrl: string;
  saleUrl: string;
  rentUrl: string;
}

export function parseAgentProfileUrl(input: string): AgentRef {
  const trimmed = input.trim();
  if (!PROPERTY24_PROFILE_URL_SHAPE.test(trimmed)) {
    throw new Error(
      "Expected a Property24 agent profile URL like https://www.property24.com/estate-agents/{agency}/{agent}/{id}.",
    );
  }
  const [agencySlug, agentSlug, agentId] = new URL(trimmed).pathname
    .split("/")
    .filter(Boolean)
    .slice(1);
  const suffix = `${agencySlug}/${agentSlug}/${agentId}`;
  return {
    agencySlug,
    agentSlug,
    agentId,
    profileUrl: `${P24_ORIGIN}/estate-agents/${suffix}`,
    saleUrl: `${P24_ORIGIN}/for-sale/agency/${suffix}`,
    rentUrl: `${P24_ORIGIN}/to-rent/agency/${suffix}`,
  };
}

async function fetchHtml(url: string): Promise<string> {
  // Re-check the host on every hop: page 2+ URLs come out of fetched HTML, so
  // they are attacker-influenced in the same way the original input is.
  if (!ALLOWED_HOSTS.has(new URL(url).hostname.toLowerCase())) {
    throw new Error("Refusing to fetch a non-Property24 URL.");
  }

  for (let attempt = 0; attempt <= FETCH_RETRIES; attempt += 1) {
    const response = await fetch(url, {
      redirect: "follow",
      headers: {
        "user-agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 " +
          "(KHTML, like Gecko) Chrome/124.0 Safari/537.36 DreamSupremeAgentSync/1.0",
        accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "accept-language": "en-ZA,en;q=0.9",
      },
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    });

    if (response.ok) return response.text();
    await response.body?.cancel();

    // Never try to work around a refusal.
    if (response.status === 401 || response.status === 403) {
      throw new Error(`Property24 refused the request (HTTP ${response.status}).`);
    }

    const retryable = [429, 500, 502, 503, 504].includes(response.status);
    if (attempt === FETCH_RETRIES || !retryable) {
      if (response.status === 503) {
        throw new Error(
          "Property24 is not serving requests from this server (HTTP 503). This is usually " +
            "Property24 declining automated traffic from cloud hosting rather than an outage.",
        );
      }
      throw new Error(`Property24 returned HTTP ${response.status}.`);
    }

    const retryAfter = Number(response.headers.get("retry-after"));
    await sleep(
      Number.isFinite(retryAfter) && retryAfter > 0 ? retryAfter * 1000 : 1000 * (attempt + 1),
    );
  }

  throw new Error(`Unable to fetch ${url}`);
}

export interface Property24Profile {
  fullName: string | null;
  photoUrl: string | null;
  agencyName: string | null;
  bio: string | null;
  areasServiced: string[];
  profileUrl: string;
  agentId: string;
}

// The suburbs an agent works are listed under an "Areas Serviced" heading, in
// the sibling rows that follow it up to the next heading. Both halves of that
// are needed: the page footer is full of `/for-sale/...` links that would
// otherwise be swept up as areas.
function parseAreasServiced($: cheerio.CheerioAPI): string[] {
  const heading = $("h5")
    .toArray()
    .find((el) => clean($(el).text()).toLowerCase() === "areas serviced");
  if (!heading) return [];

  const names: string[] = [];
  let row = $(heading).closest(".row").next(".row");
  while (row.length > 0 && row.find("h5").length === 0) {
    row.find('a[href^="/for-sale/"]').each((_, anchor) => {
      const name = clean($(anchor).text());
      if (name) names.push(name);
    });
    row = row.next(".row");
  }
  return [...new Set(names)];
}

function parseProfile(html: string, agent: AgentRef): Property24Profile {
  const $ = cheerio.load(html);
  // e.g. "Aaron Fanie Sithabela | Real Estate Services | Property24"
  const metaTitle = clean($('meta[name="title"]').attr("content"));

  return {
    fullName: clean($("h1").first().text()) || null,
    photoUrl: $('meta[property="og:image"]').attr("content") ?? null,
    agencyName: metaTitle.split("|")[1]?.trim() || null,
    // The blurb is rendered twice — collapsed and expanded — by Property24's
    // "Read More" widget; the expanded copy is the complete text.
    bio:
      clean($(".js_readMoreContainer .js_expandedText").first().text()) ||
      clean($(".js_readMoreContainer .js_visibleText").first().text()) ||
      null,
    areasServiced: parseAreasServiced($),
    profileUrl: agent.profileUrl,
    agentId: agent.agentId,
  };
}

export interface Property24ListingRow {
  listing_number: string;
  purpose: "sale" | "rent";
  url: string;
  title: string | null;
  location: string | null;
  excerpt: string | null;
  price_zar: number | null;
  price_label: string | null;
  image_url: string | null;
  bedrooms: number | null;
  bathrooms: number | null;
  parking: number | null;
  size_label: string | null;
  size_kind: string | null;
  agency_name: string | null;
}

type Tile = ReturnType<cheerio.CheerioAPI>;

// Property24 lazy-loads result images: only the first few tiles carry the real
// URL in `src`, and every tile below the fold ships `src="/blank.gif"` with the
// actual image in `lazy-src`. Reading `src` alone stored the placeholder for
// most listings, so they rendered as broken thumbnails.
function tileImageUrl(tile: Tile): string | null {
  const image = tile.find('img[itemprop="image"]').first();
  for (const attribute of ["lazy-src", "data-src", "data-original", "src"]) {
    const value = clean(image.attr(attribute));
    if (!value || value.includes("blank.gif")) continue;
    try {
      return new URL(value, P24_ORIGIN).toString();
    } catch {
      // Malformed candidate — fall through to the next attribute.
    }
  }
  return null;
}

function featureNumber(tile: Tile, title: string): number | null {
  const raw = clean(tile.find(`.p24_featureDetails[title="${title}"] span`).first().text());
  if (!raw) return null;
  const value = Number(raw.replace(/[^\d.]/g, ""));
  return Number.isFinite(value) ? value : null;
}

// Property24's result tiles carry schema.org microdata and stable `p24_*`
// class names, so everything below is a direct read rather than a guess at
// which ancestor happens to be "the card".
function parseFeedPage(html: string, purpose: "sale" | "rent") {
  const $ = cheerio.load(html);
  const listings: Property24ListingRow[] = [];

  $(".js_resultTile[data-listing-number]").each((_, element) => {
    const tile = $(element);
    const listingNumber = clean(tile.attr("data-listing-number"));
    const href = tile.find('a[href^="/for-sale/"], a[href^="/to-rent/"]').first().attr("href");
    if (!listingNumber || !href) return;

    const price = tile.find(".p24_price").first();
    const size = tile.find(".p24_size").first();
    // `content="620000"` is the machine-readable price; the element's text is
    // the display string "R 620 000". Keep both.
    const priceZar = Number(price.attr("content"));

    listings.push({
      listing_number: listingNumber,
      purpose,
      url: new URL(href, P24_ORIGIN).toString(),
      title: clean(tile.find(".p24_title").first().text()) || null,
      location: clean(tile.find(".p24_location").first().text()) || null,
      excerpt: clean(tile.find(".p24_excerpt").first().text()) || null,
      price_zar: Number.isFinite(priceZar) && priceZar > 0 ? priceZar : null,
      price_label: clean(price.clone().children("meta").remove().end().text()) || null,
      image_url: tileImageUrl(tile),
      bedrooms: featureNumber(tile, "Bedrooms"),
      bathrooms: featureNumber(tile, "Bathrooms"),
      parking: featureNumber(tile, "Parking Spaces"),
      size_label: clean(size.find("span").first().text()) || null,
      // "Floor Size" vs "Erf Size" — meaningfully different numbers.
      size_kind: clean(size.attr("title")) || null,
      agency_name: clean(tile.find('.p24_branding meta[itemprop="name"]').attr("content")) || null,
    });
  });

  // The visible "Next" control is a `javascript:;` stub, so the real page
  // links are the numbered ones, which carry absolute hrefs.
  const pageUrls = $("ul.pagination a[data-pagenumber]")
    .toArray()
    .map((anchor) => $(anchor).attr("href") ?? "")
    .filter((href) => href.startsWith("http"));

  return { listings, pageUrls };
}

async function scrapeFeed(startUrl: string, purpose: "sale" | "rent") {
  const byNumber = new Map<string, Property24ListingRow>();
  const visited = new Set<string>();
  const queue = [startUrl];

  while (queue.length > 0 && visited.size < MAX_PAGES_PER_FEED) {
    const pageUrl = queue.shift()!;
    if (visited.has(pageUrl)) continue;
    visited.add(pageUrl);

    if (visited.size > 1) await sleep(PAGE_DELAY_MS);
    const { listings, pageUrls } = parseFeedPage(await fetchHtml(pageUrl), purpose);

    for (const listing of listings) byNumber.set(listing.listing_number, listing);
    for (const href of pageUrls) {
      if (!visited.has(href) && !queue.includes(href)) queue.push(href);
    }
  }

  return { listings: [...byNumber.values()], pagesFetched: visited.size };
}

export interface Property24ScrapeResult {
  profile: Property24Profile;
  listings: Property24ListingRow[];
  counts: { total: number; sale: number; rent: number };
  pagesFetched: number;
}

export async function scrapeAgent(property24Url: string): Promise<Property24ScrapeResult> {
  const agent = parseAgentProfileUrl(property24Url);

  const profile = parseProfile(await fetchHtml(agent.profileUrl), agent);
  await sleep(PAGE_DELAY_MS);
  const sale = await scrapeFeed(agent.saleUrl, "sale");
  await sleep(PAGE_DELAY_MS);
  const rent = await scrapeFeed(agent.rentUrl, "rent");

  const listings = [...sale.listings, ...rent.listings];

  return {
    profile,
    listings,
    counts: {
      total: listings.length,
      sale: sale.listings.length,
      rent: rent.listings.length,
    },
    pagesFetched: sale.pagesFetched + rent.pagesFetched + 1,
  };
}
